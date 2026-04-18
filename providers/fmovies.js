/**
 * fmovies - High-Res Only Edition (720p/1080p/2160p)
 * Removes 360p/480p automatically.
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
  "Accept-Encoding": "identity;q=1, *;q=0", // Critical for Aurora
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

// Helper to sanitize quality labels and filter
function getValidStream(source, server, title) {
  const q = String(source.quality || "").toLowerCase();
  
  // 1. Delete low quality
  if (q.includes("360") || q.includes("480") || q === "sd") return null;
  
  // 2. Identify High Res
  let finalQuality = "720p"; // Default floor
  if (q.includes("2160") || q.includes("4k")) finalQuality = "2160p";
  else if (q.includes("1080")) finalQuality = "1080p";
  else if (q.includes("720")) finalQuality = "720p";
  else if (q.includes("auto") || q.includes("multi")) finalQuality = "1080p (Auto)";

  return {
    name: `FMovies ${server.name}`,
    title: `${title} [${finalQuality}]`,
    url: source.url,
    quality: finalQuality,
    headers: server.headers,
    provider: "fmovies"
  };
}

async function getStreams(tmdbIdOrMedia, mediaType = "movie", season = null, episode = null) {
  try {
    const id = typeof tmdbIdOrMedia === "object" ? (tmdbIdOrMedia.tmdbId || tmdbIdOrMedia.tmdb_id) : tmdbIdOrMedia;
    let type = typeof tmdbIdOrMedia === "object" ? (tmdbIdOrMedia.type || tmdbIdOrMedia.mediaType) : mediaType;
    if (type === 'series') type = 'tv';

    // Get basic info from TMDB
    const media = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`).then(r => r.json());
    if (!media.id) return [];

    const movieTitle = type === 'tv' ? media.name : media.title;
    const year = (type === 'tv' ? media.first_air_date : media.release_date).slice(0, 4);

    const streamPromises = SERVERS.map(async (server) => {
      try {
        // Encode title strictly
        const cleanTitle = encodeURIComponent(movieTitle).replace(/%20/g, "+");
        let fetchUrl = `${server.url}?title=${cleanTitle}&tmdbId=${id}&year=${year}&mediaType=${type}`;
        
        if (type === 'tv') {
          fetchUrl += `&seasonId=${season || 1}&episodeId=${episode || 1}`;
        }

        const response = await fetch(fetchUrl, { headers: server.headers });
        const encrypted = await response.text();
        
        if (!encrypted || encrypted.length < 20) return [];

        const decrypted = await fetch(DECRYPT_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: encrypted, id: String(id) })
        }).then(r => r.json());

        return (decrypted.result?.sources || [])
          .map(s => getValidStream(s, server, movieTitle))
          .filter(Boolean); // Removes the nulls (480p/360p)

      } catch (e) { return []; }
    });

    const results = (await Promise.all(streamPromises)).flat();
    
    // Final Sort by Resolution
    return results.sort((a, b) => {
      const val = (s) => parseInt(s.quality) || 0;
      return val(b) - val(a);
    });

  } catch (err) {
    return [];
  }
}

module.exports = { getStreams };
