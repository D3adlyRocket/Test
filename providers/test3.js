const cheerio = require('cheerio-without-node-native');

// fibwatch.js
const BASE_URL = "https://fibwatch.art";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const BROWSER_UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36";

const HEADERS = {
  "User-Agent": BROWSER_UA,
  "Referer": `${BASE_URL}/`
};

const PLAYBACK_HEADERS = {
  "User-Agent": BROWSER_UA,
  "Referer": "https://urlshortlink.top/",
  "Origin": "https://urlshortlink.top"
};

// FIXED QUALITY ENGINE: Returns "Auto" if no resolution strings exist
function extractQuality(str) {
  const u = (str || "").toLowerCase();
  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  if (u.includes("360")) return "360p";
  return "Auto";
}

function parseStreamFromShortenerHtml(htmlContent) {
  if (!htmlContent) return null;
  const $dl = cheerio.load(htmlContent);
  let targetUrl = $dl("a.hidden-button.buttonDownloadnew").attr("href");
  
  if (!targetUrl) {
    $dl("a").each((i, el) => {
      const href = $dl(el).attr("href") || "";
      if (href.includes("url=http")) {
        targetUrl = href;
        return false;
      }
    });
  }
  
  if (!targetUrl) {
    const rawRegex = /https?:\/\/[^\s"'`<>]+?\.b-cdn\.net\/[^\s"'`<>]+\.(?:mkv|mp4|m3u8)/i;
    const match = htmlContent.match(rawRegex);
    if (match) return match[0];
  }
  
  if (targetUrl) {
    let cleaned = targetUrl.replace(/.*url=/, "").trim();
    return decodeURIComponent(cleaned);
  }
  return null;
}

// Parses sizes dynamically from the URL or stream string contexts
function extractFileSize(str) {
  const checkString = (str || "");
  const sizeMatch = checkString.match(/(\d+(?:\.\d+)?\s*[GgMm][Bb])/);
  if (sizeMatch) {
     return sizeMatch[1].toUpperCase();
  }
  return "Dynamic Size";
}

// Dynamic info row collector parsing codec tags directly out of link components
function extractReleaseInfo(str) {
  const checkString = (str || "");
  const tags = [];
  
  if (/web-?rip|web-?dl|bluray|hdrip/i.test(checkString)) {
    const m = checkString.match(/(web-?rip|web-?dl|bluray|hdrip)/i);
    if (m) tags.push(m[1].toUpperCase().replace('-', ''));
  }
  if (/x264|h264|x265|hevc/i.test(checkString)) {
    const m = checkString.match(/(x264|h264|x265|hevc)/i);
    if (m) tags.push(m[1].toLowerCase());
  }
  if (/5\.1|7\.1|aac|ddp/i.test(checkString)) {
    const m = checkString.match(/(5\.1|7\.1|aac|ddp)/i);
    if (m) tags.push(m[1]);
  }
  
  return tags.length > 0 ? tags.join(" • ") : "Mirror Link";
}

function generateStreamLayout(url, title, declaredQuality, mediaInfo, isTV, season, episode) {
  const name = mediaInfo.title || mediaInfo.name || "Unknown Title";
  const dateStr = mediaInfo.release_date || mediaInfo.first_air_date || "";
  const year = dateStr ? dateStr.split("-")[0] : "N/A";
  const lowerUrl = url.toLowerCase();
  
  let audioType = "Original Audio"; // Fixed capitalization
  let language = "Hindi";
  
  if (lowerUrl.includes("dual")) {
    audioType = "Dual-Audio";
    language = "Hindi / English";
  } else if (lowerUrl.includes("multi")) {
    audioType = "Multi-Audio";
    language = "Multilingual";
  } else if (lowerUrl.includes("bangla")) {
    language = "Bangla";
  } else if (lowerUrl.includes("tamil")) {
    language = "Tamil";
  } else if (lowerUrl.includes("telugu")) {
    language = "Telugu";
  }
  
  let format = "MKV";
  if (lowerUrl.includes(".mp4")) format = "MP4";
  if (lowerUrl.includes(".m3u8")) format = "M3U8 / HLS";
  
  let duration = "N/A";
  if (isTV) {
    duration = mediaInfo.episode_run_time?.[0] ? `${mediaInfo.episode_run_time[0]} min` : "45 min";
  } else {
    duration = mediaInfo.runtime ? `${mediaInfo.runtime} min` : "N/A";
  }
  
  const parsedSize = extractFileSize(url);
  const releaseInfo = extractReleaseInfo(url);

  // FIXED INTERFACE HEADER: Synchronized parameters completely to remove trailing leakage
  const displayTitle = `FibWatch | ${declaredQuality} | ${audioType}`;
  
  const nameRow = isTV ? `🎬 ${name} - S${season}E${episode} (${year})` : `🎬 ${name} - ${year}`;
  const metaRow = `⚡ ${declaredQuality.toUpperCase()} | 🌍 ${language} | 💾 ${parsedSize}`;
  const formatRow = `🎞️ ${format} | ⏱️ ${duration} | 📌 ${releaseInfo}`;
  const fullDescription = `${nameRow}\n${metaRow}\n${formatRow}`;
  
  return {
    name: displayTitle,
    title: displayTitle,
    description: fullDescription,
    shortDescription: `${nameRow} • ${metaRow}`,
    episodeDescription: fullDescription,
    tags: [nameRow, metaRow, formatRow],
    extra: { info: [nameRow, metaRow, formatRow] },
    quality: declaredQuality, 
    url: url,
    subtitles: [],
    headers: PLAYBACK_HEADERS
  };
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];
    
    const searchUrl = `${BASE_URL}/search?keyword=${encodeURIComponent(title)}&page_id=1`;
    const searchHtml = await (await fetch(searchUrl, { headers: HEADERS})).text();
    const $ = cheerio.load(searchHtml);
    const results = [];
    
    $("div.video-thumb").each((i, el) => {
      const href = $("a", el).attr("href");
      const t = $("p.hptag", el).text().trim() || $("div.video-thumb img", el).attr("alt") || "";
      if (href) results.push({ title: t, url: href });
    });
    
    if (!results.length) return [];
    
    const isTV = mediaType === "tv";
    const lcTitle = title.toLowerCase();
    let match = results.find(r => r.title.toLowerCase().includes(lcTitle));
    if (!match) match = results[0];
    
    const pageUrl = match.url.startsWith("http") ? match.url : `${BASE_URL}${match.url}`;
    const showHtml = await (await fetch(pageUrl, { headers: HEADERS})).text();
    const $show = cheerio.load(showHtml);
    const videoId = $show("input#video-id").attr("value");
    if (!videoId) return [];
    
    const rawStreams = [];
    
    const processResolutionLinks = async (allLinks) => {
      for (const item of allLinks) {
        let url = (item.url || "").trim();
        if (!url) continue;
        if (!url.startsWith("http")) {
          url = `${BASE_URL}${url}`;
        }
        
        const declaredQuality = extractQuality(item.res || url);
        
        if (url.match(/\.(mp4|mkv|m3u8)/i)) {
          rawStreams.push({ url, quality: declaredQuality });
        } else {
          try {
            const shortenerHtml = await (await fetch(url, { headers: HEADERS })).text();
            const extractedMediaUrl = parseStreamFromShortenerHtml(shortenerHtml);
            if (extractedMediaUrl && extractedMediaUrl.startsWith("http")) {
              const finalQuality = extractQuality(extractedMediaUrl) !== "Auto" ? extractQuality(extractedMediaUrl) : declaredQuality;
              rawStreams.push({ url: extractedMediaUrl, quality: finalQuality });
            }
          } catch (e) {}
        }
      }
    };
    
    if (isTV) {
      const epDataUrl = `${BASE_URL}/ajax/episodes.php?video_id=${videoId}`;
      const epData = await (await fetch(epDataUrl, { headers: HEADERS})).json();
      const episodes = epData.episodes || [];
      if (!episodes.length) return [];
      
      let targetEpUrl = "";
      for (const ep of episodes) {
        const epTitle = (ep.title || "").toLowerCase();
        const m = epTitle.match(/s(\d{1,2})e(\d{1,3})/);
        if (m) {
          const epSeason = parseInt(m[1]);
          const epEpisode = parseInt(m[2]);
          if (epSeason === season && epEpisode === episode) {
            targetEpUrl = ep.url ? (ep.url.startsWith("http") ? ep.url : `${BASE_URL}${ep.url}`) : "";
            break;
          }
        }
      }
      
      if (!targetEpUrl && episodes.length > 0) {
        targetEpUrl = episodes[0].url ? (episodes[0].url.startsWith("http") ? episodes[0].url : `${BASE_URL}${episodes[0].url}`) : "";
      }
      if (!targetEpUrl) return [];
      
      const epHtml = await (await fetch(targetEpUrl, { headers: HEADERS})).text();
      const $ep = cheerio.load(epHtml);
      const epVideoId = $ep("input#video-id").attr("value");
      if (epVideoId) {
        const resUrl = `${BASE_URL}/ajax/resolution_switcher.php?video_id=${epVideoId}`;
        const resData = await (await fetch(resUrl, { headers: HEADERS})).json();
        const allLinks = [...(resData.current || []), ...(resData.popup || [])];
        await processResolutionLinks(allLinks);
      }
    } else {
      const resUrl = `${BASE_URL}/ajax/resolution_switcher.php?video_id=${videoId}`;
      const resData = await (await fetch(resUrl, { headers: HEADERS})).json();
      const allLinks = [...(resData.current || []), ...(resData.popup || [])];
      await processResolutionLinks(allLinks);
    }
    
    const uniqueStreams = [];
    const seenUrls = new Set();
    for (const entry of rawStreams) {
      if (!seenUrls.has(entry.url)) {
        seenUrls.add(entry.url);
        const formattedLayout = generateStreamLayout(
          entry.url,
          title,
          entry.quality,
          mediaInfo,
          isTV,
          season,
          episode
        );
        uniqueStreams.push(formattedLayout);
      }
    }
    return uniqueStreams;
  } catch (e) {
    console.error("[FibWatch]", e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
