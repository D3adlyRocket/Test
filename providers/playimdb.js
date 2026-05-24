// movierulzhd.js
// Nuvio-compatible Movierulzhd provider (fixed)

const DOMAINS_URL =
  "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://123moviesfree9.cloud";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

// =========================
// Helpers
// =========================
function extractQuality(url = "") {
  const u = url.toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  if (u.includes("360p")) return "360p";
  return "Unknown";
}

let cachedBaseUrl = null;

async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;

  try {
    const resp = await fetch(DOMAINS_URL);
    const data = await resp.json();
    cachedBaseUrl = data.movierulzhd || FALLBACK_URL;
  } catch (e) {
    console.log("[domain fallback]", e);
    cachedBaseUrl = FALLBACK_URL;
  }

  return cachedBaseUrl;
}

// =========================
// AJAX extractor
// =========================
async function fetchEmbedUrl(baseUrl, post, nume, type) {
  try {
    const resp = await fetch(`${baseUrl}/wp-admin/admin-ajax.php`, {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        Referer: baseUrl
      },
      body: `action=doo_player_ajax&post=${post}&nume=${nume}&type=${type}`
    });

    const text = await resp.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // fallback if response is not strict JSON
      const match = text.match(/\{.*\}/s);
      data = match ? JSON.parse(match[0]) : {};
    }

    let embedUrl = data.embed_url || "";
    if (!embedUrl) return null;

    const srcMatch = embedUrl.match(/SRC="(https?:[^"]+)"/i);
    if (srcMatch) return srcMatch[1].trim();

    const urlMatch = embedUrl.match(/"(https?[^"]+)"/);
    if (urlMatch) return urlMatch[1].trim();

    return embedUrl.replace(/^"|"$/g, "").trim();
  } catch (e) {
    console.log("[embed error]", e);
    return null;
  }
}

// =========================
// Main
// =========================
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const BASE_URL = await getBaseUrl();

    // 1. TMDB lookup
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search site
    const searchUrl = `${BASE_URL}/search/${encodeURIComponent(
      title.replace(/ /g, "-")
    )}`;

    const searchHtml = await (await fetch(searchUrl)).text();
    const $ = cheerio.load(searchHtml);

    const results = [];

    $("div.result-item").each((_, el) => {
      const a = $(el).find("div.title > a");
      const href = a.attr("href");
      const name = a.text().replace(/\(\d{4}\)/, "").trim();

      if (href && name) {
        results.push({ href, name });
      }
    });

    if (!results.length) return [];

    const match =
      results.find(r => r.name.toLowerCase().includes(title.toLowerCase())) ||
      results[0];

    let contentUrl = match.href;

    if (contentUrl.includes("/episodes/")) {
      const t = contentUrl.split("/episodes/")[1];
      const slug = t.match(/(.+?)-season/)?.[1] || t;
      contentUrl = `${BASE_URL}/tvshows/${slug}`;
    } else if (contentUrl.includes("/seasons/")) {
      const t = contentUrl.split("/seasons/")[1];
      const slug = t.match(/(.+?)-season/)?.[1] || t;
      contentUrl = `${BASE_URL}/tvshows/${slug}`;
    }

    const pageResp = await fetch(contentUrl);
    const pageHtml = await pageResp.text();
    const $p = cheerio.load(pageHtml);

    const directUrl = new URL(pageResp.url || contentUrl).origin;
    const streams = [];

    const isMovie = mediaType === "movie";

    // =========================
    // TV LOGIC
    // =========================
    if (!isMovie && mediaType === "tv") {
      const epLinks = [];

      $("ul.episodios > li").each((_, el) => {
        const href = $(el).find("a").attr("href");
        const numText = $(el)
          .find("div.numerando")
          .text()
          .replace(/ /g, "");

        const parts = numText.split("-");
        const sNum = parseInt(parts[0] || "0");
        const eNum = parseInt(parts[1] || "0");

        if (href) epLinks.push({ href, season: sNum, episode: eNum });
      });

      const target =
        epLinks.find(
          ep =>
            ep.season === parseInt(season || 1) &&
            ep.episode === parseInt(episode || 1)
        ) || epLinks[0];

      if (target) {
        const epResp = await fetch(target.href);
        const epHtml = await epResp.text();
        const $ep = cheerio.load(epHtml);

        const epDirectUrl = new URL(epResp.url || target.href).origin;

        const items = [];

        $ep("ul#playeroptionsul > li").each((_, el) => {
          items.push({
            post: $(el).attr("data-post"),
            nume: $(el).attr("data-nume"),
            type: $(el).attr("data-type")
          });
        });

        for (const item of items.slice(0, 5)) {
          if (!item.post || !item.nume) continue;
          if ((item.nume || "").includes("trailer")) continue;

          const embedUrl = await fetchEmbedUrl(
            epDirectUrl,
            item.post,
            item.nume,
            item.type
          );

          if (embedUrl && !embedUrl.includes("youtube")) {
            streams.push({
              url: embedUrl,
              quality: extractQuality(embedUrl),
              title: "Movierulzhd",
              subtitles: []
            });
          }
        }

        return streams;
      }
    }

    // =========================
    // MOVIE LOGIC
    // =========================
    const playerItems = [];

    $p("ul#playeroptionsul > li").each((_, el) => {
      playerItems.push({
        post: $(el).attr("data-post"),
        nume: $(el).attr("data-nume"),
        type: $(el).attr("data-type")
      });
    });

    for (const item of playerItems.slice(0, 5)) {
      if (!item.post || !item.nume) continue;
      if ((item.nume || "").includes("trailer")) continue;

      const embedUrl = await fetchEmbedUrl(
        directUrl,
        item.post,
        item.nume,
        item.type
      );

      if (embedUrl && !embedUrl.includes("youtube")) {
        streams.push({
          url: embedUrl,
          quality: extractQuality(embedUrl),
          title: "Movierulzhd",
          subtitles: []
        });
      }
    }

    return streams;
  } catch (e) {
    console.log("[Movierulzhd FATAL]", e);
    return [];
  }
}

// =========================
// REQUIRED EXPORT
// =========================
module.exports = {
  getStreams
};
