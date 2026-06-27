"use strict";

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

/**
 * Uses the Unicode range for Devanagari (\u0900-\u097F) 
 * to detect if the title contains Hindi script.
 */
function isHindi(text) {
    const devanagariRegex = /[\u0900-\u097F]+/;
    return devanagariRegex.test(text);
}

function getQuality(title) {
    const t = title.toLowerCase();
    if (/2160|4k/i.test(t)) return "2160p";
    if (/1080/i.test(t)) return "1080p";
    if (/720/i.test(t)) return "720p";
    if (/480/i.test(t)) return "480p";
    return "360p";
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const isSeries = mediaType === 'tv' || mediaType === 'series';
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    
    const meta = await fetch(tmdbUrl).then(r => r.json());
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    const url = isSeries 
        ? `${MOVIEBOX_BASE}/source=v3|lang=all|res=all/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
        : `${MOVIEBOX_BASE}/source=v3|lang=all|res=all/stream/movie/${imdbId}.json`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!data?.streams) return [];

        const uniqueStreams = new Map();
        
        data.streams.forEach(item => {
            const hindiDetected = isHindi(item.title);
            const lang = hindiDetected ? "Hindi" : "English";
            const quality = getQuality(item.title);
            
            // Deduplicate by URL
            if (!uniqueStreams.has(item.url)) {
                const fullLayout = `🎦 ${meta.title || meta.name}\n💎 ${quality} | 🗣️ ${lang === "Hindi" ? "Hindi 🇮🇳 • English 🇺🇸" : "English 🇺🇸"}\n🎞️ MKV | 🔗 ${PROVIDER_NAME}`;
                
                uniqueStreams.set(item.url, {
                    name: `${PROVIDER_NAME} | ${quality} | ${lang}`,
                    title: fullLayout,
                    size: fullLayout,
                    description: fullLayout,
                    url: item.url,
                    behaviorHints: { proxyHeaders: { request: { "Referer": MOVIEBOX_BASE + "/" } } }
                });
            }
        });

        return Array.from(uniqueStreams.values());
    } catch (e) { 
        console.error("MovieBox Fetch Error:", e);
        return []; 
    }
}

module.exports = { getStreams };
