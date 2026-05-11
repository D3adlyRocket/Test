/**
 * flixstream - Direct Resolver Fix
 * Targets the specific stream structures provided by the user.
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
    
    // Logic for VidLink Pro / VidKing (The storm.vodvidl.site links)
    try {
      // We target the internal API that generates those specific links
      const vidlinkTarget = mediaType === "movie" ? tmdbId : `${tmdbId}/${season}/${episode}`;
      const apiUrl = `https://vidlink.pro/api/embed/source/${vidlinkTarget}`;
      
      const response = yield fetch(apiUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          "Referer": "https://vidlink.pro/",
          "Accept": "application/json"
        }
      });

      const data = yield response.json();

      if (data && data.sources) {
        data.sources.forEach(source => {
          // This creates the direct .m3u8 link with the required proxy headers
          streams.push({
            name: "FlixStream - VidLink Pro",
            url: source.url, // This will be the storm.vodvidl.site link
            title: source.name || "Auto Quality",
            quality: "1080p",
            headers: {
              "Referer": "https://videostr.net/",
              "Origin": "https://videostr.net",
              "User-Agent": USER_AGENT
            }
          });
        });
      }
    } catch (e) {
      console.log("VidLink Resolver failed: " + e.message);
    }

    // Logic for MoviesAPI / VidSrc (The bx.netrocdn.site links)
    try {
      const vidsrcUrl = mediaType === "movie" 
        ? `https://vidsrc.to/embed/movie/${tmdbId}`
        : `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`;

      const vsResp = yield fetch(vidsrcUrl, { headers: { "User-Agent": USER_AGENT } });
      const vsHtml = yield vsResp.text();

      // Look for the source ID in the HTML to build the direct .m3u8 link
      const srcIdMatch = vsHtml.match(/id=["']([^"']+)["']/);
      if (srcIdMatch) {
         streams.push({
           name: "FlixStream - VidSrc",
           url: `https://bx.netrocdn.site/hls2/master.m3u8?id=${srcIdMatch[1]}`,
           headers: { "Referer": "https://vidsrc.to/", "User-Agent": USER_AGENT }
         });
      }
    } catch (e) {
      console.log("VidSrc Resolver failed");
    }

    // FINAL CHECK: If we failed to get direct links, we provide the embed as a last resort
    if (streams.length === 0) {
      streams.push({
        name: "FlixStream (Embed Fallback)",
        url: `https://vidlink.pro/${mediaType}/${tmdbId}`,
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
