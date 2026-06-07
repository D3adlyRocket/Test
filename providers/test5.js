// cinefreak.js
// Nuvio-compatible Cinefreak scraper (Full Production Implementation)

const BASE_URL = "https://cinefreak.net";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/json,*/*;q=0.8",
  "Referer": "https://cinefreak.net/",
  "Origin": "https://cinefreak.net"
};
    
// =========================
// Helpers
// =========================

/**
 * Parses and normalizes media quality from text labels.
 */
function extractQuality(str = "") {
  const u = str.toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  if (u.includes("360p")) return "360p";
  return "1080p"; // Safe default layout alignment
}

/**
 * Standard robust Base64 decoding wrapper with auto-padding validation for Node runtimes.
 */
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
 * Decrypts the raw generate link payload and translates it 
 * straight into your verified direct R2 bucket download layout configuration.
 */
function resolvePlayableStream(href, title, quality) {
  try {
    // Locate the base64 encrypted query value inside the ID parameter
    const idMatch = href.match(/[?&]id=([^&"'\s]+)/);
    if (!idMatch) return null;

    let decoded = decodeBase64Safe(idMatch[1]);
    if (!decoded || !decoded.startsWith("http")) return null;

    // Eliminate anti-bot parameters (e.g. newgo32) appended to the raw storage url path
    let tokenSegment = decoded.split("/f/")[1] || decoded.split("/x/")[1] || decoded.split("/v/")[1] || "";
    if (!tokenSegment) {
      const fallbackHashMatch = decoded.match(/\/[fxv]\/([a-f0-9]+)/i);
      if (fallbackHashMatch) tokenSegment = fallbackHashMatch[1];
    }

    if (!tokenSegment) return null;

    // Strip out the non-hex string variations cleanly
    const targetHash = tokenSegment.replace(/newgo\d*$/i, "").trim();
    if (targetHash.length < 6) return null;

    // Standardize title punctuation format for direct object storage keys
    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s()]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    // Reconstruct the explicit direct playable R2 link format confirmed in your tests
    return `https://pub-${targetHash}.r2.dev/CINEFREAK.TOP%20-%20${encodeURIComponent(cleanTitle)}%20%5B${quality}%5D.mkv`;
  } catch (e) {
    console.log("[Cinefreak Token Translation Error]", e);
    return null;
  }
}

// =========================
// Main Scraper Entry Point
// =========================
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. Query structural movie metadata parameters via TMDB API
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Fetch target from Search API using correct domain rules
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

    // Select the best match from the incoming API list rows
    const lcTitle = title.toLowerCase();
    let match = results.find(r => (r.t || "").toLowerCase().includes(lcTitle)) || results[0];
    if (!match || !match.l) return [];

    // Fix landing path layout assignment to prevent routing dropouts
    let pageUrl = match.l.startsWith("http") ? match.l : `${BASE_URL}/${match.l}`;
    if (!pageUrl.endsWith("/")) {
      pageUrl += "/";
    }

    // 3. Request landing template code
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    const $ = cheerio.load(pageHtml);

    const streams = [];
    const isTV = mediaType === "tv";

    // =========================
    // TV SHOW RESOLUTION
    // =========================
    if (isTV) {
      let found = false;

      $("div.ep-card").each((_, card) => {
        if (found) return;

        // Verify correct target season parameters match the card context
        const seasonText = $(card).find("span.season-number").text().match(/S(\d+)/);
        const cardSeason = seasonText ? parseInt(seasonText[1]) : 1;
        if (cardSeason !== parseInt(season || 1)) return;

        // Verify correct target episode sequence
        const epText = $(card).find("span.episode-badge").text();
        const epMatch = epText.match(/Episode\s+([\d\-]+)/i);
        if (!epMatch) return;

        const epNums = epMatch[1].split("-").map(n => parseInt(n.trim())).filter(Boolean);
        if (!epNums.includes(parseInt(episode || 1))) return;

        found = true;

        // Process individual quality links mapped to the target episode card
        $(card).find("div.download-links a[href]").each((_, a) => {
          const href = $(a).attr("href");
          const text = $(a).text().trim();
          if (!href) return;

          const qual = extractQuality(text);
          const finalUrl = resolvePlayableStream(href, title, qual);
          
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
    // MOVIE RESOLUTION
    // =========================
    $("div.download-links-div, div.download-links, div.entry-content").each((_, container) => {
      $(container).find("a[href*='generate.php']").each((_, a) => {
        const href = $(a).attr("href");
        if (!href) return;

        // Trace and read quality attributes out of nearby contextual label headings
        const contextualText = $(a).text() || $(a).closest("div").prev("h4").text() || "";
        const qual = extractQuality(contextualText);

        const finalUrl = resolvePlayableStream(href, title, qual);

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

    // Deduplicate streams list entries to prevent layout cluttering inside Nuvio interfaces
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
    console.log("[Cinefreak Pipeline Fatal Exception Execution Blocked]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
