// cinefreak.js
// Nuvio-compatible Cinefreak scraper (String Order Correction Fix)

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

function extractQuality(str = "") {
  const u = str.toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  if (u.includes("360p")) return "360p";
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

/**
 * Decrypts the raw generate link payload and translates it 
 * straight into your verified direct R2 bucket download layout configuration.
 */
function resolvePlayableStream(href, title, quality) {
  try {
    const idMatch = href.match(/[?&]id=([^&"'\s]+)/);
    if (!idMatch) return href; 

    const rawIdParam = idMatch[1];
    
    // MATCH THE CONSOLE: Apply the regex replacement directly onto the ENCODED string first
    const cleanedEncodedStr = rawIdParam.replace(/newgo\d*$/i, "").trim();

    // Now decode the pre-scrubbed base64 string
    let decoded = decodeBase64Safe(cleanedEncodedStr);
    if (!decoded || !decoded.startsWith("http")) return href;

    // Handle secondary clean up if 'newgo' bypassed the initial encoding string layer
    decoded = decoded.replace(/newgo\d*$/i, "").trim();

    // Isolate the token segment out of the decrypted path sequence (/f/, /x/, or /v/)
    let tokenSegment = decoded.split("/f/")[1] || decoded.split("/x/")[1] || decoded.split("/v/")[1] || "";
    if (!tokenSegment) {
      const fallbackHashMatch = decoded.match(/\/[fxv]\/([a-f0-9]+)/i);
      if (fallbackHashMatch) tokenSegment = fallbackHashMatch[1];
    }

    if (!tokenSegment) return href;

    const targetHash = tokenSegment.replace(/newgo\d*$/i, "").trim();
    if (targetHash.length < 6) return href;

    const cleanTitle = title
      .replace(/[^a-zA-Z0-9\s()]/g, "")
      .trim()
      .replace(/\s+/g, " ");

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
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    const timestamp = Date.now();
    let searchUrl = `${BASE_URL}/search-api.php?q=${encodeURIComponent(title)}&pg=1&_t=${timestamp}`;
    let searchResp = await fetch(searchUrl, { headers: HEADERS });

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

    const lcTitle = title.toLowerCase();
    let match = results.find(r => (r.t || "").toLowerCase().includes(lcTitle)) || results[0];
    if (!match || !match.l) return [];

    let targetLink = match.l;
    if (!targetLink.startsWith("http")) {
      targetLink = `${BASE_URL}/${targetLink}`;
    }
    
    let pageUrl = targetLink.replace("https://cinefreak.", "https://www.cinefreak.");
    if (!pageUrl.endsWith("/")) {
      pageUrl += "/";
    }

    let pageHtml = "";
    try {
      pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    } catch (err) {
      pageUrl = pageUrl.includes(".net") ? pageUrl.replace(".net", ".nl") : pageUrl.replace(".nl", ".net");
      pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    }

    const $ = cheerio.load(pageHtml);
    const streams = [];
    const isTV = mediaType === "tv";

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

    $("div.download-links-div, div.download-links, div.entry-content").each((_, container) => {
      $(container).find("a[href*='generate.php']").each((_, a) => {
        const href = $(a).attr("href");
        if (!href) return;

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
