const cheerio = require("cheerio-without-node-native");

// ============================================================
// AnimeCloud / FireAni provider for Nuvio
// ============================================================

const BASE_URL = "https://fireani.me";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  Referer: `${BASE_URL}/`,
  Origin: BASE_URL,
  Accept: "*/*"
};

function extractQuality(text = "") {
  const t = text.toLowerCase();

  if (t.includes("2160") || t.includes("4k")) return "4K";
  if (t.includes("1080")) return "1080p";
  if (t.includes("720")) return "720p";
  if (t.includes("480")) return "480p";

  return "HD";
}

async function safeJson(url) {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      skipSizeCheck: true
    });

    return await res.json();
  } catch (_) {
    return null;
  }
}

async function safeText(url, referer = BASE_URL + "/") {
  try {
    const res = await fetch(url, {
      headers: {
        ...HEADERS,
        Referer: referer
      },
      redirect: "follow",
      skipSizeCheck: true
    });

    return await res.text();
  } catch (_) {
    return "";
  }
}

async function getStreams(
  tmdbId,
  mediaType = "tv",
  season = 1,
  episode = 1
) {
  try {
    // ============================================================
    // TMDB
    // ============================================================

    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo = await (
      await fetch(tmdbUrl, {
        skipSizeCheck: true
      })
    ).json();

    const title =
      mediaInfo.name ||
      mediaInfo.title;

    if (!title) return [];

    // ============================================================
    // SEARCH
    // ============================================================

    const searchUrl =
      `${BASE_URL}/api/anime/search?q=${encodeURIComponent(title)}`;

    const searchData = await safeJson(searchUrl);

    const results =
      searchData?.data ||
      searchData ||
      [];

    if (!Array.isArray(results) || !results.length) {
      console.log("[AnimeCloud] no search results");
      return [];
    }

    // ============================================================
    // BEST MATCH
    // ============================================================

    const match =
      results.find(x =>
        (x.title || "")
          .toLowerCase()
          .includes(title.toLowerCase())
      ) || results[0];

    const slug = match?.slug;

    if (!slug) {
      console.log("[AnimeCloud] no slug");
      return [];
    }

    // ============================================================
    // SEASON / EPISODE
    // ============================================================

    const targetSeason = season || 1;
    const targetEpisode = episode || 1;

    const epApi =
      `${BASE_URL}/api/anime/episode?slug=${slug}&season=${encodeURIComponent(targetSeason)}&episode=${targetEpisode}`;

    const epData = await safeJson(epApi);

    const episodeLinks =
      epData?.data?.anime_episode_links ||
      [];

    if (!episodeLinks.length) {
      console.log("[AnimeCloud] no episode links");
      return [];
    }

    const streams = [];

    // ============================================================
    // EXTRACT
    // ============================================================

    for (const item of episodeLinks) {
      try {
        const href = item?.link;

        if (!href) continue;

        const lang =
          item?.lang?.toUpperCase() ||
          "SUB";

        // ========================================================
        // OPEN PLAYER PAGE
        // ========================================================

        const html = await safeText(
          href,
          `${BASE_URL}/`
        );

        if (!html) continue;

        // ========================================================
        // DIRECT M3U8
        // ========================================================

        let stream =
          html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0];

        // ========================================================
        // FIREANI PROXY STREAM
        // ========================================================

        if (!stream) {
          const proxyMatch =
            html.match(/\/proxy\/nocache\/[a-zA-Z0-9\-\/._]+master\.m3u8/i);

          if (proxyMatch) {
            stream = BASE_URL + proxyMatch[0];
          }
        }

        // ========================================================
        // MASTER TS FALLBACK
        // ========================================================

        if (!stream) {
          const tsMatch =
            html.match(/\/proxy\/nocache\/[a-zA-Z0-9\-\/._]+master\d+\.ts/i);

          if (tsMatch) {
            stream = BASE_URL + tsMatch[0];
          }
        }

        // ========================================================
        // FILE:
        // ========================================================

        if (!stream) {
          const fileMatch =
            html.match(/file:\s*["']([^"']+)["']/i);

          if (fileMatch) {
            stream = fileMatch[1];
          }
        }

        // ========================================================
        // SOURCES:
        // ========================================================

        if (!stream) {
          const sourceMatch =
            html.match(/sources:\s*\[\s*\{\s*file:\s*["']([^"']+)/i);

          if (sourceMatch) {
            stream = sourceMatch[1];
          }
        }

        // ========================================================
        // IFRAME FALLBACK
        // ========================================================

        if (!stream) {
          const $ = cheerio.load(html);

          const iframe =
            $("iframe").attr("src") ||
            $("iframe").attr("data-src");

          if (iframe) {
            const iframeUrl =
              iframe.startsWith("http")
                ? iframe
                : BASE_URL + iframe;

            const iframeHtml = await safeText(
              iframeUrl,
              href
            );

            stream =
              iframeHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0];

            // proxy inside iframe
            if (!stream) {
              const proxyMatch =
                iframeHtml.match(/\/proxy\/nocache\/[a-zA-Z0-9\-\/._]+master\.m3u8/i);

              if (proxyMatch) {
                stream = BASE_URL + proxyMatch[0];
              }
            }
          }
        }

        // ========================================================
        // FINAL
        // ========================================================

        if (!stream) {
          console.log("[AnimeCloud] no stream extracted");
          continue;
        }

        streams.push({
          name: "AnimeCloud",

          title:
            `AnimeCloud [${lang}] ${extractQuality(stream)}`,

          quality: extractQuality(stream),

          url: stream,

          headers: {
            Referer: `${BASE_URL}/`,
            Origin: BASE_URL,
            "User-Agent": HEADERS["User-Agent"]
          },

          subtitles: []
        });

      } catch (e) {
        console.log("[AnimeCloud stream error]", e.message);
      }
    }

    // ============================================================
    // DEDUPE
    // ============================================================

    return [
      ...new Map(
        streams.map(x => [x.url, x])
      ).values()
    ];

  } catch (e) {
    console.log("[AnimeCloud fatal]", e.message);
    return [];
  }
}

// ============================================================
// REQUIRED FOR NUVIO
// ============================================================

module.exports = {
  getStreams
};
