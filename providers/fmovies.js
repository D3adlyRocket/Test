/**
 * fmovies - High Resolution Only (720p+)
 * Custom Aurora & Videasy Integration
 */

const TMDB_API_KEY = "d131017ccc6e5462a81c9304d21476de";
const DECRYPT_API_URL = "https://enc-dec.app/api/dec-videasy";

const AURORA_HEADERS = {
  "Origin": "https://www.fmovies.gd",
  "Referer": "https://www.fmovies.gd/",
  "User-Agent": "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36",
  "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Android WebView";v="146"',
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": '"Android"',
  "Accept": "*/*",
  "X-Requested-With": "com.android.browser"
};

const STANDARD_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Referer": "https://www.fmovies.gd/",
  "Origin": "https://www.fmovies.gd"
};

const SERVERS = [
  { name: "Aurora", url: "https://api.videasy.net/cdn/sources-with-title", headers: AURORA_HEADERS },
  { name: "Yoru", url: "https://api.videasy.net/cdn/sources-with-title", headers: STANDARD_HEADERS },
  { name: "Vyse", url: "https://api.videasy.net/hdmovie/sources-with-title", headers: STANDARD_HEADERS }
];

/**
 * Validates quality is 720p or higher.
 */
function isHighRes(q) {
  const label = String(q || "").toLowerCase();
  if (label.includes("480") || label.includes("360") || label === "sd") return false;
  // Accept 720, 1080, 2160, 4k or generic HD/Auto labels
  return /720|1080|2160|4k|auto|multi|hd/i.test(label);
}

async function getStreams(tmdbIdOrMedia, mediaType = "movie", season = null, episode = null) {
  try {
    const id = typeof tmdbIdOrMedia === "object" ? (tmdbIdOrMedia.tmdbId || tmdbIdOrMedia.tmdb_id) : tmdbIdOrMedia;
    const type = (typeof tmdbIdOrMedia === "object" ? (tmdbIdOrMedia.type || tmdbIdOrMedia.mediaType) : mediaType) === 'series' ? 'tv' : 'movie';
    
    // Fetch Title and Year from TMDB
    const media = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`).then(r => r.json());
    if (!media.id) return [];

    const title = type === 'tv' ? media.name : media.title;
    const year = (type === 'tv' ? media.first_air_date : media.release_date || "").slice(0, 4);

    const streamPromises = SERVERS.map(async (server) => {
      try {
        const params = new URLSearchParams({
          title: title,
          tmdbId: id,
          year: year,
          mediaType: type
        });
        if (type === 'tv') {
          params.set("seasonId", season || 1);
          params.set("episodeId", episode || 1);
        }

        const response = await fetch(`${server.url}?${params.toString()}`, { headers: server.headers });
        const encryptedBody = await response.text();
        
        if (!encryptedBody || encryptedBody.length < 10) return [];

        const decrypted = await fetch(DECRYPT_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: encryptedBody, id: String(id) })
        }).then(r => r.json());

        const sources = decrypted.result?.sources || [];

        return sources
          .filter(s => isHighRes(s.quality))
          .map(s => ({
            name: `FMovies ${server.name}`,
            title: `${title} (${s.quality || 'HD'})`,
            url: s.url,
            quality: s.quality || '720p',
            headers: server.headers,
            provider: "fmovies"
          }));
      } catch (e) { return []; }
    });

    const results = (await Promise.all(streamPromises)).flat();
    
    // Sort: 2160p > 1080p > 720p
    return results.sort((a, b) => {
      const getVal = (str) => parseInt(String(str).match(/\d+/)?.[0] || 0);
      return getVal(b.quality) - getVal(a.quality);
    });

  } catch (err) {
    return [];
  }
}

module.exports = { getStreams };
