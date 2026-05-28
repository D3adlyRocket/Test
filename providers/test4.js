/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║               MovieBox Provider v6.0 — Android TV Stable                   ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Worker      › https://moviebox.s4nch1tt.workers.dev                      ║
 * ║  Playback    › Direct Worker Playback                                     ║
 * ║  Optimized   › Nuvio / Stremio Android TV                                 ║
 * ║  Features    › Multi-Language | Quality Sorting | Cache                   ║
 * ║  Author      › Murph Streams ⚡                                            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

"use strict";

const WORKER_BASE = "https://moviebox.s4nch1tt.workers.dev";
const TAG = "[MovieBox]";

/**
 * SIMPLE CACHE
 */
const cache = new Map();
const CACHE_TTL = 20 * 60 * 1000;

function getCached(key) {

    const entry = cache.get(key);

    if (!entry) {
        return undefined;
    }

    if (Date.now() - entry.ts > CACHE_TTL) {
        cache.delete(key);
        return undefined;
    }

    return entry.val;
}

function setCached(key, val) {

    if (cache.size > 300) {

        const oldest =
            cache.keys().next().value;

        cache.delete(oldest);
    }

    cache.set(key, {
        val,
        ts: Date.now()
    });
}

/**
 * SAFE JSON FETCH
 */
async function fetchJson(url) {

    try {

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0"
            },
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {

            console.log(
                `${TAG} HTTP ${response.status}`
            );

            return null;
        }

        return await response.json();

    } catch (err) {

        console.log(
            `${TAG} Fetch Error → ${err.message}`
        );

        return null;
    }
}

/**
 * FETCH FROM WORKER
 */
async function fetchFromWorker(
    tmdbId,
    mediaType,
    season,
    episode
) {

    let url =
        `${WORKER_BASE}/streams?tmdb_id=` +
        encodeURIComponent(tmdbId) +
        `&type=` +
        encodeURIComponent(mediaType) +
        `&lang=all`;

    if (mediaType === "tv") {

        url +=
            `&se=${season || 1}` +
            `&ep=${episode || 1}`;
    }

    console.log(`${TAG} Worker → ${url}`);

    const data = await fetchJson(url);

    if (!data) {
        return [];
    }

    if (Array.isArray(data.streams)) {
        return data.streams;
    }

    if (Array.isArray(data)) {
        return data;
    }

    return [];
}

/**
 * CLEAN STREAM URL
 */
function normalizeUrl(url) {

    if (!url) {
        return "";
    }

    if (
        url.startsWith("http://") ||
        url.startsWith("https://")
    ) {
        return url;
    }

    return (
        WORKER_BASE +
        (url.startsWith("/") ? "" : "/") +
        url
    );
}

/**
 * EXTRACT QUALITY
 */
function getQuality(stream) {

    if (!stream || !stream.resolution) {
        return "Auto";
    }

    const match =
        String(stream.resolution)
            .match(/(\d+)/);

    return match
        ? match[1] + "p"
        : String(stream.resolution);
}

/**
 * EXTRACT LANGUAGE
 */
function getLanguage(stream) {

    const match =
        String(stream.name || "")
            .match(/\(([^)]+)\)/);

    if (match && match[1]) {
        return match[1].trim();
    }

    return "Original";
}

/**
 * BUILD STREAM
 */
function buildStream(
    stream,
    isTv,
    season,
    episode
) {

    const streamUrl =
        normalizeUrl(
            stream.proxy_url ||
            stream.url ||
            ""
        );

    if (!streamUrl) {
        return null;
    }

    const quality =
        getQuality(stream);

    const language =
        getLanguage(stream);

    let title =
        (stream.title || "MovieBox Stream")
            .replace(/\s+/g, " ")
            .trim();

    if (
        isTv &&
        season != null &&
        episode != null
    ) {

        title +=
            ` • S${String(season).padStart(2, "0")}` +
            `E${String(episode).padStart(2, "0")}`;
    }

    const metaLine =
        `🎥 ${quality} • 🔊 ${language}`;

    return {

        /**
         * KEEP VERY SIMPLE
         * ANDROID TV SAFE
         */
        name:
            `MovieBox | ${quality} | ${language}`,

        title:
            title +
            "\n" +
            metaLine,

        url: streamUrl,

        behaviorHints: {

            /**
             * IMPORTANT
             * ONLY bingeGroup
             */
            bingeGroup: "moviebox-v6"
        }
    };
}

/**
 * SORT STREAMS
 */
function sortStreams(streams) {

    function langPriority(name) {

        const lang =
            String(name)
                .toLowerCase();

        if (lang.includes("original")) {
            return 0;
        }

        if (
            lang.includes("hindi")
        ) {
            return 1;
        }

        return 2;
    }

    streams.sort((a, b) => {

        const pa =
            langPriority(a.name);

        const pb =
            langPriority(b.name);

        if (pa !== pb) {
            return pa - pb;
        }

        const qa =
            parseInt(
                a.name.match(/\d+p/)?.[0] || 0
            );

        const qb =
            parseInt(
                b.name.match(/\d+p/)?.[0] || 0
            );

        return qb - qa;
    });

    return streams;
}

/**
 * MAIN
 */
async function getStreams(
    tmdbId,
    mediaType,
    season,
    episode
) {

    const isTv =
        mediaType === "tv" ||
        mediaType === "series";

    const se =
        isTv
            ? season || 1
            : null;

    const ep =
        isTv
            ? episode || 1
            : null;

    const cacheKey =
        `moviebox::${tmdbId}::${mediaType}::${se}::${ep}`;

    const cached =
        getCached(cacheKey);

    if (cached) {

        console.log(
            `${TAG} Cache HIT → ${cached.length}`
        );

        return cached;
    }

    console.log(
        `${TAG} ▶ ${tmdbId} ${mediaType}` +
        `${isTv ? ` S${se}E${ep}` : ""}`
    );

    try {

        const rawStreams =
            await fetchFromWorker(
                tmdbId,
                mediaType,
                se,
                ep
            );

        if (!rawStreams.length) {

            console.log(
                `${TAG} No streams`
            );

            return [];
        }

        const streams =
            rawStreams
                .map(stream =>
                    buildStream(
                        stream,
                        isTv,
                        se,
                        ep
                    )
                )
                .filter(Boolean);

        sortStreams(streams);

        console.log(
            `${TAG} ✔ ${streams.length} streams ready`
        );

        setCached(
            cacheKey,
            streams
        );

        return streams;

    } catch (err) {

        console.log(
            `${TAG} Error → ${err.message}`
        );

        return [];
    }
}

/**
 * EXPORT
 */
if (
    typeof module !== "undefined" &&
    module.exports
) {

    module.exports = {
        getStreams
    };

} else {

    global.getStreams =
        getStreams;
}
