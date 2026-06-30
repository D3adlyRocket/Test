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
const CINESCRAPE_BASE = "https://cinescrape-w9wl.onrender.com/eyJyZXNvbHV0aW9uIjoiMTA4MHAiLCJsYW5ndWFnZSI6ImFsbCIsImxheW91dCI6ImJhZGdlcyJ9";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

  try {
    // Read the user toggles from global configuration
    const settings = globalThis.SCRAPER_SETTINGS || {};
    const showEnglish = settings.langEnglish !== false;
    const showHindi = settings.langHindi !== false;

    // 2. Fetch metadata from TMDB
    const meta = await fetch(tmdbUrl).then(r => r.json());
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    const titleName = meta.title || meta.name || "Movie/Show";
    const releaseYear = meta.release_date ? meta.release_date.split('-')[0] : (meta.first_air_date ? meta.first_air_date.split('-')[0] : "2026");

    // 3. Fetch the stream data from CineScrape
    const streamUrl = isSeries 
      ? `${CINESCRAPE_BASE}/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
      : `${CINESCRAPE_BASE}/stream/movie/${imdbId}.json`;

    const data = await fetch(streamUrl).then(r => r.json());
    if (!data?.streams || data.streams.length === 0) return [];

    const allStreams = [];

    // 4. Map language tags and apply user settings filters
    data.streams.forEach(s => {
      const titleText = (s.title || s.description || "").toLowerCase();
      let detectedLang = "English 🇺🇲";
      let isHindiStream = false;
      
      if (/hindi|hin|dual/.test(titleText)) {
        detectedLang = "Hindi 🇮🇳";
        isHindiStream = true;
      } else if (/multi|🌐/.test(titleText)) {
        detectedLang = "Multi 🌐";
      }

      // Filter out streams matching disabled languages
      if (isHindiStream && !showHindi) return;
      if (!isHindiStream && !showEnglish) return;

      allStreams.push({ ...s, lang: detectedLang });
    });

    const result = [];
    const grouped = {};

    // 5. Run the grouping routine
    allStreams.forEach(item => {
      const title = (item.title || "").toLowerCase();
      const res = /2160|4k/.test(title) ? "2160p" : 
                  /1080/.test(title) ? "1080p" : 
                  /720/.test(title)  ? "720p"  : 
                  /480/.test(title)  ? "480p"  : "1080p";
      
      const key = `${res}-${item.lang}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    // 6. Generate final multi-line output results across TV & Mobile 
    Object.entries(grouped).forEach(([key, items]) => {
      const [res, lang] = key.split("-");
      
      items.forEach(item => {
        const rawText = (item.title || item.description || "").toLowerCase();

        // Safe fallback text parsers
        const sizeMatch = item.title ? item.title.match(/(\d+(?:\.\d+)?\s*(?:GB|MB))/i) : null;
        const sizeStr = sizeMatch ? sizeMatch[1] : "1.99 GB";
        const formatStr = /\b(mp4|avi|m4v)\b/.test(rawText) ? "MP4" : "MKV";

        // Clean language text variant by removing emojis for standard alignment
        const cleanLangText = lang.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '').trim();

        // Modified layout applying your "⛓️‍💥 MovieBox" adjustment request
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
                "Referer": "https://cinescrape-w9wl.onrender.com/"
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

// Export declarations matching your runtime constraints
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams, onSettings };
} else {
    global.getStreams = getStreams;
    global.onSettings = onSettings;
}
