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
// ADVANCED METADATA PARSER & STREAM BUILDER
// ======================================
function buildStream(stream, infoHash) {
    const rawTitle = stream.title || "";
    
    // 1. Extract Seeders
    const seeders = rawTitle.match(/👤\s*(\d+)/)?.[1] || "?";
    
    // 2. Extract File Size (e.g., 3.14 GB or 850 MB)
    const sizeMatch = rawTitle.match(/([0-9.]+ ?[GM]B)/i);
    const fileSize = sizeMatch ? sizeMatch[1] : "Unknown Size";

    const cleanTitle = rawTitle.toUpperCase();

    // 3. Extract Quality/Resolution
    let resolution = "SD";
    if (cleanTitle.includes("2160P") || cleanTitle.includes("4K")) resolution = "4K Ultra HD";
    else if (cleanTitle.includes("1080P")) resolution = "1080p Full HD";
    else if (cleanTitle.includes("720P")) resolution = "720p HD";
    else if (cleanTitle.includes("480P")) resolution = "480p";

    // 4. Extract Source Type
    let source = "WEB-DL";
    if (cleanTitle.includes("BLURAY") || cleanTitle.includes("BDRIP")) source = "Blu-ray";
    else if (cleanTitle.includes("REMUX")) source = "Remux (Lossless)";
    else if (cleanTitle.includes("WEBRIP")) source = "WEBRip";

    // 5. Extract Video Codec
    let videoCodec = "H.264";
    if (cleanTitle.includes("HEVC") || cleanTitle.includes("X265") || cleanTitle.includes("H265")) videoCodec = "HEVC / x265";
    else if (cleanTitle.includes("X264") || cleanTitle.includes("H264")) videoCodec = "AVC / x264";
    else if (cleanTitle.includes("AV1")) videoCodec = "AV1";

    // 6. Extract HDR / Color Info
    let hdrInfo = "SDR (Standard)";
    if (cleanTitle.includes("DV") || cleanTitle.includes("DOLBY VISION")) hdrInfo = "Dolby Vision 🕶️";
    else if (cleanTitle.includes("HDR10+")) hdrInfo = "HDR10+ ✨";
    else if (cleanTitle.includes("HDR10")) hdrInfo = "HDR10 🌈";
    else if (cleanTitle.includes("HDR")) hdrInfo = "HDR 🌈";

    // 7. Extract Audio Profile (Dolby, DDP5.1, Atmos, etc.)
    let audioInfo = "Stereo 2.0";
    if (cleanTitle.includes("ATMOS")) audioInfo = "Dolby Atmos 🔊";
    else if (cleanTitle.includes("DDP7.1") || cleanTitle.includes("DD+7.1")) audioInfo = "Dolby Digital Plus 7.1 🎧";
    else if (cleanTitle.includes("DDP5.1") || cleanTitle.includes("DD+5.1")) audioInfo = "Dolby Digital Plus 5.1 🎬";
    else if (cleanTitle.includes("DD5.1") || cleanTitle.includes("AC3") || cleanTitle.includes("5.1")) audioInfo = "Dolby Digital 5.1 🍿";
    else if (cleanTitle.includes("DTS-HD")) audioInfo = "DTS-HD Master Audio 🎸";
    else if (cleanTitle.includes("TRUEHD")) audioInfo = "Dolby TrueHD 🎹";

    // 8. Extract Language
    let language = "English 🇬🇧";
    if (cleanTitle.includes("DUAL") || cleanTitle.includes("DUAL-AUDIO")) language = "Dual Audio 🌐";
    else if (cleanTitle.includes("MULTI") || cleanTitle.includes("MULTILANG")) language = "Multi-Language 🌍";
    else if (cleanTitle.includes("HINDI")) language = "Hindi 🇮🇳";
    else if (cleanTitle.includes("SPANISH") || cleanTitle.includes("ESP")) language = "Spanish 🇪🇸";

    const magnet = buildMagnet(infoHash);

    return {
        url: magnet,
        quality: resolution,
        // Raw structured object for your frontend subheadings/badges
        metadata: {
            resolution,
            source,
            fileSize,
            videoCodec,
            hdrInfo,
            audioInfo,
            language,
            seeders
        },
        // Pre-formatted multi-line title block utilizing your requested emojis
        title: `Torrentio | 🎬 ${resolution} (${source})\n` +
               `📦 Size: ${fileSize} | 👥 Seeders: ${seeders}\n` +
               `📹 Video: ${videoCodec} | ${hdrInfo}\n` +
               `🔊 Audio: ${audioInfo} | 🌐 Lang: ${language}`
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
        // Extract up to 15 streams
        for (const stream of json.streams.slice(0, 15)) {
            try {
                if (!stream.infoHash) continue;
                
                // Construct the structured stream data block using our advanced extractor
                const formattedStream = buildStream(stream, stream.infoHash);
                streams.push(formattedStream);
            } catch (e) {
                // Skip malformed individual streams
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
            console.log("[TORRA] No IMDB ID found via TMDB");
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
