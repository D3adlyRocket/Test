"use strict";

const MANIFEST_STREAM_BASE = "https://arunjunan07-csx-stremio.hf.space/stream";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

// Helper function to extract file sizes from any available text fields
function parseSize(textCombined) {
  // Matches patterns like 1.4GB, 700MB, 1.4 GB, etc.
  const gbMatch = textCombined.match(/(\d+(?:\.\d+)?)\s*gb/i);
  const mbMatch = textCombined.match(/(\d+)\s*mb/i);
  
  if (gbMatch) {
    return `${gbMatch[1]} GB`;
  } else if (mbMatch) {
    return `${(parseInt(mbMatch[1], 10) / 1024).toFixed(2)} GB`;
  }
  return "N/A GB";
}

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  
  try {
    // 1. Fetch metadata from TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    const meta = await fetch(tmdbUrl).then(r => r.json());
    
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

    // 2. Format endpoint path
    const formattedId = isSeries 
      ? `${imdbId}:${season || 1}:${episode || 1}` 
      : `${imdbId}`;

    const typePath = isSeries ? 'series' : 'movie';
    const url = `${MANIFEST_STREAM_BASE}/${typePath}/${encodeURIComponent(formattedId)}.json`;

    // 3. Request stream payload
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!response.ok) return [];
    const data = await response.json();
    
    if (!data || !data.streams || data.streams.length === 0) {
      return [];
    }

    const processedStreams = [];
    
    // Counters to track server splits per source type dynamically
    const serverCounters = {
      "GDIndex CF": 0,
      "Instant DL": 0,
      "FastCloud": 0,
      "BollyFlix Mirror": 0
    };

    // 4. Parse layout elements
    data.streams.forEach(stream => {
      const nameText = (stream.name || "");
      const titleText = (stream.title || "");
      const urlStr = (stream.url || "");
      const combinedLower = `${nameText} ${titleText} ${urlStr}`.toLowerCase();

      // Exclude GoFile links completely
      if (combinedLower.includes("gofile")) return;

      // Filter: Ensure it belongs to BollyFlix
      if (!combinedLower.includes("bollyflix")) return;

      // Quality Rank Matcher
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
        return; // Ignore other sizes
      }

      // Extract accurate sizing from all metadata parameters combined
      const extractedSize = parseSize(`${nameText} ${titleText}`);

      // Identify Source dynamically without dropping unrecognized domains
      let sourceBase = "BollyFlix Mirror";
      if (combinedLower.includes("gdindex") || combinedLower.includes("cf")) {
        sourceBase = "GDIndex CF";
      } else if (combinedLower.includes("instantdl") || combinedLower.includes("idl")) {
        sourceBase = "Instant DL";
      } else if (combinedLower.includes("fastcloud") || combinedLower.includes("cloud")) {
        sourceBase = "FastCloud";
      }

      // Increment tracker and assign Server indices
      serverCounters[sourceBase]++;
      const finalSourceLabel = `${sourceBase} - Server ${serverCounters[sourceBase]}`;

      // Language layout configs
      let detectedLang = "Hindi 🇮🇳 • English 🇺🇸";
      if (combinedLower.includes("telugu")) detectedLang = "Hindi 🇮🇳 • Telugu 🏹";
      else if (combinedLower.includes("tamil")) detectedLang = "Hindi 🇮🇳 • Tamil 🐯";

      // Streaming tech matching
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

    // Sort order: Highest quality first (Descending)
    processedStreams.sort((a, b) => b.rank - a.rank);

    return processedStreams.map(({ rank, ...cleanStream }) => cleanStream);

  } catch (err) {
    console.error("Failed to fetch sorted data maps:", err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
