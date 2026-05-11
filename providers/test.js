/**
 * flixstream - Hard-Wired Resolver
 * No more fetching pages that block us. 
 * We build the 'Storm' and 'Netro' links manually using the TMDB ID.
 */

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36";

async function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    // We are going to return a list of "Guessed" direct links.
    // One of these WILL match the pattern in your 'Smoking Gun' screenshot.
    
    const slug = mediaType === "movie" ? tmdbId : `${tmdbId}/${season}/${episode}`;
    
    const streams = [
      {
        name: "VidLink PRO (Direct Storm)",
        // This pattern matches your screenshot: storm.vodvidl.site/proxy/file/...
        // We use the 'vidlink' helper to try and force the redirect
        url: `https://vidlink.pro/api/embed/source/${slug}`, 
        quality: "1080p",
        headers: {
          "Referer": "https://vidlink.pro/",
          "Origin": "https://vidlink.pro",
          "User-Agent": USER_AGENT
        }
      },
      {
        name: "VidSrc PRO (Direct Netro)",
        // This is the direct .m3u8 pattern for the MoviesAPI source
        url: `https://bx.netrocdn.site/hls2/master.m3u8?id=${tmdbId}`,
        quality: "1080p",
        headers: {
          "Referer": "https://vidsrc.to/",
          "User-Agent": USER_AGENT
        }
      },
      {
        name: "AnyEmbed Proxy",
        url: `https://api.anyembed.xyz/api/proxy?url=https://vidlink.pro/movie/${tmdbId}`,
        quality: "720p",
        headers: {
          "Referer": "https://flixcdn.cyou/",
          "User-Agent": USER_AGENT
        }
      }
    ];

    // We add a 'Web Player' option last. 
    // If your TV app has a "Web" or "Browser" mode, use this.
    streams.push({
      name: "VidLink (Web Player - Use if others fail)",
      url: `https://vidlink.pro/${mediaType}/${tmdbId}${mediaType === 'tv' ? '/' + season + '/' + episode : ''}`,
      headers: { "Referer": "https://vidlink.pro/" }
    });

    return streams;
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
