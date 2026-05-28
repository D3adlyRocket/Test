/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║              MovieBox Provider v5.1 — Android TV Optimized                 ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Worker      › https://moviebox.s4nch1tt.workers.dev                      ║
 * ║  Features    › Multi-Language | Direct Playback | Android TV Safe         ║
 * ║  Playback    › Uses proxy_url from worker                                 ║
 * ║  Optimized   › Stremio Android TV / Nuvio                                 ║
 * ║  Author      › Murph Streams ⚡                                            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

"use strict";

const WORKER_BASE = "https://moviebox.s4nch1tt.workers.dev";
const TAG = "[MovieBox]";

/**
 * SIMPLE LRU CACHE
 */
const cache = new Map();
const CACHE_TTL = 20 * 60 * 1000;

function getCached(key) {
    const entry = cache.get(key);

    if (!entry) return undefined;

    if (Date.now() - entry.ts > CACHE_TTL) {
        cache.delete(key);
        return undefined;
    }

    return entry.val;
}

function setCached(key, val) {
    if (cache.size > 300) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }

    cache.set(key, {
        val,
        ts: Date.now()
    });
}

/**
 * SAFE FETCH JSON
 */
async function safeJson(url) {
    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "User-Agent": "MurphAddon/5.1"
            },
            signal: AbortSignal.timeout(15000)
        });

        if (!res.ok) {
            console.log(`${TAG} HTTP ${res.status}`);
            return null;
        }

        return await res.json();

    } catch (err) {
        console.log(`${TAG} Fetch Error → ${err.message}`);
        return null;
    }
}

/**
 * FETCH STREAMS FROM WORKER
 */
async function fetchFromWorker(tmdbId, mediaType, season, episode) {

    let url =
        `${WORKER_BASE}/streams?tmdb_id=${encodeURIComponent(tmdbId)}` +
        `&type=${encodeURIComponent(mediaType)}` +
        `&lang=all`;

    if (mediaType === "tv") {
        url += `&se=${season || 1}&ep=${episode || 1}`;
    }

    console.log(`${TAG} Worker → ${url}`);

    const data = await safeJson(url);

    if (!data) return [];

    if (Array.isArray(data.streams)) {
        return data.streams;
    }

    if (Array.isArray(data)) {
        return data;
    }

    return [];
}

/**
 * BUILD STREAM OBJECT
 */
function buildStream(s, isTv, season, episode) {

    let streamUrl = s.proxy_url || s.url || "";

    /**
     * FIX RELATIVE URLS
     */
    if (streamUrl && !streamUrl.startsWith("http")) {
        streamUrl =
            WORKER_BASE +
            (streamUrl.startsWith("/") ? "" : "/") +
            streamUrl;
    }

    if (!streamUrl) return null;

    /**
     * QUALITY
     */
    let quality = "Auto";

    if (s.resolution) {
        const match = String(s.resolution).match(/(\d+)/);
        quality = match
            ? match[1] + "p"
            : String(s.resolution);
    }

    /**
     * LANGUAGE
     */
    let lang = "Original";

    const langMatch = (s.name || "").match(/\(([^)]+)\)/);

    if (langMatch) {
        lang = langMatch[1];
    }

    /**
     * STREAM NAME
     */
    const streamName =
        `📥 MovieBox | ${quality} | ${lang}`;

    /**
     * TITLE LINES
     */
    const lines = [];

    const baseTitle =
        (s.title || "")
            .split(" S0")[0]
            .split(" S1")[0]
            .trim();

    let epTag = "";

    if (isTv && season != null && episode != null) {
        epTag =
            ` · S${String(season).padStart(2, "0")}` +
            `E${String(episode).padStart(2, "0")}`;
    }

    lines.push(baseTitle + epTag);

    let techLine =
        `🎥 ${quality} · 🔊 ${lang}`;

    if (s.codec) {
        techLine += ` · 🎞 ${s.codec}`;
    }

    if (s.format) {
        techLine += ` · [${s.format}]`;
    }

    lines.push(techLine);

    if (s.size_mb > 0) {

        let meta = `💾 ${s.size_mb} MB`;

        if (s.duration_s) {
            meta +=
                ` · ⏱ ${Math.round(s.duration_s / 60)} min`;
        }

        lines.push(meta);
    }

    lines.push("By Murph Streams ⚡");

    /**
     * FINAL STREAM
     */
    return {

        name: streamName,

        title: lines.join("\n"),

        url: streamUrl,

        behaviorHints: {

            /**
             * ANDROID TV SAFE
             */
            notWebReady: false,

            /**
             * FORCE REFRESH
             */
            bingeGroup: "moviebox-v5-refresh"
        },

        /**
         * TELL INDEX.JS NOT TO PROXY AGAIN
         */
        isMovieBoxDirect: true
    };
}

