"use strict";

const MANIFEST_STREAM_BASE = "https://hfip-nuvio-hub-private.hf.space/stream";

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  
  // Format the ID correctly for Nuvio/Stremio standards
  const formattedId = isSeries 
    ? `${tmdbId}:${season || 1}:${episode || 1}` 
    : `${tmdbId}`;

  const typePath = isSeries ? 'series' : 'movie';
  const url = `${MANIFEST_STREAM_BASE}/${typePath}/${encodeURIComponent(formattedId)}.json`;

  try {
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

    data.streams.forEach(stream => {
      const nameText = (stream.name || "").toLowerCase();
      const titleText = (stream.title || "").toLowerCase();

      // Strict validation for provider matches
      const matchesCineScrape = nameText.includes("cinescrape") || titleText.includes("cinescrape");
      const matchesHDGharTV = nameText.includes("hdghartv") || titleText.includes("hdghartv");

      // Filter: Stream MUST belong to either CineScrape or HDGharTV
      if (!matchesCineScrape && !matchesHDGharTV) {
        return; 
      }

      // Resolution identification
      const is4K = /\b(2160p|4k)\b/i.test(titleText) || /\b(2160p|4k)\b/i.test(nameText);
      const is1080 = /\b(1080p)\b/i.test(titleText) || /\b(1080p)\b/i.test(nameText);
      const is720 = /\b(720p)\b/i.test(titleText) || /\b(720p)\b/i.test(nameText);

      // Filter: Resolution MUST be 4K, 1080p, or 720p
      if (!is4K && !is1080 && !is720) {
        return; 
      }

      // Assign display tags based on detected resolution
      let displayResolution = "1080p";
      if (is4K) displayResolution = "4K 💎";
      else if (is720) displayResolution = "720p 🎬";

      // Match display prefix badge based on the matched provider
      const activeProvider = matchesHDGharTV ? "HDGharTV" : "CineScrape";

      filteredStreams.push({
        name: `[${activeProvider}] ${displayResolution}`,
        title: stream.title || `${activeProvider} Stream`,
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
