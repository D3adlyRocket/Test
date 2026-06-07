const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const TORRENTIO_API = "https://torrentio.strem.fun";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept": "application/json"
};

// ======================================
// ANDROID TV COMPATIBLE FETCH WRAPPER
// ======================================
async function fetchWithTimeout(url, options = {}) {
  const timeout = options.timeout || 20000; // 20 seconds default fallback for TV stales
  
  if (typeof fetch === 'undefined') {
    console.log("[ERROR] No fetch implementation found in this environment!");
    throw new Error("Fetch undefined");
  }

  let controller;
  let timeoutId;

  // Safe check for environments that have half-baked or missing AbortController setups
  if (typeof AbortController !== 'undefined') {
    controller = new AbortController();
    options.signal = controller.signal;
    timeoutId = setTimeout(() => {
      console.log(`[TIMEOUT] Request to ${url} timed out after ${timeout}ms`);
      controller.abort();
    }, timeout);
  }

  try {
    const response = await fetch(url, options);
    if (timeoutId) clearTimeout(timeoutId);
    return response;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    throw err;
  }
}

// ======================================
// QUALITY EXTRACTION
// ======================================
function extractQuality(str = "") {
  const u = str.toLowerCase();

  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";

  return "Unknown";
}

// ======================================
// STATIC TRACKERS
// ======================================
const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce"
];

// ======================================
// MAGNET BUILDER
// ======================================
function buildMagnet(infoHash) {
  if (!infoHash) return "";

  const tr = TRACKERS.map(
    t => `&tr=${encodeURIComponent(t)}`
  ).join("");

  return `magnet:?xt=urn:btih:${infoHash}${tr}`;
}

// ======================================
// TMDB -> IMDB
// ======================================
async function getImdbId(tmdbId, mediaType) {
  try {
    const url =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}` +
      `?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

    // FIX: Swapped to fetchWithTimeout and appended HEADERS (Required for TV network security)
    const res = await (
      await fetchWithTimeout(url, { 
        headers: HEADERS,
        timeout: 15000,
        skipSizeCheck: true 
      })
    ).json();

    return (
      res.external_ids?.imdb_id ||
      res.imdb_id ||
      null
    );
  } catch (e) {
    console.log("[TMDB ERROR]", e);
    return null;
  }
}

// ======================================
// TORRENTIO
// ======================================
async function invokeTorrentio(imdbId, season, episode) {
  try {
    const isTV = season != null && episode != null;

    const url = isTV
      ? `${TORRENTIO_API}/stream/series/${imdbId}:${season}:${episode}.json`
      : `${TORRENTIO_API}/stream/movie/${imdbId}.json`;

    console.log("[TORRENTIO URL]", url);

    // FIX: Wrapped in fetchWithTimeout to prevent permanent background connection hangs
    const res = await fetchWithTimeout(url, {
      headers: HEADERS,
      timeout: 20000,
      skipSizeCheck: true
    });

    const json = await res.json();

    if (!json || !json.streams) {
      console.log("[TORRENTIO] No streams");
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

      } catch (e) {}
    }

    return streams;

  } catch (e) {
    console.log("[TORRENTIO ERROR]", e);
    return [];
  }
}

// ======================================
// MAIN
// ======================================
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // TMDB -> IMDB
    const imdbId = await getImdbId(tmdbId, mediaType);

    if (!imdbId) {
      console.log("[TORRA] No IMDB ID");
      return [];
    }

    console.log("[TORRA IMDB]", imdbId);

    const streams = await invokeTorrentio(
      imdbId,
      mediaType === "tv" || mediaType === "series" ? season : null,
      mediaType === "tv" || mediaType === "series" ? episode : null
    );

    return streams;

  } catch (e) {
    console.log("[TORRA FATAL]", e);
    return [];
  }
}

// ======================================
// REQUIRED
// ======================================
module.exports = {
  getStreams
};
