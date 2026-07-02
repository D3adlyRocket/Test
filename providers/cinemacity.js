const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const TORRENTIO_API = "https://torrentio.strem.fun";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept": "application/json"
};

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
// METADATA PARSER (DESIGNED FOR YOUR UI LAYOUT)
// ======================================
function buildStream(stream, infoHash) {
    const rawTitle = stream.title || "";
    
    // 1. Cleanly isolate the Raw Filename (Full Release Title)
    // Torrentio usually splits the title line with newlines '\n'. The first line is typically the filename.
    const fullTitle = rawTitle.split("\n")[0].trim();

    // 2. Extract Seeders
    const seeders = rawTitle.match(/👤\s*(\d+)/)?.[1] || "?";
    
    // 3. Extract File Size
    const sizeMatch = rawTitle.match(/([0-9.]+ ?[GM]B)/i);
    const fileSize = sizeMatch ? sizeMatch[1] : "Unknown Size";

    const cleanTitle = rawTitle.toUpperCase();

    // 4. Extract Quality/Resolution for the Header
    let resolution = "SD";
    if (cleanTitle.includes("2160P") || cleanTitle.includes("4K")) resolution = "4K";
    else if (cleanTitle.includes("1080P")) resolution = "1080p";
    else if (cleanTitle.includes("720P")) resolution = "720p";
    else if (cleanTitle.includes("480P")) resolution = "480p";

    const magnet = buildMagnet(infoHash);

    // 5. Structure the return strictly into your layout requirements
    return {
        url: magnet,
        quality: resolution,
        
        // Exact layout mappings for your UI strings
        header: `Torrentio | 👤 ${seeders} | ${resolution}`,
        subheadingLine1: `🎬 ${fullTitle}`,
        subheadingLine2: `👥 ${seeders} | 💾 ${fileSize} | ⚙️ Torrentio`
    };
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
// TORRENTIO FETCH
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
                if (!stream.infoHash) continue;
                
                // Process stream into your UI variables
                const formattedStream = buildStream(stream, stream.infoHash);
                streams.push(formattedStream);
            } catch (e) {
                // Ignore individual parsing failures safely
            }
        }
        return streams;
    } catch (e) {
        console.log("[TORRENTIO ERROR]", e);
        return [];
    }
}

// ======================================
// MAIN ENTRYPOINT
// ======================================
async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const imdbId = await getImdbId(tmdbId, mediaType);
        if (!imdbId) {
            console.log("[TORRA] No IMDB ID found");
            return [];
        }

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
