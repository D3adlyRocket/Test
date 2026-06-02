const cheerio = require('cheerio-without-node-native');

// Production Configurations matched against working Kotlin client parameters
const BASE_URL = "https://onepace.co"; 
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
  "Referer": BASE_URL + "/",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8"
};

/**
 * Scrapes and extracts playable stream objects for OnePace.
 * * @param {string} tmdbId - TMDB Identification Number
 * @param {string} mediaType - "tv" or "movie"
 * @param {string|number} season - Target Season Number
 * @param {string|number} episode - Target Episode Number
 * @returns {Promise<Array>} Array of clean stream objects configuration payloads
 */
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const streams = [];

    // 1. Establish structural path for the targeted episode content block
    const targetUrl = `${BASE_URL}/episode/one-pace-english-sub-${season}x${episode}/`;
    
    const response = await fetch(targetUrl, { headers: HEADERS });
    if (!response.ok) {
       // Secondary validation fallback if season formatting requires normalization
       return [];
    }

    const epHtml = await response.text();
    const epDoc = cheerio.load(epHtml);

    // 2. Resolve internal identification routing node (Term tracking key matching Kotlin regex pattern)
    const bodyClass = epDoc("body").attr("class") || "";
    const termMatch = bodyClass.match(/(?:term|postid)-(\d+)/);
    if (!termMatch) {
      return [];
    }
    const term = termMatch[1];

    // 3. Cycle parameters recursively over trtypes 2 & 1 to locate functional streaming layers
    const targetTypes = [2, 1]; 

    for (const trtype of targetTypes) {
      // Loop ranges 0 to 4 matching the index framework inside the source Cloudstream code structure
      for (let i = 0; i <= 4; i++) {
        try {
          const wrapperUrl = `${BASE_URL}/?trdekho=${i}&trid=${term}&trtype=${trtype}`;
          
          const wrapperRes = await fetch(wrapperUrl, { 
            headers: { 
              ...HEADERS, 
              "Referer": targetUrl 
            } 
          });
          if (!wrapperRes.ok) continue;

          const wrapperHtml = await wrapperRes.text();
          const wrapperDoc = cheerio.load(wrapperHtml);
          
          // Identify live embedded stream pointer
          const iframeSrc = wrapperDoc("iframe").attr("src");
          if (!iframeSrc || !iframeSrc.startsWith("http")) continue;

          // Process and unpack common content distributor network paths (e.g., as-cdn23.top)
          let playerUrl = iframeSrc;
          
          // Verify if player target link is ready or flags additional downstream parsing requirements
          const isDirectStream = !(iframeSrc.includes('trdekho') || iframeSrc.includes('player.php'));

          streams.push({
            name: "OnePace",
            url: playerUrl,
            quality: "Auto",
            title: `Server ${i + 1} [Type-${trtype}]`,
            subtitles: [],
            behaviorHints: {
              notWebReady: !isDirectStream,
              proxyHeaders: {
                request: {
                  "User-Agent": HEADERS["User-Agent"],
                  "Referer": wrapperUrl, // Explicitly clears downstream 403 authorization lockouts
                  "Origin": BASE_URL
                }
              }
            }
          });
        } catch (innerErr) {
          // Silent catch to let sequential server threads finish processing seamlessly
        }
      }
      
      // Stop looping through fallback types if primary server sweeps discover valid player links
      if (streams.length > 0) break;
    }

    return streams;
  } catch (e) {
    console.error("[OnePace Production Module Failure]", e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
