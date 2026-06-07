// cinefreak.js
// Nuvio-compatible Cinefreak scraper (Brute Force Regex Fix)

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
  return "1080p"; // Safe default if quality tag isn't explicitly inline
}

function decodeBase64Safe(str) {
  try {
    let cleanStr = decodeURIComponent(str).trim();
    while (cleanStr.length % 4 !== 0) {
      cleanStr += "=";
    }
    return Buffer.from(cleanStr, "base64").toString("utf-8");
  } catch {
    return null;
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

    // 3. Match the search results
    const lcTitle = title.toLowerCase();
    let match = results.find(r => (r.t || "").toLowerCase().includes(lcTitle)) || results[0];
    if (!match) return [];

    const pageUrl = match.l.startsWith("http") ? match.l : `${BASE_URL}/${match.l}/`;
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();

    const streams = [];
    const uniqueUrls = new Set();

    // 4. BRUTE FORCE REGEX MATCHING
    // This finds every single generate.php link on the page regardless of the HTML layout or classes used.
    const generateLinkRegex = /href=["']([^"']*(?:generate\.php\?id=)[^"']+)["']/gi;
    let regexMatch;

    // Clean title string to match file storage formats precisely
    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s()]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    while ((regexMatch = generateLinkRegex.exec(pageHtml)) !== null) {
      let rawUrl = regexMatch[1];
      
      // Prevent parsing duplicates
      if (uniqueUrls.has(rawUrl)) continue;
      uniqueUrls.add(rawUrl);

      try {
        // Extract the base64 string from the "id=" parameter
        const idParamMatch = rawUrl.match(/[?&]id=([^&"'\s]+)/);
        if (!idParamMatch) continue;

        let decoded = decodeBase64Safe(idParamMatch[1]);
        if (!decoded || !decoded.startsWith("http")) continue;

        // Strip the anti-bot suffix (e.g., "newgo32")
        decoded = decoded.replace(/newgo\d*$/, "");

        // Isolate the storage hash ID (e.g., 7ebfab1b)
        const hashMatch = decoded.match(/\/f\/([a-f0-9]+)/i);
        if (!hashMatch || !hashMatch[1]) continue;

        const mediaId = hashMatch[1];

        // Determine quality by looking at the context surrounding the link in the raw HTML string
        const matchIndex = regexMatch.index;
        const surroundingHtml = pageHtml.substring(Math.max(0, matchIndex - 300), matchIndex + 300);
        const qual = extractQuality(surroundingHtml);

        // Explicitly map the direct R2 playable asset URL
        const playableCdnUrl = `https://pub-${mediaId}.r2.dev/CINEFREAK.TOP%20-%20${encodeURIComponent(cleanTitle)}%20%5B${qual}%5D.mkv`;

        streams.push({
          url: playableCdnUrl,
          quality: qual,
          title: `Cinefreak [${qual}]`,
          subtitles: []
        });
      } catch (innerErr) {
        console.log("[Cinefreak Inner Parse Error]", innerErr);
      }
    }

    return streams;

  } catch (e) {
    console.log("[Cinefreak FATAL]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
