// cinefreak.js
// Fully upgraded Cinefreak provider for Nuvio
// - Resolves redirects
// - Extracts direct streams
// - Adds playback headers
// - Validates playable URLs
// - Supports m3u8/mp4
// - Safer stream handling

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
// Stream Validation
// =========================

async function isPlayable(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: HEADERS
    });

    const type =
      (res.headers.get("content-type") || "").toLowerCase();

    console.log("[CONTENT TYPE]", type);

    return (
      type.includes("video") ||
      type.includes("mp4") ||
      type.includes("mpegurl") ||
      type.includes("application/vnd.apple.mpegurl")
    );
  } catch (e) {
    console.log("[isPlayable error]", e);
    return false;
  }
}

// =========================
// Redirect Resolver
// =========================

async function resolveFinalUrl(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: HEADERS
    });

    return res.url || url;
  } catch (e) {
    console.log("[resolveFinalUrl error]", e);
    return url;
  }
}

// =========================
// Extract direct streams
// =========================

async function extractDirectStream(url) {
  try {
    console.log("[EXTRACTING]", url);

    // =========================
    // Pixeldrain
    // =========================
    if (url.includes("pixeldrain.com/u/")) {
      const id = url.split("/u/")[1].split("?")[0];
      return `https://pixeldrain.com/api/file/${id}`;
    }

    // =========================
    // Google Drive
    // =========================
    if (url.includes("drive.google.com")) {
      const match = url.match(/\/d\/(.*?)\//);

      if (match) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    }

    // =========================
    // Already playable
    // =========================
    if (
      url.includes(".m3u8") ||
      url.includes(".mp4")
    ) {
      return url;
    }

    // =========================
    // Load page HTML
    // =========================
    const html = await (
      await fetch(url, {
        headers: HEADERS
      })
    ).text();

    // =========================
    // Extract m3u8
    // =========================
    const m3u8Match = html.match(
      /https?:\/\/[^"' ]+\.m3u8[^"' ]*/i
    );

    if (m3u8Match) {
      console.log("[FOUND M3U8]");
      return m3u8Match[0];
    }

    // =========================
    // Extract mp4
    // =========================
    const mp4Match = html.match(
      /https?:\/\/[^"' ]+\.mp4[^"' ]*/i
    );

    if (mp4Match) {
      console.log("[FOUND MP4]");
      return mp4Match[0];
    }

    // =========================
    // iframe extraction
    // =========================
    const iframeMatch = html.match(
      /<iframe[^>]+src=["']([^"']+)["']/i
    );

    if (iframeMatch) {
      const iframeUrl = iframeMatch[1];

      console.log("[FOUND IFRAME]", iframeUrl);

      if (
        iframeUrl.includes(".m3u8") ||
        iframeUrl.includes(".mp4")
      ) {
        return iframeUrl;
      }

      // Try inside iframe
      const iframeHtml = await (
        await fetch(iframeUrl, {
          headers: HEADERS
        })
      ).text();

      const iframeM3u8 = iframeHtml.match(
        /https?:\/\/[^"' ]+\.m3u8[^"' ]*/i
      );

      if (iframeM3u8) {
        return iframeM3u8[0];
      }

      const iframeMp4 = iframeHtml.match(
        /https?:\/\/[^"' ]+\.mp4[^"' ]*/i
      );

      if (iframeMp4) {
        return iframeMp4[0];
      }
    }

    return null;
  } catch (e) {
    console.log("[extractDirectStream error]", e);
    return null;
  }
}

// =========================
// Create stream object
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
    console.log(
      "[CINEFREAK START]",
      tmdbId,
      mediaType
    );

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

    if (!results.length) {
      console.log("[NO RESULTS]");
      return [];
    }

    // =========================
    // Match
    // =========================
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
      let found = false;

      $("div.ep-card").each(async (_, card) => {
        if (found) return;

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
        )
          return;

        found = true;

        const links = $(card)
          .find("div.download-links a")
          .toArray();

        for (const a of links) {
          try {
            let href = $(a).attr("href");

            if (!href) continue;

            console.log("[RAW TV LINK]", href);

            const idMatch =
              href.match(/id=([^&]+)/);

            if (idMatch) {
              const decoded =
                decodeBase64Safe(idMatch[1]);

              if (decoded) href = decoded;
            }

            href = await resolveFinalUrl(href);

            const direct =
              await extractDirectStream(href);

            if (!direct) continue;

            const playable =
              await isPlayable(direct);

            if (!playable) continue;

            streams.push(
              createStream(
                direct,
                extractQuality(href),
                "Cinefreak"
              )
            );
          } catch (e) {
            console.log("[TV stream error]", e);
          }
        }
      });

      return streams;
    }

    // =========================
    // MOVIES
    // =========================
    const containers = $("div.download-links-div")
      .toArray();

    for (const container of containers) {
      const titles = $(container)
        .find("h4.movie-title")
        .toArray();

      for (const titleEl of titles) {
        const titleText =
          $(titleEl).text();

        const quality =
          extractQuality(titleText);

        const links = $(titleEl)
          .next()
          .find("a.dlbtn-download[href]")
          .toArray();

        for (const a of links) {
          try {
            let href = $(a).attr("href");

            if (!href) continue;

            console.log("[RAW MOVIE LINK]", href);

            // =========================
            // Decode base64
            // =========================
            const idMatch =
              href.match(/id=([^&]+)/);

            if (idMatch) {
              const decoded =
                decodeBase64Safe(idMatch[1]);

              if (decoded) {
                href = decoded;
              }
            }

            // =========================
            // Resolve redirects
            // =========================
            href = await resolveFinalUrl(href);

            console.log(
              "[RESOLVED LINK]",
              href
            );

            // =========================
            // Extract direct media
            // =========================
            const direct =
              await extractDirectStream(href);

            if (!direct) {
              console.log(
                "[NO DIRECT STREAM]"
              );
              continue;
            }

            console.log(
              "[DIRECT STREAM]",
              direct
            );

            // =========================
            // Validate stream
            // =========================
            const playable =
              await isPlayable(direct);

            if (!playable) {
              console.log(
                "[NOT PLAYABLE]"
              );
              continue;
            }

            console.log(
              "[PLAYABLE STREAM]"
            );

            streams.push(
              createStream(
                direct,
                quality,
                `Cinefreak [${quality}]`
              )
            );
          } catch (e) {
            console.log(
              "[Movie stream error]",
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
    console.log("[CINEFREAK FATAL]", e);
    return [];
  }
}

// =========================
// Export
// =========================

module.exports = {
  getStreams
};
