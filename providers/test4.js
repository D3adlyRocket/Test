/**
 * KMmovies Provider v2.1 – Stremio addon
 * By Murph Streams ⚡
 */

'use strict';

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const KMMOVIES_API = 'https://badboysxs-kmmovies.hf.space/search';
const PROVIDER_NAME = 'KMmovies';

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
    console.log(`[KMmovies] Fetching title: TMDB ${tmdbId} (${mediaType})`);
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
        console.error(`[KMmovies] Title fetch error: ${err.message}`);
    }
    return null;
}

function buildStreamTitle({ season, episode, quality, size, server, label, language }) {
    const lines = [];

    if (season != null && episode != null) {
        lines.push(`S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`);
    }

    lines.push(`🎥 ${quality || 'HD'} · 🔊 ${language || 'Hindi'}`);

    if (size) {
        lines.push(`💾 ${size}`);
    }

    const displayLabel = label || server || 'Skydrop';
    lines.push(`⚡ ${displayLabel}`);
    lines.push("By Murph Streams ⚡");

    return lines.join('\n');
}

function extractEpisodeNumber(epName) {
    if (!epName) return null;
    const match = epName.match(/\d+/);
    return match ? parseInt(match[0]) : null;
}

async function fetchKMMoviesStreams(title, season, episode) {
    const cacheKey = `${title}_${season || 0}_${episode || 0}`;
    const cached = getCached(streamCache, cacheKey);
    if (cached) {
        console.log(`[KMmovies] Cache HIT for ${title}`);
        return cached;
    }

    let apiUrl = `${KMMOVIES_API}?query=${encodeURIComponent(title)}`;
    if (season != null) {
        apiUrl += `&season=${season}`;
        if (episode != null) apiUrl += `&episode=${episode}`;
    }

    console.log(`[KMmovies] API URL: ${apiUrl}`);
    try {
        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(35000) });
        if (!res.ok) {
            console.log(`[KMmovies] API error: ${res.status}`);
            return [];
        }
        const data = await res.json();

        const streams = [];
        const type = data.type;
        const language = data.language || 'Hindi';
        const seasonsData = data.seasons || {};

        console.log(`[KMmovies] Raw API response: type=${type}, language=${language}, seasons keys=${Object.keys(seasonsData).join(',')}`);

        if (type === 'movie') {
            const qualities = data.qualities || {};
            for (const [quality, servers] of Object.entries(qualities)) {
                if (!servers || typeof servers !== 'object') continue;

                for (const [server, info] of Object.entries(servers)) {
                    const url = info?.url;
                    if (!url || !url.startsWith('http')) continue;

                    const size = info.size || info.label || '';
                    const lang = info.language || language;
                    const label = info.label || server;

                    const name = `📥 ${PROVIDER_NAME} | ${quality} | ${lang}`;
                    const streamTitle = buildStreamTitle({ quality, size, server: label, language: lang });

                    console.log(`[KMmovies] Adding movie stream: ${quality}, ${label}, url=${url.substring(0, 80)}`);
                    streams.push({
                        name,
                        title: streamTitle,
                        url
                    });
                }

                if (servers.combined && typeof servers.combined === 'object') {
                    for (const [server, info] of Object.entries(servers.combined)) {
                        if (server !== 'Skydrop') continue;
                        const url = info?.url;
                        if (!url || !url.startsWith('http')) continue;

                        const size = info.size || '';
                        const lang = info.language || language;
                        const label = info.label || server;

                        const name = `📥 ${PROVIDER_NAME} | ${quality} | ${lang}`;
                        const streamTitle = buildStreamTitle({ quality, size, label, language: lang });

                        streams.push({
                            name,
                            title: streamTitle,
                            url
                        });
                    }
                }
            }
        } else if (type === 'series') {
            if (season != null && seasonsData && seasonsData[String(season)]) {
                const seasonData = seasonsData[String(season)];
                const qualities = seasonData.qualities || {};

                for (const [quality, qData] of Object.entries(qualities)) {
                    const lang = qData.language || language;

                    if (qData.episodes && typeof qData.episodes === 'object') {
                        for (const [epName, epInfo] of Object.entries(qData.episodes)) {
                            const epServers = epInfo?.servers;
                            if (!epServers || typeof epServers !== 'object') continue;

                            const epNum = extractEpisodeNumber(epName);

                            if (episode != null && epNum !== episode) continue;

                            const currentEpisode = episode != null ? episode : epNum;

                            for (const [server, serverInfo] of Object.entries(epServers)) {
                                const epUrl = serverInfo?.url;
                                if (!epUrl || !epUrl.startsWith('http')) continue;

                                const epSize = serverInfo.size || epInfo.size || '';

                                const name = `📥 ${PROVIDER_NAME} | ${quality} | ${lang}`;
                                const streamTitle = buildStreamTitle({
                                    season,
                                    episode: currentEpisode,
                                    quality,
                                    size: epSize,
                                    server,
                                    language: lang
                                });

                                console.log(`[KMmovies] Adding episode stream: S${season}E${currentEpisode} ${quality}, url=${epUrl.substring(0, 80)}`);
                                streams.push({
                                    name,
                                    title: streamTitle,
                                    url: epUrl
                                });
                            }
                        }
                    }

                    if (qData.combined && typeof qData.combined === 'object') {
                        for (const [server, info] of Object.entries(qData.combined)) {
                            if (server !== 'Skydrop') continue;
                            const url = info?.url;
                            if (!url || !url.startsWith('http')) continue;

                            const size = info.size || '';
                            const lang = info.language || language;
                            const label = info.label || server;

                            const name = `📥 ${PROVIDER_NAME} | ${quality} | ${lang}`;
                            const streamTitle = buildStreamTitle({ quality, size, label, language: lang });

                            streams.push({
                                name,
                                title: streamTitle,
                                url
                            });
                        }
                    }
                }
            } else {
                console.log('[KMmovies] Series requested without season; skipping.');
            }
        }

        console.log(`[KMmovies] Resolved ${streams.length} streams`);
        setCache(streamCache, cacheKey, streams);
        return streams;
    } catch (err) {
        console.error(`[KMmovies] Error: ${err.message}`);
        return [];
    }
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const title = await getTitleFromTmdb(tmdbId, mediaType);
    if (!title) {
        console.log('[KMmovies] Could not fetch title, skipping.');
        return [];
    }
    return await fetchKMMoviesStreams(title, season, episode);
}

module.exports = { getStreams };
