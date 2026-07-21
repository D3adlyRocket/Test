"use strict";

// 1. Settings Layout configuration for Audio Preferences
async function onSettings() {
    return [
        { type: "header", label: "Audio Preferences" },
        { type: "toggle", key: "langEnglish", label: "Enable English 🇺🇸", defaultValue: true },
        { type: "toggle", key: "langHindi", label: "Enable Hindi 🇮🇳", defaultValue: true }
    ];
}

const PROVIDER_NAME = "MovieBox";
// Configured with your requested MovieBox endpoint (manifest.json trimmed for path appending)
const MOVIEBOX_BASE = "https://pengu.uk/%7B%22source_moviebox%22%3A%22on%22%2C%22res_1080%22%3A%22on%22%2C%22auth_token%22%3A%22XwZg2rLkLlbjXBeDVCyxgfHXjxN1ijLMkUuToW8KaKc%22%7D";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

  try {
    const settings = globalThis.SCRAPER_SETTINGS || {};
    const showEnglish = settings.langEnglish !== false;
    const showHindi = settings.langHindi !== false;

    // 2. Fetch metadata from TMDB
    const meta = await fetch(tmdbUrl).then(r => r.json()).catch(() => null);
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id || tmdbId;

    const titleName = meta?.title || meta?.name || "Movie/Show";
    const releaseYear = meta?.release_date ? meta.release_date.split('-')[0] : (meta?.first_air_date ? meta.first_air_date.split('-')[0] : "2026");

    // 3. Fetch the stream data from your specified MovieBox URL endpoint
    const streamUrl = isSeries 
      ? `${MOVIEBOX_BASE}/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
      : `${MOVIEBOX_BASE}/stream/movie/${imdbId}.json`;

    const data = await fetch(streamUrl).then(r => r.json()).catch(() => null);
    if (!data?.streams || data.streams.length === 0) return [];

    const allStreams = [];

    // 4. Map language tags and filter using your configuration preferences
    data.streams.forEach(s => {
      if (!s) return;
      const titleText = (s.title || s.description || s.name || "").toLowerCase();
      
      let detectedLang = "English 🇺🇲";
      let isHindiStream = false;
      
      if (/hindi|hin|dual/.test(titleText)) {
        detectedLang = "Hindi 🇮🇳";
        isHindiStream = true;
      } else if (/multi|🌐/.test(titleText)) {
        detectedLang = "Multi 🌐";
      }

      if (isHindiStream && !showHindi) return;
      if (!isHindiStream && !showEnglish) return;

      allStreams.push({ ...s, lang: detectedLang });
    });

    const result = [];
    const grouped = {};

    // 5. Group elements cleanly by quality tags
    allStreams.forEach(item => {
      const title = (item.title || item.description || item.name || "").toLowerCase();
      const res = /2160|4k/.test(title) ? "2160p" : 
                  /1080/.test(title) ? "1080p" : 
                  /720/.test(title)  ? "720p"  : 
                  /480/.test(title)  ? "480p"  : "1080p";
      
      const key = `${res}-${item.lang}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    // 6. Generate final cross-platform presentation layout structure
    Object.entries(grouped).forEach(([key, items]) => {
      const [res, lang] = key.split("-");
      
      items.forEach(item => {
        const rawText = (item.title || item.description || item.name || "").toLowerCase();

        // Advanced size detection extraction logic
        let sizeStr = "Unknown Size";
        const sizeMatch = (item.title || item.description || item.name || "").match(/(\d+(?:\.\d+)?\s*(?:GB|MB|gb|mb))/i);
        if (sizeMatch) {
          sizeStr = sizeMatch[1].toUpperCase();
        } else if (item.size) {
          const bytes = parseInt(item.size, 10);
          if (!isNaN(bytes) && bytes > 0) {
            sizeStr = bytes > 1024 * 1024 * 1024 
              ? `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB` 
              : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
          }
        }

        const formatStr = /\b(mp4|avi|m4v)\b/.test(rawText) ? "MP4" : "MKV";
        const cleanLangText = lang.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '').trim();

        // Standardized multi-line presentation design layout
        const fullLayout = 
          `🎬 ${titleName} - (${releaseYear})\n` +
          `💎 ${res} | 🔊 ${cleanLangText} | 💾 ${sizeStr}\n` +
          `🎞️ ${formatStr} | ⛓️‍💥 MovieBox`;

        result.push({
          name: `${PROVIDER_NAME} | ${res} | ${lang}`,
          title: fullLayout,
          size: fullLayout,
          description: fullLayout,
          url: item.url,
          behaviorHints: {
            proxyHeaders: {
              request: {
                "Referer": "https://stremio-moviebox-1.onrender.com/"
              }
            }
          }
        });
      });
    });

    return result;
  } catch (err) {
    console.error("Global processing failure context:", err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams, onSettings };
} else {
    global.getStreams = getStreams;
    global.onSettings = onSettings;
}
