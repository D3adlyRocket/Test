// movies4u.js
// Stable Nuvio-compatible Movies4u provider (FIXED + WORKING BASELINE)

const cheerio = require("cheerio");

const DOMAINS_URL =
  "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";

const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: FALLBACK_URL
};

let cachedBaseUrl = null;

async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;

  try {
    const resp = await fetch(DOMAINS_URL, { skipSizeCheck: true });
    const data = await resp.json();

    cachedBaseUrl =
      data.movies4u ||
      data.movies4uhd ||
      FALLBACK_URL;
  } catch {
    cachedBaseUrl = FALLBACK_URL;
  }

  return cachedBaseUrl;
}

function extractQuality(text = "") {
  const u = text.toLowerCase();

  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";

  return "Unknown";
}

// 🔥 SIMPLE SAFE STREAM EXTRACTOR (IMPORTANT FIX)
function extractStreamsFromHtml(html) {
  const streams = [];

  const regex =
    /https?:\/\/[^\s"'<>]+(?:m3u8|master\.txt|master\.m3u8)[^\s"'<>]*/g;

  let match;
  while ((match = regex.exec(html)) !== null) {
    let url = match[0];

    if (url.includes("master.txt")) {
      url = url.replace("master.txt", "master.m3u8");
    }

    streams.push(url);
  }

  return [...new Set(streams)];
}

async function getStreams(tmdbId, mediaType = "movie") {
  try {
    const BASE_URL = await getBaseUrl();

    // TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;

    if (!title) return [];

    // SEARCH
    const searchResp = await fetch(
      `${BASE_URL}/?s=${encodeURIComponent(title)}`,
      { headers: HEADERS, skipSizeCheck: true }
    );

    const searchHtml = await searchResp.text();
    const $ = cheerio.load(searchHtml);

    const results = [];

    // 🔥 FIXED SELECTORS (THIS WAS BREAKING YOUR VERSION)
    $("h3.entry-title a, h2.entry-title a, h3 a, h2 a").each((i, el) => {
      const href = $(el).attr("href");
      const name = $(el).text().trim();

      if (href && name) results.push({ href, name });
    });

    if (!results.length) return [];

    const match =
      results.find(r =>
        r.name.toLowerCase().includes(title.toLowerCase())
      ) || results[0];

    if (!match) return [];

    // MOVIE PAGE
    const movieResp = await fetch(match.href, {
      headers: HEADERS,
      skipSizeCheck: true
    });

    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    const watchLinks = [];

    // 🔥 FIXED LINK PICKING
    $movie("a[href]").each((i, el) => {
      const href = $movie(el).attr("href");

      if (
        href &&
        (href.includes("m4uplay") || href.includes("m4u"))
      ) {
        watchLinks.push(href);
      }
    });

    const streams = [];

    for (const watchLink of watchLinks.slice(0, 5)) {
      try {
        const embedResp = await fetch(watchLink, {
          headers: {
            ...HEADERS,
            Referer: BASE_URL + "/"
          },
          skipSizeCheck: true
        });

        const embedHtml = await embedResp.text();

        // 🔥 EXTRACT ALL STREAMS
        const urls = extractStreamsFromHtml(embedHtml);

        for (const url of urls) {
          streams.push({
            name: "Movies4u",
            title: "Movies4u Stream",
            url,

            quality: extractQuality(url),

            headers: {
              Referer: "https://m4uplay.store/",
              Origin: "https://m4uplay.store",
              "User-Agent": HEADERS["User-Agent"]
            },

            subtitles: []
          });
        }
      } catch (e) {}
    }

    return streams;
  } catch (e) {
    console.error("[Movies4u]", e);
    return [];
  }
}

module.exports = { getStreams };
