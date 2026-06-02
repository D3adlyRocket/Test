const cheerio = require('cheerio-without-node-native');

// ============================================================
// OnePace Provider for Nuvio
// Scrapes https://onepace.co
// Resolves direct .m3u8 streams from embeds
// ============================================================

const BASE_URL = "https://onepace.co";

const TMDB_API_KEY =
  "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

  "Referer": BASE_URL + "/",
  "Origin": BASE_URL
};

// ============================================================
// Safe fetch
// ============================================================

async function safeFetch(url, options = {}) {

  try {

    return await fetch(url, options);

  } catch (e) {

    console.log("[safeFetch error]", e);

    return null;
  }
}

// ============================================================
// Extract m3u8 from HTML
// ============================================================

function extractM3U8(html) {

  if (!html) return null;

  const regexes = [

    /https?:\/\/[^"' ]+\.m3u8[^"' ]*/gi,

    /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,

    /source\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,

    /src\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i
  ];

  for (const regex of regexes) {

    const match = html.match(regex);

    if (match) {

      return match[1] || match[0];
    }
  }

  // Turbosplayer fallback
  const turboMatch = html.match(
    /https?:\/\/[^"' ]+\/file\/[a-f0-9-]+\/master\.m3u8/i
  );

  if (turboMatch) {

    return turboMatch[0];
  }

  return null;
}

// ============================================================
// Resolve embed pages
// ============================================================

async function resolveStream(embedUrl) {

  try {

    const res = await safeFetch(embedUrl, {
      headers: {
        ...HEADERS,
        Referer: BASE_URL + "/"
      }
    });

    if (!res) return null;

    const html = await res.text();

    // Direct extraction
    let m3u8 = extractM3U8(html);

    // Nested iframe
    if (!m3u8) {

      const iframeMatch = html.match(
        /<iframe[^>]+src=["']([^"']+)["']/i
      );

      if (iframeMatch?.[1]) {

        const nestedUrl =
          iframeMatch[1].startsWith("http")
            ? iframeMatch[1]
            : new URL(
                iframeMatch[1],
                embedUrl
              ).href;

        const nestedRes = await safeFetch(
          nestedUrl,
          {
            headers: {
              ...HEADERS,
              Referer: embedUrl
            }
          }
        );

        if (nestedRes) {

          const nestedHtml =
            await nestedRes.text();

          m3u8 = extractM3U8(nestedHtml);
        }
      }
    }

    if (!m3u8) return null;

    return {
      url: m3u8,
      referer: embedUrl,
      origin: new URL(embedUrl).origin
    };

  } catch (e) {

    console.log("[resolveStream error]", e);

    return null;
  }
}

// ============================================================
// Main stream resolver
// ============================================================

async function getStreams(
  tmdbId,
  mediaType,
  season,
  episode
) {

  try {

    const streams = [];

    // ========================================================
    // TMDB lookup
    // ========================================================

    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const tmdbRes = await safeFetch(
      tmdbUrl,
      {
        headers: HEADERS
      }
    );

    if (!tmdbRes) return [];

    const mediaInfo =
      await tmdbRes.json();

    const title =
      mediaInfo.title ||
      mediaInfo.name;

    if (!title) return [];

    console.log(
      "[OnePace] TMDB Title:",
      title
    );

    // ========================================================
    // Load One Pace page
    // ========================================================

    const seriesUrl =
      `${BASE_URL}/series/one-pace-english-sub/`;

    const seriesRes = await safeFetch(
      seriesUrl,
      {
        headers: HEADERS
      }
    );

    if (!seriesRes) return [];

    const seriesHtml =
      await seriesRes.text();

    const doc =
      cheerio.load(seriesHtml);

    // ========================================================
    // Build episode list
    // ========================================================

    const allEpisodes = [];

    doc("ul.seasons-lst.anm-a li").each(
      (_, el) => {

        const $el = doc(el);

        const href =
          $el.find("a").attr("href");

        const epTitle =
          $el.find("h3.title")
            .text()
            .trim() ||
          $el.text().trim();

        if (href) {

          allEpisodes.push({
            href,
            title: epTitle
          });
        }
      }
    );

    console.log(
      "[OnePace] Episodes found:",
      allEpisodes.length
    );

    if (allEpisodes.length === 0) {

      return [];
    }

    // ========================================================
    // Match episode
    // ========================================================

    let selectedEpisode = null;

    if (
      episode &&
      allEpisodes[
        parseInt(episode) - 1
      ]
    ) {

      selectedEpisode =
        allEpisodes[
          parseInt(episode) - 1
        ];

    } else {

      selectedEpisode =
        allEpisodes[0];
    }

    console.log(
      "[OnePace] Selected:",
      selectedEpisode.title
    );

    // ========================================================
    // Open episode page
    // ========================================================

    const fullEpisodeUrl =
      selectedEpisode.href.startsWith("http")
        ? selectedEpisode.href
        : BASE_URL +
          selectedEpisode.href;

    const epRes = await safeFetch(
      fullEpisodeUrl,
      {
        headers: HEADERS
      }
    );

    if (!epRes) return [];

    const epHtml =
      await epRes.text();

    const epDoc =
      cheerio.load(epHtml);

    // ========================================================
    // Extract iframe/player sources
    // ========================================================

    const iframeSources = [];

    // Standard iframes
    epDoc("iframe").each(
      (_, frame) => {

        let src =
          epDoc(frame).attr("src");

        if (!src) return;

        if (!src.startsWith("http")) {

          src = new URL(
            src,
            BASE_URL
          ).href;
        }

        iframeSources.push(src);
      }
    );

    // Extract raw URLs from scripts/html
    const urlMatches =
      epHtml.match(
        /https?:\/\/[^"' ]+/g
      ) || [];

    for (const url of urlMatches) {

      if (
        url.includes("embed") ||
        url.includes("player") ||
        url.includes("turbosplayer") ||
        url.includes(".m3u8")
      ) {

        iframeSources.push(url);
      }
    }

    // Remove duplicates
    const uniqueFrames =
      [...new Set(iframeSources)];

    console.log(
      "[OnePace] Sources found:",
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
          "[OnePace] Resolving:",
          src
        );

        // Already direct m3u8
        if (
          src.includes(".m3u8")
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
                    fullEpisodeUrl,

                  "Origin":
                    BASE_URL
                }
              }
            }
          });

          continue;
        }

        // Resolve embeds
        const resolved =
          await resolveStream(src);

        if (
          !resolved?.url
        ) continue;

        streams.push({

          name: "OnePace",

          title:
            `OnePace Server ${i + 1}`,

          url: resolved.url,

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
                  resolved.referer,

                "Origin":
                  resolved.origin
              }
            }
          }
        });

      } catch (err) {

        console.log(
          "[resolve error]",
          err
        );
      }
    }

    // ========================================================
    // Remove duplicate streams
    // ========================================================

    const unique = [];

    const seen = new Set();

    for (const s of streams) {

      if (
        !seen.has(s.url)
      ) {

        seen.add(s.url);

        unique.push(s);
      }
    }

    console.log(
      `[OnePace] Final streams: ${unique.length}`
    );

    return unique;

  } catch (e) {

    console.log(
      "[OnePace fatal error]",
      e
    );

    return [];
  }
}

if (
  typeof module !== "undefined" &&
  module.exports
) {

  module.exports = {
    getStreams
  };
}
