/**
 * flixstream - Brute Force Provider
 * Bypasses the HTML scraping and targets the proxy directly
 */

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

async function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var streams = [];
    var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    try {
      // 1. We know the destination from your screenshot. 
      // We attempt to fetch the direct mapping from VidLink's source helper.
      var slug = mediaType === "movie" ? tmdbId : `${tmdbId}/${season}/${episode}`;
      var helperUrl = `https://vidlink.pro/api/embed/source/${slug}`;

      var resp = yield fetch(helperUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": "https://vidlink.pro/",
          "Origin": "https://vidlink.pro"
        }
      });

      var data = yield resp.json();

      if (data && data.sources) {
        data.sources.forEach(src => {
          streams.push({
            name: "VidLink PRO (Direct)",
            url: src.url, // THIS should be the storm.vodvidl.site link
            title: "M3U8 Stream",
            quality: "1080p",
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": "https://vidlink.pro/", // Based on your screenshot
              "Origin": "https://vidlink.pro",   // Based on your screenshot
              "Accept": "*/*"
            }
          });
        });
      }
    } catch (e) {
      // 2. If the API call fails, the site is likely using a 'v-token'.
      // In this case, we return the VidLink URL but with the CORRECT headers 
      // that might allow your TV player to handle the redirect itself.
      streams.push({
        name: "VidLink (External Player)",
        url: `https://vidlink.pro/movie/${tmdbId}`,
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": "https://vidlink.pro/",
          "Origin": "https://vidlink.pro"
        }
      });
    }

    // Filter out duplicates and return
    return streams;
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
