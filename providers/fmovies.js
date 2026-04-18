/**
 * fmovies - Updated with Dynamic Aurora Server & High-Res Filtering
 * Generated: 2026-04-18
 */

// --- Configuration & Headers ---
const TMDB_API_KEY = "d131017ccc6e5462a81c9304d21476de";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const DECRYPT_API_URL = "https://enc-dec.app/api/dec-videasy";

const PLAYBACK_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Referer": "https://www.fmovies.gd/",
  "Origin": "https://www.fmovies.gd"
};

const AURORA_HEADERS = {
  "Origin": "https://www.fmovies.gd",
  "User-Agent": "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36",
  "Referer": "https://www.fmovies.gd/",
  "Accept": "*/*",
  "sec-ch-ua-platform": '"Android"'
};

const SERVERS = [
  {
    name: "Aurora",
    language: "Original",
    baseUrl: "https://fast.vidplus.dev/file2/", // Dynamic base for the new server
    headers: AURORA_HEADERS
  },
  {
    name: "Yoru",
    language: "Original",
    baseUrl: "https://api.videasy.net/cdn/sources-with-title",
    headers: PLAYBACK_HEADERS
  },
  {
    name: "Vyse",
    language: "Hindi",
    baseUrl: "https://api.videasy.net/hdmovie/sources-with-title",
    headers: PLAYBACK_HEADERS
  }
];

// --- Resolution Logic ---
function isHighQuality(qualityStr) {
  const q = String(qualityStr).toLowerCase();
  // Remove any stream that is 360, 480, or labeled SD
  if (q.includes("360") || q.includes("480") || q === "sd") return false;
  // Keep 720, 1080, 2160/4k, or "Auto/Adaptive" (as they usually contain HD)
  return q.includes("720") || q.includes("1080") || q.includes("2160") || q.includes("4k") || q.includes("auto");
}

function normalizeQualityLabel(value) {
  const raw = String(value || "").toUpperCase();
  if (raw.includes("2160") || raw.includes("4K")) return "2160p";
  if (raw.includes("1080")) return "1080p";
  if (raw.includes("720")) return "720p";
  return "HD Multi";
}

// --- Fetching Logic ---
async function fetchMediaDetails(tmdbId, mediaType) {
  const type = mediaType === "series" ? "tv" : mediaType;
  const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
  const res = await fetch(url).then(r => r.json());
  return {
    tmdbId: String(res.id),
    title: type === "tv" ? res.name : res.title,
    year: (type === "tv" ? res.first_air_date : res.release_date).slice(0, 4),
    type: type
  };
}

async function getStreams(tmdbIdOrMedia, mediaType = "movie", season = null, episode = null) {
  try {
    const input = typeof tmdbIdOrMedia === "object" ? tmdbIdOrMedia : { tmdbId: tmdbIdOrMedia, type: mediaType };
    const media = await fetchMediaDetails(input.tmdbId, input.type);
    
    const streamPromises = SERVERS.map(async (server) => {
      try {
        // Build request URL (Simplified for internal API logic)
        const query = new URLSearchParams({
          title: media.title,
          tmdbId: media.tmdbId,
          year: media.year
        });
        if (media.type === "tv") {
          query.set("s", season || input.season || 1);
          query.set("e", episode || input.episode || 1);
        }

        const response = await fetch(`${server.baseUrl}?${query.toString()}`, { headers: server.headers });
        const data = await response.text();
        
        // Decrypt if necessary (Videasy servers)
        let results = [];
        if (server.name !== "Aurora") {
            const decrypted = await fetch(DECRYPT_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: data, id: media.tmdbId })
            }).then(r => r.json());
            results = decrypted.result?.sources || [];
        } else {
            // Placeholder for Aurora's specific dynamic logic if different from Videasy
            // If Aurora uses the same payload structure, it would be handled here
            results = [{ url: server.baseUrl, quality: "1080p" }]; 
        }

        return results
          .filter(s => isHighQuality(s.quality)) // STRICT FILTER: REMOVES 480P/360P
          .map(s => ({
            name: `FMovies ${server.name} (${server.language})`,
            title: `${media.title} - ${normalizeQualityLabel(s.quality)}`,
            url: s.url,
            quality: normalizeQualityLabel(s.quality),
            headers: server.headers
          }));
      } catch (e) {
        return [];
      }
    });

    const allStreams = (await Promise.all(streamPromises)).flat();
    
    // Final Sort: Highest Resolution first
    return allStreams.sort((a, b) => {
        const qA = parseInt(a.quality) || 0;
        const qB = parseInt(b.quality) || 0;
        return qB - qA;
    });

  } catch (err) {
    return [];
  }
}

module.exports = { getStreams };
