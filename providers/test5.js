const cheerio = require("cheerio-without-node-native");

// ============================================================
// OnePace Provider for Nuvio
// ============================================================

const BASE_URL = "https://onepace.co";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Referer": BASE_URL + "/",
  "Origin": BASE_URL
};

// ============================================================
// Safe Fetch
// ============================================================

async function safeFetch(url, options = {}) {

  try {

    return await fetch(url, options);

  } catch (err) {

    console.log("[Fetch Error]", err);

    return null;
  }
}

// ============================================================
// Extract m3u8
// ============================================================

function extractM3U8(html) {

  if (!html) return null;

  // Direct m3u8
  const direct =
    html.match(
      /https?:\/\/[^"' ]+\.m3u8[^"' ]*/i
    );

  if (direct?.[0]) {
    return direct[0];
  }

  // JWPlayer style
  const jw =
    html.match(
      /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i
    );

  if (jw?.[1]) {
    return jw[1];
  }

  // Source style
  const source =
    html.match(
      /source\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i
    );

  if (source?.[1]) {
    return source[1];
  }

  // Turbosplayer fallback
  const turbo =
    html.match(
      /https?:\/\/[^"' ]+\/file\/[a-f0-9-]+\/master\.m3u8/i
    );

  if (turbo?.[0]) {
    return turbo[0];
  }

  return null;
}

// ============================================================
// Resolve embeds
// ============================================================

async function resolveStream(url) {

  try {

    // Direct m3u8
    if (url.includes(".m3u8")) {

      return {
        url,
        referer: BASE_URL + "/",
        origin: BASE_URL
      };
    }

    const res = await safeFetch(url, {
      headers: HEADERS
    });

    if (!res) return null;

    const html = await res.text();

    // Extract direct stream
    let m3u8 = extractM3U8(html);

    // Nested iframe
    if (!m3u8) {

      const iframe =
        html.match(
          /<iframe[^>]+src=["']([^"']+)["']/i
        );

      if (iframe?.[1]) {

        let nested =
          iframe[1];

        if (
          !nested.startsWith("http")
        ) {

          nested = new URL(
            nested,
            url
          ).href;
        }

        const nestedRes =
          await safeFetch(nested, {
            headers: {
              ...HEADERS,
              Referer: url
            }
          });

        if (nestedRes) {

          const nestedHtml =
            await nestedRes.text();

          m3u8 =
            extractM3U8(
              nestedHtml
            );
        }
      }
    }

    if (!m3u8) return null;

    return {
      url: m3u8,
      referer: url,
      origin: new URL(url).origin
    };

  } catch (err) {

    console.log(
      "[Resolve Error]",
      err
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

    const streams = [];

    // ========================================================
    // Open One Pace page
    // ========================================================

    const seriesRes =
      await safeFetch(
        `${BASE_URL}/series/one-pace-english-sub/`,
        {
          headers: HEADERS
        }
      );

    if (!seriesRes) {
      return [];
    }

    const html =
      await seriesRes.text();

    const doc =
      cheerio.load(html);

    // ========================================================
    // Collect episode links
    // ========================================================

    const episodes = [];

    doc(
      "ul.seasons-lst.anm-a li"
    ).each((_, el) => {

      const href =
        doc(el)
          .find("a")
          .attr("href");

      const title =
        doc(el)
          .text()
          .trim();

      if (href) {

        episodes.push({
          href,
          title
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
    // Pick episode
    // ========================================================

    const epNum =
      parseInt(episode || 1);

    const selected =
      episodes[
        Math.max(0, epNum - 1)
      ] || episodes[0];

    console.log(
      "[OnePace] Selected:",
      selected.title
    );

    const epUrl =
      selected.href.startsWith(
        "http"
      )
        ? selected.href
        : BASE_URL +
          selected.href;

    // ========================================================
    // Open episode page
    // ========================================================

    const epRes =
      await safeFetch(
        epUrl,
        {
          headers: HEADERS
        }
      );

    if (!epRes) {
      return [];
    }

    const epHtml =
      await epRes.text();

    const epDoc =
      cheerio.load(epHtml);

    // ========================================================
    // Find possible player URLs
    // ========================================================

    const urls = [];

    // iframe src
    epDoc("iframe").each(
      (_, el) => {

        const src =
          epDoc(el).attr("src");

        if (src) {
          urls.push(src);
        }
      }
    );

    // data-src
    epDoc("[data-src]").each(
      (_, el) => {

        const src =
          epDoc(el).attr(
            "data-src"
          );

        if (src) {
          urls.push(src);
        }
      }
    );

    // Extract URLs from page
    const matches =
      epHtml.match(
        /https?:\/\/[^"' ]+/g
      ) || [];

    urls.push(...matches);

    // ========================================================
    // Filter useful URLs
    // ========================================================

    const filtered =
      [...new Set(urls)].filter(
        url =>
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
      );

    console.log(
      "[OnePace] Sources:",
      filtered.length
    );

    // ========================================================
    // Resolve all
    // ========================================================

    for (
      let i = 0;
      i < filtered.length;
      i++
    ) {

      try {

        let url =
          filtered[i];

        if (
          !url.startsWith(
            "http"
          )
        ) {

          url = new URL(
            url,
            epUrl
          ).href;
        }

        console.log(
          "[OnePace] Resolving:",
          url
        );

        const resolved =
          await resolveStream(
            url
          );

        if (
          !resolved?.url
        ) {
          continue;
        }

        streams.push({

          name: "OnePace",

          title:
            `Server ${i + 1}`,

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

      } catch (err) {

        console.log(
          "[Stream Error]",
          err
        );
      }
    }

    // ========================================================
    // Deduplicate
    // ========================================================

    const final = [];

    const seen =
      new Set();

    for (const s of streams) {

      if (
        !seen.has(s.url)
      ) {

        seen.add(s.url);

        final.push(s);
      }
    }

    console.log(
      "[OnePace] Final:",
      final.length
    );

    return final;

  } catch (err) {

    console.log(
      "[OnePace Fatal]",
      err
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
