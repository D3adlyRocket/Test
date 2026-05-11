/**
 * flixstream - Nuvio Provider (Fixed via DevTools Intel)
 * Targeted for: VidLink Pro / Storm Proxy
 */

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// Use the exact User-Agent from your screenshot for consistency
var USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36";

async function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var streams = [];
    
    try {
      // 1. Target VidLink's internal source API
      var targetId = mediaType === "movie" ? tmdbId : `${tmdbId}/${season}/${episode}`;
      var apiUrl = `https://vidlink.pro/api/embed/source/${targetId}`;
      
      console.log("[FlixStream] Calling VidLink API: " + apiUrl);
      
      var resp = yield fetch(apiUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": "https://vidlink.pro/",
          "Origin": "https://vidlink.pro",
          "Accept": "application/json"
        }
      });
      
      var data = yield resp.json();
      
      if (data && data.sources) {
        data.sources.forEach(source => {
          // 2. Build the stream object with the EXACT headers from your screenshot
          streams.push({
            name: "VidLink Pro (Fixed)",
            url: source.url, // This is the storm.vodvidl.site link
            title: source.name || "HD",
            quality: "1080p",
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": "https://vidlink.pro/",
              "Origin": "https://vidlink.pro",
              "Accept": "*/*",
              "Sec-Fetch-Mode": "cors",
              "Sec-Fetch-Site": "cross-site"
            }
          });
        });
      }
    } catch (e) {
      console.error("[FlixStream] Error: " + e.message);
    }

    // 3. Fallback: Standard Embed (Only if API fails)
    if (streams.length === 0) {
        streams.push({
            name: "VidLink (Embed)",
            url: `https://vidlink.pro/${mediaType}/${tmdbId}${mediaType === 'tv' ? `/${season}/${episode}` : ''}`,
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
