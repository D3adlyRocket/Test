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

        // STANDARDIZED URL CONSTRUCTION
        // Ensure both Movie and Series use the 'source=v3' structure
        const getUrl = (lang) => isSeries 
            ? `${MOVIEBOX_BASE}/source=v3|lang=${lang}|res=all/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
            : `${MOVIEBOX_BASE}/source=v3|lang=${lang}|res=all/stream/movie/${imdbId}.json`;

        const [englishData, hindiData] = await Promise.all([
            fetch(getUrl("en")).then(r => r.json()).catch(() => ({ streams: [] })),
            fetch(getUrl("hi")).then(r => r.json()).catch(() => ({ streams: [] }))
        ]);

        const allStreams = [];
        const seenUrls = new Set();

        // Process Streams
        const process = (data, label) => {
            if (data?.streams) {
                data.streams.forEach(s => {
                    if (!seenUrls.has(s.url)) {
                        seenUrls.add(s.url);
                        allStreams.push({ ...s, lang: label });
                    }
                });
            }
        };

        process(englishData, "English 🇺🇸");
        process(hindiData, "Hindi 🇮🇳");

        if (allStreams.length === 0) return [];

        // Final Mapping
        return allStreams.map(item => {
            const title = (item.title || "").toLowerCase();
            const res = /2160|4k/.test(title) ? "2160p" : 
                        /1080/.test(title) ? "1080p" : 
                        /720/.test(title) ? "720p" : 
                        /480/.test(title) ? "480p" : "360p";

            const fullLayout = `🎦 ${meta.title || meta.name}\n💎 ${res} | 🗣️ ${item.lang}\n🎞️ MKV | 🔗 ${PROVIDER_NAME}`;

            return {
                name: `${PROVIDER_NAME} | ${res} | ${item.lang.replace(' 🇺🇸','').replace(' 🇮🇳','')}`,
                title: fullLayout,
                size: fullLayout,
                description: fullLayout,
                url: item.url,
                behaviorHints: { proxyHeaders: { request: { "Referer": MOVIEBOX_BASE + "/" } } }
            };
        });

    } catch (err) {
        console.error("Fetch failed:", err);
        return [];
    }
}

module.exports = { getStreams };
