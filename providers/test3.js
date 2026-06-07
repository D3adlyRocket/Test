const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

// FIX: Public Torrentio requires configuration flags embedded directly into the URL route
const TORRENTIO_API = "https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,kickasstorrents,torrentgalaxy";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; BRAVIA 4K UR3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Accept": "application/json"
};

// Android TV Resilient Network Wrapper
async function fetchWithTimeout(url, options = {}) {
  const timeout = options.timeout || 15000;
  if (typeof fetch === 'undefined') {
    console.log("[TORRA] Environment Fetch Error");
    return null;
  }

  let controller;
  let timeoutId;
  if (typeof AbortController !== 'undefined') {
    controller = new AbortController();
    options.signal = controller.signal;
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }

  try {
    return await fetch(url, options);
  } catch (e) {
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function extractQuality(str = "") {
  const u = str.toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  return "480p";
}

const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce"
];

function buildMagnet(infoHash) {
  if (!infoHash) return "";
  const tr = TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");
  return `magnet:?xt=urn:btih:${infoHash}${tr}`;
}

// TMDB Endpoint Interceptor
async function getImdbId(tmdbId, mediaType) {
  try {
    const type = (mediaType === "tv" || mediaType === "series") ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    
    const res = await fetchWithTimeout(url, { headers: HEADERS });
    if (!res || !res.ok) return null;

    const data = await res.json();
    return data.external_ids?.imdb_id || data.imdb_id || null;
  } catch (e) {
    return null;
  }
}

// Torrentio Scraper
async function invokeTorrentio(imdbId, mediaType, season, episode) {
  try {
    const isTV = mediaType === "tv" || mediaType === "series";
    
    // Core Correction: Uses the unified public configuration pathway pattern
    const url = isTV
      ? `${TORRENTIO_API}/stream/series/${imdbId}:${season}:${episode}.json`
      : `${TORRENTIO_API}/stream/movie/${imdbId}.json`;

    console.log("[TORRA ENGINE] Fetching from endpoint URL:", url);

    const res = await fetchWithTimeout(url, { headers: HEADERS });
    if (!res || !res.ok) return [];

    const json = await res.json();
    if (!json || !json.streams) return [];

    const streams = [];
    for (const stream of json.streams.slice(0, 15)) {
      try {
        const title = stream.title || "";
        const quality = extractQuality(title);
        const seeders = title.match(/👤\s*(\d+)/)?.[1] || "?";
        
        // Use stream direct URL fallback if present, else construct our custom magnet links
        const targetUrl = stream.url || buildMagnet(stream.infoHash);
        if (!targetUrl) continue;

        streams.push({
          url: targetUrl,
          quality,
          title: `Torrentio | ${quality} | 👤 ${seeders}`,
          subtitles: []
        });
      } catch (inner) {}
    }

    return streams;
  } catch (e) {
    return [];
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    if (!tmdbId) return [];

    const imdbId = await getImdbId(tmdbId, mediaType);
    if (!imdbId) {
      console.log("[TORRA] Failed to resolve TMDB mapping context.");
      return [];
    }

    return await invokeTorrentio(imdbId, mediaType, season || 1, episode || 1);
  } catch (e) {
    console.log("[TORRA MASTER FATAL]", e);
    return [];
  }
}

module.exports = { getStreams };
