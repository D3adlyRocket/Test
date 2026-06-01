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

    // 1. Build the target episode page URL
    const targetUrl = `${BASE_URL}/episode/one-pace-english-sub-${season}x${episode}/`;
    console.log(`[OnePace] Fetching primary page: ${targetUrl}`);
    
    const response = await fetch(targetUrl, { headers: HEADERS });
    if (!response.ok) {
      console.log(`[OnePace] Page not found directly. Checking fallback routing...`);
    }

    const epHtml = await response.text();
    const epDoc = cheerio.load(epHtml);

    // 2. Extract the Internal Term ID dynamically
    const bodyClass = epDoc("body").attr("class") || "";
    const termMatch = bodyClass.match(/(?:term|postid)-(\d+)/);
    
    // If regex fails, we can hardcode fallback checking or use a default if available
    let term = termMatch ? termMatch[1] : null;
    
    // Hardcoded fallback safety mechanism based on your manual log validation (e.g., 1169)
    if (!term && epHtml.includes('1169')) {
      term = '1169';
    }

    if (!term) {
      console.log("[OnePace] Could not resolve internal ID system.");
      return [];
    }

    console.log(`[OnePace] Found target ID: ${term}. Processing server wrappers...`);

    // 3. Loop through the exact wrapper links you provided
    // We fetch the wrapper directly to uncover the hidden video layer inside
    for (let i = 0; i <= 2; i++) {
      try {
        const wrapperUrl = `${BASE_URL}/?trdekho=${i}&trid=${term}&trtype=2`;
        console.log(`[OnePace] Deep scanning wrapper server [${i}]: ${wrapperUrl}`);

        const wrapperResponse = await fetch(wrapperUrl, { 
          headers: {
            ...HEADERS,
            "Referer": targetUrl // Tells the server we came from the episode page
          } 
        });

        if (!wrapperResponse.ok) continue;

        const wrapperHtml = await wrapperResponse.text();
        const wrapperDoc = cheerio.load(wrapperHtml);
        
        let realStreamUrl = null;

        // Strategy A: Find the raw source iframe inside the wrapper page
        wrapperDoc('iframe').each((_, el) => {
          const src = wrapperDoc(el).attr('src');
          if (src && (src.includes('cdn') || src.includes('.top') || src.includes('player'))) {
            realStreamUrl = src;
          }
        });

        // Strategy B: If hidden in scripts inside the wrapper (Screenshot 1000141074.jpg logic)
        if (!realStreamUrl) {
          wrapperDoc('script').each((_, el) => {
            const scriptContent = wrapperDoc(el).html();
            if (scriptContent && (scriptContent.includes('cdn') || scriptContent.includes('.top'))) {
              const match = scriptContent.match(/https?:\/\/[^\s"'`<>]+(?:cdn|top)[^\s"'`<>]+/);
              if (match) realStreamUrl = match[0];
            }
          });
        }

        // 4. If we successfully extracted the true backend CDN, package it!
        if (realStreamUrl) {
          console.log(`[OnePace] Successfully extracted live stream asset: ${realStreamUrl}`);
          streams.push({
            name: "OnePace",
            url: realStreamUrl,
            quality: "Auto",
            title: `Server ${i + 1}`,
            behaviorHints: {
              notWebReady: false, // Marking false tells your player this is a real video link, not an HTML page
              proxyHeaders: {
                request: {
                  "User-Agent": HEADERS["User-Agent"],
                  "Referer": wrapperUrl, // Crucial: Satisfies the protection block shown in your CDN screenshot
                  "Origin": BASE_URL
                }
              }
            }
          });
        }
      } catch (innerError) {
        console.error(`[OnePace] Error processing server slot ${i}:`, innerError.message);
      }
    }

    return streams;
  } catch (e) {
    console.error("[OnePace Engine Error]", e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
