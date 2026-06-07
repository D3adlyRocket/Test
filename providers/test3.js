const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const TORRENTIO_API = "https://torrentio.strem.fun";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept": "application/json"
};

// Android TV Friendly Fetch
async function fetchWithTimeout(url, options = {}) {
  const timeout = options.timeout || 20000;
  if (typeof fetch === 'undefined') {
    console.log("[DIAG] CRITICAL: Fetch is completely undefined on this TV engine.");
    throw new Error("Fetch undefined");
  }

  let controller;
  let timeoutId;

  if (typeof AbortController !== 'undefined') {
    controller = new AbortController();
    options.signal = controller.signal;
    timeoutId = setTimeout(() => {
      console.log(`[DIAG TIMEOUT] Stale connection dropped: ${url}`);
      controller.abort();
    }, timeout);
  }

  try {
    return await fetch(url, options);
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

// TMDB -> IMDB Lookup
async function getImdbId(tmdbId, mediaType) {
  try {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    
    console.log(`[DIAG] Attempting TMDB Fetch for ID: ${tmdbId}`);
    const res = await fetchWithTimeout(url, { 
      headers: HEADERS,
      timeout: 12000,
      skipSizeCheck: true 
    });

    if (!res.ok) {
      console.log(`[DIAG ERROR] TMDB responded with bad status: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const id = data.external_ids?.imdb_id || data.imdb_id || null;
    console.log(`[DIAG SUCCESS] Found IMDB ID: ${id}`);
    return id;
  } catch (e) {
    console.log("[DIAG CRASH] TMDB Fetch crashed entirely. Network/SSL block suspected.", e.message || e);
    return null;
  }
}

// Torrentio Scraper
async function invokeTorrentio(imdbId, season, episode) {
  try {
    const isTV = season != null && episode != null;
    const url = isTV
      ? `${TORRENTIO_API}/stream/series/${imdbId}:${season}:${episode}.json`
      : `${TORRENTIO_API}/stream/movie/${imdbId}.json`;

    console.log("[DIAG] Querying Torrentio URL:", url);

    const res = await fetchWithTimeout(url, {
      headers: HEADERS,
      timeout: 15000,
      skipSizeCheck: true
    });

    if (!res.ok) {
      console.log(`[DIAG ERROR] Torrentio API blocked request. Status: ${res.status}`);
      return [];
    }

    const json = await res.json();

    if (!json || !json.streams || json.streams.length === 0) {
      console.log("[DIAG WARNING] Torrentio returned 0 streams. You might be rate-limited.");
      return [];
    }

    const streams = [];
    for (const stream of json.streams.slice(0, 15)) {
      try {
        const title = stream.title || "";
        const quality = extractQuality(title);
        const seeders = title.match(/👤\s*(\d+)/)?.[1] || "?";
        const magnet = buildMagnet(stream.infoHash);

        if (!magnet) continue;

        streams.push({
          url: magnet,
          quality,
          title: `Torrentio | ${quality} | 👤 ${seeders}`,
          subtitles: []
        });
      } catch (inner) {}
    }

    console.log(`[DIAG SUCCESS] Successfully parsed ${streams.length} links.`);
    return streams;

  } catch (e) {
    console.log("[DIAG CRASH] Torrentio connection dropped completely.", e.message || e);
    return [];
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const normalizedType = (mediaType === "tv" || mediaType === "series") ? "tv" : "movie";
    
    const imdbId = await getImdbId(tmdbId, normalizedType);
    if (!imdbId) {
      console.log("[DIAG ABORT] Script stopped early because IMDB extraction returned nothing.");
      return [];
    }

    return await invokeTorrentio(
      imdbId,
      normalizedType === "tv" ? season : null,
      normalizedType === "tv" ? episode : null
    );
  } catch (e) {
    console.log("[DIAG FATAL MASTER ERROR]", e);
    return [];
  }
}

module.exports = { getStreams };
