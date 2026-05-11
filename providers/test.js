/**
 * flixstream - Comprehensive Fixed Provider
 * Includes: VidLink, VidKing, AnyEmbed, 2Embed, MoviesAPI
 */

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

async function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var streams = [];
    var watchUrl = `https://www.flixstream.ca/watch/${tmdbId}?type=${mediaType}${mediaType === 'tv' ? `&episode=${episode}` : ''}`;

    try {
      // Fetch the page to find the current active tokens/proxies
      var resp = yield fetch(watchUrl, { headers: { "User-Agent": USER_AGENT, "Referer": "https://www.flixstream.ca/" } });
      var html = yield resp.text();

      // REGEX to find the specific patterns from the links you provided
      var patterns = [
        { name: "VidLink/VidKing Pro", regex: /https:\/\/storm\.vodvidl\.site\/proxy\/[^"'\s]+/g },
        { name: "2Embed", regex: /https:\/\/lookmovie2\.skin\/stream\/[^"'\s]+/g },
        { name: "AnyEmbed", regex: /https:\/\/api\.anyembed\.xyz\/api\/proxy\?url=[^"'\s]+/g },
        { name: "MoviesAPI", regex: /https:\/\/bx\.netrocdn\.site\/hls2\/[^"'\s]+/g }
      ];

      patterns.forEach(p => {
        var matches = html.match(p.regex);
        if (matches) {
          matches.forEach(url => {
            // Fix URL encoding if necessary
            let finalUrl = url.replace(/&amp;/g, '&');
            
            // Apply specific headers based on your provided links
            let headers = { "User-Agent": USER_AGENT };
            
            if (finalUrl.includes("vodvidl.site")) {
              headers["Referer"] = "https://videostr.net/";
              headers["Origin"] = "https://videostr.net";
            } else if (finalUrl.includes("anyembed")) {
              headers["Referer"] = "https://flixcdn.cyou/";
            } else if (finalUrl.includes("netrocdn")) {
              headers["Referer"] = "https://moviesapi.to/";
            }

            streams.push({
              name: p.name,
              url: finalUrl,
              title: "Stream Link",
              quality: finalUrl.includes("1080") ? "1080p" : "720p",
              headers: headers
            });
          });
        }
      });

      // If no direct links found in HTML, build the fallback embeds
      if (streams.length === 0) {
        streams.push({
          name: "VidLink (Direct Embed)",
          url: mediaType === "movie" ? `https://vidlink.pro/movie/${tmdbId}` : `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`,
          headers: { "Referer": "https://vidlink.pro/" }
        });
      }

      return streams;
    } catch (e) {
      console.error("Stream Fetch Error:", e);
      return [];
    }
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
