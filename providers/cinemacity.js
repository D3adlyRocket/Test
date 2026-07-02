const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const TORRENTIO_API = "https://torrentio.strem.fun";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept": "application/json"
};

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
  const tr = TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");
  return `magnet:?xt=urn:btih:${infoHash}${tr}`;
}

// ======================================
// TMDB -> IMDB
// ======================================
async function getImdbId(tmdbId, mediaType) {
  try {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    const res = await (await fetch(url, { skipSizeCheck: true })).json();
    return res.external_ids?.imdb_id || res.imdb_id || null;
  } catch (e) {
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
    const res = await fetch(url, { headers: HEADERS, skipSizeCheck: true });
    const json = await res.json();

    if (!json || !json.streams) {
      console.log("[TORRENTIO] No streams");
      return [];
    }

    const streams = [];
    for (const stream of json.streams.slice(0, 15)) {
      try {
        const rawTitle = stream.title || "";
        const quality = extractQuality(rawTitle);
        const seeders = rawTitle.match(/👤\s*(\d+)/)?.[1] || "?";
        
        // Extract size (e.g., 1.56 GB or 850 MB)
        const sizeMatch = rawTitle.match(/([0-9.]+ ?[GM]B)/i);
        const fileSize = sizeMatch ? sizeMatch[1] : "Unknown Size";

        // Clean up full filename/title from Torrentio text (usually the first line)
        const fullTitle = rawTitle.split("\n")[0].trim();

        const magnet = buildMagnet(stream.infoHash);
        if (!magnet) continue;

        // ==========================================
        // YOUR EXACT REQUESTED LAYOUT MAPPING
        // ==========================================
        // Header: Torrentio | 👤 (Seed Count) | Quality
        const nameHeader = `Torrentio | 👤 ${seeders} | ${quality}`;

        // Subheading Line 1: 🎬 Full Title
        // Subheading Line 2: 👥 Seeders | 💾 Size | ⚙️ Provider
        const bodyLayout = [
          `🎬 ${fullTitle}`,
          `👥 ${seeders} | 💾 ${fileSize} | ⚙️ Torrentio`
        ].join("\n");

        streams.push({
          url: magnet,
          name: nameHeader,      // Binds to UI Main Bold Header
          title: bodyLayout,     // Binds to UI Subheading Body
          description: bodyLayout
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
    const imdbId = await getImdbId(tmdbId, mediaType);
    if (!imdbId) {
      console.log("[TORRA] No IMDB ID");
      return [];
    }
    console.log("[TORRA IMDB]", imdbId);

    const streams = await invokeTorrentio(
      imdbId,
      mediaType === "tv" ? season : null,
      mediaType === "tv" ? episode : null
    );
    return streams;
  } catch (e) {
    console.log("[TORRA FATAL]", e);
    return [];
  }
}

module.exports = { getStreams };
