"use strict";

const MANIFEST_STREAM_BASE = "https://arunjunan07-csx-stremio.hf.space/stream";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

// Helper function to extract Source and Size directly from the streaming URL
function parseUrlMetadata(urlStr) {
  const url = (urlStr || "").toLowerCase();
  
  // 1. Identify Source based on URL properties
  let source = "BollyFlix"; // default fallback
  if (url.includes("gdindex") || url.includes("cf")) {
    source = "GDIndex CF";
  } else if (url.includes("instantdl") || url.includes("idl")) {
    source = "Instant DL";
  } else if (url.includes("fastcloud") || url.includes("cloud")) {
    source = "FastCloud";
  }

  // 2. Identify Size from URL patterns (e.g., "movie.name.2.4gb.mkv" or similar parameters)
  let sizeStr = "N/A GB";
  const gbMatch = url.match(/(\d+(?:\.\d+)?)\s*gb/);
  const mbMatch = url.match(/(\d+)\s*mb/);
  
  if (gbMatch) {
    sizeStr = `${gbMatch[1]} GB`;
  } else if (mbMatch) {
    sizeStr = `${(parseInt(mbMatch[1], 10) / 1024).toFixed(2)} GB`;
  }

  return { source, sizeStr };
}

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  
  try {
    // 1. Fetch deep metadata from TMDB
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

    // 2. Format the streaming endpoint path for csx-stremio
    const formattedId = isSeries 
      ? `${imdbId}:${season || 1}:${episode || 1}` 
      : `${imdbId}`;

    const typePath = isSeries ? 'series' : 'movie';
    const url = `${MANIFEST_STREAM_BASE}/${typePath}/${encodeURIComponent(formattedId)}.json`;

    // 3. Make the stream lookup request
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

    // 4. Parse, analyze properties, and build metadata layouts
    data.streams.forEach(stream => {
      const nameText = (stream.name || "").toLowerCase();
      const titleText = (stream.title || "").toLowerCase();
      const rawTextCombined = `${nameText} ${titleText}`;

      // Tweak 4: Filter out GoFile streams entirely or keep specifically designated sources
      if (stream.url && stream.url.toLowerCase().includes("gofile")) {
        return; 
      }

      // Filter: Keep ONLY BollyFlix links
      const matchesBollyFlix = nameText.includes("bollyflix") || titleText.includes("bollyflix");
      if (!matchesBollyFlix) return;

      // Quality Rank Assignment
      let rank = 0; // lower fallback rank
      let resLabel = "1080p";
      let resEmoji = "🔥";
      
      if (/\b(2160p|4k)\b/i.test(rawTextCombined)) {
        resLabel = "2160p";
        resEmoji = "💎";
        rank = 3; // Top priority sorting rank
      } else if (/\b(1080p)\b/i.test(rawTextCombined)) {
        resLabel = "1080p";
        resEmoji = "🔥";
        rank = 2;
      } else if (/\b(720p)\b/i.test(rawTextCombined)) {
        resLabel = "720p";
        resEmoji = "🎬";
        rank = 1;
      } else {
        return; // Ignore other lower/unlabeled resolutions
      }

      // Tweak 2: Explicit multi-language labeling inside subheading description
      let detectedLang = "Hindi 🇮🇳 • English 🇺🇸";
      if (/telugu/i.test(rawTextCombined)) detectedLang = "Hindi 🇮🇳 • Telugu 🏹";
      else if (/tamil/i.test(rawTextCombined)) detectedLang = "Hindi 🇮🇳 • Tamil 🐯";

      // Parse container metadata formats
      const isM3U8 = stream.url && stream.url.includes(".m3u8");
      const formatStr = isM3U8 ? "HLS" : (/\b(mp4|avi|m4v)\b/.test(rawTextCombined) ? "MP4" : "MKV");
      const codecStr = /\b(hevc|x265|h265)\b/.test(rawTextCombined) ? "x.265" : "x.264";
      const streamTech = isM3U8 ? "HLS" : "Direct";

      // Tweak 3 & 4: Pull analytical properties directly via URL parameters
      const parsedMeta = parseUrlMetadata(stream.url);

      // Build device layouts
      const subLine1 = isSeries 
        ? `🎦 ${titleName} - (${releaseYear}) | S${season || 1}E${episode || 1}`
        : `🎦 ${titleName} - (${releaseYear})`;

      // Modified Subheading layout blocks mapping your requested variables
      const layoutDescription = 
        `${subLine1}\n` +
        `${resEmoji} ${resLabel} | 🔊 ${detectedLang} | ⏳ ${runtimeStr}\n` +
        `⚡ ${formatStr} | 🎥 ${codecStr} • ${streamTech} | 💾 ${parsedMeta.sizeStr}\n` +
        `🛰️ Source: ${parsedMeta.source}`;

      processedStreams.push({
        rank: rank, // track internal score for sorting priority later
        name: `BollyFlix | ${resLabel} | Dual-Audio`,
        title: layoutDescription,
        description: layoutDescription,
        size: layoutDescription,
        url: stream.url,
        behaviorHints: stream.behaviorHints || {}
      });
    });

    // Tweak 1: Strict array structural sort (Descending: 2160p -> 1080p -> 720p)
    processedStreams.sort((a, b) => b.rank - a.rank);

    // Strip internal sorting ranks from final objects delivered to player layout engine
    return processedStreams.map(({ rank, ...cleanStream }) => cleanStream);

  } catch (err) {
    console.error("Failed to execute sorted BollyFlix layouts:", err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