/**
 * MAIN EXPORT
 */
async function getStreams(tmdbId, mediaType, season, episode) {

    const isTv =
        mediaType === "tv" ||
        mediaType === "series";

    const se = isTv
        ? season || 1
        : null;

    const ep = isTv
        ? episode || 1
        : null;

    const cacheKey =
        `mb::v5::${tmdbId}::${mediaType}::${se}::${ep}`;

    const cached = getCached(cacheKey);

    if (cached) {
        console.log(`${TAG} Cache HIT → ${cached.length} streams`);
        return cached;
    }

    console.log(
        `${TAG} ▶ ${tmdbId} ${mediaType}` +
        `${isTv ? ` S${se}E${ep}` : ""}`
    );

    try {

        const raw =
            await fetchFromWorker(
                tmdbId,
                mediaType,
                se,
                ep
            );

        if (!raw.length) {
            console.log(`${TAG} No streams returned`);
            return [];
        }

        const streams = raw
            .map(s => buildStream(s, isTv, se, ep))
            .filter(Boolean);

        /**
         * SORT STREAMS
         * Hindi first → higher quality first
         */
        const langPriority = lang => {

            const l =
                String(lang)
                    .toLowerCase()
                    .trim();

            if (l === "original") return 0;
            if (l === "hindi") return 1;
            if (l === "hindi dub") return 1;

            return 2;
        };

        streams.sort((a, b) => {

            const la =
                (a.name.split("|").pop() || "").trim();

            const lb =
                (b.name.split("|").pop() || "").trim();

            const pa = langPriority(la);
            const pb = langPriority(lb);

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

            if (qb !== qa) {
                return qb - qa;
            }

            return la.localeCompare(lb);
        });

        console.log(`${TAG} ✔ ${streams.length} streams ready`);

        setCached(cacheKey, streams);

        return streams;

    } catch (err) {

        console.log(`${TAG} Error → ${err.message}`);

        return [];
    }
}

/**
 * EXPORT
 */
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        getStreams: getStreams
    };
} else {
    global.getStreams = getStreams;
}

/**
 * ╔════════════════════════════════════════════════════════════╗
 * ║        ANDROID TV COMPATIBILITY NORMALIZER                ║
 * ╚════════════════════════════════════════════════════════════╝
 */

function __movieboxNormalizeStream(rawStream) {

    if (!rawStream || !rawStream.url) {
        return null;
    }

    return {

        /**
         * CLEAN SAFE VALUES ONLY
         */
        name: rawStream.name,

        title: rawStream.title,

        url: rawStream.url,

        behaviorHints: {

            /**
             * STREMIO ANDROID TV SAFE
             */
            notWebReady: false,

            /**
             * FORCE UI REFRESH
             */
            bingeGroup: "moviebox-v5-refresh"
        },

        /**
         * KEEP DIRECT PLAYBACK
         */
        isMovieBoxDirect: true
    };
}

/**
 * WRAP getStreams()
 */
(function () {

    if (
        typeof getStreams !== "function" ||
        getStreams.__movieboxNormalizedWrapped
    ) {
        return;
    }

    const __movieboxOriginalGetStreams = getStreams;

    const __movieboxNormalizedGetStreams =
        function () {

            return Promise.resolve(
                __movieboxOriginalGetStreams.apply(
                    this,
                    arguments
                )
            ).then(function (streams) {

                if (!Array.isArray(streams)) {
                    return [];
                }

                return streams
                    .map(__movieboxNormalizeStream)
                    .filter(Boolean);
            });
        };

    __movieboxNormalizedGetStreams.__movieboxNormalizedWrapped = true;

    getStreams = __movieboxNormalizedGetStreams;

    if (
        typeof module !== "undefined" &&
        module.exports
    ) {
        module.exports.getStreams = getStreams;

    } else if (typeof global !== "undefined") {

        global.getStreams = getStreams;
    }

})();
