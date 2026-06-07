// cinefreak.js
// Nuvio-compatible Cinefreak scraper (Complete Static Bypass Fix)

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

function decodeBase64Safe(str) {
  try {
    return Buffer.from(decodeURIComponent(str), "base64").toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * Extracts the video file by converting the intermediate URL format
 * directly into the unprotected Vagaverse configuration player frame.
 */
async function resolveFinalStreamUrl(url) {
  try {
    if (url.includes(".r2.dev")) return url;

    // Extract the hash ID (e.g., 7ebfab1b or 6155ede1) from the link
    const cinecloudIdMatch = url.match(/\/f\/([a-f0-9]+)/i);
    
    if (cinecloudIdMatch && cinecloudIdMatch[1]) {
      const mediaId = cinecloudIdMatch[1];
      
      // Build the target structure and inject it into the Vagaverse embed player URL
      const directTargetHost = `https://movieto.in/f/${mediaId}`;
      const encodedTarget = encodeURIComponent(directTargetHost);
      const simulatedFrameUrl = `https://stream.vagaverse.net/embed2/?id=${encodedTarget}`;
      
      // Scrape the unprotected player frame instead of the protected landing page
      const frameResponse = await fetch(simulatedFrameUrl, { headers: HEADERS });
      const frameHtml = await frameResponse.text();
      
      // Search for the direct storage stream URL (.r2.dev)
      const r2Regex = /(https:\/\/pub-[a-f0-9]+\.r2\.dev\/[^"'\s]+)/i;
      const frameMatch = frameHtml.match(r2Regex);
      
      if (frameMatch) {
        return frameMatch[1].replace(/\\/g, "");
      }
      
      return simulatedFrameUrl;
    }

    return url;
  } catch (e) {
    console.log("[Cinefreak Static Bypass Error]", e);
    return url; 
  }
}

// =========================
// Main
// =========================
async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search API
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

    // 3. Match
    const lcTitle = title.toLowerCase();
    let match = results.find(r => (r.t || "").toLowerCase().includes(lcTitle)) || results[0];
    if (!match) return [];

    const pageUrl = match.l.startsWith("http") ? match.l : `${BASE_URL}/${match.l}/`;
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    const $ = cheerio.load(pageHtml);

    const streams = [];
    const isTV = mediaType === "tv";

    // =========================
    // TV LOGIC
    // =========================
    if (isTV) {
      let found = false;
      const tvPromises = [];

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

          let targetUrl = href;
          try {
            const idMatch = href.match(/id=([^&]+)/);
            if (idMatch) {
              let decoded = decodeBase64Safe(idMatch[1]);
              if (decoded && decoded.startsWith("http")) {
                targetUrl = decoded.replace(/newgo\d*$/, "");
              }
            }
          } catch (e) {}

          const p = resolveFinalStreamUrl(targetUrl).then(finalUrl => {
            streams.push({
              url: finalUrl,
              quality: extractQuality(text),
              title: `Cinefreak [${text}]`,
              subtitles: []
            });
          });
          tvPromises.push(p);
        });
      });

      await Promise.all(tvPromises);
      return streams;
    }

    // =========================
    // MOVIE LOGIC
    // =========================
    const moviePromises = [];

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

              let targetUrl = href;

              try {
                const idMatch = href.match(/id=([^&]+)/);
                if (idMatch) {
                  let decoded = decodeBase64Safe(idMatch[1]);
                  if (decoded && decoded.startsWith("http")) {
                    targetUrl = decoded.replace(/newgo\d*$/, "");
                  }
                }
              } catch (e) {
                console.log("[base64 error]", e);
              }

              const p = resolveFinalStreamUrl(targetUrl).then(finalUrl => {
                streams.push({
                  url: finalUrl,
                  quality: qual,
                  title: `Cinefreak [${qual}]`,
                  subtitles: []
                });
              });
              moviePromises.push(p);
            });
        });
    });

    await Promise.all(moviePromises);
    return streams;

  } catch (e) {
    console.log("[Cinefreak FATAL]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
