"use strict";

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

/**
 * HIGH-PRECISION DETECTORS
 * Scans title and URL to correctly identify language and resolution.
 */
function getBetterLanguage(item) {
    const title = (item.title || "").toLowerCase();
    const url = (item.url || "").toLowerCase();
    // Prioritize URL patterns over title strings for accuracy
    if (url.includes("hindi") || title.includes("hindi") || title.includes("hin")) return "Hindi";
    return "English";
}

function getBetterQuality(item) {
    const title = (item.title || "").toLowerCase();
    // Use precise regex to identify resolution
    if (/2160|4k/i.test(title)) return "2160p";
    if (/1080/i.test(title)) return "1080p";
    if (/720/i.test(title)) return "720p";
    if (/480/i.test(title)) return "480p";
    if (/360/i.test(title)) return "360p";
    return "1080p"; // Fallback
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const isSeries = mediaType === 'tv' || mediaType === 'series';
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    
    // Fetch Metadata
    const meta = await fetch(tmdbUrl).then(r => r.json());
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    // Fetch from the 'all' endpoint to ensure no links are filtered out
    const url = isSeries 
        ? `${MOVIEBOX_BASE}/source=v3|lang=all|res=all/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
        : `${MOVIEBOX_BASE}/source=v3|lang=all|res=all/stream/movie/${imdbId}.json`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!data?.streams) return [];

        // Map and format each stream
        return data.streams.map(item => {
            const lang = getBetterLanguage(item);
            const quality = getBetterQuality(item);
            
            // RICH LAYOUT for Mobile/TV
            const fullLayout = `🎦 ${meta.title || meta.name}\n💎 ${quality} | 🗣️ ${lang === "Hindi" ? "Hindi 🇮🇳 • English 🇺🇸" : "English 🇺🇸"}\n🎞️ MKV | 🔗 ${PROVIDER_NAME}`;
            
            return {
                name: `${PROVIDER_NAME} | ${quality} | ${lang}`,
                title: fullLayout,
                size: fullLayout, // Ensures mobile displays the full multi-line layout
                description: fullLayout,
                url: item.url,
                behaviorHints: { proxyHeaders: { request: { "Referer": MOVIEBOX_BASE + "/" } } }
            };
        });
    } catch (e) { 
        console.error("MovieBox Fetch Error:", e);
        return []; 
    }
}

module.exports = { getStreams };
