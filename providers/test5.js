// cinefreak.js
// Nuvio-compatible Cinefreak scraper (Bulletproof Regex Decoder Fix)

const BASE_URL = "https://cinefreak.nl";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

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

// =========================
// Main
// =========================
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. Get Title from TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s()]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    // 2. Query Search API
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

    // Format final page routing path cleanly
    let pageUrl = match.l.startsWith("http") ? match.l : `${BASE_URL}/${match.l}`;
    if (!pageUrl.endsWith("/")) {
      pageUrl += "/";
    }

    // 3. Get Raw HTML Source Text
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    const streams = [];
    const seenUrls = new Set();

    // 4. BRUTE-FORCE REGEX SCAN
    // Matches any instance of generate.php?id=... anywhere on the page text
    const generateRegex = /generate\.php\?id=([^"'\s&>]+)/gi;
    let regexMatch;

    while ((regexMatch = generateRegex.exec(pageHtml)) !== null) {
      const rawIdParam = regexMatch[1];

      // Decode the base64 token safely
      let decoded = decodeBase64Safe(rawIdParam);
      if (!decoded || !decoded.includes("/f/")) continue;

      // Clean up anti-bot tokens at the tail (e.g., newgo32)
      decoded = decoded.replace(/newgo\d*$/, "");

      // Isolate the unique hash ID (e.g., 7ebfab1b)
      const hashMatch = decoded.match(/\/f\/([a-f0-9]+)/i);
      if (!hashMatch || !hashMatch[1]) continue;

      const mediaId = hashMatch[1];

      // Pull context clues near the match to determine file video quality
      const matchIndex = regexMatch.index;
      const surroundingText = pageHtml.substring(Math.max(0, matchIndex - 150), matchIndex + 150);
      const qual = extractQuality(surroundingText);

      // Reconstruct your direct playable R2 link format natively
      const finalPlayableUrl = `https://pub-${mediaId}.r2.dev/CINEFREAK.TOP%20-%20${encodeURIComponent(cleanTitle)}%20%5B${qual}%5D.mkv`;

      if (!seenUrls.has(finalPlayableUrl)) {
        seenUrls.add(finalPlayableUrl);
        streams.push({
          url: finalPlayableUrl,
          quality: qual,
          title: `Cinefreak [${qual}]`,
          subtitles: []
        });
      }
    }

    return streams;

  } catch (e) {
    console.log("[Cinefreak Scraper Fatal Exception]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
