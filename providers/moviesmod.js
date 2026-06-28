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

        const englishUrl = isSeries
    ? `${MOVIEBOX_BASE}/source=v3|lang=en|res=all/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
    : `${MOVIEBOX_BASE}/lang=en/stream/movie/${imdbId}.json`;

const hindiUrl = isSeries
    ? `${MOVIEBOX_BASE}/source=v3|lang=hi|res=all/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
    : `${MOVIEBOX_BASE}/source=v3|lang=hi|res=all/stream/movie/${imdbId}.json`;

const [englishData, hindiData] = await Promise.all([
    fetch(englishUrl).then(r => r.json()),
    fetch(hindiUrl).then(r => r.json())
]);

const allStreams = [];
const seenUrls = new Set();

if (englishData?.streams) {
    englishData.streams.forEach(s => {
        if (!seenUrls.has(s.url)) {
            seenUrls.add(s.url);
            allStreams.push({
                ...s,
                lang: "English 🇺🇸"
            });
        }
    });
}

if (hindiData?.streams) {
    hindiData.streams.forEach(s => {
        if (!seenUrls.has(s.url)) {
            seenUrls.add(s.url);
            allStreams.push({
                ...s,
                lang: "Hindi 🇮🇳"
            });
        }
    });
}

if (allStreams.length === 0) return [];

        const result = [];

// Group by res + language
const grouped = {};

allStreams.forEach(item => {
    const title = (item.title || "").toLowerCase();

    const res =
        /2160|4k/.test(title) ? "2160p" :
        /1080/.test(title) ? "1080p" :
        /720/.test(title) ? "720p" :
        /480/.test(title) ? "480p" :
        "360p";

    const key = `${res}-${item.lang}`;

    if (!grouped[key]) grouped[key] = [];

    grouped[key].push(item);
});

// Build final result
Object.entries(grouped).forEach(([key, items]) => {
    const [res, lang] = key.split("-");

    items.forEach(item => {
        const fullLayout =
`🎦 ${meta.title || meta.name}
💎 ${res} | 🗣️ ${lang}
🎞️ MKV | 🔗 ${PROVIDER_NAME}`;

        result.push({
            name: `${PROVIDER_NAME} | ${res} | ${lang}`,
            title: fullLayout,
            size: fullLayout,
            description: fullLayout,
            url: item.url,
            behaviorHints: {
                proxyHeaders: {
                    request: {
                        "Referer": MOVIEBOX_BASE + "/"
                    }
                }
            }
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
