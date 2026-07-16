"use strict";

const PROVIDER_NAME = "2Peckle";
const CINESCRAPE_BASE = "https://pengu.uk/%7B%22source_2peckle%22%3A%22on%22%2C%22res_2160%22%3A%22on%22%2C%22res_1080%22%3A%22on%22%2C%22res_720%22%3A%22on%22%2C%22disable_direct%22%3A%22on%22%7D";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

  try {
    // 1. Fetch metadata from TMDB
    const meta = await fetch(tmdbUrl).then(r => r.json());
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    const titleName = meta.title || meta.name || "Movie/Show";
    const releaseYear = meta.release_date ? meta.release_date.split('-')[0] : (meta.first_air_date ? meta.first_air_date.split('-')[0] : "2026");

    // 2. Fetch the stream data from CineScrape (with required Referer validation headers)
    const streamUrl = isSeries 
      ? `${CINESCRAPE_BASE}/stream/series/${imdbId}:${season || 1}:${episode || 1}.json` 
      : `${CINESCRAPE_BASE}/stream/movie/${imdbId}.json`;

    // 🌟 Crucial fix: Injecting the expected Referer into the scraping request context
    const data = await fetch(streamUrl, {
      headers: {
        "Referer": "https://pengu.uk/",
        "Origin": "https://pengu.uk"
      }
    }).then(r => r.json());
    
    if (!data?.streams || data.streams.length === 0) return [];

    const allStreams = [];

    // 3. Map language tags
    data.streams.forEach(s => {
      if (s.url && s.url.includes("bcdnxw.hakunaymatata.com")) {
        return;
      }

      const titleText = (s.title || s.description || "").toLowerCase();
      let detectedLang = "English 🇺🇸";

      if (/multi|dual|🌐/.test(titleText)) {
        detectedLang = "Multi-Audio 🌐";
      } else if (/hindi|hin/.test(titleText)) {
        detectedLang = "Hindi 🇮🇳";
      }

      allStreams.push({ ...s, lang: detectedLang });
    });

    const result = [];
    const grouped = {};

    // 4. Run the grouping routine
    allStreams.forEach(item => {
      const title = (item.title || "").toLowerCase();
      const res = /2160|4k/.test(title) ? "2160p" : /1080/.test(title) ? "1080p" : /720/.test(title) ? "720p" : /480/.test(title) ? "480p" : "1080p";
      const key = `${res}-${item.lang}`;

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    // 5. Generate final multi-line output results across TV & Mobile
    Object.entries(grouped).forEach(([key, items]) => {
      const [res, lang] = key.split("-");
      items.forEach(item => {
        const rawText = (item.title || item.description || "").toLowerCase();

        const sizeMatch = item.title ? item.title.match(/(\d+(?:\.\d+)?\s*(?:GB|MB))/i) : null;
        const sizeStr = sizeMatch ? sizeMatch[1] : "1.99 GB";
        const formatStr = /\b(mp4|avi|m4v)\b/.test(rawText) ? "MP4" : "MKV";

        const cleanLangText = lang.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '').trim();

        const fullLayout = `🎬 ${titleName} - (${releaseYear})\n` +
                           `💎 ${res} | 🔊 ${cleanLangText} | 💾 ${sizeStr}\n` +
                           `🎞️ ${formatStr} | ⛓️‍💥 2Peckle`;

        result.push({
          name: `${PROVIDER_NAME} | ${res} | ${lang}`,
          title: fullLayout,
          size: fullLayout,
          description: fullLayout,
          url: item.url,
          behaviorHints: {
            proxyHeaders: {
              request: {
                "Referer": "https://pengu.uk/"
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
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
