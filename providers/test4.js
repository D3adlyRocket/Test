// cinefreak.js
// Fully fixed Cinefreak provider for Nuvio
// - Proper base64 decoding
// - Redirect resolution
// - Better playback compatibility
// - Async fixed
// - Stream extraction improved
// - Proxy headers added

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

// ========================================
// Quality
// ========================================

function extractQuality(str = "") {
  const u = str.toLowerCase();

  if (u.includes("2160p") || u.includes("4k"))
    return "4K";

  if (u.includes("1080p"))
    return "1080p";

  if (u.includes("720p"))
    return "720p";

  if (u.includes("480p"))
    return "480p";

  if (u.includes("360p"))
    return "360p";

  return "Unknown";
}

// ========================================
// Proper Cinefreak decoder
// ========================================

function decodeBase64Safe(str) {
  try {
    // URL-safe conversion
    str = str
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    // padding
    while (str.length % 4) {
      str += "=";
    }

    const decoded = Buffer.from(
      str,
      "base64"
    ).toString("utf-8");

    return decoded;
  } catch (e) {
    console.log("[DECODE ERROR]", e);
    return null;
  }
}

// ========================================
// Resolve redirects
// ========================================

async function resolveFinalUrl(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: HEADERS
    });

    return res.url || url;
  } catch (e) {
    console.log("[RESOLVE ERROR]", e);
    return url;
  }
}

// ========================================
// Extract playable stream
// ========================================

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

    // ========================================
    // Pixeldrain
    // ========================================

    if (url.includes("pixeldrain.com/u/")) {
      const id = url
        .split("/u/")[1]
        .split("?")[0];

      return `https://pixeldrain.com/api/file/${id}`;
    }

    // ========================================
    // Google Drive
    // ========================================

    if (url.includes("drive.google.com")) {
      const match =
        url.match(/\/d\/(.*?)\//);

      if (match) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    }

    // ========================================
    // Load HTML
    // ========================================

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
      console.log("[FOUND M3U8]");
      return m3u8[0];
    }

    // mp4
    const mp4 = html.match(
      /https?:\/\/[^"' ]+\.mp4[^"' ]*/i
    );

    if (mp4) {
      console.log("[FOUND MP4]");
      return mp4[0];
    }

    // JWPlayer
    const fileMatch = html.match(
      /file\s*:\s*["']([^"']+)["']/i
    );

    if (fileMatch) {
      console.log("[FOUND FILE]");
      return fileMatch[1];
    }

    // HTML5 source
    const sourceMatch = html.match(
      /<source[^>]+src=["']([^"']+)["']/i
    );

    if (sourceMatch) {
      console.log("[FOUND SOURCE]");
      return sourceMatch[1];
    }

    // iframe
    const iframeMatch = html.match(
      /<iframe[^>]+src=["']([^"']+)["']/i
    );

    if (iframeMatch) {
      console.log("[FOUND IFRAME]");
      return iframeMatch[1];
    }

    return url;
  } catch (e) {
    console.log("[EXTRACT ERROR]", e);
    return url;
  }
}

// ========================================
// Stream object
// ========================================

function createStream(
  url,
  quality,
  title
) {
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

          "User-Agent":
            HEADERS["User-Agent"]
        }
      }
    }
  };
}

// ========================================
// Main
// ========================================

