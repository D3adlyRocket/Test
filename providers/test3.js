const BASE_URL = "https://5movierulz.gripe";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  Referer: `${BASE_URL}/`
};

function extractQuality(url = "") {
  const u = url.toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  return "Unknown";
}

async function getStreams(tmdbId, mediaType) {
  try {
    // =====================
    // TMDB
    // =====================
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // =====================
    // SEARCH (FIXED)
    // =====================
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
    const searchHtml = await (await fetch(searchUrl, { headers: HEADERS })).text();

    const $ = cheerio.load(searchHtml);

    const results = [];

    // 🔥 BROADER SEARCH (not brittle selector)
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      const text = ($(el).text() || "").trim();

      if (!href || !text) return;

      // heuristic: movie pages usually include year or quality hints
      if (
        href.includes(BASE_URL) &&
        text.length > 3 &&
        !text.toLowerCase().includes("home") &&
        !text.toLowerCase().includes("category")
      ) {
        results.push({ title: text, url: href });
      }
    });

    if (!results.length) return [];

    const lcTitle = title.toLowerCase();

    let match =
      results.find(r => r.title.toLowerCase().includes(lcTitle)) ||
      results[0];

    const pageUrl = match.url.startsWith("http")
      ? match.url
      : `${BASE_URL}${match.url}`;

    // =====================
    // LOAD PAGE
    // =====================
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    const $page = cheerio.load(pageHtml);

    const streams = [];

    // =====================
    // STRATEGY 1: direct watch links
    // =====================
    $page("a").each((_, el) => {
      const text = ($(el).text() || "").toLowerCase();
      const href = $(el).attr("href");

      if (!href) return;

      if (
        text.includes("watch") ||
        text.includes("online") ||
        text.includes("server") ||
        text.includes("stream")
      ) {
        streams.push({
          url: href,
          quality: extractQuality(href),
          title: `5movierulz [direct]`,
          subtitles: []
        });
      }
    });

    // =====================
    // STRATEGY 2: fallback (iframe/video links)
    // =====================
    if (!streams.length) {
      $page("iframe, video source, source").each((_, el) => {
        const src = $(el).attr("src");
        if (src && src.startsWith("http")) {
          streams.push({
            url: src,
            quality: extractQuality(src),
            title: `5movierulz [embed]`,
            subtitles: []
          });
        }
      });
    }

    return streams;
  } catch (e) {
    console.log("[5movierulz FATAL]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
