"use strict";

const SOURCE_NAME = "VidCore";
const VIDCORE_BASE = "https://vidcore.net";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
const HEADERS = {
    "User-Agent": UA,
    "Referer": VIDCORE_BASE + "/",
    "Origin": VIDCORE_BASE
};

// --- Helper Functions ---
function pad2(n) { return String(parseInt(n, 10)).padStart(2, "0"); }

async function fetchJson(url, options = {}) {
    try {
        const response = await fetch(url, { ...options, headers: { ...HEADERS, ...options.headers } });
        if (!response.ok) return null;
        return await response.json();
    } catch (e) { return null; }
}

async function fetchText(url, options = {}) {
    try {
        const response = await fetch(url, { ...options, headers: { ...HEADERS, ...options.headers } });
        if (!response.ok) return null;
        return await response.text();
    } catch (e) { return null; }
}

function extractQuality(url) {
    const u = String(url || "").toLowerCase();
    if (u.includes("2160") || u.includes("4k")) return "4K";
    if (u.includes("1080")) return "1080p";
    if (u.includes("720")) return "720p";
    if (u.includes("480")) return "480p";
    return "Auto";
}

// --- Scrape Logic ---
async function getStreams(tmdbId, mediaType, season, episode) {
    const isTv = mediaType === "tv" || (season && episode);
    const type = isTv ? "tv" : "movie";
    const sid = encodeURIComponent(String(tmdbId));
    
    let streamUrl = null;

    // 1. Try API endpoints
    const apiPatterns = [
        `${VIDCORE_BASE}/api/${type}/${sid}${isTv ? `/${season}/${episode}` : ''}`,
        `${VIDCORE_BASE}/api/source/${type}/${sid}`
    ];

    for (const url of apiPatterns) {
        const data = await fetchJson(url);
        if (data && (data.url || data.stream?.url || data.sources?.[0]?.url)) {
            streamUrl = data.url || data.stream?.url || data.sources[0].url;
            break;
        }
    }

    // 2. Fallback to scraping HTML if API fails
    if (!streamUrl) {
        const embedUrl = isTv 
            ? `${VIDCORE_BASE}/tv/${sid}/${season}/${episode}` 
            : `${VIDCORE_BASE}/movie/${sid}`;
        const html = await fetchText(embedUrl);
        if (html) {
            const match = html.match(/(https?:\/\/[^"'\s]+\.m3u8)/i);
            if (match) streamUrl = match[1];
        }
    }

    if (!streamUrl) return [];

    // 3. Format result to match Nuvio/Vidlink structure
    return [{
        name: "VidCore.",
        title: "1080p", // VidCore usually provides master playlists
        url: streamUrl,
        quality: "1080p",
        type: "m3u8",
        headers: HEADERS,
        provider: SOURCE_NAME
    }];
}

// --- Interface Export ---
if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
