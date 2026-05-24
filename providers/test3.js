// fivemovierulz.js
// Nuvio-compatible 5movierulz scraper (fixed)

const BASE_URL = "https://5movierulz.gripe";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  Referer: `${BASE_URL}/`
};

// =========================
// Quality helper
// =========================
function extractQuality(url = "") {
  const u = url.toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  return "Unknown";
}

// =========================
// Main
// =========================
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. TMDB fetch
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo = await (await fetch(tmdbUrl)).json();
    if (!mediaInfo) return [];

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;

    const searchHtml = await (
      await fetch(searchUrl, { headers: HEADERS })
    ).text();

    const $ = cheerio.load(searchHtml);

    const results = [];

    $("#main .cont_display").each((_, el) => {
      const a = $(el).find("a").first();
      const href = a.attr("href");

      const t = (a.attr("title") || a.text() || "")
        .trim()
        .replace(/\(.*$/, "")
        .trim();

      if (href && t) {
        results.push({ title: t, url: href });
      }
    });

    if (!results.length) return [];

    const lcTitle = title.toLowerCase();

    let match =
      results.find(r => r.title.toLowerCase().includes(lcTitle)) ||
      results[0];

    if (!match) return [];

    const pageUrl = match.url.startsWith("http")
      ? match.url
      : `${BASE_URL}${match.url}`;

    // 3. Load page
    const pageHtml = await (
      await fetch(pageUrl, { headers: HEADERS })
    ).text();

    const $page = cheerio.load(pageHtml);

    const streams = [];

    // =========================
    // Extract "watch online"
    // =========================
    $page("p a").each((_, el) => {
      const text = $(el).text().toLowerCase().trim();
      const href = $(el).attr("href");

      if (!href) return;

      // filter only real watch links
      if (text.includes("watch online")) {
        streams.push({
          url: href,
          quality: extractQuality(href),
          title: `5movierulz [${$(el).text().trim()}]`,
          subtitles: []
        });
      }
    });

    return streams;
  } catch (e) {
    console.log("[5movierulz FATAL]", e);
    return [];
  }
}

// =========================
// REQUIRED EXPORT
// =========================
module.exports = {
  getStreams
};
