// movies4u.js
// FINAL FIXED: Original working flow + multi-stream extraction

const cheerio = require("cheerio");

const DOMAINS_URL =
  "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";

const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  Referer: FALLBACK_URL
};

let cachedBaseUrl = null;

async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;

  try {
    const r = await fetch(DOMAINS_URL, { skipSizeCheck: true });
    const d = await r.json();
    cachedBaseUrl = d.movies4u || FALLBACK_URL;
  } catch {
    cachedBaseUrl = FALLBACK_URL;
  }

  return cachedBaseUrl;
}

// ---------- QUALITY ----------
function extractQuality(text = "") {
  const u = text.toLowerCase();
  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  return "Unknown";
}

// ---------- NEW: extract ALL usable links ----------
function extractAllStreams(html) {
  const out = new Set();

  const regex =
    /https?:\/\/[^\s"'<>]+(?:m3u8|master\.txt|master\.m3u8|\.mp4)[^\s"'<>]*/g;

  let m;
  while ((m = regex.exec(html)) !== null) {
    let url = m[0];

    // IMPORTANT FIX (your missing piece)
    if (url.includes("master.txt")) {
      url = url.replace("master.txt", "master.m3u8");
    }

    out.add(url);
  }

  return [...out];
}

// ---------- MAIN ----------
async function getStreams(tmdbId, mediaType = "movie") {
  try {
    const BASE_URL = await getBaseUrl();

    // TMDB
    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;

    if (!title) return [];

    // SEARCH (RESTORED ORIGINAL BEHAVIOUR)
    const searchHtml = await (
      await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, {
        headers: HEADERS,
        skipSizeCheck: true
      })
    ).text();

    const $ = cheerio.load(searchHtml);

    const results = [];

    // ORIGINAL SAFE SELECTORS (IMPORTANT)
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

    // MOVIE PAGE (UNCHANGED WORKING FLOW)
    const movieHtml = await (
      await fetch(match.href, {
        headers: HEADERS,
        skipSizeCheck: true
      })
    ).text();

    const $movie = cheerio.load(movieHtml);

    const watchLinks = [];

    // ORIGINAL LINK DISCOVERY (important restore)
    $movie("a[href]").each((i, el) => {
      const href = $movie(el).attr("href");

      if (href && href.includes("m4u")) {
        watchLinks.push(href);
      }
    });

    const streams = [];

    // ---------- STREAM EXTRACTION ----------
    for (const link of watchLinks.slice(0, 5)) {
      try {
        const embedHtml = await (
          await fetch(link, {
            headers: {
              ...HEADERS,
              Referer: BASE_URL + "/"
            },
            skipSizeCheck: true
          })
        ).text();

        // 🔥 THIS IS THE KEY FIX (multi-stream extraction)
        const foundStreams = extractAllStreams(embedHtml);

        for (const s of foundStreams) {
          streams.push({
            name: "Movies4u",
            title: "Movies4u Stream",
            url: s,
            quality: extractQuality(s),

            headers: {
              Referer: "https://m4uplay.store/",
              Origin: "https://m4uplay.store",
              "User-Agent": HEADERS["User-Agent"]
            },

            subtitles: []
          });
        }
      } catch {}
    }

    return streams;
  } catch (e) {
    console.error("[Movies4u]", e);
    return [];
  }
}

module.exports = { getStreams };
