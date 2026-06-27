"use strict";

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

// 1. YOUR PROVEN LAYOUT ENGINE (Modified to accept language)
function makeStream(name, title, url, quality, lang, isSeries, season, episode) {
    var mediaInfo = isSeries ? `S${season.toString().padStart(2,'0')}E${episode.toString().padStart(2,'0')}` : "";
    var isHindi = lang === "Hindi";
    
    // Applying your CineFreak-style layout
    var line1 = '🎦 ' + name + (mediaInfo ? ' - ' + mediaInfo : '');
    var line2 = '💎 ' + quality + ' | 🗣️ ' + (isHindi ? "English 🇺🇸 • Hindi 🇮🇳" : "English 🇺🇸");
    var line3 = '🎞️ MKV | 🎧 DD5.1 | 🔗 ' + PROVIDER_NAME;
    var formattedTitle = line1 + '\n' + line2 + '\n' + line3;

    return {
        name: PROVIDER_NAME + " | " + quality + " | " + lang,
        title: formattedTitle,
        url: url,
        behaviorHints: { proxyHeaders: { request: { "Referer": MOVIEBOX_BASE + "/" } } }
    };
}

// 2. FETCH ENGINE
async function fetchLanguageStreams(langCode, langName, imdbId, isSeries, s, e, title) {
    const url = isSeries 
        ? `${MOVIEBOX_BASE}/source=v3|lang=${langCode}|res=all/stream/series/${imdbId}:${s}:${e}.json`
        : `${MOVIEBOX_BASE}/source=v3|lang=${langCode}|res=all/stream/movie/${imdbId}.json`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!data?.streams) return [];
        return data.streams.map(s => {
            const quality = (s.title || "").match(/(2160p|1080p|720p|480p)/i)?.[0] || "1080p";
            return makeStream(title, s.title, s.url, quality, langName, isSeries, s, e);
        });
    } catch (e) { return []; }
}

// 3. MAIN ENTRY
async function getStreams(tmdbId, mediaType, season, episode) {
    const isSeries = mediaType === 'tv' || mediaType === 'series';
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    
    const meta = await fetch(tmdbUrl).then(r => r.json());
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    // EXECUTE PARALLEL FETCHES
    const [enStreams, hiStreams] = await Promise.all([
        fetchLanguageStreams("en", "English", imdbId, isSeries, season || 1, episode || 1, meta.title || meta.name),
        fetchLanguageStreams("hi", "Hindi", imdbId, isSeries, season || 1, episode || 1, meta.title || meta.name)
    ]);

    return [...enStreams, ...hiStreams]; // MERGED LIST
}

module.exports = { getStreams };
