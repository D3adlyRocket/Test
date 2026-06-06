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

function extractQuality(str) {
  const u = (str || "").toLowerCase();
  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  if (u.includes("360")) return "360p";
  return "Unknown";
}

// Helper to look for the streaming link inside the shortener HTML page using multiple selector fallbacks
function parseStreamFromShortenerHtml(htmlContent) {
  if (!htmlContent) return null;
  const $dl = cheerio.load(htmlContent);
  
  // Strategy 1: Check standard dynamic download button href attribute
  let targetUrl = $dl("a.hidden-button.buttonDownloadnew").attr("href");
  
  // Strategy 2: Fallback to any anchor element containing a url redirect string parameter
  if (!targetUrl) {
    $dl("a").each((i, el) => {
      const href = $dl(el).attr("href") || "";
      if (href.includes("url=http")) {
        targetUrl = href;
        return false; // Break loop
      }
    });
  }

  // Strategy 3: Raw regex regex extraction fallback from scripts or variables if HTML layout differs
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

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. Fetch metadata from TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search platform index
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

    // 3. Extract core site parameters
    const showHtml = await (await fetch(pageUrl, { headers: HEADERS})).text();
    const $show = cheerio.load(showHtml);

    const videoId = $show("input#video-id").attr("value");
    if (!videoId) return [];

    const streams = [];

    // 4. Collect video files using the calculated endpoints
    const processResolutionLinks = async (allLinks) => {
      for (const item of allLinks) {
        let url = (item.url || "").trim();
        if (!url) continue;
        
        if (!url.startsWith("http")) {
          url = `${BASE_URL}${url}`;
        }
        
        const declaredQuality = extractQuality(item.res || url);

        if (url.match(/\.(mp4|mkv|m3u8)/i)) {
          streams.push({
            url,
            quality: declaredQuality,
            title: `FibWatch [${declaredQuality}]`,
            subtitles: [],
            headers: PLAYBACK_HEADERS
          });
        } else {
          try {
            const shortenerHtml = await (await fetch(url, { headers: HEADERS })).text();
            const extractedMediaUrl = parseStreamFromShortenerHtml(shortenerHtml);
            
            if (extractedMediaUrl && extractedMediaUrl.startsWith("http")) {
              // Override quality tag if final link explicitly names a different stream resolution profile
              const finalQuality = extractQuality(extractedMediaUrl) !== "Unknown" ? extractQuality(extractedMediaUrl) : declaredQuality;
              
              streams.push({
                url: extractedMediaUrl,
                quality: finalQuality,
                title: `FibWatch [${finalQuality}]`,
                subtitles: [],
                headers: PLAYBACK_HEADERS
              });
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
      // Movies path
      const resUrl = `${BASE_URL}/ajax/resolution_switcher.php?video_id=${videoId}`;
      const resData = await (await fetch(resUrl, { headers: HEADERS})).json();
      const allLinks = [...(resData.current || []), ...(resData.popup || [])];
      await processResolutionLinks(allLinks);
    }

    // Deduplicate streams matching explicit destination urls
    const uniqueStreams = [];
    const seenUrls = new Set();
    for (const entry of streams) {
      if (!seenUrls.has(entry.url)) {
        seenUrls.add(entry.url);
        uniqueStreams.push(entry);
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
