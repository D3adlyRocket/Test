/**
 * flixstream - Fixed Nuvio Provider
 * Logic: Extracts direct stream links or high-quality embed links with correct headers.
 */

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

var BASE_URL = "https://www.flixstream.ca";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

var BASE_HEADERS = {
  "User-Agent": USER_AGENT,
  "Referer": BASE_URL + "/",
  "Accept": "*/*",
};

// Helper to extract nested M3U8 from complex strings (like your Vidsrc example)
function extractM3U8(text) {
  var m3u8Regex = /(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/gi;
  var matches = text.match(m3u8Regex);
  if (matches) {
    // Decode URI components in case the URL is URL-encoded inside a parameter
    return matches.map(m => decodeURIComponent(m));
  }
  return [];
}

async function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log(`[FlixStream] Resolving: ${mediaType} ${tmdbId}`);
    var streams = [];

    try {
      // 1. Construct the FlixStream Watch URL
      var watchUrl = mediaType === "movie" 
        ? `${BASE_URL}/watch/${tmdbId}?type=movie` 
        : `${BASE_URL}/watch/${tmdbId}?type=tv&episode=${episode || 1}&season=${season || 1}`;

      var resp = yield fetch(watchUrl, { headers: BASE_HEADERS });
      var html = yield resp.text();

      // 2. Identify potential stream sources from the HTML
      // We look for direct .m3u8 links first, then embed URLs
      var potentialUrls = extractM3U8(html);
      
      // Also look for the standard embed patterns
      var embedPattern = /src=["'](https?:\/\/[^"']+(?:vidlink|vidsrc|vidking|autoembed|anyembed|bx\.netrocdn)[^"']+)["']/gi;
      var match;
      while ((match = embedPattern.exec(html)) !== null) {
        potentialUrls.push(match[1]);
      }

      // 3. Process each found URL
      for (let url of [...new Set(potentialUrls)]) {
        let name = "FlixStream - Direct";
        let headers = { ...BASE_HEADERS };

        // Handle specific provider logic/headers based on your provided samples
        if (url.includes("vodvidl.site") || url.includes("videostr.net")) {
          name = "VidLink Pro (HLS)";
          headers["Origin"] = "https://videostr.net";
          headers["Referer"] = "https://videostr.net/";
        } else if (url.includes("lookmovie2.skin")) {
          name = "2Embed / LookMovie";
        } else if (url.includes("anyembed.xyz")) {
          name = "AnyEmbed";
          headers["Referer"] = "https://flixcdn.cyou/";
        } else if (url.includes("netrocdn.site") || url.includes("moviesapi")) {
          name = "MoviesAPI / Vidsrc";
        }

        // If it's a direct m3u8, add it as a playable stream
        if (url.includes(".m3u8")) {
            streams.push({
                name: name,
                title: "Multi-Quality",
                url: url,
                quality: url.includes("1080") ? "1080p" : "720p",
                headers: headers
            });
        } else {
            // If it's an iframe URL, we pass it through. 
            // Note: Some players requires this to be the final video URL.
            streams.push({
                name: name + " (Embed)",
                title: "External Player",
                url: url,
                quality: "Unknown",
                headers: headers
            });
        }
      }

      // 4. Fallback: If page scrape fails, manually build known working embeds
      if (streams.length === 0) {
        console.log("[FlixStream] No direct streams found, using fallbacks");
        const fallbacks = [
            { n: "VidLink", u: `https://vidlink.pro/${mediaType}/${tmdbId}${mediaType === 'tv' ? `/${season}/${episode}` : ''}` },
            { n: "VidSrc", u: `https://vidsrc.to/embed/${mediaType}/${tmdbId}${mediaType === 'tv' ? `/${season}/${episode}` : ''}` }
        ];
        
        fallbacks.forEach(f => {
            streams.push({
                name: f.n,
                url: f.u,
                quality: "HD",
                headers: { "Referer": BASE_URL }
            });
        });
      }

      return streams;
    } catch (e) {
      console.error("[FlixStream] Error fetching streams:", e);
      return [];
    }
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
