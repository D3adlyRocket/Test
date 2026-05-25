// cinefreak.js
// Stable working version

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

async function resolveFinalUrl(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: HEADERS
    });

    return res.url || url;
  } catch {
    return url;
  }
}

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
    // TMDB
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

    // Search
    const searchUrl =
      `${BASE_URL}/search-api.php?q=${encodeURIComponent(
        title
      )}&pg=1`;

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

    // Match
    const lcTitle = title.toLowerCase();

    let match =
      results.find(r =>
        (r.t || "")
          .toLowerCase()
          .includes(lcTitle)
      ) || results[0];

    if (!match) return [];

    const pageUrl = match.l.startsWith("http")
      ? match.l
      : `${BASE_URL}/${match.l}/`;

    console.log("[PAGE URL]", pageUrl);

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
          .each((_, a) => {
            try {
              let href = $(a).attr("href");

              if (!href) return;

              const text = $(a).text().trim();

              // decode base64
              const idMatch =
                href.match(/id=([^&]+)/);

              if (idMatch) {
                const decoded =
                  decodeBase64Safe(idMatch[1]);

                if (
                  decoded &&
                  decoded.startsWith("http")
                ) {
                  href = decoded;
                }
              }

              streams.push(
                createStream(
                  href,
                  extractQuality(text),
                  `Cinefreak [${text}]`
                )
              );
            } catch (e) {
              console.log(e);
            }
          });
      });

      return streams;
    }

    // =========================
    // MOVIES
    // =========================

    $("div.download-links-div").each(
      (_, container) => {
        $(container)
          .find("h4.movie-title")
          .each((_, titleEl) => {
            const qualMatch = $(titleEl)
              .text()
              .match(
                /(480p|720p|1080p|2160p)/i
              );

            const qual = qualMatch
              ? qualMatch[1]
              : "Unknown";

            $(titleEl)
              .next()
              .find("a.dlbtn-download[href]")
              .each((_, a) => {
                try {
                  let href =
                    $(a).attr("href");

                  if (!href) return;

                  console.log(
                    "[RAW LINK]",
                    href
                  );

                  // decode
                  const idMatch =
                    href.match(/id=([^&]+)/);

                  if (idMatch) {
                    const decoded =
                      decodeBase64Safe(
                        idMatch[1]
                      );

                    if (
                      decoded &&
                      decoded.startsWith("http")
                    ) {
                      href = decoded;
                    }
                  }

                  streams.push(
                    createStream(
                      href,
                      qual,
                      `Cinefreak [${qual}]`
                    )
                  );
                } catch (e) {
                  console.log(e);
                }
              });
          });
      }
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
