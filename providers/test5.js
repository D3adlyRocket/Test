// cinefreak.js
// Nuvio-compatible Cinefreak scraper (Complete Production Implementation)

const BASE_URL = "https://www.cinefreak.net"; 
const ALTERNATE_BASE_URL = "https://www.cinefreak.nl";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/json,*/*;q=0.8",
  "Referer": "https://www.cinefreak.net/",
  "Origin": "https://www.cinefreak.net"
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
  return "1080p"; 
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
    if (!idMatch) return href; 

    let decoded = decodeBase64Safe(idMatch[1]);
    if (!decoded || !decoded.startsWith("http")) return href;

    // Hard-clean the decoded URL to eliminate anti-bot noise (e.g. newgo32) right away
    decoded = decoded.replace(/newgo\d*$/i, "").trim();

    // Isolate the token segment out of the decrypted path sequence (/f/, /x/, or /v/)
    let tokenSegment = decoded.split("/f/")[1] || decoded.split("/x/")[1] || decoded.split("/v/")[1] || "";
    if (!tokenSegment) {
      const fallbackHashMatch = decoded.match(/\/[fxv]\/([a-f0-9]+)/i);
      if (fallbackHashMatch) tokenSegment = fallbackHashMatch[1];
    }

    if (!tokenSegment) return href;

    // Secondary deep verification cleanup step to pull the exact clean hex ID sequence out
    const targetHash = tokenSegment.replace(/newgo\d*$/i, "").trim();
    if (targetHash.length < 6) return href;

    // Standardize title punctuation format for direct object storage keys
    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s()]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    // Reconstruct the explicit direct playable R2 link format confirmed in your tests
    return `https://pub-${targetHash}.r2.dev/CINEFREAK.TOP%20-%20${encodeURIComponent(cleanTitle)}%20%5B${quality}%5D.mkv`;
  } catch (e) {
    return href;
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

    // 2. Fetch target from Search API using correct subdomain path tracking
    const timestamp = Date.now();
    let searchUrl = `${BASE_URL}/search-api.php?q=${encodeURIComponent(title)}&pg=1&_t=${timestamp}`;
    let searchResp = await fetch(searchUrl, { headers: HEADERS });

    // Fallback layer checking alternate domains if the connection drops out
    if (!searchResp.ok) {
      searchUrl = `${ALTERNATE_BASE_URL}/search-api.php?q=${encodeURIComponent(title)}&pg=1&_t=${timestamp}`;
      searchResp = await fetch(searchUrl, { headers: HEADERS });
    }

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

    // Force base subdomain URL rules across dynamic strings
    let targetLink = match.l;
    if (!targetLink.startsWith("http")) {
      targetLink = `${BASE_URL}/${targetLink}`;
    }
    
    // Normalize absolute paths to utilize proper layout rules
    let pageUrl = targetLink.replace("https://cinefreak.", "https://www.cinefreak.");
    if (!pageUrl.endsWith("/")) {
      pageUrl += "/";
    }

    // 3. Request landing template code
    let pageHtml = "";
    try {
      pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    } catch (err) {
      // Toggle validation fallback check
      pageUrl = pageUrl.includes(".net") ? pageUrl.replace(".net", ".nl") : pageUrl.replace(".nl", ".net");
      pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    }

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
          
          streams.push({
            url: finalUrl,
            quality: qual,
            title: `Cinefreak Direct [${text}]`,
            subtitles: []
          });
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

        streams.push({
          url: finalUrl,
          quality: qual,
          title: `Cinefreak Direct [${qual}]`,
          subtitles: []
        });
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
