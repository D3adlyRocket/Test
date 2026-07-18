"use strict";

const MANIFEST_STREAM_BASE = "https://arunjunan07-csx-stremio.hf.space/stream";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

// Extracts precise file sizes directly from the stream title layout text
function parseSize(textCombined) {
  if (!textCombined) return "N/A GB";
  
  // Look for bracketed size formats like [1.13GB] or [2.71GB]
  const bracketMatch = textCombined.match(/\[(\d+(?:\.\d+)?)\s*(gb|mb)\]/i);
  if (bracketMatch) {
    const val = parseFloat(bracketMatch[1]);
    if (bracketMatch[2].toLowerCase() === 'gb') return `${val} GB`;
    return `${(val / 1024).toFixed(2)} GB`;
  }

  // Standard match fallback if brackets are missing
  const standardMatch = textCombined.match(/\b(\d+(?:\.\d+)?)\s*(gb|mb)\b/i);
  if (standardMatch) {
    const val = parseFloat(standardMatch[1]);
    if (standardMatch[2].toLowerCase() === 'gb') return `${val} GB`;
    return `${(val / 1024).toFixed(2)} GB`;
  }

  return "N/A GB";
}

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  
  try {
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    const meta = await fetch(tmdbUrl).then(r => r.json()).catch(() => null);
    
    if (!meta) return [];
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    const titleName = meta.title || meta.name || "Unknown Title";
    const releaseYear = meta.release_date ? meta.release_date.split('-')[0] : (meta.first_air_date ? meta.first_air_date.split('-')[0] : "2026");
    
    let runtimeStr = "N/A";
    if (!isSeries && meta.runtime) {
      runtimeStr = `${meta.runtime} min`;
    } else if (isSeries && meta.episode_run_time && meta.episode_run_time.length > 0) {
      runtimeStr = `${meta.episode_run_time[0]} min`;
    }

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
    
    // Multi-dimensional server context counter block
    const serverTracker = {
      "2160p": { "GDIndex CF": 0, "Instant DL": 0, "FastCloud": 0, "BollyFlix Mirror": 0 },
      "1080p": { "GDIndex CF": 0, "Instant DL": 0, "FastCloud": 0, "BollyFlix Mirror": 0 },
      "720p":  { "GDIndex CF": 0, "Instant DL": 0, "FastCloud": 0, "BollyFlix Mirror": 0 }
    };

    data.streams.forEach(stream => {
      if (!stream || !stream.url) return;
      
      const nameText = stream.name || "";
      const titleText = stream.title || "";
      const urlStr = stream.url || "";
      const combinedLower = `${nameText} ${titleText}`.toLowerCase();

      // Explicitly exclude GoFile streams as requested
      if (combinedLower.includes("gofile")) return;

      // Extract quality labels natively
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
        // Safe layout fallback if quality is completely unlabelled
        resLabel = "1080p";
        resEmoji = "🔥";
        rank = 2;
      }

      // Read bracket size directly from the original stream.title metadata
      const extractedSize = parseSize(titleText);

      // Map providers cleanly using the original addon labels shown in your screenshots
      let sourceBase = "BollyFlix Mirror";
      if (combinedLower.includes("instant dl") || combinedLower.includes("instantdl") || combinedLower.includes("gdflix instant")) {
        sourceBase = "Instant DL";
      } else if (combinedLower.includes("fastcloud") || combinedLower.includes("fast cloud")) {
        sourceBase = "FastCloud";
      } else if (combinedLower.includes("gdindex") || combinedLower.includes("cf")) {
        sourceBase = "GDIndex CF";
      }

      // Increment tracking variables isolated to specific quality and source groups
      serverTracker[resLabel][sourceBase]++;
      const finalSourceLabel = `${sourceBase} - Server ${serverTracker[resLabel][sourceBase]}`;

      // Language tag settings
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

    // Ensure 2160p displays at the top down to 720p
    processedStreams.sort((a, b) => b.rank - a.rank);
    return processedStreams.map(({ rank, ...cleanStream }) => cleanStream);

  } catch (err) {
    console.error("Failed to map explicit provider structures:", err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
