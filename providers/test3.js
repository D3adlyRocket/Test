// netcinez.js
// Netcinez provider rebuilt using the working proxy/iframe engine approach

const cheerio = require("cheerio");

const BASE_URL = "https://netcinez.si";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Referer": `${BASE_URL}/`
};

// ======================================
// PROXY FETCH (IMPORTANT)
// ======================================
const PROXY = (url) =>
  `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;

async function fetchText(url) {
  try {
    const res = await fetch(PROXY(url), {
      headers: HEADERS,
      skipSizeCheck: true
    });

    return await res.text();
  } catch (e) {
    console.log("[FETCH ERROR]", e);
    return "";
  }
}

// ======================================
// QUALITY
// ======================================
function extractQuality(text = "") {
  const u = text.toLowerCase();

  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p") || u.includes("fullhd")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  if (u.includes("360p")) return "360p";

  return "Unknown";
}

// ======================================
// URL NORMALIZER
// ======================================
function normalizeUrl(url) {
  if (!url) return null;

  if (url.startsWith("http")) return url;

  if (url.startsWith("//")) {
    return "https:" + url;
  }

  if (url.startsWith("/")) {
    return BASE_URL + url;
  }

  return `${BASE_URL}/${url}`;
}

// ======================================
// STREAM EXTRACTOR
// ======================================
async function extractPlayerStreams(url, label = "Netcinez") {
  try {
    const html = await fetchText(url);

    if (!html) return [];

    const $ = cheerio.load(html);

    const streams = [];

    // --------------------------
    // direct media
    // --------------------------
    $("source, video source").each((_, el) => {
      const src = $(el).attr("src");

      if (!src) return;

      const full = normalizeUrl(src);

      if (
        full.includes(".mp4") ||
        full.includes(".m3u8")
      ) {
        streams.push({
          url: full,
          quality: extractQuality(full),
          title: label,
          subtitles: []
        });
      }
    });

    // --------------------------
    // iframe fallback
    // --------------------------
    $("iframe").each((_, el) => {
      const src = $(el).attr("src");

      if (!src) return;

      const full = normalizeUrl(src);

      streams.push({
        url: full,
        quality: extractQuality(full),
        title: `${label} [iframe]`,
        subtitles: []
      });
    });

    // --------------------------
    // button links fallback
    // --------------------------
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      const text = ($(el).text() || "").trim();

      if (!href) return;

      const full = normalizeUrl(href);

      if (
        full.includes(".mp4") ||
        full.includes(".m3u8") ||
        text.toLowerCase().includes("download") ||
        text.toLowerCase().includes("assistir") ||
        text.toLowerCase().includes("player")
      ) {
        streams.push({
          url: full,
          quality: extractQuality(text + " " + full),
          title: `${label} [${text || "link"}]`,
          subtitles: []
        });
      }
    });

    return streams;
  } catch (e) {
    console.log("[EXTRACT ERROR]", e);
    return [];
  }
}

// ======================================
// MAIN
// ======================================
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // ==================================
    // TMDB
    // ==================================
    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo =
      await (await fetch(tmdbUrl, {
        skipSizeCheck: true
      })).json();

    const title = mediaInfo.title || mediaInfo.name;

    if (!title) return [];

    console.log("[NETCINEZ TITLE]", title);

    // ==================================
    // SEARCH
    // ==================================
    const searchUrl =
      `${BASE_URL}/?s=${encodeURIComponent(title)}`;

    const searchHtml = await fetchText(searchUrl);

    if (!searchHtml) {
      console.log("[NETCINEZ] Empty search HTML");
      return [];
    }

    const $ = cheerio.load(searchHtml);

    const results = [];

    // BROAD SEARCH
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      const text = ($(el).text() || "").trim();

      if (!href || !text) return;

      if (
        href.includes(BASE_URL) &&
        text.length > 2
      ) {
        results.push({
          title: text,
          url: href
        });
      }
    });

    if (!results.length) {
      console.log("[NETCINEZ] No results");
      return [];
    }

    // ==================================
    // MATCH
    // ==================================
    const lcTitle = title.toLowerCase();

    let match =
      results.find(r =>
        r.title.toLowerCase().includes(lcTitle)
      ) || results[0];

    if (!match) return [];

    const pageUrl = normalizeUrl(match.url);

    console.log("[NETCINEZ PAGE]", pageUrl);

    // ==================================
    // LOAD PAGE
    // ==================================
    const pageHtml = await fetchText(pageUrl);

    if (!pageHtml) {
      console.log("[NETCINEZ] Empty page HTML");
      return [];
    }

    const $page = cheerio.load(pageHtml);

    // ==================================
    // iframe/player extraction
    // ==================================
    let playerUrl =
      $page("#player-container iframe").attr("src") ||
      $page("#player-container iframe").attr("data-src") ||
      $page("iframe").first().attr("src");

    playerUrl = normalizeUrl(playerUrl);

    // fallback to current page extraction
    if (!playerUrl) {
      console.log("[NETCINEZ] No iframe found, using page");

      return await extractPlayerStreams(
        pageUrl,
        `Netcinez - ${title}`
      );
    }

    console.log("[NETCINEZ PLAYER]", playerUrl);

    // ==================================
    // extract streams from iframe/player
    // ==================================
    const streams = await extractPlayerStreams(
      playerUrl,
      `Netcinez - ${title}`
    );

    return streams;

  } catch (e) {
    console.log("[NETCINEZ FATAL]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
