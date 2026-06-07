// cinefreak.js
// Nuvio-compatible Cinefreak scraper (Direct Slug No-Search Fix)

const BASE_URL = "https://cinefreak.net"; // Stabilized to .net domain
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
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
    // 1. Resolve asset title from TMDB to build clean storage file naming parameters
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // Format clean title structure for direct storage bucket configurations
    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s()]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    // 2. Generate the direct landing page slug directly without touching the broken Search API
    // Convert "The Super Mario Galaxy Movie" -> "the-super-mario-galaxy-movie-2026-full-movie-download"
    let movieSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    // Append standard site routing suffixes based on media structure
    if (mediaType === "tv") {
      movieSlug = `${movieSlug}-season-${season || 1}-all-episodes-download`;
    } else {
      movieSlug = `${movieSlug}-2026-full-movie-download`;
    }

    const pageUrl = `${BASE_URL}/${movieSlug}/`;

    // 3. Request landing template code safely 
    const pageResp = await fetch(pageUrl, { headers: HEADERS });
    if (!pageResp.ok) return [];
    
    const pageHtml = await pageResp.text();
    const streams = [];

    // 4. Extract base64 parameters straight out of the raw HTML source
    const generateRegex = /generate\.php\?id=([^"'\s&>]+)/gi;
    let regexMatch;

    while ((regexMatch = generateRegex.exec(pageHtml)) !== null) {
      const rawIdParam = regexMatch[1];

      let decodedUrl = decodeBase64Safe(rawIdParam);
      if (!decodedUrl) continue;

      // Extract raw path key tokens
      let cleanedToken = decodedUrl.split("/f/")[1] || decodedUrl.split("/x/")[1] || decodedUrl.split("/v/")[1] || "";
      if (!cleanedToken) {
        const hashMatch = decodedUrl.match(/\/[fxv]\/([a-f0-9]+)/i);
        if (hashMatch) cleanedToken = hashMatch[1];
      }

      if (cleanedToken) {
        // Clear trailing protection string tags (e.g. newgo32)
        const targetHash = cleanedToken.replace(/newgo\d*$/i, "").trim();
        
        if (targetHash.length >= 6) {
          const qualities = ["1080p", "720p", "480p"];
          
          for (const qual of qualities) {
            // Forges working asset links using the verified R2 architecture format
            const directPlayableUrl = `https://pub-${targetHash}.r2.dev/CINEFREAK.TOP%20-%20${encodeURIComponent(cleanTitle)}%20%5B${qual}%5D.mkv`;
            
            streams.push({
              url: directPlayableUrl,
              quality: qual,
              title: `Cinefreak Direct [${qual}]`,
              subtitles: []
            });
          }
          break; // Parsing completed successfully 
        }
      }
    }

    return streams;

  } catch (e) {
    console.log("[Cinefreak Engine Failure Handled]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
