"use strict";

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

const decodeEntities = (str) => str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

function makeStream(name, title, url, quality, headers, mediaInfo, lang) {
    var cleanName = decodeEntities(name || '').replace(/[\n\t]+/g, '').trim();
    
    // Logic for Language and Audio
    var isHindi = lang === "Hindi";
    var displayLanguages = isHindi ? "English 🇺🇸 • Hindi 🇮🇳" : "English 🇺🇸";
    var audioType = isHindi ? "Dual-Audio" : "Single Audio";
    
    // Layout Generation
    var displayQuality = quality || "1080p";
    var label = PROVIDER_NAME + " | " + displayQuality + " | " + (isHindi ? "Hindi" : "English");

    var line1 = '🎦 ' + cleanName;
    var line2 = '💎 ' + displayQuality + ' | 🗣️ ' + displayLanguages;
    var line3 = '🎞️ MKV | 🎧 DD5.1 | 🔗 ' + PROVIDER_NAME;

    var formattedTitle = line1 + '\n' + line2 + '\n' + line3;

    return {
        name: label,
        title: formattedTitle,
        url: url || "",
        behaviorHints: {
            proxyHeaders: { request: headers || { "Referer": MOVIEBOX_BASE + "/" } }
        }
    };
}

// Fetch helper to handle the new split API endpoints
function fetchStreams(url, lang, meta) {
    return __async(this, null, function* () {
        try {
            const response = yield fetch(url);
            const data = yield response.json();
            if (!data?.streams) return [];
            return data.streams.map(s => {
                const q = (s.title || "").match(/(\d{3,4}p)/i)?.[0] || "1080p";
                return makeStream(meta.title, s.title, s.url, q, null, meta.info, lang);
            });
        } catch { return []; }
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
    return __async(this, null, function* () {
        const isSeries = mediaType === "tv" || season != null || episode != null;
        const metaRes = yield fetch(`https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`).then(r => r.json());
        const imdbId = metaRes?.external_ids?.imdb_id || metaRes?.imdb_id;
        const meta = { title: metaRes.title || metaRes.name, info: isSeries ? `S${season}E${episode}` : "" };

        // Endpoints
        const enUrl = `${MOVIEBOX_BASE}/source=v3|lang=en|res=all/stream/${isSeries ? 'series' : 'movie'}/${imdbId}${isSeries ? ':' + season + ':' + episode : '.json'}`;
        const hiUrl = `${MOVIEBOX_BASE}/source=v3|lang=hi|res=all/stream/${isSeries ? 'series' : 'movie'}/${imdbId}${isSeries ? ':' + season + ':' + episode : '.json'}`;

        const [enStreams, hiStreams] = yield Promise.all([
            fetchStreams(enUrl, "English", meta),
            fetchStreams(hiUrl, "Hindi", meta)
        ]);

        return [...enStreams, ...hiStreams];
    });
}

module.exports = { getStreams };
