/**
 * flixstream - Deep Scraper Fix
 * Mimics a browser to extract the hidden 'storm' links.
 */

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var streams = [];
    
    // 1. Build the actual Player URL (not the API)
    var playerUrl = mediaType === "movie" 
      ? `https://vidlink.pro/movie/${tmdbId}` 
      : `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`;

    try {
      console.log("[FlixStream] Deep scraping player: " + playerUrl);
      
      // 2. Fetch the player page HTML
      var resp = yield fetch(playerUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": "https://www.flixstream.ca/"
        }
      });
      var html = yield resp.text();

      // 3. Search for the 'storm.vodvidl.site' pattern directly in the HTML
      // Often these links are in a <script> tag or a data-attribute
      var stormRegex = /https:\/\/storm\.vodvidl\.site\/proxy\/[^"'\s]+/g;
      var matches = html.match(stormRegex);

      if (matches && matches.length > 0) {
        [...new Set(matches)].forEach(url => {
          streams.push({
            name: "VidLink Pro (Direct)",
            url: url.replace(/&amp;/g, '&'),
            title: "M3U8 Stream",
            quality: "1080p",
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": "https://vidlink.pro/",
              "Origin": "https://vidlink.pro"
            }
          });
        });
      }

      // 4. Secondary Check: Look for encoded Base64 strings (VidLink sometimes hides URLs here)
      if (streams.length === 0) {
          var b64Regex = /["']([A-Za-z0-9+/]{50,})["']/g;
          var bMatch;
          while ((bMatch = b64Regex.exec(html)) !== null) {
              try {
                  var decoded = atob(bMatch[1]);
                  if (decoded.includes("m3u8") || decoded.includes("storm")) {
                      var urlMatch = decoded.match(/https?:\/\/[^"'\s]+/);
                      if (urlMatch) {
                          streams.push({
                              name: "VidLink Pro (Decoded)",
                              url: urlMatch[0],
                              headers: { "Referer": "https://vidlink.pro/" }
                          });
                      }
                  }
              } catch(e) {}
          }
      }

    } catch (e) {
      console.error("[FlixStream] Scrape failed: " + e.message);
    }

    // 5. Final fallback (If everything else fails, we give the embed URL)
    if (streams.length === 0) {
        console.log("[FlixStream] No direct links found, returning embed.");
        streams.push({
            name: "VidLink (Embed)",
            url: playerUrl,
            headers: { "Referer": "https://vidlink.pro/" }
        });
    }

    return streams;
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
