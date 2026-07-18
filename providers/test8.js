"use strict";

const MANIFEST_STREAM_BASE = "https://arunjunan07-csx-stremio.hf.space/stream";

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
  
  try {
    // 1. Bypass TMDB entirely to prevent lookups from breaking the stream fetch
    const formattedId = isSeries 
      ? `${tmdbId}:${season || 1}:${episode || 1}` 
      : `${tmdbId}`;

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
    
    // Server tracking per resolution tier
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

      // Strict Exclusions
      if (combinedLower.includes("gofile")) return;
      if (combinedLower.includes("moviesdrive")) return;

      // Quality Rank Assignments
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

      // Map base provider source names
      let sourceBase = "BollyFlix Mirror";
      if (combinedLower.includes("instant dl") || combinedLower.includes("instantdl") || combinedLower.includes("instant")) {
        sourceBase = "Instant DL";
      } else if (combinedLower.includes("fastcloud") || combinedLower.includes("fast cloud")) {
        sourceBase = "FastCloud";
      } else if (combinedLower.includes("gdindex") || combinedLower.includes("cf")) {
        sourceBase = "GDIndex CF";
      }

      // Initialize counter per quality tier dynamically
      if (!serverTracker[resLabel][sourceBase]) {
        serverTracker[resLabel][sourceBase] = 0;
      }

      serverTracker[resLabel][sourceBase]++;
      const finalSourceLabel = `${sourceBase} - Server ${serverTracker[resLabel][sourceBase]}`;

      // Extract title names safely directly from incoming payload titles
      let cleanTitleLine = "🎦 Stream Asset";
      const titleMatch = titleText.match(/\]\s*([^\\{}|]+)\s*(?:\(\d{4}\)|\{\b)/i);
      if (titleMatch && titleMatch[1]) {
        cleanTitleLine = `🎦 ${titleMatch[1].trim()}`;
      } else {
        // Fallback layout clean up if regex doesn't match clean title elements
        const segment = titleText.split('\n')[0].replace(/\[.*?\]/g, '').trim();
        if (segment) cleanTitleLine = `🎦 ${segment}`;
      }

      // Append season data if working with a tv series mapping context
      if (isSeries) {
        cleanTitleLine += ` | S${season || 1}E${episode || 1}`;
      }

      let detectedLang = "Hindi 🇮🇳 • English 🇺🇸";
      if (combinedLower.includes("telugu")) detectedLang = "Hindi 🇮🇳 • Telugu 🏹";
      else if (combinedLower.includes("tamil")) detectedLang = "Hindi 🇮🇳 • Tamil 🐯";

      const isM3U8 = urlStr.includes(".m3u8");
      const formatStr = isM3U8 ? "HLS" : (/\b(mp4|avi|m4v)\b/.test(combinedLower) ? "MP4" : "MKV");
      const codecStr = /\b(hevc|x265|h265)\b/.test(combinedLower) ? "x.265" : "x.264";
      const streamTech = isM3U8 ? "HLS" : "Direct";

      const layoutDescription = 
        `${cleanTitleLine}\n` +
        `${resEmoji} ${resLabel} | 🔊 ${detectedLang}\n` +
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

    processedStreams.sort((a, b) => b.rank - a.rank);
    return processedStreams.map(({ rank, ...cleanStream }) => cleanStream);

  } catch (err) {
    console.error("Layout engine error:", err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
