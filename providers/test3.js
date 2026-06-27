"use strict";

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

const decodeEntities = (str) => String(str || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

function makeStream(name, title, url, quality, headers, mediaInfo, lang) {
    var cleanName = decodeEntities(name || '').replace(/[\n\t]+/g, '').trim();
    var isHindi = lang === "Hindi";
    
    var label = PROVIDER_NAME + " | " + (quality || "1080p") + " | " + lang;
    var line1 = '🎦 ' + cleanName + (mediaInfo ? ' - ' + mediaInfo : '');
    var line2 = '💎 ' + (quality || "1080p") + ' | 🗣️ ' + (isHindi ? "English 🇺🇸 • Hindi 🇮🇳" : "English 🇺🇸");
    var line3 = '🎞️ MKV | 🎧 DD5.1 | 🔗 ' + PROVIDER_NAME;

    return {
        name: label,
        title: line1 + '\n' + line2 + '\n' + line3,
        url: url,
        behaviorHints: { proxyHeaders: { request: headers || { "Referer": MOVIEBOX_BASE + "/" } } }
    };
}

function fetchStreams(baseUrl, lang, meta, isSeries, imdbId, s, e) {
    return __async(this, null, function* () {
        // Construct URL exactly as the API expects
        const url = isSeries 
            ? `${baseUrl}/stream/series/${imdbId}:${(s || 1).toString().padStart(2, '0')}:${(e || 1).toString().padStart(2, '0')}.json`
            : `${baseUrl}/stream/movie/${imdbId}.json`;
            
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
        
        // Fetch TMDB metadata
        const tmdbRes = yield fetch(`https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`).then(r => r.json());
        const imdbId = tmdbRes?.external_ids?.imdb_id;
        if (!imdbId) return [];

        const meta = { title: tmdbRes.title || tmdbRes.name, info: isSeries ? `S${season}E${episode}` : "" };

        // Use the specific API segments defined in your request
        const apiEn = `${MOVIEBOX_BASE}/source=v3|lang=en|res=all`;
        const apiHi = `${MOVIEBOX_BASE}/source=v3|lang=hi|res=all`;

        const [enStreams, hiStreams] = yield Promise.all([
            fetchStreams(apiEn, "English", meta, isSeries, imdbId, season, episode),
            fetchStreams(apiHi, "Hindi", meta, isSeries, imdbId, season, episode)
        ]);

        return [...enStreams, ...hiStreams];
    });
}

module.exports = { getStreams };
