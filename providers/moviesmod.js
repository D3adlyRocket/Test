"use strict";

const PROVIDER_NAME = "MovieBox";
const CINESCRAPE_BASE = "https://cinescrape-w9wl.onrender.com/eyJyZXNvbHV0aW9uIjoiMTA4MHAiLCJsYW5ndWFnZSI6ImFsbCIsImxheW91dCI6ImJhZGdlcyJ9";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

  try {
    // 1. Fetch metadata from TMDB to get the IMDb ID
    const meta = await fetch(tmdbUrl).then(r => r.json());
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    // 2. Construct the Stremio standard stream URL using the "all" languages configuration
    const streamUrl = isSeries 
      ? `${CINESCRAPE_BASE}/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
      : `${CINESCRAPE_BASE}/stream/movie/${imdbId}.json`;

    // 3. Fetch the stream data
    const data = await fetch(streamUrl).then(r => r.json());
    if (!data?.streams || data.streams.length === 0) return [];

    const result = [];
    const grouped = {};

    // 4. Group by resolution and extract languages
    data.streams.forEach(item => {
      const title = (item.title || item.name || "").toLowerCase();
      
      // Determine resolution
      const res = /2160|4k/.test(title) ? "2160p" : 
                  /1080/.test(title) ? "1080p" : 
                  /720/.test(title)  ? "720p"  : 
                  /480/.test(title)  ? "480p"  : "360p";

      // Separate English, Hindi, or fallback to Multi
      let lang = "Multi 🌐";
      if (/hindi|hin|dual/.test(title)) {
        lang = "Hindi 🇮🇳";
      } else if (/english|eng/.test(title)) {
        lang = "English 🇺🇸";
      }

      const key = `${res}-${lang}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    // 5. Build final UI layout items split by language
    Object.entries(grouped).forEach(([key, items]) => {
      const [res, lang] = key.split("-");
      items.forEach(item => {
        const fullLayout = `🎦 ${meta.title || meta.name || "Stream"} 💎 ${res} | 🗣️ ${lang} | 🔗 ${PROVIDER_NAME}`;
        
        result.push({
          name: `${PROVIDER_NAME} | ${res} | ${lang}`,
          title: item.title || fullLayout,
          size: item.title || fullLayout, 
          description: item.description || fullLayout,
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
    console.error("Fetch failed:", err);
    return [];
  }
}

module.exports = { getStreams };
