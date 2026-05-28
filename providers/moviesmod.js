// movies4u.js
// Stable test version (debug + robust scraping)

const cheerio = require("cheerio");

const DOMAINS_URL =
  "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";

const FALLBACK_URL = "https://new1.movies4u.finance";

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: FALLBACK_URL,
  Cookie: "xla=s4t",
};

let cachedBaseUrl = null;

// ----------------------
// BASE URL
// ----------------------
async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;

  try {
    const resp = await fetch(DOMAINS_URL, { skipSizeCheck: true });
    const data = await resp.json();

    cachedBaseUrl =
      data.movies4u ||
      data.movies4uhd ||
      FALLBACK_URL;
  } catch (e) {
    console.log("[Movies4u] domain fallback:", e.message);
    cachedBaseUrl = FALLBACK_URL;
  }

  return cachedBaseUrl;
}

// ----------------------
// QUALITY
// ----------------------
function extractQuality(text) {
  const u = (text || "").toLowerCase();

  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  if (u.includes("360")) return "360p";

  return "Unknown";
}

// ----------------------
// URL RESOLVER
// ----------------------
async function resolveUrl(url) {
  try {
    const resp = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      skipSizeCheck: true,
    });

    return resp.url || url;
  } catch {
    return url;
  }
}

// ----------------------
// CLEAN MATCH
// ----------------------
const clean = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// ----------------------
// MAIN
// ----------------------
async function getStreams(tmdbId, mediaType = "movie") {
  try {
    const BASE_URL = await getBaseUrl();

    console.log("[Movies4u] Base URL:", BASE_URL);

    // ----------------------
    // TMDB
    // ----------------------
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;

    if (!title) return [];

    console.log("[Movies4u] Searching:", title);

    // ----------------------
    // SEARCH PAGE
    // ----------------------
    const searchResp = await fetch(
      `${BASE_URL}/?s=${encodeURIComponent(title)}`,
      { headers: HEADERS, skipSizeCheck: true }
    );

    const searchHtml = await searchResp.text();
    const $ = cheerio.load(searchHtml);

    const results = [];

    // VERY BROAD LINK GRAB (IMPORTANT FIX)
    $("a").each((i, el) => {
      const href = $(el).attr("href");
      const name = $(el).text().trim();

      if (
        href &&
        name &&
        name.length > 5 &&
        href.includes(BASE_URL.replace("https://", ""))
      ) {
        results.push({ href, name });
      }
    });

    console.log("[Movies4u] Results found:", results.length);

    if (!results.length) {
      console.log("[Movies4u] No results at all → site structure changed or JS-rendered");
      return [];
    }

    const match =
      results.find((r) =>
        clean(r.name).includes(clean(title)) ||
        clean(title).includes(clean(r.name))
      ) || results[0];

    console.log("[Movies4u] Matched:", match?.name);

    // ----------------------
    // FIX RELATIVE URL ISSUE
    // ----------------------
    const movieUrl = new URL(match.href, BASE_URL).href;

    const movieResp = await fetch(movieUrl, {
      headers: HEADERS,
      skipSizeCheck: true,
    });

    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    // ----------------------
    // WATCH LINKS (ROBUST)
    // ----------------------
    const watchLinks = [];

    $movie("a[href]").each((i, el) => {
      const href = $movie(el).attr("href");

      if (!href) return;

      if (
        href.includes("hubcloud") ||
        href.includes("gdflix") ||
        href.includes("m4u") ||
        href.includes("drive") ||
        href.includes("gofile") ||
        href.startsWith("http")
      ) {
        watchLinks.push(href);
      }
    });

    console.log("[Movies4u] Watch links:", watchLinks.length);

    const streams = [];

    // ----------------------
    // PROCESS LINKS
    // ----------------------
    for (const link of watchLinks.slice(0, 15)) {
      try {
        const finalUrl = await resolveUrl(link);

        const embedResp = await fetch(finalUrl, {
          headers: { ...HEADERS, Referer: BASE_URL + "/" },
          skipSizeCheck: true,
        });

        const html = await embedResp.text();

        let m3u8 = null;

        m3u8 =
          html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0];

        if (!m3u8) {
          m3u8 =
            html.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];
        }

        if (!m3u8) continue;

        if (m3u8.includes("master.txt")) {
          m3u8 = m3u8.replace("master.txt", "master.m3u8");
        }

        streams.push({
          name: "Movies4u",
          title: `Movies4u ${extractQuality(m3u8)}`,
          quality: extractQuality(m3u8),
          url: m3u8,
          headers: {
            Referer: "https://m4uplay.store/",
            Origin: "https://m4uplay.store",
            "User-Agent": HEADERS["User-Agent"],
          },
          subtitles: [],
        });
      } catch (e) {
        console.log("[Movies4u link error]", e.message);
      }
    }

    console.log("[Movies4u] FINAL STREAMS:", streams.length);

    return streams;
  } catch (e) {
    console.log("[Movies4u FATAL]", e.message);
    return [];
  }
}

module.exports = {
  getStreams,
};
