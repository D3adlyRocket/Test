"use strict";

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

async function fetchFromEndpoint(langCode, label, imdbId, isSeries, s, e, meta) {
    const url = isSeries 
        ? `${MOVIEBOX_BASE}/source=v3|lang=${langCode}|res=all/stream/series/${imdbId}:${s}:${e}.json`
        : `${MOVIEBOX_BASE}/source=v3|lang=${langCode}|res=all/stream/movie/${imdbId}.json`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!data?.streams) return [];

        return data.streams.map(item => {
            const quality = /2160|4k/i.test(item.title) ? "2160p" : 
                            /1080/i.test(item.title) ? "1080p" : 
                            /720/i.test(item.title) ? "720p" : 
                            /480/i.test(item.title) ? "480p" : "360p";
            
            const fullLayout = `🎦 ${meta.title || meta.name}\n💎 ${quality} | 🗣️ ${label === "Hindi" ? "Hindi 🇮🇳" : "English 🇺🇸"}\n🎞️ MKV | 🔗 ${PROVIDER_NAME}`;

            return {
                url: item.url,
                streamObj: {
                    name: `${PROVIDER_NAME} | ${quality} | ${label}`,
                    title: fullLayout,
                    size: fullLayout,
                    description: fullLayout,
                    url: item.url,
                    behaviorHints: { proxyHeaders: { request: { "Referer": MOVIEBOX_BASE + "/" } } }
                }
            };
        });
    } catch (e) { return []; }
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const isSeries = mediaType === 'tv' || mediaType === 'series';
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    
    const meta = await fetch(tmdbUrl).then(r => r.json());
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    // Fetch BOTH endpoints
    const [enResults, hiResults] = await Promise.all([
        fetchFromEndpoint("en", "English", imdbId, isSeries, season || 1, episode || 1, meta),
        fetchFromEndpoint("hi", "Hindi", imdbId, isSeries, season || 1, episode || 1, meta)
    ]);

    // Deduplicate: If an English fetch and a Hindi fetch return the same URL,
    // we keep the Hindi version because it's more specific.
    const combined = [...enResults, ...hiResults];
    const uniqueMap = new Map();
    
    combined.forEach(item => {
        // If we already have the URL, we only replace it if the new one is Hindi
        if (!uniqueMap.has(item.url) || item.streamObj.name.includes("Hindi")) {
            uniqueMap.set(item.url, item.streamObj);
        }
    });

    return Array.from(uniqueMap.values());
}

module.exports = { getStreams };
