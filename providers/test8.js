"use strict";

const MANIFEST_STREAM_BASE = "https://hfip-nuvio-hub-private.hf.space/stream";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  
  try {
    // 1. Fetch deep metadata from TMDB for the titles, year, and duration runtime
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    const meta = await fetch(tmdbUrl).then(r => r.json());
    
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) return [];

    // Extract basic title elements
    const titleName = meta.title || meta.name || "Unknown Title";
    const releaseYear = meta.release_date ? meta.release_date.split('-')[0] : (meta.first_air_date ? meta.first_air_date.split('-')[0] : "2026");
    
    // Extract runtime/duration format
    let runtimeStr = "N/A";
    if (!isSeries && meta.runtime) {
      runtimeStr = `${meta.runtime} min`;
    } else if (isSeries && meta.episode_run_time && meta.episode_run_time.length > 0) {
      runtimeStr = `${meta.episode_run_time[0]} min`;
    }

    // 2. Format the streaming endpoint path
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

    const filteredStreams = [];

    // 4. Parse, identify properties, and display layout blocks
    data.streams.forEach(stream => {
      const nameText = (stream.name || "").toLowerCase();
      const titleText = (stream.title || "").toLowerCase();
      const rawTextCombined = `${nameText} ${titleText}`;

      // Drop anything that isn't HDGharTV
      const matchesHDGharTV = nameText.includes("hdghartv") || titleText.includes("hdghartv");
      if (!matchesHDGharTV) return;

      // Quality matching logic
      const is4K = /\b(2160p|4k)\b/i.test(rawTextCombined);
      const is1080 = /\b(1080p)\b/i.test(rawTextCombined);
      const is720 = /\b(720p)\b/i.test(rawTextCombined);

      if (!is4K && !is1080 && !is720) return; // Ignore other resolutions

      let resLabel = "1080p";
      let resEmoji = "🔥";
      if (is4K) { resLabel = "2160p"; resEmoji = "💎"; }
      else if (is720) { resLabel = "720p"; resEmoji = "🎬"; }

      // Language tracking regex
      let detectedLang = "English 🇺🇸";
      if (/multi|dual|🌐/.test(rawTextCombined)) detectedLang = "Multi-Audio 🌐";
      else if (/hindi|hin|🇮🇳/.test(rawTextCombined)) detectedLang = "Hindi 🇮🇳";

      // Video format parameters
      const formatStr = /\b(mp4|avi|m4v)\b/.test(rawTextCombined) ? "MP4" : "MKV";
      const codecStr = /\b(hevc|x265|h265)\b/.test(rawTextCombined) ? "x.265" : "x.264";
      const streamTech = stream.url && stream.url.includes(".m3u8") ? "HLS" : "Direct";
      const audioCodec = /\b(ddp|dd\+|eac3|dolby)\b/.test(rawTextCombined) ? "E-AC3" : /\b(ac3|dolby)\b/.test(rawTextCombined) ? "AC3" : "AAC";

      // Subheading Line 1 conditional assignment
      const subLine1 = isSeries 
        ? `🎦 ${titleName} - (${releaseYear}) | S${season || 1}E${episode || 1}`
        : `🎦 ${titleName} - (${releaseYear})`;

      // Assemble layout matching your precise parameters
      const layoutDescription = 
        `${subLine1}\n` +
        `${resEmoji} ${resLabel} Quality | 🔊 ${detectedLang} | ⏳ ${runtimeStr}\n` +
        `⚡ ${formatStr} | 🎥 ${codecStr} • ${streamTech} | 🎧 ${audioCodec}\n` +
        `🛰️ Source: HDGharTV`;

      filteredStreams.push({
        name: `HDGharTV | ${resLabel} | Original`,
        title: layoutDescription,
        url: stream.url,
        behaviorHints: stream.behaviorHints || {}
      });
    });

    return filteredStreams;

  } catch (err) {
    console.error("Failed to construct device layouts:", err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
