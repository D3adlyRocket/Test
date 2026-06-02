const cheerio = require('cheerio-without-node-native');

// ============================================================
// OnePace Provider for Nuvio
// Scrapes https://onepace.co
// Resolves direct .m3u8 streams from embeds
// Includes Turbosplayer support
// ============================================================

const BASE_URL = "https://onepace.co";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Referer": BASE_URL + "/",
  "Origin": BASE_URL
};

async function safeFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (e) {
    console.log("[safeFetch error]", e);
    return null;
  }
}

function extractM3U8(html) {
  if (!html) return null;

  const patterns = [
    /https?:\/\/[^"' ]+\.m3u8[^"' ]*/gi,
    /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
    /source\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
    /src\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match) {
      if (Array.isArray(match)) {
        return match[1] || match[0];
      }
    }
  }

  // Turbosplayer fallback
  const turboMatch = html.match(
    /file\/([a-f0-9-]+)\/master\.m3u8/i
  );

  if (turboMatch) {
    return `https://g251.turbosplayer.com/file/${turboMatch[1]}/master.m3u8`;
  }

  return null;
}

async function resolveStream(embedUrl) {
  try {
    const embedHeaders = {
      ...HEADERS,
      Referer: BASE_URL + "/"
    };

    const res = await safeFetch(embedUrl, {
      headers: embedHeaders
    });

    if (!res) return null;

    const html = await res.text();

    // Direct extraction
    let m3u8 = extractM3U8(html);

    // If iframe inside iframe
    if (!m3u8) {
      const iframeMatch = html.match(
        /<iframe[^>]+src=["']([^"']+)["']/i
      );

      if (iframeMatch && iframeMatch[1]) {
        const nestedUrl = iframeMatch[1].startsWith("http")
          ? iframeMatch[1]
          : new URL(iframeMatch[1], embedUrl).href;

        const nestedRes = await safeFetch(nestedUrl, {
          headers: {
            ...HEADERS,
            Referer: embedUrl
          }
        });

        if (nestedRes) {
          const nestedHtml = await nestedRes.text();
          m3u8 = extractM3U8(nestedHtml);
        }
      }
    }

    if (!m3u8) return null;

    return {
      url: m3u8,
      referer: embedUrl,
      origin: new URL(embedUrl).origin
    };

  } catch (e) {
    console.log("[resolveStream error]", e);
    return null;
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {

    // =========================================================
    // Get TMDB info
    // =========================================================

    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const tmdbRes = await safeFetch(tmdbUrl, {
      headers: HEADERS
    });

    if (!tmdbRes) return [];

    const mediaInfo = await tmdbRes.json();

    const title = mediaInfo.title || mediaInfo.name;

    if (!title) return [];

    // =========================================================
    // Load One Pace page
    // =========================================================

    const seriesUrl =
      `${BASE_URL}/series/one-pace-english-sub/`;

    const seriesRes = await safeFetch(seriesUrl, {
      headers: HEADERS
    });

    if (!seriesRes) return [];

    const seriesHtml = await seriesRes.text();

    const doc = cheerio.load(seriesHtml);

    const streams = [];

// =========================================================
// Find episode links
// =========================================================

let episodeLinks = [];

const allEpisodes = [];

doc("ul.seasons-lst.anm-a li").each((_, el) => {

  const $el = doc(el);

  const href = $el.find("a").attr("href");

  const title =
    $el.find("h3.title").text().trim() ||
    $el.text().trim();

  if (href) {

    allEpisodes.push({
      href,
      title
    });
  }
});

// Debug logging
console.log(
  "[OnePace] Total episodes:",
  allEpisodes.length
);

// Match by episode index instead
if (episode && allEpisodes.length > 0) {

  const epIndex = parseInt(episode) - 1;

  if (allEpisodes[epIndex]) {

    episodeLinks.push(
      allEpisodes[epIndex].href
    );

    console.log(
      "[OnePace] Selected:",
      allEpisodes[epIndex].title
    );
  }
}

// Final fallback
if (episodeLinks.length === 0 && allEpisodes.length > 0) {

  episodeLinks.push(allEpisodes[0].href);

  console.log(
    "[OnePace] Using fallback episode"
  );
}

    // =========================================================
    // Fallback first episode
    // =========================================================

    if (episodeLinks.length === 0) {

      const firstEp =
        doc("ul.seasons-lst.anm-a li")
          .first()
          .find("a")
          .attr("href");

      if (firstEp) {
        episodeLinks.push(firstEp);
      }
    }

    // =========================================================
    // Extract stream links
    // =========================================================

    for (const epUrl of episodeLinks) {

      try {

        const fullUrl = epUrl.startsWith("http")
          ? epUrl
          : BASE_URL + epUrl;

        const epRes = await safeFetch(fullUrl, {
          headers: HEADERS
        });

        if (!epRes) continue;

        const epHtml = await epRes.text();

        const epDoc = cheerio.load(epHtml);

        const bodyClass =
          epDoc("body").attr("class") || "";

        const termMatch =
          bodyClass.match(/(?:term|postid)-(\d+)/);

        if (!termMatch) continue;

        const term = termMatch[1];

        // =====================================================
// Extract ALL iframes directly from episode page
// =====================================================

const iframeSources = [];

// Main iframe embeds
epDoc("iframe").each((_, frame) => {

  let src = epDoc(frame).attr("src");

  if (!src) return;

  if (!src.startsWith("http")) {
    src = new URL(src, BASE_URL).href;
  }

  iframeSources.push(src);
});

// Video source URLs inside scripts
epHtml.match(/https?:\/\/[^"' ]+/g)?.forEach(url => {

  if (
    url.includes("embed") ||
    url.includes("player") ||
    url.includes("turbosplayer") ||
    url.includes(".m3u8")
  ) {
    iframeSources.push(url);
  }
});

// Remove duplicates
const uniqueFrames = [...new Set(iframeSources)];

console.log(
  "[OnePace] Found iframe sources:",
  uniqueFrames.length
);

// Resolve each iframe
for (let i = 0; i < uniqueFrames.length; i++) {

  try {

    const src = uniqueFrames[i];

    const resolved = await resolveStream(src);

    if (!resolved?.url) continue;

    console.log(
      "[OnePace] Resolved:",
      resolved.url
    );

    streams.push({
      name: "OnePace",
      title: `OnePace Server ${i + 1}`,
      url: resolved.url,
      quality: "1080p",
      type: "hls",
      subtitles: [],

      behaviorHints: {
        notWebReady: false,

        proxyHeaders: {
          request: {
            "User-Agent":
              HEADERS["User-Agent"],

            "Referer":
              resolved.referer,

            "Origin":
              resolved.origin
          }
        }
      }
    });

  } catch (err) {
    console.log("[resolve error]", err);
  }
}

    // =========================================================
    // Remove duplicates
    // =========================================================

    const unique = [];
    const seen = new Set();

    for (const s of streams) {

      if (!seen.has(s.url)) {
        seen.add(s.url);
        unique.push(s);
      }
    }

    console.log(
      `[OnePace] Found ${unique.length} streams`
    );

    return unique;

  } catch (e) {

    console.log("[OnePace fatal error]", e);

    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
