// PStream Scraper for Nuvio
// Optimized for getStreams execution

const PSTREAM_BASE = "https://pstream.net";
const PSTREAM_EMBED = "https://pstream.net/e";
const FEDAPI_HOSTS = [
    "https://fed-api-db.pstream.mov",
    "https://fedapi.xyz",
    "https://api.pstream.net",
    "https://pstream.net/api"
];

const QUALITY_RANK = { "4k": 0, "2160p": 0, "1080p": 1, "720p": 2, "480p": 3, "360p": 4, "auto": 5 };

function normalizeQuality(str) {
    if (!str) return "auto";
    const s = String(str).toLowerCase();
    if (s.includes("4k") || s.includes("2160")) return "4K";
    if (s.includes("1080")) return "1080p";
    if (s.includes("720")) return "720p";
    if (s.includes("480")) return "480p";
    if (s.includes("360")) return "360p";
    return str;
}

function qualityRank(q) {
    const k = (q || "auto").toLowerCase().replace("p", "");
    return QUALITY_RANK[k] ?? QUALITY_RANK[q?.toLowerCase()] ?? 5;
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return undefined;
    const units = ["B", "KB", "MB", "GB"];
    let i = 0, val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(1)} ${units[i]}`;
}

const COMMON_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": `${PSTREAM_BASE}/`,
};

async function tryFedAPI(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = `${path}${qs ? "?" + qs : ""}`;

    for (const host of FEDAPI_HOSTS) {
        try {
            const res = await fetch(`${host}${url}`, {
                headers: COMMON_HEADERS,
                signal: AbortSignal.timeout(4000), // Shorter timeout to prevent Nuvio hang
            });
            if (!res.ok) continue;
            const data = await res.json();
            if (data && (data.sources || data.streams || data.url || Array.isArray(data))) {
                return data;
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

function extractStreamsFromHtml(html) {
    const streams = [];
    const seen = new Set();
    const patterns = [
        /["'`](https?:\/\/[^"'`\s]+\.(?:m3u8|mp4)(?:\?[^"'`\s]*)?)/gi,
        /file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)/gi,
        /["'](https?:\/\/[^"']*(?:stream|cdn|video|media)[^"']*\.(?:m3u8|mp4)[^"']*)/gi,
    ];

    for (const pattern of patterns) {
        for (const match of html.matchAll(pattern)) {
            const url = match[1];
            if (url && !seen.has(url)) {
                seen.add(url);
                streams.push(url);
            }
        }
    }
    return streams;
}

function parseSources(data, title) {
    const streams = [];
    const rawSources = data?.sources || data?.streams || data?.links || (Array.isArray(data) ? data : []);

    for (const src of rawSources) {
        const url = src.url || src.stream || src.link || src.file || src.src;
        if (!url) continue;

        const quality = normalizeQuality(src.quality || src.resolution || src.label || "");
        const fileName = src.name || src.title || `${title || "Stream"} [${quality}]`;

        streams.push({
            url,
            quality,
            title: fileName,
            size: formatBytes(src.size || src.filesize),
            headers: { "Referer": `${PSTREAM_BASE}/`, "Origin": PSTREAM_BASE },
        });
    }
    return streams;
}

/**
 * Main Scraper Logic
 */
async function getStreams(config) {
    const { tmdbId, type, season, episode, title } = config;
    let streams = [];

    // --- Strategy 1: FedAPI ---
    try {
        const apiPath = type === "movie" ? "/movie" : "/tv";
        const params = type === "movie" ? { tmdb: tmdbId } : { tmdb: tmdbId, season, episode };
        
        const data = await tryFedAPI(apiPath, params);
        if (data) {
            streams.push(...parseSources(data, title));
            if (streams.length === 0 && data.url) {
                streams.push({
                    url: data.url,
                    quality: normalizeQuality(data.quality),
                    title: title || "PStream",
                    headers: { "Referer": `${PSTREAM_BASE}/` },
                });
            }
        }
    } catch (e) {}

    // --- Strategy 2: Embed Scrape (Fallback) ---
    if (streams.length === 0) {
        try {
            const embedUrl = type === "movie"
                ? `${PSTREAM_EMBED}/${tmdbId}`
                : `${PSTREAM_EMBED}/${tmdbId}/${season}/${episode}`;

            const res = await fetch(embedUrl, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(6000) });
            if (res.ok) {
                const html = await res.text();
                const rawUrls = extractStreamsFromHtml(html);
                for (const url of rawUrls) {
                    const quality = url.includes("1080") ? "1080p" : url.includes("720") ? "720p" : "auto";
                    streams.push({
                        url,
                        quality,
                        title: `${title || "PStream"} [${quality}]`,
                        headers: { "Referer": `${PSTREAM_BASE}/` },
                    });
                }
            }
        } catch (e) {}
    }

    // Deduplicate and Sort
    const seen = new Set();
    return streams
        .filter(s => {
            if (seen.has(s.url)) return false;
            seen.add(s.url);
            return true;
        })
        .sort((a, b) => qualityRank(a.quality) - qualityRank(b.quality));
}

// Ensure Nuvio can find the entry point
module.exports = { getStreams };
