"use strict";

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

function formatStreamLayout(name, title, url, quality, lang, isSeries, s, e) {
    var mediaInfo = isSeries ? `S${s.toString().padStart(2,'0')}E${e.toString().padStart(2,'0')}` : "";
    var isHindi = lang === "Hindi";
    
    // The "Rich" Layout
    var line1 = '🎦 ' + name + (mediaInfo ? ' - ' + mediaInfo : '');
    var line2 = '💎 ' + (quality || "1080p") + ' | 🗣️ ' + (isHindi ? "English 🇺🇸 • Hindi 🇮🇳" : "English 🇺🇸");
    var line3 = '🎞️ MKV | 🎧 DD5.1 | 🔗 ' + PROVIDER_NAME;
    var fullLayout = line1 + '\n' + line2 + '\n' + line3;

    return {
        // Populating all fields ensures Mobile UI fallback works
        name: PROVIDER_NAME + " | " + (quality || "1080p") + " | " + lang,
        title: fullLayout,
        size: fullLayout, 
        description: fullLayout,
        url: url,
        behaviorHints: { proxyHeaders: { request: { "Referer": MOVIEBOX_BASE + "/" } } }
    };
}

async function fetchLanguageStreams(langCode, langName, imdbId, isSeries, s, e, title) {
    const url = isSeries 
        ? `${MOVIEBOX_BASE}/source=v3|lang=${langCode}|res=all/stream/series/${imdbId}:${s}:${e}.json`
        : `${MOVIEBOX_BASE}/source=v3|lang=${langCode}|res=all/stream/movie/${imdbId}.json`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!data?.streams) return [];
        return data.streams.map(item => {
            const quality = (item.title || "").match(/(2160p|1080p|720p|480p)/i)?.[0] || "1080p";
            return formatStreamLayout(title, item.title, item.url, quality, langName, isSeries, s, e);
        });
    } catch (e) { return []; }
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const isSeries = mediaType === 'tv' || mediaType === 'series';
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    
    const meta = await fetch(tmdbUrl).then(r => r.json());
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    const [enStreams, hiStreams] = await Promise.all([
        fetchLanguageStreams("en", "English", imdbId, isSeries, season || 1, episode || 1, meta.title || meta.name),
        fetchLanguageStreams("hi", "Hindi", imdbId, isSeries, season || 1, episode || 1, meta.title || meta.name)
    ]);

    return [...enStreams, ...hiStreams];
}

module.exports = { getStreams };
