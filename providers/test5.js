const cheerio = require('cheerio-without-node-native');

// ============================================================
// OnePace provider for Nuvio
// FIXED VERSION
// - Keeps original working structure
// - Fixes same-link issue
// - Resolves direct .m3u8 streams
// - Supports Turbosplayer
// ============================================================

const BASE_URL = "https://onepace.co";

const TMDB_API_KEY =
  "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

  "Referer": BASE_URL + "/"
};

// ============================================================
// Extract m3u8
// ============================================================

function extractM3U8(html) {

  if (!html) return null;

  const patterns = [

    /https?:\/\/[^"' ]+\.m3u8[^"' ]*/i,

    /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,

    /source\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i
  ];

  for (const pattern of patterns) {

    const match = html.match(pattern);

    if (match) {

      return match[1] || match[0];
    }
  }

  return null;
}

// ============================================================
// Resolve embed page -> m3u8
// ============================================================

async function resolveEmbed(url, referer) {

  try {

    const res = await fetch(url, {
      headers: {
        ...HEADERS,
        Referer: referer || BASE_URL + "/"
      }
    });

    const html = await res.text();

    let m3u8 = extractM3U8(html);

    // Nested iframe support
    if (!m3u8) {

      const nested =
        html.match(
          /<iframe[^>]+src=["']([^"']+)["']/i
        );

      if (nested?.[1]) {

        let nestedUrl = nested[1];

        if (!nestedUrl.startsWith("http")) {

          nestedUrl = new URL(
            nestedUrl,
            url
          ).href;
        }

        const nestedRes = await fetch(
          nestedUrl,
          {
            headers: {
              ...HEADERS,
              Referer: url
            }
          }
        );

        const nestedHtml =
          await nestedRes.text();

        m3u8 =
          extractM3U8(
            nestedHtml
          );
      }
    }

    if (!m3u8) return null;

    return {
      url: m3u8,
      referer: url,
      origin: new URL(url).origin
    };

  } catch (e) {

    console.log(
      "[resolveEmbed]",
      e
    );

    return null;
  }
}

// ============================================================
// Main
// ============================================================

async function getStreams(
  tmdbId,
  mediaType,
  season,
  episode
) {

  try {

    // ========================================================
    // TMDB info
    // ========================================================

    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo =
      await (
        await fetch(
          tmdbUrl,
          {
            headers: HEADERS
          }
        )
      ).json();

    const title =
      mediaInfo.title ||
      mediaInfo.name;

    if (!title) {
      return [];
    }

    // ========================================================
    // Load One Pace page
    // ========================================================

    const seriesUrl =
      `${BASE_URL}/series/one-pace-english-sub/`;

    const html =
      await (
        await fetch(
          seriesUrl,
          {
            headers: HEADERS
          }
        )
      ).text();

    const doc =
      cheerio.load(html);

    const streams = [];

    // ========================================================
    // Build episode list
    // ========================================================

    const episodes = [];

    doc(
      "ul.seasons-lst.anm-a li"
    ).each((_, el) => {

      const href =
        doc(el)
          .find("a")
          .attr("href");

      const epTitle =
        doc(el)
          .text()
          .trim();

      if (href) {

        episodes.push({
          href,
          title: epTitle
        });
      }
    });

    console.log(
      "[OnePace] Episodes:",
      episodes.length
    );

    if (!episodes.length) {
      return [];
    }

    // ========================================================
    // Episode selection
    // ========================================================

    let selectedEpisode;

    const epIndex =
      Math.max(
        0,
        parseInt(episode || 1) - 1
      );

    if (episodes[epIndex]) {

      selectedEpisode =
        episodes[epIndex];

    } else {

      selectedEpisode =
        episodes[0];
    }

    console.log(
      "[OnePace] Selected:",
      selectedEpisode.title
    );

    // ========================================================
    // Open episode page
    // ========================================================

    const epUrl =
      selectedEpisode.href.startsWith(
        "http"
      )
        ? selectedEpisode.href
        : BASE_URL +
          selectedEpisode.href;

    const epHtml =
      await (
        await fetch(
          epUrl,
          {
            headers: HEADERS
          }
        )
      ).text();

    const epDoc =
      cheerio.load(epHtml);

    // ========================================================
    // Extract iframe sources DIRECTLY from episode page
    // ========================================================

    const iframeSources = [];

    // Real iframe tags
    epDoc("iframe").each(
      (_, frame) => {

        let src =
          epDoc(frame).attr("src");

        if (!src) return;

        if (
          !src.startsWith(
            "http"
          )
        ) {

          src = new URL(
            src,
            BASE_URL
          ).href;
        }

        iframeSources.push(src);
      }
    );

    // Extract raw URLs from scripts/html
    const matches =
      epHtml.match(
        /https?:\/\/[^"' ]+/g
      ) || [];

    for (const url of matches) {

      if (
        url.includes(
          ".m3u8"
        ) ||
        url.includes(
          "embed"
        ) ||
        url.includes(
          "player"
        ) ||
        url.includes(
          "turbosplayer"
        )
      ) {

        iframeSources.push(url);
      }
    }

    // ========================================================
    // Remove duplicate iframe URLs
    // ========================================================

    const uniqueFrames =
      [...new Set(iframeSources)];

    console.log(
      "[OnePace] Sources:",
      uniqueFrames.length
    );

    // ========================================================
    // Resolve streams
    // ========================================================

    for (
      let i = 0;
      i < uniqueFrames.length;
      i++
    ) {

      try {

        const src =
          uniqueFrames[i];

        console.log(
          "[OnePace] Processing:",
          src
        );

        // Direct m3u8 already
        if (
          src.includes(
            ".m3u8"
          )
        ) {

          streams.push({

            name: "OnePace",

            title:
              `OnePace Server ${i + 1}`,

            url: src,

            quality: "1080p",

            type: "hls",

            subtitles: [],

            behaviorHints: {

              notWebReady: false,

              proxyHeaders: {

                request: {

                  "User-Agent":
                    HEADERS[
                      "User-Agent"
                    ],

                  "Referer":
                    epUrl
                }
              }
            }
          });

          continue;
        }

        // Resolve embeds
        const resolved =
          await resolveEmbed(
            src,
            epUrl
          );

        if (
          !resolved?.url
        ) continue;

        streams.push({

          name: "OnePace",

          title:
            `OnePace Server ${i + 1}`,

          url:
            resolved.url,

          quality:
            "1080p",

          type: "hls",

          subtitles: [],

          behaviorHints: {

            notWebReady: false,

            proxyHeaders: {

              request: {

                "User-Agent":
                  HEADERS[
                    "User-Agent"
                  ],

                "Referer":
                  resolved.referer,

                "Origin":
                  resolved.origin
              }
            }
          }
        });

      } catch (e) {

        console.log(
          "[Stream Resolve Error]",
          e
        );
      }
    }

    // ========================================================
    // Remove duplicate streams
    // ========================================================

    const unique = [];

    const seen =
      new Set();

    for (const s of streams) {

      if (
        !seen.has(s.url)
      ) {

        seen.add(s.url);

        unique.push(s);
      }
    }

    console.log(
      "[OnePace] Final:",
      unique.length
    );

    return unique;

  } catch (e) {

    console.log(
      "[OnePace Fatal]",
      e
    );

    return [];
  }
}

if (
  typeof module !==
    "undefined" &&
  module.exports
) {

  module.exports = {
    getStreams
  };
}
