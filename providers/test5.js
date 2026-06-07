// cinefreak.js
// Nuvio-compatible Cinefreak scraper (iframe-aware extraction fix)

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
 * Deep resolves the final playable media stream link by piercing through
 * embedded cross-origin iframes (like Vagaverse) and hunting script vars.
 */
async function resolveFinalStreamUrl(url) {
  try {
    // 1. Fetch intermediate landing host content
    const response = await fetch(url, { headers: HEADERS });
    const htmlText = await response.text();

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("video/") || url.includes(".r2.dev")) {
      return response.url || url;
    }

    const $ = cheerio.load(htmlText);
    
    // 2. PIERCE IFRAMES: Look for embedded players (e.g., stream.vagaverse.net)
    let embeddedFrameSrc = $("iframe").attr("src");
    
    if (embeddedFrameSrc) {
      if (embeddedFrameSrc.startsWith("//")) {
        embeddedFrameSrc = "https:" + embeddedFrameSrc;
      }
      
      // Look for deeply nested direct target IDs passed to the embed platform
      const deepIdMatch = embeddedFrameSrc.match(/[?&]id=([^&]+)/);
      if (deepIdMatch) {
        const fullyDecodedTarget = decodeURIComponent(deepIdMatch[1]);
        if (fullyDecodedTarget.startsWith("http")) {
          // If the nested ID is already the source target asset, resolve it directly
          return await resolveFinalStreamUrl(fullyDecodedTarget);
        }
      }
      
      // Fallback: Fetch the frame content itself to hunt variables inside it
      try {
        const frameResponse = await fetch(embeddedFrameSrc, { headers: HEADERS });
        const frameHtml = await frameResponse.text();
        
        const r2Regex = /(https:\/\/pub-[a-f0-9]+\.r2\.dev\/[^"'\s]+)/i;
        const frameMatch = frameHtml.match(r2Regex);
        if (frameMatch) return frameMatch[1].replace(/\\/g, "");
      } catch (frameErr) {
        console.log("[Frame parsing error]", frameErr);
      }
    }

    // 3. Static Code Sweep (Standard Patterns)
    const sourceRegexes = [
      /["'](https:\/\/pub-[a-f0-9]+\.r2\.dev\/[^"']+)["']/i,
      /file\s*:\s*["']([^"']+\.(?:mkv|mp4|m3u8)[^"']*)["']/i,
      /src\s*:\s*["']([^"']+\.(?:mkv|mp4|m3u8)[^"']*)["']/i
    ];

    for (const regex of sourceRegexes) {
      const match = htmlText.match(regex);
      if (match && match[1]) {
        return match[1].replace(/\\/g, "");
      }
    }

    // 4. Dom fallback for standard player tags
    const videoSrc = $("video").attr("src") || $("video source").attr("src");
    if (videoSrc && videoSrc.startsWith("http")) return videoSrc;

    return response.url || url;
  } catch (e) {
    console.log("[Cinefreak Extraction Error]", e);
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

          const p = resolveFinalStreamUrl(href).then(finalUrl => {
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
