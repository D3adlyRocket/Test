/**
 * MovieBox Provider v5.0 — Worker‑backed (Lightning)
 * Uses Cloudflare Worker: https://moviebox.s4nch1tt.workers.dev
 * Multi‑language support via lang=all.
 * No local scraping, no proxy issues.
 * By Murph Streams ⚡
 */

'use strict';

const WORKER_BASE = 'https://moviebox.s4nch1tt.workers.dev';
const TAG = '[MovieBox]';

// Simple LRU cache (20 min)
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
    cache.set(key, { val, ts: Date.now() });
}

/**
 * Fetch streams from the Cloudflare Worker.
 * Always includes proxy={WORKER_BASE} → every stream has a proxy_url.
 */
async function fetchFromWorker(tmdbId, mediaType, season, episode) {
    let url = `${WORKER_BASE}/streams?tmdb_id=${encodeURIComponent(tmdbId)}&type=${encodeURIComponent(mediaType)}&lang=all`;
    if (mediaType === 'tv') {
        url += `&se=${season || 1}&ep=${episode || 1}`;
    }

    console.log(`${TAG} Worker → ${url}`);

    const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'MurphAddon/4.3' },
        signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`Worker HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.streams) ? data.streams : (Array.isArray(data) ? data : []);
}

/**
 * Build a Stremio stream object from Worker output.
 * Uses proxy_url for playback — worker already handles Range + CORS.
 */
function buildStream(s, isTv, season, episode) {
    const streamUrl = s.proxy_url || s.url || '';
    if (!streamUrl) return null;

    // Quality
    let quality = 'Auto';
    if (s.resolution) {
        const match = String(s.resolution).match(/(\d+)/);
        quality = match ? match[1] + 'p' : String(s.resolution);
    }

    // Language from worker name pattern "MovieBox (Hindi) - 1080p"
    let lang = 'Original';
    const langMatch = (s.name || '').match(/\(([^)]+)\)/);
    if (langMatch) lang = langMatch[1];

    // Stream name - beautiful format like movieboz
    const streamName = `📥 MovieBox | ${quality} | ${lang}`;

    // Title lines (Stremio shows below stream name)
    const baseTitle = (s.title || '').split(' S0')[0].split(' S1')[0].trim();
    let epTag = '';
    if (isTv && season != null && episode != null) {
        epTag = ` · S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
    }
    const lines = [];
    lines.push(baseTitle + epTag);

    let techLine = `🎥 ${quality} · 🔊 ${lang}`;
    if (s.codec) techLine += ` · 🎞 ${s.codec}`;
    if (s.format) techLine += ` · [${s.format}]`;
    lines.push(techLine);

    if (s.size_mb > 0) {
        let meta = `💾 ${s.size_mb} MB`;
        if (s.duration_s) meta += ` · ⏱ ${Math.round(s.duration_s / 60)} min`;
        lines.push(meta);
    }
    lines.push("By Murph Streams ⚡");

    return {
        name:            streamName,
        title:           lines.join('\n'),
        url:             streamUrl,          // Worker proxy – already Range‑safe
        behaviorHints:   {
            notWebReady: false,              // Allow Stremio to play directly
            bingeGroup:  'moviebox'
        },
        // Flag to tell index.js: do NOT add local proxy – use as‑is
        isMovieBoxDirect: true
    };
}

// ─── Main export (used by index.js) ──────────────────────────────────────────
async function getStreams(tmdbId, mediaType, season, episode) {
    const isTv = mediaType === 'tv' || mediaType === 'series';
    const se   = isTv ? season || 1 : null;
    const ep   = isTv ? episode || 1 : null;

    const cacheKey = `mb::v2::${tmdbId}::${mediaType}::${se}::${ep}`;
    const cached   = getCached(cacheKey);
    if (cached) {
        console.log(`${TAG} Cache HIT → ${cached.length} streams`);
        return cached;
    }

    console.log(`${TAG} ▶ ${tmdbId} ${mediaType}${isTv ? ` S${se}E${ep}` : ''}`);

    try {
        const raw = await fetchFromWorker(tmdbId, mediaType, se, ep);
        if (!raw.length) {
            console.log(`${TAG} No streams returned`);
            return [];
        }

        const streams = raw
            .map(s => buildStream(s, isTv, se, ep))
            .filter(Boolean);

        // Sort: Hindi first, then other langs; quality desc within each
        const langPriority = lang => {
            const l = lang.toLowerCase().trim();
            if (l === 'original') return 0;
            if (l === 'hindi dub' || l === 'hindi') return 1;
            return 2;
        };
        streams.sort((a, b) => {
            const la = (a.name.split('|').pop() || '').trim();
            const lb = (b.name.split('|').pop() || '').trim();
            const pa = langPriority(la);
            const pb = langPriority(lb);
            if (pa !== pb) return pa - pb;
            const qa = parseInt(a.name.match(/\d+p/)?.[0] || 0);
            const qb = parseInt(b.name.match(/\d+p/)?.[0] || 0);
            if (qb !== qa) return qb - qa;
            return la.localeCompare(lb);
        });

        console.log(`${TAG} ✔ ${streams.length} streams ready`);
        setCached(cacheKey, streams);
        return streams;
    } catch (err) {
        console.error(`${TAG} Error: ${err.message}`);
        return [];
    }
}

module.exports = { getStreams };
