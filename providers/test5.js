// cinefreak.js
// Nuvio-compatible Cinefreak scraper (Strict Structural Fix)

const BASE_URL = "https://cinefreak.nl";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Cookie: "xla=s4t"
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
  if (u.includes("360p")) return "360p";
  return "Unknown";
}

function decodeBase64Safe(str) {
  try {
    let cleanStr = decodeURIComponent(str).trim();
    // Re-apply browser-style missing padding padding
    while (cleanStr.length % 4 !== 0) {
      cleanStr += "=";
    }
    return Buffer.from(cleanStr, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * Directly maps the ID token inside the generate link to the absolute working storage destination.
 */
function convertToPlayableUrl(href, title, quality) {
  try {
    // Isolate the base64 payload from the id parameter
    const idMatch = href.match(/[?&]id=([^&]+)/);
    if (!idMatch) return href;

    let decoded = decodeBase64Safe(idMatch[1]);
    if (!decoded || !decoded.startsWith("http")) return href;

    // Strip trailing 'newgo32' anti-bot additions
    decoded = decoded.replace(/newgo\d*$/, "");

    // Isolate the storage hash ID (e.g., 7ebfab1b)
    const hashMatch = decoded.match(/\/f\/([a-f0-9]+)/i);
    if (!hashMatch || !hashMatch[1]) return decoded;

    const mediaId = hashMatch[1];

    // Clean title structure to fit the raw storage configuration naming conventions precisely
    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s()]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    // Reconstruct the direct download link asset explicitly match your working sample
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
    // 1. Meta Retrieval
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Querying Internal Search API
    const searchUrl = `${BASE_URL}/search-api.php?q=${encodeURIComponent(title)}&pg=1`;
    const searchResp = await fetch(searchUrl, { headers: HEADERS });

    let searchData;
    try {
      searchData = await searchResp.json();
    } catch {
      return [];
    }

    const results = Array.isArray(searchData?.results) ? searchData.results : [];
    if (!results.length) return [];

    // 3. Selection Node Validation
    const lcTitle = title.toLowerCase();
    let match = results.find(r => (r.t || "").toLowerCase().includes(lcTitle)) || results[0];
    if (!match) return [];

    const pageUrl = match.l.startsWith("http") ? match.l : `${BASE_URL}/${match.l}/`;
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    const $ = cheerio.load(pageHtml);

    const streams = [];
    const isTV = mediaType === "tv";

    // =========================
    // TV EXTRACTION LOGIC
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
          const finalPlayableUrl = convertToPlayableUrl(href, title, qual);
          
          streams.push({
            url: finalPlayableUrl,
            quality: qual,
            title: `Cinefreak [${text}]`,
            subtitles: []
          });
        });
      });

      return streams;
    }

    // =========================
    // MOVIE EXTRACTION LOGIC
    // =========================
    // Flatten selection structure entirely to verify no button is missed regardless of layout changes
    $("div.download-links-div").each((_, container) => {
      
      // Select every single download link within this specific section directly
      $(container).find("a.dlbtn-download[href]").each((_, a) => {
        const href = $(a).attr("href");
        if (!href) return;

        // Trace upwards or close-by to extract text configurations safely
        const contextualText = $(a).text() || $(a).closest("div").prev("h4").text() || "";
        const qual = extractQuality(contextualText) !== "Unknown" ? extractQuality(contextualText) : "1080p";

        const finalPlayableUrl = convertToPlayableUrl(href, title, qual);

        streams.push({
          url: finalPlayableUrl,
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
