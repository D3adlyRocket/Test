/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║            Movies4u — Nuvio Stream Plugin Optimized for Android TV            ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Source     › https://movies4u.promo                                               ║
 * ║  Author     › Murph Streams ⚡                                                      ║
 * ║  Backend    › https://badboysxs-murph-api.hf.space                                 ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Supports   › Movies & Series (HD / FSL Direct)                                   ║
 * ║  Chain      › Movies4u FastAPI → HubCloud FSL Resolver                             ║
 * ║  Parallel   › Asynchronous API query handling with caching                         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

"use strict";

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var API_BASE = "https://badboysxs-murph-api.hf.space";
var TAG = "[Movies4u]";

var cache = new Map();
var CACHE_TTL = 15 * 60 * 1000;

function getCached(key) {
    var entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return undefined; }
    return entry.val;
}

function setCached(key, val) {
    if (cache.size > 200) {
        var oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
    cache.set(key, { val: val, ts: Date.now() });
}

async function fetchJson(url) {
    try {
        var resp = await fetch(url, { 
            method: "GET",
            headers: { 
                "Accept": "application/json", 
                "User-Agent": "MurphAddon/7.0"
            }
        });
        return resp.ok ? await resp.json() : null;
    } catch (e) { 
        return null; 
    }
}

async function tmdbMeta(tmdbId, mediaType) {
    var type = (mediaType === "tv" || mediaType === "series") ? "tv" : "movie";
    var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
    var d = await fetchJson(url);
    if (!d) return null;
    return {
        title: type === "tv" ? d.name : d.title
    };
}

function buildStream(row, isTv, se, ep, movieTitle) {
    var lang = row.audio_lang || "Original";
    var quality = row.quality || "HD";
    var size = row.per_episode_size || row.file_size || "";
    var directUrl = row.direct_url || "";

    if (!directUrl) return null;

    var streamName = "Movies4u | " + movieTitle;
    var lines = [];

    if (isTv && se != null && ep != null) {
        lines.push("S" + String(se).padStart(2, "0") + "E" + String(ep).padStart(2, "0"));
    }

    lines.push("🎥 " + quality + " · 🔊 " + lang);

    if (size && size !== "N/A") {
        lines.push("💾 " + size);
    }

    lines.push("⚡ FSL Direct");
    lines.push("By Murph Streams ⚡");

    return {
        name: streamName,
        title: lines.join("\n"),
        url: directUrl,
        behaviorHints: {
            notWebReady: false,
            bingeGroup: "movies4u-v3-refresh"
        }
    };
}

function extractStreams(results, isTv, se, ep, movieTitle) {
    var streams = [];
    for (var i = 0; i < results.length; i++) {
        var row = results[i];
        var directUrl = "";

        if (isTv && row.episodes && row.episodes.length) {
            var matchingEp = ep != null
                ? row.episodes.find(function(e) { return e.episode === ep; })
                : row.episodes[0];
            directUrl = matchingEp ? matchingEp.direct_url : row.episodes[0].direct_url;
        } else {
            directUrl = row.direct_url;
        }

        if (!directUrl || typeof directUrl !== "string") {
            continue;
        }

        var s = buildStream({ ...row, direct_url: directUrl }, isTv, se, ep, movieTitle);
        if (s) streams.push(s);
    }
    
    return streams;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    var isTv = mediaType === "tv" || mediaType === "series";
    var se = isTv ? season || 1 : null;
    var ep = isTv ? episode || 1 : null;

    var cacheKey = "mfu::" + tmdbId + "::" + mediaType + "::" + se + "::" + ep;
    var cached = getCached(cacheKey);
    if (cached) return cached;

    var meta = await tmdbMeta(tmdbId, mediaType);
    if (!meta || !meta.title) return [];

    var searchTitle = meta.title;

    try {
        // Direct safe URL concatenation to bypass standard runtime URL object mutations
        var endpoint = isTv 
            ? API_BASE + "/api/mfu/series?q=" + encodeURIComponent(searchTitle) + "&season=" + se + "&episode=" + ep
            : API_BASE + "/api/mfu/movie?q=" + encodeURIComponent(searchTitle);

        var data = await fetchJson(endpoint);
        if (!data || !data.results || data.results.length === 0) {
            return [];
        }

        var streams = extractStreams(data.results, isTv, se, ep, searchTitle);
        if (streams.length) setCached(cacheKey, streams);
        return streams;
    } catch (err) {
        return [];
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}

/**
 * ANDROID TV COMPATIBILITY NORMALIZER
 */
function __doomNormalizeStream(rawStream) {
    if (!rawStream || !rawStream.url) return null;

    return {
        name: rawStream.name,
        title: rawStream.title,
        url: rawStream.url,
        behaviorHints: rawStream.behaviorHints
    };
}

(function() {
    if (typeof getStreams !== "function" || getStreams.__doomNormalizedWrapped) return;

    var __doomOriginalGetStreams = getStreams;
    var __doomNormalizedGetStreams = function() {
        return Promise.resolve(__doomOriginalGetStreams.apply(this, arguments))
            .then(function(streams) {
                if (!Array.isArray(streams)) return [];
                return streams.map(__doomNormalizeStream).filter(Boolean);
            });
    };

    __doomNormalizedGetStreams.__doomNormalizedWrapped = true;
    getStreams = __doomNormalizedGetStreams;

    if (typeof module !== "undefined" && module.exports) {
        module.exports.getStreams = getStreams;
    } else if (typeof global !== "undefined") {
        global.getStreams = getStreams;
    }
})();
