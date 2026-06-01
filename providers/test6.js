// animecloud.js
// AnimeCloud / FireAni provider for Nuvio

const cheerio = require("cheerio");

const BASE_URL = "https://fireani.me";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Referer": `${BASE_URL}/`,
  "Origin": BASE_URL
};

// ======================
// QUALITY DETECTION
// ======================

function extractQuality(text) {
  const u = (text || "").toLowerCase();

  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1440")) return "1440p";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  if (u.includes("360")) return "360p";

  return "1080p";
}

// ======================
// EXTRACT M3U8
// ======================

function extractM3U8(html) {
  if (!html) return null;

  // direct m3u8
  let m3u8 =
    html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0];

  if (m3u8) return m3u8;

  // master.txt
  m3u8 =
    html.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];

  if (m3u8) {
    return m3u8.replace("master.txt", "master.m3u8");
  }

  // relative stream path
  const rel =
    html.match(/\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i)?.[0];

  if (rel) {
    return ("https://m4uplay.store" + rel)
      .replace("master.txt", "master.m3u8");
  }

  return null;
}

// ======================
// FETCH HTML
// ======================

async function fetchHtml(url, referer = BASE_URL + "/") {
  const resp = await fetch(url, {
    headers: {
      ...HEADERS,
      Referer: referer
    },
    redirect: "follow",
    skipSizeCheck: true
  });

  return await resp.text();
}

// ======================
// MAIN
// ======================

async function getStreams(
  tmdbId,
  mediaType = "tv",
  season = 1,
  episode = 1
) {

  try {

    // ======================
    // TMDB LOOKUP
    // ======================

    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo =
      await (await fetch(tmdbUrl, {
        skipSizeCheck: true
      })).json();

    const title =
      mediaInfo.title ||
      mediaInfo.name;

    if (!title) return [];

    // ======================
    // SEARCH API
    // ======================

    const searchUrl =
      `${BASE_URL}/api/anime/search?q=${encodeURIComponent(title)}`;

    const searchRes =
      await (await fetch(searchUrl, {
        headers: HEADERS,
        skipSizeCheck: true
      })).json();

    const results =
      searchRes?.data || [];

    if (!results.length) {
      console.log("[AnimeCloud] No search results");
      return [];
    }

    // ======================
    // BEST MATCH
    // ======================

    const best =
      results.find(r =>
        (r.title || r.name || "")
          .toLowerCase()
          .includes(title.toLowerCase())
      ) || results[0];

    const slug = best?.slug;

    if (!slug) {
      console.log("[AnimeCloud] No slug found");
      return [];
    }

    // ======================
    // DETERMINE SEASON
    // ======================

    const targetSeason =
      mediaType === "movie"
        ? 0
        : parseInt(season || 1);

    const targetEpisode =
      parseInt(episode || 1);

    let seasonQuery =
      targetSeason === 0
        ? "Filme"
        : String(targetSeason);

    // ======================
    // EPISODE API
    // ======================

    const epUrl =
      `${BASE_URL}/api/anime/episode?slug=${slug}&season=${encodeURIComponent(seasonQuery)}&episode=${targetEpisode}`;

    const epRes =
      await (await fetch(epUrl, {
        headers: HEADERS,
        skipSizeCheck: true
      })).json();

    const episodeLinks =
      epRes?.data?.anime_episode_links || [];

    if (!episodeLinks.length) {
      console.log("[AnimeCloud] No episode links");
      return [];
    }

    // ======================
    // STREAM EXTRACTION
    // ======================

    const streams = [];

    for (const link of episodeLinks) {

      try {

        const href = link?.link;
        const lang =
          (link?.lang || "Unknown").toUpperCase();

        if (!href) continue;

        console.log("[AnimeCloud] Processing:", href);

        // ======================
        // FETCH PAGE
        // ======================

        const pageHtml =
          await fetchHtml(href, BASE_URL + "/");

        let m3u8 =
          extractM3U8(pageHtml);

        // ======================
        // IFRAME EXTRACTION
        // ======================

        if (!m3u8) {

          const $ = cheerio.load(pageHtml);

          const iframeSrc =
            $("iframe").attr("src") ||
            $("iframe").attr("data-src");

          if (iframeSrc) {

            const iframeUrl =
              iframeSrc.startsWith("http")
                ? iframeSrc
                : new URL(iframeSrc, href).href;

            console.log("[AnimeCloud] iframe:", iframeUrl);

            try {

              const iframeHtml =
                await fetchHtml(iframeUrl, href);

              m3u8 =
                extractM3U8(iframeHtml);

            } catch (e) {
              console.log("[AnimeCloud iframe ERROR]", e.message);
            }
          }
        }

        // ======================
        // FINAL STREAM
        // ======================

        if (m3u8) {

          streams.push({
            name: "AnimeCloud",

            title:
              `AnimeCloud [${lang}] ${extractQuality(m3u8)}`,

            quality:
              extractQuality(m3u8),

            url: m3u8,

            headers: {
              Referer: `${BASE_URL}/`,
              Origin: BASE_URL,
              "User-Agent": HEADERS["User-Agent"]
            },

            subtitles: []
          });

          console.log("[AnimeCloud] Stream found");
        }

      } catch (e) {
        console.log("[AnimeCloud Stream ERROR]", e.message);
      }
    }

    // ======================
    // REMOVE DUPLICATES
    // ======================

    const unique = [];
    const seen = new Set();

    for (const s of streams) {

      if (!seen.has(s.url)) {
        seen.add(s.url);
        unique.push(s);
      }
    }

    console.log(`[AnimeCloud] Final streams: ${unique.length}`);

    return unique;

  } catch (e) {

    console.log("[AnimeCloud ERROR]", e.message);

    return [];
  }
}

// ======================
// EXPORT
// ======================

module.exports = {
  getStreams
};
