"use strict";

const MANIFEST_STREAM_BASE = "https://arunjunan07-csx-stremio.hf.space/stream";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

// Safe size parser filtering out any tiny file fragments under 0.50 GB
function parseSize(textCombined) {
  if (!textCombined) return "N/A GB";
  
  const bracketMatch = textCombined.match(/\[(\d+(?:\.\d+)?)\s*(gb|mb)\]/i);
  if (bracketMatch) {
    const val = parseFloat(bracketMatch[1]);
    if (bracketMatch[2].toLowerCase() === 'gb') return `${val} GB`;
    return `${(val / 1024).toFixed(2)} GB`;
  }

  const standardMatch = textCombined.match(/\b(\d+(?:\.\d+)?)\s*(gb|mb)\b/i);
  if (standardMatch) {
    const val = parseFloat(standardMatch[1]);
    if (standardMatch[2].toLowerCase() === 'gb' && val >= 0.5) return `${val} GB`;
    if (standardMatch[2].toLowerCase() === 'mb' && val > 500) return `${(val / 1024).toFixed(2)} GB`;
  }

  return "N/A GB";
}

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  let imdbId = "";
  let titleName = "Unknown Title";
  let releaseYear = "2026";
  let runtimeStr = "N/A";

  try {
    // 1. Robust ID Handling: Check if input is already an IMDb ID (starts with 'tt')
    if (typeof tmdbId === 'string' && tmdbId.startsWith('tt')) {
      imdbId = tmdbId;
      // Fetch cosmetic info using find endpoint
      const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const findData = await fetch(findUrl).then(r => r.json()).catch(() => null);
      const meta = isSeries ? findData?.tv_results?.[0] : findData?.movie_results?.[0];
      if (meta) {
        titleName = meta.title || meta.name || titleName;
        releaseYear = meta.release_date ? meta.release_date.split('-')[0] : (meta.first_air_date ? meta.first_air_date.split('-')[0] : "2026");
      }
    } else {
      // Input is a numeric TMDB ID
      const extUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
      const extData = await fetch(extUrl).then(r => r.json()).catch(() => null);
      imdbId = extData?.imdb_id;

      const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
      const meta = await fetch(tmdbUrl).then(r => r.json()).catch(() => null);
      if (meta) {
        titleName = meta.title || meta.name || titleName;
        releaseYear = meta.release_date ? meta.release_date.split('-')[0] : (meta.first_air_date ? meta.first_air_date.split('-')[0] : "2026");
        if (!isSeries && meta.runtime) runtimeStr = `${meta.runtime} min`;
        else if (isSeries && meta.episode_run_time?.[0]) runtimeStr = `${meta.episode_run_time[0]} min`;
      }
    }

    if (!imdbId) return [];

    // 2. Build the exact streaming path request
    const formattedId = isSeries 
      ? `${imdbId}:${season || 1}:${episode || 1}` 
      : `${imdbId}`;

    const typePath = isSeries ? 'series' : 'movie';
    const url = `${MANIFEST_STREAM_BASE}/${typePath}/${encodeURIComponent(formattedId)}.json`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }).catch(() => null);

    if (!response || !response.ok) return [];
    const data = await response.json().catch(() => null);
    
    if (!data || !data.streams || data.streams.length === 0) {
      return [];
    }

    const processedStreams = [];
    
    // Dynamic tracker schema to protect against undefined key crashes
    const serverTracker = {
      "2160p": {},
      "1080p": {},
      "720p":  {}
    };

    data.streams.forEach(stream => {
      if (!stream || !stream.url) return;
      
      const nameText = stream.name || "";
      const titleText = stream.title || "";
      const urlStr = stream.url || "";
      const combinedLower = `${nameText} ${titleText}`.toLowerCase();

      // STRICT EXCLUSIONS: Block GoFile and MoviesDrive links entirely
      if (combinedLower.includes("gofile")) return;
      if (combinedLower.includes("moviesdrive")) return;

      // Extract resolution tier labels cleanly
      let rank = 0;
      let resLabel = "1080p";
      let resEmoji = "🔥";
      
      if (/\b(2160p|4k)\b/i.test(combinedLower)) {
        resLabel = "2160p";
        resEmoji = "💎";
        rank = 3;
      } else if (/\b(1080p)\b/i.test(combinedLower)) {
        resLabel = "1080p";
        resEmoji = "🔥";
        rank = 2;
      } else if (/\b(720p)\b/i.test(combinedLower)) {
        resLabel = "720p";
        resEmoji = "🎬";
        rank = 1;
      } else {
        resLabel = "1080p";
        resEmoji = "🔥";
        rank = 2;
      }

      const extractedSize = parseSize(titleText);

      // Map providers specifically matching core keywords from screenshots
      let sourceBase = "BollyFlix Mirror";
      if (combinedLower.includes("instant dl") || combinedLower.includes("instantdl") || combinedLower.includes("instant")) {
        sourceBase = "Instant DL";
      } else if (combinedLower.includes("fastcloud") || combinedLower.includes("fast cloud")) {
        sourceBase = "FastCloud";
      } else if (combinedLower.includes("gdindex") || combinedLower.includes("cf")) {
        sourceBase = "GDIndex CF";
      }

      // Safeguard: Initialize counter dynamically if it doesn't exist yet
      if (!serverTracker[resLabel][sourceBase]) {
        serverTracker[resLabel][sourceBase] = 0;
      }

      // Increment sequence contextual numbering safely
      serverTracker[resLabel][sourceBase]++;
      const finalSourceLabel = `${sourceBase} - Server ${serverTracker[resLabel][sourceBase]}`;

      let detectedLang = "Hindi 🇮🇳 • English 🇺🇸";
      if (combinedLower.includes("telugu")) detectedLang = "Hindi 🇮🇳 • Telugu 🏹";
      else if (combinedLower.includes("tamil")) detectedLang = "Hindi 🇮🇳 • Tamil 🐯";

      const isM3U8 = urlStr.includes(".m3u8");
      const formatStr = isM3U8 ? "HLS" : (/\b(mp4|avi|m4v)\b/.test(combinedLower) ? "MP4" : "MKV");
      const codecStr = /\b(hevc|x265|h265)\b/.test(combinedLower) ? "x.265" : "x.264";
      const streamTech = isM3U8 ? "HLS" : "Direct";

      const subLine1 = isSeries 
        ? `🎦 ${titleName} - (${releaseYear}) | S${season || 1}E${episode || 1}`
        : `🎦 ${titleName} - (${releaseYear})`;

      const layoutDescription = 
        `${subLine1}\n` +
        `${resEmoji} ${resLabel} | 🔊 ${detectedLang} | ⏳ ${runtimeStr}\n` +
        `⚡ ${formatStr} | 🎥 ${codecStr} • ${streamTech} | 💾 ${extractedSize}\n` +
        `🛰️ Source: ${finalSourceLabel}`;

      processedStreams.push({
        rank: rank,
        name: `BollyFlix | ${resLabel} | Dual-Audio`,
        title: layoutDescription,
        description: layoutDescription,
        size: layoutDescription,
        url: stream.url,
        behaviorHints: stream.behaviorHints || {}
      });
    });

    // Enforce high-to-low quality sort sequencing constraint
    processedStreams.sort((a, b) => b.rank - a.rank);
    return processedStreams.map(({ rank, ...cleanStream }) => cleanStream);

  } catch (err) {
    console.error("Critical layout processing failure:", err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
