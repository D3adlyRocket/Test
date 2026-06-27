"use strict";

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

async function getStreams(tmdbId, mediaType, season, episode) {
    const isSeries = mediaType === 'tv' || mediaType === 'series';
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

    try {
        const meta = await fetch(tmdbUrl).then(r => r.json());
        const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
        if (!imdbId) return [];

        const url = isSeries 
            ? `${MOVIEBOX_BASE}/source=v3|lang=all|res=all/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
            : `${MOVIEBOX_BASE}/source=v3|lang=all|res=all/stream/movie/${imdbId}.json`;

        const response = await fetch(url);
        const data = await response.json();
        
        if (!data?.streams || data.streams.length === 0) return [];

        // 1. Group by resolution
        const groups = { "2160p": [], "1080p": [], "720p": [], "480p": [], "360p": [] };
        data.streams.forEach(s => {
            const title = s.title.toLowerCase();
            const res = /2160|4k/.test(title) ? "2160p" : /1080/.test(title) ? "1080p" : /720/.test(title) ? "720p" : /480/.test(title) ? "480p" : "360p";
            groups[res].push(s);
        });

        // 2. Interleave English (Even) and Hindi (Odd)
        const result = [];
        Object.keys(groups).forEach(res => {
            groups[res].forEach((item, index) => {
                const lang = (index % 2 === 0) ? "English" : "Hindi";
                const fullLayout = `🎦 ${meta.title || meta.name}\n💎 ${res} | 🗣️ ${lang === "Hindi" ? "Hindi 🇮🇳 • English 🇺🇸" : "English 🇺🇸"}\n🎞️ MKV | 🔗 ${PROVIDER_NAME}`;
                
                result.push({
                    name: `${PROVIDER_NAME} | ${res} | ${lang}`,
                    title: fullLayout,
                    size: fullLayout,
                    description: fullLayout,
                    url: item.url,
                    behaviorHints: { proxyHeaders: { request: { "Referer": MOVIEBOX_BASE + "/" } } }
                });
            });
        });
        
        return result;
    } catch (err) {
        console.error("Fetch failed:", err);
        return [];
    }
}

module.exports = { getStreams };
