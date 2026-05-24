// desicinemas.js
// Nuvio-compatible Desicinemas scraper (fixed version)

const BASE_URL = "https://desicinemas.to";
const PROXY = "https://desicinemas.phisherdesicinema.workers.dev/";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:139.0) Gecko/20100101 Firefox/139.0",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Referer": BASE_URL,
  "Connection": "keep-alive",
  "Cache-Control": "no-cache"
};

function extractQuality(url = "") {
  const u = url.toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  return "Unknown";
}

async function fetchText(url) {
  return await (await fetch(url, { headers: HEADERS })).text();
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // =========================
    // 1. TMDB lookup
    // =========================
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // =========================
    // 2. Search (via proxy)
    // =========================
    const searchUrl =
      `${PROXY}?url=${encodeURIComponent(`${BASE_URL}/?s=${encodeURIComponent(title)}`)}`;

    const searchHtml = await fetchText(searchUrl);
    const $ = cheerio.load(searchHtml);

    const results = [];

    $(".MovieList a, .TPostMv a").each((_, el) => {
      const href = $(el).attr("href");
      const t = $(el).find("h2, .Title, .title").first().text().trim();

      if (href && t) {
        results.push({ title: t, url: href });
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

    const proxyPageUrl = `${PROXY}?url=${encodeURIComponent(pageUrl)}`;

    // =========================
    // 3. Load movie page
    // =========================
    const pageHtml = await fetchText(proxyPageUrl);
    const $page = cheerio.load(pageHtml);

    const streams = [];

    const optionBoxes = $page(".OptionBx").toArray();

    for (const box of optionBoxes) {
      try {
        const link = $page(box).find("a").attr("href");
        if (!link) continue;

        const embedHtml = await fetchText(link);
        const $embed = cheerio.load(embedHtml);

        const iframeSrc = $embed("iframe").attr("src");
        if (!iframeSrc) continue;

        const name =
          $page(box).find("p.AAIco-dns").text().trim() ||
          "Desicinemas";

        streams.push({
          url: iframeSrc,
          quality: extractQuality(iframeSrc),
          title: `Desicinemas [${name}]`,
          subtitles: []
        });
      } catch (e) {
        console.log("[OptionBx error]", e);
      }
    }

    return streams;
  } catch (e) {
    console.log("[Desicinemas FATAL]", e);
    return [];
  }
}

// ✅ REQUIRED for Nuvio detection
module.exports = {
  getStreams
};
