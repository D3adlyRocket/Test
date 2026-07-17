"use strict";

const PROVIDER_NAME = "CineScrape - HDGharTV";
const MANIFEST_STREAM_BASE = "https://hfip-nuvio-hub-private.hf.space/stream";

async function getStreams(tmdbId, mediaType, season, episode) {
  const isSeries = mediaType === 'tv' || mediaType === 'series';
  
  // 1. Construct the stream endpoint based on standard Stremio formatting
  let streamUrl;
  if (isSeries) {
    streamUrl = `${MANIFEST_STREAM_BASE}/series/${tmdbId}:${season || 1}:${episode || 1}.json`;
  } else {
    streamUrl = `${MANIFEST_STREAM_BASE}/movie/${tmdbId}.json`;
  }

  try {
    // 2. Fetch all streams from the private hub manifest
    const response = await fetch(streamUrl);
    const data = await response.json();
    
    if (!data || !data.streams || data.streams.length === 0) {
      return [];
    }

    const filteredStreams = [];

    // 3. Loop through and filter out unwanted providers and resolutions
    data.streams.forEach(stream => {
      const nameText = (stream.name || "").toLowerCase();
      const titleText = (stream.title || "").toLowerCase();

      // Filter Condition 1: Must be from CineScrape - HDGharTV
      if (!nameText.includes("hdghartv") && !titleText.includes("hdghartv")) {
        return; // Skip this stream
      }

      // Filter Condition 2: Must match allowed resolutions (4K/2160p, 1080p, 720p)
      const has4K = /2160p|4k/i.test(titleText) || /2160p|4k/i.test(nameText);
      const has1080 = /1080p/i.test(titleText) || /1080p/i.test(nameText);
      const has720 = /720p/i.test(titleText) || /720p/i.test(nameText);

      if (!has4K && !has1080 && !has720) {
        return; // Skip 480p or lower / unlabelled streams
      }

      // Determine clean label for resolution
      let resolutionLabel = "1080p";
      if (has4K) resolutionLabel = "4K 💎";
      else if (has720) resolutionLabel = "720p 🎬";

      // 4. Format and add your clean, chosen links to the final output list
      filteredStreams.push({
        name: `[${PROVIDER_NAME}] ${resolutionLabel}`,
        title: stream.title,
        url: stream.url,
        behaviorHints: stream.behaviorHints || {}
      });
    });

    return filteredStreams;

  } catch (err) {
    console.error("Error filtering the Nuvio Hub manifest streams:", err);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
