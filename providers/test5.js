// cinefreak.js
// Nuvio-compatible Cinefreak scraper (Deterministic Direct Stream Fix)

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

/**
 * Robust base64 decoder with strict padding validation to mimic browser-level flexibility.
 */
function decodeBase64Safe(str) {
  try {
    let cleanStr = decodeURIComponent(str).trim();
    // Normalize string string padding constraints for Node runtime environments
    while (cleanStr.length % 4 !== 0) {
      cleanStr += "=";
    }
    return Buffer.from(cleanStr, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * Forges the final stream target URL cleanly by separating the unique site hash ID
 * away from the intermediate platform gateway strings.
 */
function resolveFinalStreamUrl(rawHref, title, quality) {
  try {
    let base64Token = "";

    // Extract raw base64 string directly from the URL target
    const urlObj = new URL(rawHref, BASE_URL);
    base64Token = urlObj.searchParams.get("id");

    if (!base64Token) {
      const fallbackMatch = rawHref.match(/id=([^&]+)/);
      if (fallbackMatch) base64Token = fallbackMatch[1];
    }

    if (base64Token) {
      let decodedUrl = decodeBase64Safe(base64Token);
      
      if (decodedUrl && decodedUrl.startsWith("http")) {
        // Purge tracking tags or trailing string artifacts (e.g. newgo32)
        decodedUrl = decodedUrl.replace(/newgo\d*$/, "");

        // Isolate the dynamic media asset index key sequence
        const hashIdMatch = decodedUrl.match(/\/f\/([a-f0-9]+)/i);
        if (hashIdMatch && hashIdMatch[1]) {
          const mediaId = hashIdMatch[1];
          
          // Format standard alphanumeric text safely for asset distribution layouts
          const urlFriendlyTitle = encodeURIComponent(
            title
              .replace(/[^a-zA-Z0-9\s()]/g, "")
              .trim()
              .replace(/\s+/g, " ")
          );

          // Build asset routing URL configuration pointing to direct object target blocks
          return `https://pub-${mediaId}.r2.dev/CINEFREAK.TOP%20-%20${urlFriendlyTitle}%20%5B${quality}%5D.mkv`;
        }
        return decodedUrl;
      }
    }
    return rawHref;
  } catch (e) {
    console.log("[Cinefreak Core Translation Error]", e);
    return rawHref; 
  }
}

// =========================
// Main
// =========================
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. TMDB Meta Query Handling
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search Index Fetch Validation
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

    // 3. String Alignment and Node Isolation
    const lcTitle = title.toLowerCase();
    let match = results.find(r => (r.t || "").toLowerCase().includes(lcTitle)) || results[0];
    if (!match) return [];

    const pageUrl = match.l.startsWith("http") ? match.l : `${BASE_URL}/${match.l}/`;
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    const $ = cheerio.load(pageHtml);

    const streams = [];
    const isTV = mediaType === "tv";

    // =========================
    // TV LAYER LOGIC
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

        $(card).find("div.download-links a").each((_, a) => {
          const href = $(a).attr("href");
          const text = $(a).text().trim();
          if (!href) return;

          const qual = extractQuality(text);
          const finalUrl = resolveFinalStreamUrl(href, title, qual);
          
          streams.push({
            url: finalUrl,
            quality: qual,
            title: `Cinefreak [${text}]`,
            subtitles: []
          });
        });
      });

      return streams;
    }

    // =========================
    // MOVIE LAYER LOGIC
    // =========================
    $("div.download-links-div").each((_, container) => {
      $(container)
        .find("h4.movie-title")
        .each((_, titleEl) => {
          const qualMatch = $(titleEl).text().match(/(480p|720p|1080p|2160p)/i);
          const qual = qualMatch ? qualMatch[1] : "Unknown";

          $(titleEl)
            .next()
            .find("a.dlbtn-download[href]")
            .each((_, a) => {
              const href = $(a).attr("href");
              if (!href) return;

              const finalUrl = resolveFinalStreamUrl(href, title, qual);
              
              streams.push({
                url: finalUrl,
                quality: qual,
                title: `Cinefreak [${qual}]`,
                subtitles: []
              });
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
