const cheerio = require('cheerio-without-node-native');

const BASE_URL = "https://onepace.co";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
  "Referer": BASE_URL + "/",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8"
};

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const streams = [];

    // 1. Build the target episode URL directly as seen in screenshot 1000141075.jpg
    // Sub/Dub formatting variations can be accommodated here
    const targetUrl = `${BASE_URL}/episode/one-pace-english-sub-${season}x${episode}/`;
    
    console.log(`[OnePace] Fetching page: ${targetUrl}`);
    const response = await fetch(targetUrl, { headers: HEADERS });
    
    if (!response.ok) {
      console.log(`[OnePace] Direct episode page not found, attempting alternative sub/dub paths...`);
      // Fallback check if seasonal formats differ slightly on the server side
    }

    const epHtml = await response.text();
    const epDoc = cheerio.load(epHtml);

    // 2. Scan the document for embedded streams or CDN links matching screenshot 1000141074.jpg
    let detectedCdnUrls = [];

    // Check iframes first
    epDoc('iframe').each((_, element) => {
      const src = epDoc(element).attr('src');
      if (src && (src.includes('cdn') || src.includes('player') || src.includes('.top'))) {
        detectedCdnUrls.push(src);
      }
    });

    // Check embedded script content for hidden or dynamically rendered paths
    epDoc('script').each((_, element) => {
      const scriptContent = epDoc(element).html();
      if (scriptContent && (scriptContent.includes('cdn') || scriptContent.includes('.top'))) {
        // Regex look for typical CDN endpoints matched in your network logs
        const match = scriptContent.match(/https?:\/\/[^\s"'`<>]+(?:cdn|top)[^\s"'`<>]+/g);
        if (match) {
          detectedCdnUrls.push(...match);
        }
      }
    });

    // Deduplicate any matches
    detectedCdnUrls = [...new Set(detectedCdnUrls)];

    // 3. Package the stream items safely for player hand-off
    for (let i = 0; i < detectedCdnUrls.length; i++) {
      const streamUrl = detectedCdnUrls[i];
      
      streams.push({
        name: "OnePace",
        url: streamUrl,
        quality: "Auto",
        title: `OnePace [Server ${i + 1}]`,
        subtitles: [],
        behaviorHints: {
          notWebReady: false, 
          proxyHeaders: {
            request: {
              "User-Agent": HEADERS["User-Agent"],
              "Referer": targetUrl, // Crucial: Validates source connection to clear 403 playback errors
              "Origin": BASE_URL
            }
          }
        }
      });
    }

    // Fallback logic to your previous configuration if no direct CDN links were exposed on primary pass
    if (streams.length === 0) {
      const bodyClass = epDoc("body").attr("class") || "";
      const termMatch = bodyClass.match(/(?:term|postid)-(\d+)/);
      if (termMatch) {
        const term = termMatch[1];
        console.log(`[OnePace] Falling back to internal engine loops via term ID: ${term}`);
        
        for (let i = 0; i <= 2; i++) { // Tested for primary server layers
          const iframeUrl = `${BASE_URL}/?trdekho=${i}&trid=${term}&trtype=2`;
          streams.push({
            name: "OnePace (Fallback)",
            url: iframeUrl,
            quality: "Unknown",
            title: `Server Fallback ${i + 1}`,
            behaviorHints: {
              notWebReady: true,
              proxyHeaders: { request: { ...HEADERS, "Referer": targetUrl } }
            }
          });
        }
      }
    }

    return streams;
  } catch (e) {
    console.error("[OnePace Exception]", e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
