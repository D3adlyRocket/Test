"use strict";

const PROVIDER_NAME = "MovieBox";
const CINESCRAPE_BASE = "https://cinescrape-w9wl.onrender.com/eyJyZXNvbHV0aW9uIjoiMTA4MHAiLCJsYW5ndWFnZSI6ImFsbCIsImxheW91dCI6ImJhZGdlcyJ9";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

  try {
    // 1. Fetch metadata from TMDB
    const meta = await fetch(tmdbUrl).then(r => r.json());
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    const titleName = meta.title || meta.name || "Unknown";
    const releaseYear = meta.release_date ? meta.release_date.split('-')[0] : (meta.first_air_date ? meta.first_air_date.split('-')[0] : "2026");

    // 2. Construct and fetch the stream URL
    const streamUrl = isSeries 
      ? `${CINESCRAPE_BASE}/stream/series/${imdbId}:${season || 1}:${episode || 1}.json`
      : `${CINESCRAPE_BASE}/stream/movie/${imdbId}.json`;

    const data = await fetch(streamUrl).then(r => r.json());
    if (!data?.streams || data.streams.length === 0) return [];

    const result = [];

    data.streams.forEach(item => {
      // Stremio addons usually combine info in item.title or item.description
      const rawTitle = item.title || item.description || "";
      const lowerTitle = rawTitle.toLowerCase();
      
      // Extract Resolution
      const res = /2160|4k/.test(lowerTitle) ? "2160p" : 
                  /1080/.test(lowerTitle) ? "1080p" : 
                  /720/.test(lowerTitle)  ? "720p"  : 
                  /480/.test(lowerTitle)  ? "480p"  : "360p";

      // Extract Language
      let langLabel = "English";
      let langEmoji = "🇺🇸";
      if (/hindi|hin|dual/.test(lowerTitle)) {
        langLabel = "Hindi";
        langEmoji = "🇮🇳";
      } else if (/multi|🌐/.test(lowerTitle)) {
        langLabel = "Multi";
        langEmoji = "🌐";
      }

      // Extract Size (looks for patterns like 1.99 GB, 1021 MB)
      const sizeMatch = rawTitle.match(/(\d+(?:\.\d+)?\s*(?:GB|MB|gb|mb))/);
      const sizeStr = sizeMatch ? sizeMatch[1] : "Unknown Size";

      // Extract Format (MKV, MP4, etc.)
      const formatMatch = lowerTitle.match(/\b(mkv|mp4|avi|m4v)\b/);
      const formatStr = formatMatch ? formatMatch[1].toUpperCase() : "MKV";

      // Extract Codec (x265, x264, h264, hevc)
      let codecStr = "x264";
      if (/x265|hevc|h265/.test(lowerTitle)) {
        codecStr = "x265";
      } else if (/x264|h264/.test(lowerTitle)) {
        codecStr = "x264";
      }

      // Build your exact multi-line subheading layout
      const customSubheading = 
        `🎬 ${titleName} - (${releaseYear})\n` +
        `💎 ${res} | 🔊 ${langLabel} | 💾 ${sizeStr}\n` +
        `🎞️ ${formatStr} | ⚡ ${codecStr}`;

      result.push({
        name: `${PROVIDER_NAME} | ${res} | ${langLabel} ${langEmoji}`,
        title: customSubheading,
        description: customSubheading,
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

    return result;
  } catch (err) {
    console.error("Fetch failed:", err);
    return [];
  }
}

module.exports = { getStreams };
