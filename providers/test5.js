// cinefreak.js
// Nuvio-compatible Cinefreak scraper (Bulletproof String Split Fix)

const BASE_URL = "https://cinefreak.nl";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Cookie: "xla=s4t"
};

// Safe decoder that will NEVER crash the script
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
    // 1. Get TMDB Data
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search Cinefreak
    const searchUrl = `${BASE_URL}/search-api.php?q=${encodeURIComponent(title)}&pg=1`;
    const searchResp = await fetch(searchUrl, { headers: HEADERS });

    let searchData;
    try {
      searchData = await searchResp.json();
    } catch (e) {
      return [];
    }

    const results = Array.isArray(searchData?.results) ? searchData.results : [];
    if (!results.length) return [];

    // 3. Match Item
    const lcTitle = title.toLowerCase();
    let match = results.find(r => (r.t || "").toLowerCase().includes(lcTitle)) || results[0];
    if (!match) return [];

    const pageUrl = match.l.startsWith("http") ? match.l : `${BASE_URL}/${match.l}/`;
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();

    const streams = [];
    
    // Clean Title for the R2 URL format
    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s()]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    // 4. Pure String Search (No Cheerio, No URL Objects, Safe Runtime)
    // Split the entire HTML page into an array by 'href=' to isolate links cleanly
    const parts = pageHtml.split(/href=["']/i);

    for (let i = 1; i < parts.length; i++) {
      // Isolate the actual URL string
      const urlPart = parts[i].split(["\"", "'"])[0];

      if (urlPart.includes("generate.php?id=")) {
        try {
          // Manually split out the ID param value without using the URL constructor
          const idSplit = urlPart.split("id=");
          if (idSplit.length < 2) continue;
          
          const rawId = idSplit[1].split("&")[0].split('"')[0].split("'")[0];
          if (!rawId) continue;

          let decoded = decodeBase64Safe(rawId);
          if (!decoded || !decoded.startsWith("http")) continue;

          // Strip anti-bot additions
          decoded = decoded.replace(/newgo\d*$/, "");

          // Grab the hash ID out of the path
          const hashMatch = decoded.match(/\/f\/([a-f0-9]+)/i);
          if (!hashMatch || !hashMatch[1]) continue;

          const mediaId = hashMatch[1];

          // Determine quality based on structural checks inside the isolated string chunk
          let qual = "1080p";
          const surroundingText = parts[i].toLowerCase();
          if (surroundingText.includes("2160p") || surroundingText.includes("4k")) qual = "4K";
          else if (surroundingText.includes("720p")) qual = "720p";
          else if (surroundingText.includes("480p")) qual = "480p";

          // Force construct the exact known working direct storage location URL
          const finalPlayableUrl = `https://pub-${mediaId}.r2.dev/CINEFREAK.TOP%20-%20${encodeURIComponent(cleanTitle)}%20%5B${qual}%5D.mkv`;

          streams.push({
            url: finalPlayableUrl,
            quality: qual,
            title: `Cinefreak [${qual}]`,
            subtitles: []
          });

        } catch (innerErr) {
          // Prevent any inner string failure from stopping the loop
        }
      }
    }

    // Deduplicate array data to keep Nuvio manifest clean
    const uniqueStreams = [];
    const seenUrls = new Set();
    for (const stream of streams) {
      if (!seenUrls.has(stream.url)) {
        seenUrls.add(stream.url);
        uniqueStreams.push(stream);
      }
    }

    return uniqueStreams;

  } catch (e) {
    console.log("[Cinefreak FATAL]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
