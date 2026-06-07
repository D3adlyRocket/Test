// cinefreak.js
// Nuvio-compatible Cinefreak scraper (Domain Alignment Fix)

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

function convertToPlayableUrl(href, title, quality) {
  try {
    const idMatch = href.match(/[?&]id=([^&"'\s]+)/);
    if (!idMatch) return href;

    let decoded = decodeBase64Safe(idMatch[1]);
    if (!decoded || !decoded.startsWith("http")) return href;

    // Strip trailing 'newgo' verification additions
    decoded = decoded.replace(/newgo\d*$/, "");

    // Isolate storage hash segment
    const hashMatch = decoded.match(/\/f\/([a-f0-9]+)/i);
    if (!hashMatch || !hashMatch[1]) return decoded;

    const mediaId = hashMatch[1];

    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s()]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    // Reconstruct direct R2 asset download url
    return `https://pub-${mediaId}.r2.dev/CINEFREAK.TOP%20-%20${encodeURIComponent(cleanTitle)}%20%5B${quality}%5D.mkv`;
  } catch (e) {
    return href;
  }
}

// =========================
// Main
// =========================
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. Resolve asset title from TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Fetch from Search API endpoint discovered in logs
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

    // Format page routing safely
    let pageUrl = match.l.startsWith("http") ? match.l : `${BASE_URL}/${match.l}`;
    if (!pageUrl.endsWith("/")) {
      pageUrl += "/";
    }

    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    const $ = cheerio.load(pageHtml);

    const streams = [];
    const isTV = mediaType === "tv";

    // =========================
    // TV EXTRACTION
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
          const finalUrl = convertToPlayableUrl(href, title, qual);
          
          streams.push({
            url: finalUrl,
            quality: qual,
            title: `Cinefreak [${text}]`,
            subtitles: []
          });
        });
      });

      return streams;
    }

    // =========================
    // MOVIE EXTRACTION
    // =========================
    // Check both potential container class structures across both domains
    $("div.download-links-div, div.download-links").each((_, container) => {
      $(container).find("a[href*='generate.php']").each((_, a) => {
        const href = $(a).attr("href");
        if (!href) return;

        const contextualText = $(a).text() || $(a).closest("div").prev("h4").text() || "";
        const qual = extractQuality(contextualText);

        const finalUrl = convertToPlayableUrl(href, title, qual);

        streams.push({
          url: finalUrl,
          quality: qual,
          title: `Cinefreak [${qual}]`,
          subtitles: []
        });
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
