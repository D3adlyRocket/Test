"use strict";

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

async function getStreams(tmdbId, mediaType, season, episode) {
    const isSeries = mediaType === 'tv' || mediaType === 'series';
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    
    const meta = await fetch(tmdbUrl).then(r => r.json());
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    // Fetch the full list
    const url = isSeries 
        ? `${MOVIEBOX_BASE}/source=v3|lang=all|res=all/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
        : `${MOVIEBOX_BASE}/source=v3|lang=all|res=all/stream/movie/${imdbId}.json`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!data?.streams || data.streams.length === 0) return [];

        // YOUR LOGIC: Split the total list into two halves
        // If there are 6 links, first 3 = English, last 3 = Hindi
        const midPoint = Math.floor(data.streams.length / 2);
        
        return data.streams.map((item, index) => {
            const isHindi = index >= midPoint;
            const lang = isHindi ? "Hindi" : "English";
            
            // Quality detection (the part you liked)
            const quality = /2160|4k/i.test(item.title) ? "2160p" : 
                            /1080/i.test(item.title) ? "1080p" : 
                            /720/i.test(item.title) ? "720p" : 
                            /480/i.test(item.title) ? "480p" : "360p";
            
            const fullLayout = `🎦 ${meta.title || meta.name}\n💎 ${quality} | 🗣️ ${lang === "Hindi" ? "Hindi 🇮🇳 • English 🇺🇸" : "English 🇺🇸"}\n🎞️ MKV | 🔗 ${PROVIDER_NAME}`;
            
            return {
                name: `${PROVIDER_NAME} | ${quality} | ${lang}`,
                title: fullLayout,
                size: fullLayout,
                description: fullLayout,
                url: item.url,
                behaviorHints: { proxyHeaders: { request: { "Referer": MOVIEBOX_BASE + "/" } } }
            };
        });
    } catch (e) { 
        return []; 
    }
}

module.exports = { getStreams };
