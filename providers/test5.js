// cinefreak.js
// Nuvio-compatible Cinefreak scraper (Definitive Direct Decryption Fix)

const BASE_URL = "https://cinefreak.net"; // Forced to .net to stop fetch failures
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Referer": "https://cinefreak.net/"
};
    
// =========================
// Helpers
// =========================
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
    // 1. Fetch official structural name string from TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // Format title precisely to align with R2 bucket distribution paths
    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s()]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    // 2. Query Search API directly using the validated .net domain framework
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

    // Locate the exact matching result row from the API array payload
    const lcTitle = title.toLowerCase();
    let match = results.find(r => (r.t || "").toLowerCase().includes(lcTitle)) || results[0];
    if (!match || !match.l) return [];

    // 3. Request Movie Landing Page to find the generate link hidden inside
    let pageUrl = match.l.startsWith("http") ? match.l : `${BASE_URL}/${match.l}`;
    if (!pageUrl.endsWith("/")) pageUrl += "/";

    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    const streams = [];

    // 4. Decrypt raw generate links directly out of the page HTML string body
    const generateRegex = /generate\.php\?id=([^"'\s&>]+)/gi;
    let regexMatch;

    while ((regexMatch = generateRegex.exec(pageHtml)) !== null) {
      const rawIdParam = regexMatch[1];

      let decodedUrl = decodeBase64Safe(rawIdParam);
      if (!decodedUrl) continue;

      // Clean away the anti-bot noise trailing at the tail of the link (e.g. newgo32)
      let cleanedToken = decodedUrl.split("/f/")[1] || decodedUrl.split("/x/")[1] || "";
      if (!cleanedToken) {
        const hashMatch = decodedUrl.match(/\/f\/([a-f0-9]+)/i);
        if (hashMatch) cleanedToken = hashMatch[1];
      }

      if (cleanedToken) {
        // Strip out any trailing non-hex anti-bot variables (like newgo32) explicitly
        const targetHash = cleanedToken.replace(/newgo\d*$/i, "").trim();
        
        // Ensure a valid hexadecimal hash length before formatting output entries
        if (targetHash.length >= 6) {
          const qualities = ["1080p", "720p", "480p"];
          
          for (const qual of qualities) {
            // Build direct R2 asset delivery links from the decrypted watch identifier
            const directPlayableUrl = `https://pub-${targetHash}.r2.dev/CINEFREAK.TOP%20-%20${encodeURIComponent(cleanTitle)}%20%5B${qual}%5D.mkv`;
            
            streams.push({
              url: directPlayableUrl,
              quality: qual,
              title: `Cinefreak Direct [${qual}]`,
              subtitles: []
            });
          }
          
          // Break loop early once the legitimate file hash is decrypted successfully
          break;
        }
      }
    }

    return streams;

  } catch (e) {
    console.log("[Cinefreak Engine Core Error]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
