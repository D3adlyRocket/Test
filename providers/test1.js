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
  return "";
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

    // 4. Extract TV streams or Movie streams
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
        
        for (const item of allLinks) {
          const url = (item.url || "").trim();
          if (!url) continue;
          
          if (url.match(/\.(mp4|mkv|m3u8)/i)) {
            const fallbackQual = extractQuality(item.res || url) || "Unknown";
            streams.push({
              url,
              quality: fallbackQual,
              title: `FibWatch [${fallbackQual}]`,
              subtitles: [],
              headers: PLAYBACK_HEADERS
            });
          } else {
            try {
              const dlHtml = await (await fetch(url, { headers: HEADERS})).text();
              const $dl = cheerio.load(dlHtml);
              
              $dl("a.hidden-button.buttonDownloadnew").each((idx, element) => {
                const onclick = $dl(element).attr("href") || "";
                let dlUrl = onclick.replace(/.*url=/, "").trim();
                
                if (dlUrl) {
                  dlUrl = decodeURIComponent(dlUrl);
                  if (dlUrl.startsWith("http")) {
                    const dynamicLabel = $dl(element).text() || item.res || dlUrl;
                    // Fall back to item.res or raw link structure strings if text extraction yields empty values
                    const determinedQuality = extractQuality(dynamicLabel) || extractQuality(item.res) || extractQuality(dlUrl) || "Unknown";
                    
                    streams.push({
                      url: dlUrl,
                      quality: determinedQuality,
                      title: `FibWatch [${determinedQuality}]`,
                      subtitles: [],
                      headers: PLAYBACK_HEADERS
                    });
                  }
                }
              });
            } catch (e) {}
          }
        }
      }
    } else {
      // Movies track processing
      const resUrl = `${BASE_URL}/ajax/resolution_switcher.php?video_id=${videoId}`;
      const resData = await (await fetch(resUrl, { headers: HEADERS})).json();
      const allLinks = [...(resData.current || []), ...(resData.popup || [])];

      for (const item of allLinks) {
        const url = (item.url || "").trim();
        if (!url) continue;
        
        if (url.match(/\.(mp4|mkv|m3u8)/i)) {
          const fallbackQual = extractQuality(item.res || url) || "Unknown";
          streams.push({
            url,
            quality: fallbackQual,
            title: `FibWatch [${fallbackQual}]`,
            subtitles: [],
            headers: PLAYBACK_HEADERS
          });
        } else {
          try {
            const dlHtml = await (await fetch(url, { headers: HEADERS})).text();
            const $dl = cheerio.load(dlHtml);
            
            $dl("a.hidden-button.buttonDownloadnew").each((idx, element) => {
              const onclick = $dl(element).attr("href") || "";
              let dlUrl = onclick.replace(/.*url=/, "").trim();
              
              if (dlUrl) {
                dlUrl = decodeURIComponent(dlUrl);
                if (dlUrl.startsWith("http")) {
                  const dynamicLabel = $dl(element).text() || item.res || dlUrl;
                  const determinedQuality = extractQuality(dynamicLabel) || extractQuality(item.res) || extractQuality(dlUrl) || "Unknown";
                  
                  streams.push({
                    url: dlUrl,
                    quality: determinedQuality,
                    title: `FibWatch [${determinedQuality}]`,
                    subtitles: [],
                    headers: PLAYBACK_HEADERS
                  });
                }
              }
            });
          } catch (e) {}
        }
      }

      // Final fallback layer parsing landing view source directly
      if (streams.length === 0) {
        const dlBtn = $show("a.hidden-button.buttonDownloadnew").attr("href") || "";
        let dlUrl = dlBtn.replace(/.*url=/, "").trim();
        
        if (dlUrl) {
          dlUrl = decodeURIComponent(dlUrl);
          if (dlUrl.startsWith("http")) {
            const fallbackQual = extractQuality(dlUrl) || "Unknown";
            streams.push({
              url: dlUrl,
              quality: fallbackQual,
              title: `FibWatch [${fallbackQual}]`,
              subtitles: [],
              headers: PLAYBACK_HEADERS
            });
          }
        }
      }
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
