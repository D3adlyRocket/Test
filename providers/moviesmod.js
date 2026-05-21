/**
 * DahmerMovies Provider v1.0
 * Uses 111477.xyz Scraper API
 * By Murph Streams ⚡
 */

'use strict';

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const SCRAPER_API = 'https://dahmer.s4nch1ttt.workers.dev';
const PROVIDER_NAME = 'DahmerMovies';

const titleCache = new Map();
const streamCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

function getCached(cache, key) {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts > CACHE_TTL) {
        cache.delete(key);
        return undefined;
    }
    return entry.data;
}

function setCache(cache, key, data) {
    cache.set(key, { data, ts: Date.now() });
}

async function getTitleFromTmdb(tmdbId, mediaType) {
    const cacheKey = `${tmdbId}_${mediaType}`;
    const cached = getCached(titleCache, cacheKey);
    if (cached) return cached;

    const url = `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    console.log(`[DahmerMovies] Fetching title: TMDB ${tmdbId} (${mediaType})`);
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
        const data = await res.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        if (title) {
            setCache(titleCache, cacheKey, title);
            return title;
        }
    } catch (err) {
        console.error(`[DahmerMovies] Title fetch error: ${err.message}`);
    }
    return null;
}

function buildStreamTitle(season, episode, quality, size, codec, audio, source) {
    const lines = [];

    if (season != null && episode != null) {
        lines.push(`S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`);
    }

    lines.push(`🎥 ${quality} · 🔊 ${audio}`);

    if (size && size !== '-') {
        lines.push(`💾 ${size}`);
    }

    if (codec && codec !== 'Unknown') {
        lines.push(`🔧 ${codec}`);
    }

    if (source && source !== 'Unknown') {
        lines.push(`📀 ${source}`);
    }

    lines.push("By Murph Streams ⚡");

    return lines.join('\n');
}

function extractEpisodeNumber(epName) {
    if (!epName) return null;
    const match = epName.match(/S(\d+)E(\d+)/i) || epName.match(/E(\d+)/i) || epName.match(/Episode[\s._-]*(\d+)/i);
    return match ? parseInt(match[match.length - 1]) : null;
}

function extractSeasonNumber(seasonName) {
    if (!seasonName) return null;
    const match = seasonName.match(/Season\s*(\d+)/i) || seasonName.match(/S(\d+)/i);
    return match ? parseInt(match[1]) : null;
}

async function fetchDahmerStreams(title, season, episode) {
    const cacheKey = `${title}_${season || 0}_${episode || 0}`;
    const cached = getCached(streamCache, cacheKey);
    if (cached) {
        console.log(`[DahmerMovies] Cache HIT for ${title}`);
        return cached;
    }

    const streams = [];
    const isTv = season != null;

    try {
        let apiUrl = `${SCRAPER_API}/search?q=${encodeURIComponent(title)}`;
        
        if (isTv) {
            apiUrl += `&type=series`;
            if (season != null) {
                apiUrl += `&season=Season%20${season}`;
            }
        } else {
            apiUrl += `&type=movie`;
        }

        console.log(`[DahmerMovies] API URL: ${apiUrl}`);
        
        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(60000) });
        if (!res.ok) {
            console.log(`[DahmerMovies] API error: ${res.status}`);
            return [];
        }
        
        const data = await res.json();
        
        if (!data || (data.message && data.message.includes('No'))) {
            console.log(`[DahmerMovies] No results found`);
            return [];
        }

        console.log(`[DahmerMovies] Raw API response:`, JSON.stringify(data).substring(0, 500));

        if (isTv) {
            const episodes = data.episodes || [];
            console.log(`[DahmerMovies] Found ${episodes.length} episodes, requested episode=${episode}`);

            for (const ep of episodes) {
                const epName = ep.name || '';
                const epNum = extractEpisodeNumber(epName);
                
                if (episode != null && epNum !== null && epNum !== episode) continue;

                const currentEpisode = epNum || episode || 1;
                const seasonNum = season;
                
                const quality = ep.quality || 'HD';
                const size = ep.size || '';
                const codec = ep.codec || '';
                const audio = ep.audio || 'Unknown';
                const source = ep.source || '';
                const url = ep.url;

                if (!url || !url.startsWith('http')) {
                    console.log(`[DahmerMovies] Skipping invalid URL: ${url}`);
                    continue;
                }

                const name = `📥 ${PROVIDER_NAME} | ${quality} | ${audio}`;
                const streamTitle = buildStreamTitle(seasonNum, currentEpisode, quality, size, codec, audio, source);

                console.log(`[DahmerMovies] Adding: S${seasonNum}E${currentEpisode} ${quality}`);
                streams.push({
                    name,
                    title: streamTitle,
                    url
                });
            }
            console.log(`[DahmerMovies] Total streams after filtering: ${streams.length}`);
        } else {
            const files = data.files || [];
            console.log(`[DahmerMovies] Found ${files.length} movie files`);

            for (const file of files) {
                const quality = file.quality || 'HD';
                const size = file.size || '';
                const codec = file.codec || '';
                const audio = file.audio || 'Unknown';
                const source = file.source || '';
                const url = file.url;

                if (!url || !url.startsWith('http')) continue;

                const name = `📥 ${PROVIDER_NAME} | ${quality} | ${audio}`;
                const streamTitle = buildStreamTitle(null, null, quality, size, codec, audio, source);

                console.log(`[DahmerMovies] Adding movie: ${quality}, url=${url.substring(0, 80)}`);
                streams.push({
                    name,
                    title: streamTitle,
                    url
                });
            }
        }

        streams.sort((a, b) => {
            const pa = parseInt((a.name || '').match(/\d+p/)?.[0] || 0);
            const pb = parseInt((b.name || '').match(/\d+p/)?.[0] || 0);
            return pb - pa;
        });

        console.log(`[DahmerMovies] Resolved ${streams.length} streams`);
        setCache(streamCache, cacheKey, streams);
        return streams;
    } catch (err) {
        console.error(`[DahmerMovies] Error: ${err.message}`);
        return [];
    }
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const title = await getTitleFromTmdb(tmdbId, mediaType);
    if (!title) {
        console.log('[DahmerMovies] Could not fetch title, skipping.');
        return [];
    }
    return await fetchDahmerStreams(title, season, episode);
}

module.exports = { getStreams };
