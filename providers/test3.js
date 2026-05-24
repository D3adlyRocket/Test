// netcinez.js
// Nuvio-compatible Netcinez scraper (fixed & hardened)

const BASE_URL = "https://netcinez.si";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: `${BASE_URL}/`
};

// =========================
// Quality
// =========================
function extractQuality(text = "") {
  const u = text.toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p") || u.includes("fullhd")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  if (u.includes("360p")) return "360p";
  return "Unknown";
}

// =========================
// Safe URL normalizer
// =========================
function normalizeUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  return `${BASE_URL}${url}`;
}

// =========================
// Episode parser (FIXED)
// =========================
function parseEpisode(text = "") {
  const t = text.toLowerCase();

  // supports: "S1E3", "1-3", "1x3"
  const match =
    t.match(/s?(\d+)\s*[-x]?\s*e?(\d+)/i) ||
    t.match(/(\d+)\s*[-x]\s*(\d+)/);

  if (!match) return null;

  return {
    season: parseInt(match[1]),
    episode: parseInt(match[2])
  };
}

// =========================
// Main
// =========================
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
    const searchHtml = await (await fetch(searchUrl, { headers: HEADERS })).text();
    const $ = cheerio.load(searchHtml);

    const results = [];

    // BROADER SEARCH (fixes missing results issue)
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      const text = ($(el).text() || "").trim();

      if (!href || !text) return;

      if (href.includes(BASE_URL) && text.length > 3) {
        results.push({ title: text, url: href });
      }
    });

    if (!results.length) return [];

    const lcTitle = title.toLowerCase();

    let match =
      results.find(r => r.title.toLowerCase().includes(lcTitle)) ||
      results[0];

    const pageUrl = normalizeUrl(match.url);

    // 3. Load page
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    const $p = cheerio.load(pageHtml);

    const streams = [];

    const isTV = mediaType === "tv";

    // =========================
    // TV LOGIC (FIXED)
    // =========================
    if (isTV) {
      let targetEpUrl = null;

      $p("div.post #cssmenu a").each((_, el) => {
        const href = $p(el).attr("href");
        const text = $p(el).text();

        const parsed = parseEpisode(text);

        if (!parsed || !href) return;

        const sMatch = parseInt(season || 1);
        const eMatch = parseInt(episode || 1);

        if (parsed.season === sMatch && parsed.episode === eMatch) {
          targetEpUrl = normalizeUrl(href);
        }
      });

      if (!targetEpUrl) {
        targetEpUrl = normalizeUrl($p("div.post #cssmenu a").first().attr("href"));
      }

      if (!targetEpUrl) return [];

      const epHtml = await (await fetch(targetEpUrl, { headers: HEADERS })).text();
      const $ep = cheerio.load(epHtml);

      let iframeUrl =
        $ep("#player-container iframe").attr("src") ||
        $ep("#player-container iframe").attr("data-src");

      iframeUrl = normalizeUrl(iframeUrl);

      if (!iframeUrl) return [];

      const iframeHtml = await (
        await fetch(iframeUrl, { headers: HEADERS })
      ).text();

      const $ifr = cheerio.load(iframeHtml);

      $ifr("div.btn-container a").each((_, el) => {
        const href = normalizeUrl($ifr(el).attr("href"));
        const label = $ifr(el).text().trim();

        if (href) {
          streams.push({
            url: href,
            quality: extractQuality(label),
            title: `Netcinez [${label}]`,
            subtitles: []
          });
        }
      });

      return streams;
    }

    // =========================
    // MOVIE LOGIC
    // =========================
    let iframeUrl =
      $p("#player-container iframe").attr("src") ||
      $p("#player-container iframe").attr("data-src");

    iframeUrl = normalizeUrl(iframeUrl);

    if (!iframeUrl) return [];

    const iframeHtml = await (
      await fetch(iframeUrl, { headers: HEADERS })
    ).text();

    const $ifr = cheerio.load(iframeHtml);

    $ifr("div.btn-container a").each((_, el) => {
      const href = normalizeUrl($ifr(el).attr("href"));
      const label = $ifr(el).text().trim();

      if (href) {
        streams.push({
          url: href,
          quality: extractQuality(label),
          title: `Netcinez [${label}]`,
          subtitles: []
        });
      }
    });

    return streams;
  } catch (e) {
    console.log("[Netcinez FATAL]", e);
    return [];
  }
}

// =========================
// REQUIRED EXPORT
// =========================
module.exports = {
  getStreams
};
