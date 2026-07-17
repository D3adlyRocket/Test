"use strict";

const MANIFEST_STREAM_BASE = "https://hfip-nuvio-hub-private.hf.space/stream";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  
  try {
    // 1. Convert the TMDB ID to an IMDb ID (ttXXXXXXX)
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    const meta = await fetch(tmdbUrl).then(r => r.json());
    
    const imdbId = meta?.external_ids?.imdb_id || meta?.imdb_id;
    if (!imdbId) {
      console.error(`Could not find a matching IMDb ID for TMDB ID: ${tmdbId}`);
      return [];
    }

    // 2. Format the ID endpoint path
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

    // 4. Parse and filter the results strictly for HDGharTV
    data.streams.forEach(stream => {
      const nameText = (stream.name || "").toLowerCase();
      const titleText = (stream.title || "").toLowerCase();

      // Strict validation: Must match HDGharTV (CineScrape is ignored/dropped)
      const matchesHDGharTV = nameText.includes("hdghartv") || titleText.includes("hdghartv");

      if (!matchesHDGharTV) {
        return; // Drop the link immediately if it isn't HDGharTV
      }

      // Check resolutions (4K, 1080p, 720p)
      const is4K = /\b(2160p|4k)\b/i.test(titleText) || /\b(2160p|4k)\b/i.test(nameText);
      const is1080 = /\b(1080p)\b/i.test(titleText) || /\b(1080p)\b/i.test(nameText);
      const is720 = /\b(720p)\b/i.test(titleText) || /\b(720p)\b/i.test(nameText);

      if (!is4K && !is1080 && !is720) {
        return; // Drop unsupported resolutions
      }

      // Set clean display labels
      let displayResolution = "1080p";
      if (is4K) displayResolution = "4K 💎";
      else if (is720) displayResolution = "720p 🎬";

      filteredStreams.push({
        name: `[HDGharTV] ${displayResolution}`,
        title: stream.title || `HDGharTV Stream`,
        url: stream.url,
        behaviorHints: stream.behaviorHints || {}
      });
    });

    return filteredStreams;

  } catch (err) {
    console.error("Failed to fetch or filter manifest streams:", err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
