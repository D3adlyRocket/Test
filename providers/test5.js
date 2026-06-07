// cinefreak.js
// Nuvio-compatible Cinefreak scraper (API-to-Storage Direct Resolution Fix)

const BASE_URL = "https://cinefreak.nl";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/json, text/charset=utf-8",
  "Referer": "https://cinefreak.nl/"
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
    // 1. Fetch TMDB details to ensure exact alphanumeric sync with the storage cluster naming layout
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=1865f43a0549ca50d341dd9ab8b29f49`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // Clean up movie title punctuation to ensure perfect alignment with direct CDN file strings
    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s()]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    // 2. Query the active API endpoint uncovered in your network logs (including cache-busting timestamp signature)
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

    // Match search data using standard name parameters
    const lcTitle = title.toLowerCase();
    let match = results.find(r => (r.t || "").toLowerCase().includes(lcTitle)) || results[0];
    if (!match || !match.l) return [];

    const streams = [];

    // 3. IMMEDATE TRANSLATION LOOP
    // We isolate the base64 encrypted payload directly out of the matched search item link configuration
    const idParamMatch = match.l.match(/[?&]id=([^&"'\s]+)/);
    let targetHash = "";

    if (idParamMatch) {
      let decoded = decodeBase64Safe(idParamMatch[1]);
      if (decoded) {
        decoded = decoded.replace(/newgo\d*$/, "");
        const hashMatch = decoded.match(/\/f\/([a-f0-9]+)/i);
        if (hashMatch && hashMatch[1]) {
          targetHash = hashMatch[1];
        }
      }
    }

    // If string processing constraints fell back, extract the raw alpha string structure
    if (!targetHash) {
      const pathFallback = match.l.match(/\/f\/([a-f0-9]+)/i);
      if (pathFallback) targetHash = pathFallback[1];
    }

    // 4. GENERATE DIRECT CDNS
    // Hard-construct your proven working R2 endpoints directly into Nuvio's manifest output stream
    if (targetHash) {
      const qualities = ["1080p", "720p", "480p"];
      
      for (const qual of qualities) {
        const directPlayableAssetUrl = `https://pub-${targetHash}.r2.dev/CINEFREAK.TOP%20-%20${encodeURIComponent(cleanTitle)}%20%5B${qual}%5D.mkv`;
        
        streams.push({
          url: directPlayableAssetUrl,
          quality: qual,
          title: `Cinefreak Direct [${qual}]`,
          subtitles: []
        });
      }
    }

    return streams;

  } catch (e) {
    console.log("[Cinefreak Structural Failure Blocked]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
