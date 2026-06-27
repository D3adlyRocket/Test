"use strict";

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

async function fetchFromEndpoint(langCode, label, imdbId, isSeries, s, e, meta) {
    // This is the cache-busting URL logic
    const url = isSeries 
        ? `${MOVIEBOX_BASE}/source=v3|lang=${langCode}|res=all/stream/series/${imdbId}:${s}:${e}.json?t=${Date.now()}`
        : `${MOVIEBOX_BASE}/source=v3|lang=${langCode}|res=all/stream/movie/${imdbId}.json?t=${Date.now()}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!data?.streams) return [];

        return data.streams.map(item => ({ ...item, lang: label }));
    } catch (e) { return []; }
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const isSeries = mediaType === 'tv' || mediaType === 'series';
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    
    const meta = await fetch(tmdbUrl).then(r => r.json());
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    // 1. Fire requests using the fetcher that includes the cache-buster
    const [enResults, hiResults] = await Promise.all([
        fetchFromEndpoint("en", "English", imdbId, isSeries, season || 1, episode || 1, meta),
        fetchFromEndpoint("hi", "Hindi", imdbId, isSeries, season || 1, episode || 1, meta)
    ]);

    // 2. Combine and Deduplicate
    const combined = [...enResults, ...hiResults];
    const uniqueStreams = new Map();
    
    combined.forEach(s => {
        // Prioritize Hindi if the same URL is returned by both
        if (!uniqueStreams.has(s.url) || s.lang === 'Hindi') {
            const quality = /2160|4k/i.test(s.title) ? "2160p" : 
                            /1080/i.test(s.title) ? "1080p" : 
                            /720/i.test(s.title) ? "720p" : 
                            /480/i.test(s.title) ? "480p" : "360p";
            
            const fullLayout = `🎦 ${meta.title || meta.name}\n💎 ${quality} | 🗣️ ${s.lang === "Hindi" ? "Hindi 🇮🇳 • English 🇺🇸" : "English 🇺🇸"}\n🎞️ MKV | 🔗 ${PROVIDER_NAME}`;
            
            uniqueStreams.set(s.url, {
                name: `${PROVIDER_NAME} | ${quality} | ${s.lang}`,
                title: fullLayout,
                size: fullLayout,
                description: fullLayout,
                url: s.url,
                behaviorHints: { proxyHeaders: { request: { "Referer": MOVIEBOX_BASE + "/" } } }
            });
        }
    });
    
    return Array.from(uniqueStreams.values());
}

module.exports = { getStreams };