async function getStreams(
  tmdbId,
  mediaType,
  season,
  episode
) {
  try {
    console.log(
      "[START]",
      tmdbId,
      mediaType
    );

    // ========================================
    // TMDB
    // ========================================

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

    // ========================================
    // Search
    // ========================================

    const searchUrl =
      `${BASE_URL}/search-api.php?q=` +
      encodeURIComponent(title) +
      "&pg=1";

    const searchResp = await fetch(
      searchUrl,
      {
        headers: HEADERS
      }
    );

    let searchData;

    try {
      searchData =
        await searchResp.json();
    } catch {
      return [];
    }

    const results = Array.isArray(
      searchData?.results
    )
      ? searchData.results
      : [];

    if (!results.length) {
      console.log("[NO RESULTS]");
      return [];
    }

    // ========================================
    // Match
    // ========================================

    const lcTitle =
      title.toLowerCase();

    const match =
      results.find(r =>
        (r.t || "")
          .toLowerCase()
          .includes(lcTitle)
      ) || results[0];

    if (!match) return [];

    const pageUrl =
      match.l.startsWith("http")
        ? match.l
        : `${BASE_URL}/${match.l}/`;

    console.log(
      "[PAGE URL]",
      pageUrl
    );

    const pageHtml = await (
      await fetch(pageUrl, {
        headers: HEADERS
      })
    ).text();

    const $ = cheerio.load(pageHtml);

    const streams = [];

    // ========================================
    // TV
    // ========================================

    if (mediaType === "tv") {
      const cards = $("div.ep-card")
        .toArray();

      for (const card of cards) {
        const seasonText = $(card)
          .find("span.season-number")
          .text()
          .match(/S(\d+)/);

        const cardSeason =
          seasonText
            ? parseInt(seasonText[1])
            : 1;

        if (
          cardSeason !==
          parseInt(season || 1)
        ) {
          continue;
        }

        const epText = $(card)
          .find("span.episode-badge")
          .text();

        const epMatch =
          epText.match(
            /Episode\s+([\d\-]+)/i
          );

        if (!epMatch) continue;

        const epNums = epMatch[1]
          .split("-")
          .map(n =>
            parseInt(n.trim())
          )
          .filter(Boolean);

        if (
          !epNums.includes(
            parseInt(episode || 1)
          )
        ) {
          continue;
        }

        const links = $(card)
          .find(
            "div.download-links a"
          )
          .toArray();

        for (const a of links) {
          try {
            let href =
              $(a).attr("href");

            if (!href) continue;

            console.log(
              "[RAW TV LINK]",
              href
            );

            // decode
            const idMatch =
              href.match(
                /id=([^&]+)/
              );

            if (idMatch) {
              const decoded =
                decodeBase64Safe(
                  idMatch[1]
                );

              console.log(
                "[DECODED]",
                decoded
              );

              if (
                decoded &&
                decoded.startsWith(
                  "http"
                )
              ) {
                href = decoded;
              }
            }

            // resolve
            href =
              await resolveFinalUrl(
                href
              );

            // extract
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
                extractQuality(
                  href
                ),
                "Cinefreak"
              )
            );
          } catch (e) {
            console.log(
              "[TV ERROR]",
              e
            );
          }
        }
      }

      return streams;
    }

    // ========================================
    // MOVIES
    // ========================================

    const containers = $(
      "div.download-links-div"
    ).toArray();

    for (const container of containers) {
      const titles = $(container)
        .find("h4.movie-title")
        .toArray();

      for (const titleEl of titles) {
        const quality =
          extractQuality(
            $(titleEl).text()
          );

        const links = $(titleEl)
          .next()
          .find(
            "a.dlbtn-download[href]"
          )
          .toArray();

        for (const a of links) {
          try {
            let href =
              $(a).attr("href");

            if (!href) continue;

            console.log(
              "[RAW LINK]",
              href
            );

            // ========================================
            // Decode Cinefreak URL
            // ========================================

            const idMatch =
              href.match(
                /id=([^&]+)/
              );

            if (idMatch) {
              const decoded =
                decodeBase64Safe(
                  idMatch[1]
                );

              console.log(
                "[DECODED]",
                decoded
              );

              if (
                decoded &&
                decoded.startsWith(
                  "http"
                )
              ) {
                href = decoded;
              }
            }

            // ========================================
            // Resolve redirects
            // ========================================

            href =
              await resolveFinalUrl(
                href
              );

            console.log(
              "[RESOLVED]",
              href
            );

            // ========================================
            // Extract stream
            // ========================================

            const finalUrl =
              await extractDirectStream(
                href
              );

            console.log(
              "[FINAL STREAM]",
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
              "[MOVIE ERROR]",
              e
            );
          }
        }
      }
    }

    console.log(
      "[TOTAL STREAMS]",
      streams.length
    );

    return streams;
  } catch (e) {
    console.log(
      "[CINEFREAK FATAL]",
      e
    );

    return [];
  }
}

module.exports = {
  getStreams
};
