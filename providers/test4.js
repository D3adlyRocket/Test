// cinefreak.js
// Stable Cinefreak provider for Nuvio
// Fetches links + improves playback reliability

const BASE_URL = "https://cinefreak.nl";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: BASE_URL,
  Origin: BASE_URL,
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
    return Buffer.from(
      decodeURIComponent(str),
      "base64"
    ).toString("utf-8");
  } catch {
    return null;
  }
}

// =========================
// Resolve redirects
// =========================

async function resolveFinalUrl(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: HEADERS
    });

    return res.url || url;
  } catch {
    return url;
  }
}

// =========================
// Extract playable stream
// =========================

async function extractDirectStream(url) {
  try {
    console.log("[EXTRACT]", url);

    // already direct
    if (
      url.includes(".m3u8") ||
      url.includes(".mp4") ||
      url.includes(".mkv")
    ) {
      return url;
    }

    // Pixeldrain
    if (url.includes("pixeldrain.com/u/")) {
      const id = url.split("/u/")[1].split("?")[0];
      return `https://pixeldrain.com/api/file/${id}`;
    }

    // Google Drive
    if (url.includes("drive.google.com")) {
      const match = url.match(/\/d\/(.*?)\//);

      if (match) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    }

    // load page html
    const html = await (
      await fetch(url, {
        headers: HEADERS
      })
    ).text();

    // m3u8
    const m3u8 = html.match(
      /https?:\/\/[^"' ]+\.m3u8[^"' ]*/i
    );

    if (m3u8) {
      return m3u8[0];
    }

    // mp4
    const mp4 = html.match(
      /https?:\/\/[^"' ]+\.mp4[^"' ]*/i
    );

    if (mp4) {
      return mp4[0];
    }

    // file:"..."
    const fileMatch = html.match(
      /file\s*:\s*["']([^"']+)["']/i
    );

    if (fileMatch) {
      return fileMatch[1];
    }

    // source src=
    const sourceMatch = html.match(
      /<source[^>]+src=["']([^"']+)["']/i
    );

    if (sourceMatch) {
      return sourceMatch[1];
    }

    // iframe
    const iframe = html.match(
      /<iframe[^>]+src=["']([^"']+)["']/i
    );

    if (iframe) {
      return iframe[1];
    }

    return url;
  } catch (e) {
    console.log("[extract error]", e);
    return url;
  }
}

// =========================
// Create stream
// =========================

function createStream(url, quality, title) {
  return {
    type: "url",

    url,

    quality,

    title,

    subtitles: [],

    behaviorHints: {
      notWebReady: false,

      proxyHeaders: {
        request: {
          Referer: BASE_URL,
          Origin: BASE_URL,
          "User-Agent": HEADERS["User-Agent"]
        }
      }
    }
  };
}

// =========================
// Main
// =========================

async function getStreams(
  tmdbId,
  mediaType,
  season,
  episode
) {
  try {
    // =========================
    // TMDB
    // =========================

    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}` +
      `?api_key=${TMDB_API_KEY}`;

    const mediaInfo = await (
      await fetch(tmdbUrl)
    ).json();

    if (!mediaInfo) return [];

    const title =
      mediaInfo.title || mediaInfo.name;

    if (!title) return [];

    console.log("[TITLE]", title);

    // =========================
    // Search
    // =========================

    const searchUrl =
      `${BASE_URL}/search-api.php?q=` +
      encodeURIComponent(title) +
      "&pg=1";

    const searchResp = await fetch(searchUrl, {
      headers: HEADERS
    });

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

    // =========================
    // Match title
    // =========================

    const lcTitle = title.toLowerCase();

    const match =
      results.find(r =>
        (r.t || "")
          .toLowerCase()
          .includes(lcTitle)
      ) || results[0];

    if (!match) return [];

    const pageUrl = match.l.startsWith("http")
      ? match.l
      : `${BASE_URL}/${match.l}/`;

    console.log("[PAGE]", pageUrl);

    const pageHtml = await (
      await fetch(pageUrl, {
        headers: HEADERS
      })
    ).text();

    const $ = cheerio.load(pageHtml);

    const streams = [];

    // =========================
    // TV
    // =========================

    if (mediaType === "tv") {
      $("div.ep-card").each((_, card) => {
        const seasonText = $(card)
          .find("span.season-number")
          .text()
          .match(/S(\d+)/);

        const cardSeason = seasonText
          ? parseInt(seasonText[1])
          : 1;

        if (cardSeason !== parseInt(season || 1))
          return;

        const epText = $(card)
          .find("span.episode-badge")
          .text();

        const epMatch = epText.match(
          /Episode\s+([\d\-]+)/i
        );

        if (!epMatch) return;

        const epNums = epMatch[1]
          .split("-")
          .map(n => parseInt(n.trim()))
          .filter(Boolean);

        if (
          !epNums.includes(
            parseInt(episode || 1)
          )
        ) {
          return;
        }

        $(card)
          .find("div.download-links a")
          .each(async (_, a) => {
            try {
              let href = $(a).attr("href");

              if (!href) return;

              // decode
              const idMatch =
                href.match(/id=([^&]+)/);

              if (idMatch) {
                const decoded =
                  decodeBase64Safe(idMatch[1]);

                if (decoded) {
                  href = decoded;
                }
              }

              href = await resolveFinalUrl(href);

              const finalUrl =
                await extractDirectStream(href);

              streams.push(
                createStream(
                  finalUrl,
                  extractQuality(href),
                  "Cinefreak"
                )
              );
            } catch {}
          });
      });

      return streams;
    }

    // =========================
    // Movies
    // =========================

    $("div.download-links-div").each(
      (_, container) => {
        $(container)
          .find("h4.movie-title")
          .each((_, titleEl) => {
            const titleText =
              $(titleEl).text();

            const quality =
              extractQuality(titleText);

            $(titleEl)
              .next()
              .find("a.dlbtn-download[href]")
              .each(async (_, a) => {
                try {
                  let href = $(a).attr("href");

                  if (!href) return;

                  console.log(
                    "[RAW LINK]",
                    href
                  );

                  // decode base64
                  const idMatch =
                    href.match(/id=([^&]+)/);

                  if (idMatch) {
                    const decoded =
                      decodeBase64Safe(
                        idMatch[1]
                      );

                    if (decoded) {
                      href = decoded;
                    }
                  }

                  // resolve redirects
                  href =
                    await resolveFinalUrl(href);

                  console.log(
                    "[RESOLVED]",
                    href
                  );

                  // extract stream
                  const finalUrl =
                    await extractDirectStream(
                      href
                    );

                  console.log(
                    "[FINAL]",
                    finalUrl
                  );

                  streams.push(
                    createStream(
                      finalUrl,
                      quality,
                      `Cinefreak [${quality}]`
                    )
                  );
                } catch (e) {
                  console.log(
                    "[STREAM ERROR]",
                    e
                  );
                }
              });
          });
      }
    );

    // allow async each to finish
    await new Promise(r =>
      setTimeout(r, 3000)
    );

    console.log(
      "[TOTAL STREAMS]",
      streams.length
    );

    return streams;
  } catch (e) {
    console.log("[CINEFREAK FATAL]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
