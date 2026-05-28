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

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const API_BASE = "https://badboysxs-murph-api.hf.space";
const TAG = "[Movies4u]";

// In-memory cache to prevent redundant backend hit hammering
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return undefined; }
    return entry.val;
}

function setCached(key, val) {
    if (cache.size > 200) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
    cache.set(key, { val, ts: Date.now() });
}

async function fetchJson(url) {
    try {
        const resp = await fetch(url, { 
            method: "GET",
            signal: AbortSignal.timeout(120000),
            headers: { Accept: 'application/json', 'User-Agent': 'MurphAddon/7.0' }
        });
        return resp.ok ? await resp.json() : null;
    } catch (e) { 
        console.error(`${TAG} Fetch failed: ${e.message}`);
        return null; 
    }
}

async function tmdbMeta(tmdbId, mediaType) {
    const type = mediaType === 'tv' || mediaType === 'series' ? 'tv' : 'movie';
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const d = await fetchJson(url);
    if (!d) return null;
    return {
        title: type === 'tv' ? d.name : d.title,
        year: (type === 'tv' ? d.first_air_date : d.release_date || '').slice(0, 4)
    };
}

function buildStream(row, isTv, se, ep, movieTitle) {
    const lang = row.audio_lang || 'Original';
    const quality = row.quality || 'HD';
    const size = row.per_episode_size || row.file_size || '';
    const directUrl = row.direct_url || '';

    if (!directUrl) return null;

    const streamName = `📥 Movies4u | ${movieTitle}`;
    const lines = [];

    if (isTv && se != null && ep != null) {
        lines.push(`S${String(se).padStart(2, '0')}E${String(ep).padStart(2, '0')}`);
    }

    lines.push(`🎥 ${quality} · 🔊 ${lang}`);

    if (size && size !== 'N/A') {
        lines.push(`💾 ${size}`);
    }

    lines.push('⚡ FSL Direct');
    lines.push("By Murph Streams ⚡");

    return {
        name: streamName,
        title: lines.join('\n'),
        url: directUrl,
        behaviorHints: {
            notWebReady: false,
            bingeGroup: `movies4u-v3-refresh`
        }
    };
}

function extractStreams(results, isTv, se, ep, movieTitle) {
    const streams = [];
    for (const row of results) {
        let directUrl;

        if (isTv && row.episodes && row.episodes.length) {
            const matchingEp = ep != null
                ? row.episodes.find(e => e.episode === ep)
                : row.episodes[0];
            directUrl = matchingEp ? matchingEp.direct_url : row.episodes[0].direct_url;
        } else {
            directUrl = row.direct_url;
        }

        if (!directUrl || typeof directUrl !== 'string') {
            continue;
        }

        const s = buildStream({ ...row, direct_url: directUrl }, isTv, se, ep, movieTitle);
        if (s) streams.push(s);
    }
    
    // Sort highest resolution to lowest
    return streams.sort((a, b) => {
        const pa = parseInt((a.title || '').match(/\d+p/)?.[0] || 0);
        const pb = parseInt((b.title || '').match(/\d+p/)?.[0] || 0);
        return pb - pa;
    });
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const isTv = mediaType === 'tv' || mediaType === 'series';
    const se = isTv ? season || 1 : null;
    const ep = isTv ? episode || 1 : null;

    const cacheKey = `mfu::${tmdbId}::${mediaType}::${se}::${ep}`;
    const cached = getCached(cacheKey);
    if (cached) {
        return cached;
    }

    const meta = await tmdbMeta(tmdbId, mediaType);
    if (!meta || !meta.title) {
        return [];
    }

    const searchTitle = meta.title;

    try {
        const url = new URL(isTv ? '/api/mfu/series' : '/api/mfu/movie', API_BASE);
        url.searchParams.set('q', searchTitle);
        if (isTv) {
            url.searchParams.set('season', se);
            url.searchParams.set('episode', ep);
        }

        const data = await fetchJson(url.toString());
        if (!data || !data.results || data.results.length === 0) {
            return [];
        }

        const streams = extractStreams(data.results, isTv, se, ep, searchTitle);
        if (streams.length) setCached(cacheKey, streams);
        return streams;
    } catch (err) {
        return [];
    }
}

// Module system integration export
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
