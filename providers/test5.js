"use strict";

const MANIFEST_BASE_URL = "https://animestream-addon.keypop3750.workers.dev/sm=https|rp=t0-free-rpdb|tp=q_4k,q_1080,a_dual,n_3";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

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
  let targetId = tmdbId;
  
  try {
    if (typeof tmdbId === 'number' || (typeof tmdbId === 'string' && !tmdbId.startsWith('tt'))) {
      const extUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
      const extData = await fetch(extUrl).then(r => r.json()).catch(() => null);
      if (extData && extData.imdb_id) {
        targetId = extData.imdb_id;
      }
    }

    // Adapt layout query construction to point to the new workers manifest architecture
    const formattedId = isSeries 
      ? `${targetId}:${season || 1}:${episode || 1}` 
      : `${targetId}`;

    const typePath = isSeries ? 'series' : 'movie';
    const streamUrl = `${MANIFEST_BASE_URL}/stream/${typePath}/${encodeURIComponent(formattedId)}.json`;

    const response = await fetch(streamUrl, {
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
      const combinedLower = `${nameText} ${titleText} ${urlStr}`.toLowerCase();

      // Strict Exclusions
      if (combinedLower.includes("gofile")) return;
      if (combinedLower.includes("moviesdrive")) return;
      if (combinedLower.includes("vidlink")) return;

      let rank = 0;
      let resLabel = "";
      let resEmoji = "";
      
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
        return;
      }

      if (/\b(480p)\b/i.test(combinedLower)) return;

      const extractedSize = parseSize(titleText);

      let sourceBase = "BollyFlix Mirror";
      if (combinedLower.includes("instant dl") || combinedLower.includes("instantdl") || combinedLower.includes("instant")) {
        sourceBase = "Instant DL";
      } else if (combinedLower.includes("fastcloud") || combinedLower.includes("fast cloud")) {
        sourceBase = "FastCloud";
      } else if (combinedLower.includes("gdindex") || combinedLower.includes("cf")) {
        sourceBase = "GDIndex CF";
      }

      if (!serverTracker[resLabel][sourceBase]) {
        serverTracker[resLabel][sourceBase] = 0;
      }

      serverTracker[resLabel][sourceBase]++;
      const finalSourceLabel = `${sourceBase} - Server ${serverTracker[resLabel][sourceBase]}`;

      let cleanTitleLine = "🎦 Stream Asset";
      const titleMatch = titleText.match(/\]\s*([^\\{}|]+)\s*(?:\(\d{4}\)|\{\b)/i);
      if (titleMatch && titleMatch[1]) {
        cleanTitleLine = `🎦 ${titleMatch[1].replace(/\bimax\b/i, '').replace(/\s+/g, ' ').trim()}`;
      } else {
        const segment = titleText.split('\n')[0].replace(/\[.*?\]/g, '').replace(/\bimax\b/i, '').replace(/\s+/g, ' ').trim();
        if (segment) cleanTitleLine = `🎦 ${segment}`;
      }

      if (isSeries) {
        cleanTitleLine += ` | S${season || 1}E${episode || 1}`;
      }

      let detectedLang = "Hindi 🇮🇳 • English 🇺🇸";
      if (combinedLower.includes("telugu")) detectedLang = "Hindi 🇮🇳 • Telugu 🏹";
      else if (combinedLower.includes("tamil")) detectedLang = "Hindi 🇮🇳 • Tamil 🐯";

      const isM3U8 = urlStr.includes(".m3u8");
      const formatStr = isM3U8 ? "HLS" : (/\b(mp4|avi|m4v)\b/.test(combinedLower) ? "MP4" : "MKV");

      // IMAX and 10bit Processing Layout Strings
      const has10bit = combinedLower.includes("10bit") || combinedLower.includes("10-bit");
      const hasIMAX = combinedLower.includes("imax");
      
      let line3Middle = "";
      if (has10bit && hasIMAX) {
        line3Middle = "🌈 10bit • 👁️ IMAX";
      } else if (has10bit) {
        line3Middle = "🌈 10bit • 🎥 x.265";
      } else if (hasIMAX) {
        line3Middle = "👁️ IMAX • 🎥 x.264";
      } else {
        const codecStr = /\b(hevc|x265|h265)\b/.test(combinedLower) ? "x.265" : "x.264";
        const streamTech = isM3U8 ? "HLS" : "Direct";
        line3Middle = `🎥 ${codecStr} • ${streamTech}`;
      }

      let ripType = "WEB-DL";
      if (combinedLower.includes("webrip") || combinedLower.includes("web-rip")) {
        ripType = "WEB-RIP";
      } else if (combinedLower.includes("bluray") || combinedLower.includes("hdtv")) {
        ripType = "BRRip";
      }

      const layoutDescription = 
        `${cleanTitleLine}\n` +
        `${resEmoji} ${resLabel} | 🔊 ${detectedLang}\n` +
        `⚡ ${formatStr} | ${line3Middle} | 💾 ${extractedSize}\n` +
        `🛰️ Source: ${finalSourceLabel} | 📥 ${ripType}`;

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
