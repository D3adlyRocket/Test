"use strict";

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

function detectLanguage(title) {
    const t = title.toLowerCase();
    // Local logic to detect Hindi vs English based on the title string
    if (t.includes("hindi") || t.includes("hin")) return "Hindi";
    return "English";
}

function detectQuality(title) {
    const t = title.toLowerCase();
    if (t.includes("2160") || t.includes("4k")) return "2160p";
    if (t.includes("1080")) return "1080p";
    if (t.includes("720")) return "720p";
    if (t.includes("480")) return "480p";
    return "1080p";
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const isSeries = mediaType === 'tv' || mediaType === 'series';
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    
    const meta = await fetch(tmdbUrl).then(r => r.json());
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    // Use the 'all' endpoint that we know works
    const url = isSeries 
        ? `${MOVIEBOX_BASE}/source=v3|lang=all|res=all/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
        : `${MOVIEBOX_BASE}/source=v3|lang=all|res=all/stream/movie/${imdbId}.json`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!data?.streams) return [];

        // Return the mapped and formatted stream objects
        return data.streams.map(item => {
            const lang = detectLanguage(item.title);
            const quality = detectQuality(item.title);
            
            // Reusing your layout logic
            const shortName = `${PROVIDER_NAME} | ${quality} | ${lang}`;
            const fullLayout = `🎦 ${meta.title || meta.name}\n💎 ${quality} | 🗣️ ${lang === "Hindi" ? "English 🇺🇸 • Hindi 🇮🇳" : "English 🇺🇸"}\n🎞️ MKV | 🔗 ${PROVIDER_NAME}`;
            
            return {
                name: shortName,
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
