// cinefreak.js
// Nuvio-compatible Cinefreak scraper (Fully fixed stream asset resolver)

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
 * Deep-extracts the actual streaming file URL from the landing host page.
 * Parses the internal script patterns or configurations to catch the asset target.
 */
async function resolveFinalStreamUrl(url) {
  try {
    // 1. Fetch the actual content of the landing host page instead of just HEAD headers
    const response = await fetch(url, { headers: HEADERS });
    const htmlText = await response.text();

    // If it's already a direct video file link or didn't hit the landing page, return the final URL
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("video/") || url.includes(".r2.dev")) {
      return response.url || url;
    }

    // 2. Scan the webpage HTML body scripts for common source patterns or the R2 CDN host
    // Matches patterns like "url": "...", file: "...", or direct .dev bucket links embedded inside the script config
    const sourceRegexes = [
      /["'](https:\/\/pub-[a-f0-9]+\.r2\.dev\/[^"']+)["']/i,
      /file\s*:\s*["']([^"']+\.(?:mkv|mp4|m3u8)[^"']*)["']/i,
      /src\s*:\s*["']([^"']+\.(?:mkv|mp4|m3u8)[^"']*)["']/i
    ];

    for (const regex of sourceRegexes) {
      const match = htmlText.match(regex);
      if (match && match[1]) {
        // Clean any backslash escapes common in JSON/JS variables
        return match[1].replace(/\\/g, "");
      }
    }

    // 3. Fallback: Check if the landing page contains standard HTML5 video elements or download anchors
    const $ = cheerio.load(htmlText);
    const videoSrc = $("video").attr("src") || $("video source").attr("src") || $("a.download-btn").attr("href");
    if (videoSrc && videoSrc.startsWith("http")) {
      return videoSrc;
    }

    // If nothing structural is found, default to the followed page location
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
    const searchUrl = `${BASE_URL}/search-api.php?q=${encodeURIComponent(
      title
    )}&pg=1`;

    const searchResp = await fetch(searchUrl, { headers: HEADERS });

    let searchData;
    try {
      searchData = await searchResp.json();
    } catch {
      return [];
    }

    const results = Array.isArray(searchData?.results)
      ? searchData.results
      : [];

    if (!results.length) return [];

    // 3. Match
    const lcTitle = title.toLowerCase();

    let match =
      results.find(r => (r.t || "").toLowerCase().includes(lcTitle)) ||
      results[0];

    if (!match) return [];

    const pageUrl = match.l.startsWith("http")
      ? match.l
      : `${BASE_URL}/${match.l}/`;

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

        const seasonText = $(card)
          .find("span.season-number")
          .text()
          .match(/S(\d+)/);

        const cardSeason = seasonText ? parseInt(seasonText[1]) : 1;

        if (cardSeason !== parseInt(season || 1)) return;

        const epText = $(card)
          .find("span.episode-badge")
          .text();

        const epMatch = epText.match(/Episode\s+([\d\-]+)/i);
        if (!epMatch) return;

        const epNums = epMatch[1]
          .split("-")
          .map(n => parseInt(n.trim()))
          .filter(Boolean);

        if (!epNums.includes(parseInt(episode || 1))) return;

        found = true;

        $(card)
          .find("div.download-links a")
          .each((_, a) => {
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
          const qualMatch = $(titleEl)
            .text()
            .match(/(480p|720p|1080p|2160p)/i);

          const qual = qualMatch ? qualMatch[1] : "Unknown";

          $(titleEl)
            .next()
            .find("a.dlbtn-download[href]")
            .each((_, a) => {
              const href = $(a).attr("href");
              if (!href) return;

              let targetUrl = href;

              // Base64 token translation logic
              try {
                const idMatch = href.match(/id=([^&]+)/);
                if (idMatch) {
                  let decoded = decodeBase64Safe(idMatch[1]);
                  if (decoded && decoded.startsWith("http")) {
                    // Strips off trailing "newgo32" obfuscators
                    targetUrl = decoded.replace(/newgo\d*$/, "");
                  }
                }
              } catch (e) {
                console.log("[base64 error]", e);
              }

              // Concurrently run deep stream extraction
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
