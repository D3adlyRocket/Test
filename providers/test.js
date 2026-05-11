/**
 * flixstream - Compatibility Fix
 * Uses stable gateways that usually bypass the 'Unsupported Container' error.
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
    const streams = [];
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

    // 1. VidSrc.me Gateway (The most compatible for TV apps)
    const vidsrcMe = mediaType === "movie" 
      ? `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`
      : `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&sea=${season}&epi=${episode}`;

    streams.push({
      name: "VidSrc (Stable)",
      url: vidsrcMe,
      quality: "1080p",
      headers: { "Referer": "https://vidsrc.me/", "User-Agent": userAgent }
    });

    // 2. VidLink Direct (Force the API path)
    const vidlinkApi = `https://vidlink.pro/api/embed/source/${mediaType === 'movie' ? tmdbId : tmdbId + '/' + season + '/' + episode}`;
    
    streams.push({
      name: "VidLink (Direct API)",
      url: vidlinkApi,
      quality: "1080p",
      headers: { 
        "Referer": "https://vidlink.pro/",
        "Origin": "https://vidlink.pro",
        "User-Agent": userAgent 
      }
    });

    // 3. SuperEmbed Fallback
    const superEmbed = `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`;
    streams.push({
        name: "SuperEmbed (Multi)",
        url: superEmbed,
        quality: "720p",
        headers: { "Referer": "https://multiembed.mov/" }
    });

    return streams;
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
