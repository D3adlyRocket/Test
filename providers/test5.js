// cinefreak.js
// Nuvio-compatible Cinefreak scraper (Direct Token Interception Fix)

const BASE_URL = "https://cinefreak.nl";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  "Accept": "*/*",
  "Referer": "https://cinefreak.nl/"
};
    
// =========================
// Helpers
// =========================
function extractQuality(str = "") {
  const u = str.toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  return "1080p";
}

function decodeBase64Safe(str) {
  try {
    let cleanStr = decodeURIComponent(str).trim();
    while (cleanStr.length % 4 !== 0) {
      cleanStr += "=";
    }
    return Buffer.from(cleanStr, "base64").toString("utf-8");
  } catch (e) {
    return null;
  }
}

/**
 * Intercepts the raw generate.php URL string, cracks open its base64 payload,
 * extracts the hidden cinecloud file identifier, and outputs the playable R2 location.
 */
function processGenerateLink(rawHref, title, quality) {
  try {
    // Isolate the base64 string from the "id=" parameter
    const idMatch = rawHref.match(/[?&]id=([^&"'\s]+)/);
    if (!idMatch) return null;

    let decoded = decodeBase64Safe(idMatch[1]);
    if (!decoded || !decoded.startsWith("http")) return null;

    // Purge the trailing 'newgo32' anti-bot tokens attached to the end of the string
    decoded = decoded.replace(/newgo\d*$/, "");

    // Extract the final unique stream hash (e.g., 7ebfab1b)
    const hashMatch = decoded.match(/\/f\/([a-f0-9]+)/i);
    if (!hashMatch || !hashMatch[1]) return null;

    const mediaId = hashMatch[1];
    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s()]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    // Build the direct R2 download link matching your verified endpoint layout
    return `https://pub-${mediaId}.r2.dev/CINEFREAK.TOP%20-%20${encodeURIComponent(cleanTitle)}%20%5B${quality}%5D.mkv`;
  } catch (e) {
    return null;
  }
}

// =========================
// Main
// =========================
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. Resolve exact title parameters via TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Query search endpoint tracking with fresh timestamp strings
    const timestamp = Date.now();
    const searchUrl = `${BASE_URL}/search-api.php?q=${encodeURIComponent(title)}&pg=1&_t=${timestamp}`;
    const searchResp = await fetch(searchUrl, { headers: HEADERS });

    let searchData;
    try {
      searchData = await searchResp.json();
    } catch (e) {
      return [];
    }

    const results = Array.isArray(searchData?.results) ? searchData.results : [];
    if (!results.length) return [];

    const lcTitle = title.toLowerCase();
    let match = results.find(r => (r.t || "").toLowerCase().includes(lcTitle)) || results[0];
    if (!match || !match.l) return [];

    // Form page routing target safely
    let pageUrl = match.l.startsWith("http") ? match.l : `${BASE_URL}/${match.l}`;
    if (!pageUrl.endsWith("/")) {
      pageUrl += "/";
    }

    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    const $ = cheerio.load(pageHtml);

    const streams = [];
    const isTV = mediaType === "tv";

    // =========================
    // TV PARSING
    // =========================
    if (isTV) {
      let found = false;

      $("div.ep-card").each((_, card) => {
        if (found) return;

        const seasonText = $(card).find("span.season-number").text().match(/S(\d+)/);
        const cardSeason = seasonText ? parseInt(seasonText[1]) : 1;
        if (cardSeason !== parseInt(season || 1)) return;

        const epText = $(card).find("span.episode-badge").text();
        const epMatch = epText.match(/Episode\s+([\d\-]+)/i);
        if (!epMatch) return;

        const epNums = epMatch[1].split("-").map(n => parseInt(n.trim())).filter(Boolean);
        if (!epNums.includes(parseInt(episode || 1))) return;

        found = true;

        $(card).find("div.download-links a[href]").each((_, a) => {
          const href = $(a).attr("href");
          const text = $(a).text().trim();
          if (!href) return;

          const qual = extractQuality(text);
          const finalUrl = processGenerateLink(href, title, qual);
          
          if (finalUrl) {
            streams.push({
              url: finalUrl,
              quality: qual,
              title: `Cinefreak Direct [${text}]`,
              subtitles: []
            });
          }
        });
      });

      return streams;
    }

    // =========================
    // MOVIE PARSING
    // =========================
    $("div.download-links-div, div.download-links, div.entry-content").each((_, container) => {
      $(container).find("a[href*='generate.php']").each((_, a) => {
        const href = $(a).attr("href");
        if (!href) return;

        const contextualText = $(a).text() || $(a).closest("div").prev("h4").text() || "";
        const qual = extractQuality(contextualText);

        const finalUrl = processGenerateLink(href, title, qual);

        if (finalUrl) {
          streams.push({
            url: finalUrl,
            quality: qual,
            title: `Cinefreak Direct [${qual}]`,
            subtitles: []
          });
        }
      });
    });

    return streams;

  } catch (e) {
    console.log("[Cinefreak FATAL]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
