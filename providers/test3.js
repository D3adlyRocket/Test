"use strict";

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

// 1. IMPROVED QUALITY DETECTOR
function detectQuality(title) {
    const t = title.toLowerCase();
    if (t.includes("2160") || t.includes("4k")) return "2160p";
    if (t.includes("1080")) return "1080p";
    if (t.includes("720")) return "720p";
    if (t.includes("480")) return "480p";
    if (t.includes("360")) return "360p";
    return "1080p"; // Only default if absolutely necessary
}

function formatStreamLayout(name, itemTitle, url, lang, isSeries, s, e) {
    const quality = detectQuality(itemTitle); // Use our new smart detector
    const mediaInfo = isSeries ? `S${s.toString().padStart(2,'0')}E${e.toString().padStart(2,'0')}` : "";
    const isHindi = lang === "Hindi";
    
    // Clean name for the 'name' field (keep it short so Stremio identifies it)
    const shortName = `${PROVIDER_NAME} | ${quality} | ${lang}`;
    
    // Rich content for display fields
    const line1 = '🎦 ' + name + (mediaInfo ? ' - ' + mediaInfo : '');
    const line2 = '💎 ' + quality + ' | 🗣️ ' + (isHindi ? "English 🇺🇸 • Hindi 🇮🇳" : "English 🇺🇸");
    const line3 = '🎞️ MKV | 🎧 DD5.1 | 🔗 ' + PROVIDER_NAME;
    const fullLayout = line1 + '\n' + line2 + '\n' + line3;

    return {
        name: shortName, // Keep this CLEAN for the app's sorting engine
        title: fullLayout, // Keep this RICH for your TV/Mobile display
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
            return formatStreamLayout(title, item.title, item.url, langName, isSeries, s, e);
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
