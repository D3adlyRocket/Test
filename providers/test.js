/**
 * flixstream - API Integration Fix
 * Targets the specific /api/stream-links/ endpoint found in DevTools
 */

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// Exact User-Agent from your screenshot
var USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36";

async function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var streams = [];
    
    try {
      // 1. Construct the API URL found in your screenshot
      var apiUrl = `https://www.flixstream.ca/api/stream-links/${tmdbId}?type=${mediaType}`;
      if (mediaType === "tv") {
          apiUrl += `&season=${season}&episode=${episode}`;
      }

      console.log("[FlixStream] Requesting internal API: " + apiUrl);

      // 2. Fetch the actual link list from their API
      var resp = yield fetch(apiUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": `https://www.flixstream.ca/watch/${tmdbId}?type=${mediaType}`,
          "Accept": "*/*",
          "X-Requested-With": "XMLHttpRequest"
        }
      });

      var data = yield resp.json();

      // 3. If the API returns links, process them
      if (data && Array.isArray(data)) {
        data.forEach(item => {
          // If it's a direct m3u8 link (like the 'storm' links you found)
          if (item.url && item.url.includes("m3u8")) {
            streams.push({
              name: `FlixStream - ${item.name || 'Direct'}`,
              url: item.url,
              quality: "1080p",
              headers: {
                "Referer": "https://vidlink.pro/",
                "Origin": "https://vidlink.pro",
                "User-Agent": USER_AGENT
              }
            });
          } else if (item.url) {
            // If it's an embed URL, we try to return it in a way the player understands
            streams.push({
              name: `FlixStream - ${item.name || 'Embed'}`,
              url: item.url,
              quality: "HD",
              headers: { "Referer": "https://www.flixstream.ca/", "User-Agent": USER_AGENT }
            });
          }
        });
      }
    } catch (e) {
      console.log("[FlixStream] API Fetch failed: " + e.message);
    }

    // 4. Fallback Logic: Brute-force build the VidLink embed if the API returns nothing (2nd screenshot issue)
    if (streams.length === 0) {
      var fallbackUrl = mediaType === "movie" 
        ? `https://vidlink.pro/movie/${tmdbId}` 
        : `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`;

      streams.push({
        name: "VidLink (Direct Embed)",
        url: fallbackUrl,
        headers: {
          "Referer": "https://vidlink.pro/",
          "User-Agent": USER_AGENT
        }
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
