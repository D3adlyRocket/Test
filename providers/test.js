// kickassanime.js - Modern Nuxt-Compatible Module for Nuvio

const BASE_URL = "https://www.kaa.lt";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache"
};

/**
 * Sanitizes titles to generate accurate slugs matching Nuxt route parameters
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')       // Replace spaces with -
    .replace(/[^\w\-]+/g, '')   // Remove all non-word chars
    .replace(/\-\-+/g, '-');    // Replace multiple - with single -
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // Step 1: Fetch series metadata from TMDB
    const type = mediaType === "tv" ? "tv" : "movie";
    const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.name || mediaInfo.title;
    if (!title) return [];

    // Step 2: Target the Nuxt page directly using slug forecasting
    // Nuxt patterns use clean structural hyphenated route maps
    const slugTitle = slugify(title);
    let targetUrl = `${BASE_URL}/${slugTitle}`;

    if (type === "tv" && episode) {
      // Formats path directly to the episode page targeting your browser logs route context
      targetUrl = `${BASE_URL}/${slugTitle}-episode-${episode}`;
    }

    // Step 3: Fetch the raw HTML content with browser headers
    const response = await fetch(targetUrl, { headers: HEADERS, skipSizeCheck: true });
    if (!response.ok) return [];
    
    const html = await response.text();
    const streams = [];

    // Step 4: Extract embedded HLS stream links via adaptive regex routing
    // This circumvents the obfuscated JavaScript loops seen in your screenshot logs
    const m3u8Regex = /(https?:\/\/[^\s"'<>]+playlist\.m3u8[^\s"'<>]*)/gi;
    const m3u8Matches = html.match(m3u8Regex);

    if (m3u8Matches && m3u8Matches.length > 0) {
      const uniqueUrls = [...new Set(m3u8Matches)];
      
      for (const streamUrl of uniqueUrls) {
        const isSubVariant = streamUrl.includes("/a/playlist.m3u8");
        const hostOrigin = new URL(streamUrl).origin;

        streams.push({
          name: "KAA Player Engine",
          title: `KickassAnime (${isSubVariant ? "1080p Direct Track" : "Auto Adaptive Stream"})`,
          url: streamUrl,
          quality: isSubVariant ? "1080p" : "auto",
          headers: {
            "User-Agent": HEADERS["User-Agent"],
            "Origin": BASE_URL,
            "Referer": targetUrl + "/",
            "Accept": "*/*"
          },
          provider: "kickassanime"
        });
      }
    }

    // Fallback Step 5: Try finding any nested iFrame source nodes if manifests aren't top-level
    if (streams.length === 0) {
      const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/i;
      const iframeMatch = html.match(iframeRegex);
      if (iframeMatch && iframeMatch[1]) {
        let embedUrl = iframeMatch[1];
        if (embedUrl.startsWith("//")) embedUrl = "https:" + embedUrl;

        streams.push({
          name: "KAA Embed Cloud",
          title: "KickassAnime External Server Link",
          url: embedUrl,
          quality: "720p",
          headers: {
            "User-Agent": HEADERS["User-Agent"],
            "Referer": targetUrl + "/"
          },
          provider: "kickassanime"
        });
      }
    }

    return streams;
  } catch (e) {
    console.error("[KickassAnime Addon Engine Error]", e);
    return [];
  }
}

// --- Nuvio Environment Bridge Integration Layer ---
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else if (typeof global !== 'undefined') {
  global.getStreams = getStreams;
}
