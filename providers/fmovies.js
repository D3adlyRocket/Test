/**
 * fmovies - High-Res Only (720p, 1080p, 2160p)
 * Updated: 2026-04-18
 */

const TMDB_API_KEY = "d131017ccc6e5462a81c9304d21476de";
const DECRYPT_API_URL = "https://enc-dec.app/api/dec-videasy";

// Standard headers for Yoru/Vyse
const STANDARD_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Referer": "https://www.fmovies.gd/",
  "Origin": "https://www.fmovies.gd"
};

// Strict headers for Aurora to prevent Playback Error
const AURORA_HEADERS = {
  "Origin": "https://www.fmovies.gd",
  "Referer": "https://www.fmovies.gd/",
  "User-Agent": "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36",
  "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Android WebView";v="146"',
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": '"Android"',
  "Accept": "*/*"
};

const SERVERS = [
  {
    name: "Aurora",
    language: "Original",
    url: "https://api.videasy.net/cdn/sources-with-title", // Using the working API endpoint
    headers: AURORA_HEADERS
  },
  {
    name: "Yoru",
    language: "Original",
    url: "https://api.videasy.net/cdn/sources-with-title",
    headers: STANDARD_HEADERS
  },
  {
    name: "Vyse",
    language: "Hindi",
    url: "https://api.videasy.net/hdmovie/sources-with-title",
    headers: STANDARD_HEADERS
  }
];

/**
 * Filter logic: Removes 360p and 480p.
 * Keeps 720, 1080, 2160, and "Auto/Unknown" (as Auto usually contains 1080p).
 */
function isAcceptedQuality(qualityStr) {
  const q = String(qualityStr || "").toLowerCase();
  if (q.includes("480") || q.includes("360") || q === "sd") return false;
  return true; // Keep everything else (720, 1080, 2160, Auto, Adaptive)
}

async function getStreams(tmdbIdOrMedia, mediaType = "movie", season = null, episode = null) {
  try {
    const id = typeof tmdbIdOrMedia === "object" ? (tmdbIdOrMedia.tmdbId || tmdbIdOrMedia.tmdb_id) : tmdbIdOrMedia;
    const type = typeof tmdbIdOrMedia === "object" ? (tmdbIdOrMedia.type || tmdbIdOrMedia.mediaType) : mediaType;
    
    // 1. Get Media Info
    const mediaReq = await fetch(`https://api.themoviedb.org/3/${type === 'series' ? 'tv' : type}/${id}?api_key=${TMDB_API_KEY}`);
    const media = await mediaReq.json();
    const title = type === 'tv' ? media.name : media.title;
    const year = (type === 'tv' ? media.first_air_date : media.release_date).slice(0, 4);

    // 2. Fetch from all servers
    const promises = SERVERS.map(async (server) => {
      try {
        const query = new URLSearchParams({
          title: encodeURIComponent(title),
          tmdbId: id,
          year: year,
          mediaType: type === 'series' ? 'tv' : type
        });
        if (type === 'tv' || type === 'series') {
          query.set("seasonId", season || 1);
          query.set("episodeId", episode || 1);
        }

        const encrypted = await fetch(`${server.url}?${query.toString()}`, { headers: server.headers }).then(r => r.text());
        const decrypted = await fetch(DECRYPT_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: encrypted, id: String(id) })
        }).then(r => r.json());

        const sources = decrypted.result?.sources || [];
        
        return sources
          .filter(s => isAcceptedQuality(s.quality))
          .map(s => ({
            name: `FMovies ${server.name}`,
            title: `${title} (${s.quality || 'HD'})`,
            url: s.url,
            quality: s.quality || 'HD',
            headers: server.headers, // Pass Aurora headers to the player
            language: server.language
          }));
      } catch (e) { return []; }
    });

    const allResults = (await Promise.all(promises)).flat();
    
    // Sort so 2160p and 1080p are at the top
    return allResults.sort((a, b) => {
      const qA = parseInt(a.quality) || 0;
      const qB = parseInt(b.quality) || 0;
      return qB - qA;
    });

  } catch (err) {
    return [];
  }
}

module.exports = { getStreams };
