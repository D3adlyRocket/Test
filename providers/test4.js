/**
 * Movies4u Provider v1.0
 * Uses Movies4u FastAPI: https://badboysxs-mfu.hf.space (backed v1)
 * Scrapes movies4u.promo with HubCloud FSL resolver via REST API.
 * By Murph Streams ⚡
 */

'use strict';

// Will be updated after HF Space deployment
const API_BASE = process.env.MFU_API_BASE || 'https://badboysxs-murph-api.hf.space';
const TAG = '[Movies4u]';

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

async function apiFetch(path, params) {
    const url = new URL(path, API_BASE);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null && v !== 0 && v !== '') url.searchParams.set(k, v);
        }
    }
    const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(120000),
        headers: { Accept: 'application/json', 'User-Agent': 'MurphAddon/7.0' }
    });
    if (!res.ok) throw new Error(`${TAG} HTTP ${res.status} for ${url}`);
    return res.json();
}

async function tmdbMeta(tmdbId, mediaType) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const res = await fetch(
        `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c`,
        { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return {
        title: mediaType === 'tv' ? d.name : d.title,
        year: (mediaType === 'tv' ? d.first_air_date : d.release_date || '').slice(0, 4)
    };
}

function buildStream(row, isTv, se, ep) {
    const lang = row.audio_lang || 'Original';
    const quality = row.quality || 'HD';
    const size = row.per_episode_size || row.file_size || '';
    const directUrl = row.direct_url || '';

    if (!directUrl) return null;

    const streamName = `📥 Movies4u | ${quality} | ${lang}`;

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
        name:          streamName,
        title:         lines.join('\n'),
        url:           directUrl,
        behaviorHints: {
            notWebReady: false,
            bingeGroup: `movies4u-${quality.toLowerCase()}`
        },
        isMovieBoxDirect: true
    };
}

function extractStreams(results, isTv, se, ep) {
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

        const s = buildStream({ ...row, direct_url: directUrl }, isTv, se, ep);
        if (s) streams.push(s);
    }
    streams.sort((a, b) => {
        const pa = parseInt((a.name || '').match(/\d+p/)?.[0] || 0);
        const pb = parseInt((b.name || '').match(/\d+p/)?.[0] || 0);
        return pb - pa;
    });
    return streams;
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const isTv = mediaType === 'tv' || mediaType === 'series';
    const se = isTv ? season || 1 : null;
    const ep = isTv ? episode || 1 : null;

    const cacheKey = `mfu::${tmdbId}::${mediaType}::${se}::${ep}`;
    const cached = getCached(cacheKey);
    if (cached) {
        console.log(`${TAG} Cache HIT → ${cached.length} streams`);
        return cached;
    }

    const meta = await tmdbMeta(tmdbId, mediaType);
    if (!meta) {
        console.log(`${TAG} No TMDB meta for ${tmdbId}`);
        return [];
    }

    const searchTitle = meta.title;
    console.log(`${TAG} ▶ ${searchTitle} ${mediaType}${isTv ? ` S${se}E${ep}` : ''}`);

    try {
        let data;
        if (isTv) {
            data = await apiFetch('/api/mfu/series', { q: searchTitle, season: se, episode: ep });
        } else {
            data = await apiFetch('/api/mfu/movie', { q: searchTitle });
        }

        if (!data.results || data.results.length === 0) {
            console.log(`${TAG} API returned no results for "${searchTitle}"`);
            return [];
        }

        const streams = extractStreams(data.results, isTv, se, ep);
        console.log(`${TAG} ✓ ${streams.length} streams for "${searchTitle}"`);
        if (streams.length) setCached(cacheKey, streams);
        return streams;
    } catch (err) {
        console.error(`${TAG} ✗ ${err.message}`);
        return [];
    }
}

module.exports = { getStreams };
