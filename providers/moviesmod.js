// movies4u.js
// Hardened Nuvio-compatible Movies4u provider (debug-safe)

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
    console.log("[Movies4u] domain fetch failed:", e.message);
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
// REDIRECT RESOLVER
// ----------------------
async function resolveUrl(url) {
  try {
    const resp = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      skipSizeCheck: true,
    });

    return resp.url || url;
  } catch (e) {
    return url;
  }
}

// ----------------------
// CLEAN STRING MATCH
// ----------------------
const clean = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// ----------------------
// MAIN
// ----------------------
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    // TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.title || mediaInfo.name;

    if (!title) return [];

    console.log("[Movies4u] Searching:", title);

    // SEARCH
    const searchResp = await fetch(
      `${BASE_URL}/?s=${encodeURIComponent(title)}`,
      { headers: HEADERS, skipSizeCheck: true }
    );

    const searchHtml = await searchResp.text();
    const $ = cheerio.load(searchHtml);

    const results = [];

    $("article, .post, .result-item, .item, li a").each((i, el) => {
      const a = $(el).is("a") ? $(el) : $(el).find("a").first();

      const href = a.attr("href");
      const name = a.text().trim();

      if (href && name) {
        results.push({ href, name });
      }
    });

    if (!results.length) {
      console.log("[Movies4u] No search results");
      return [];
    }

    const match =
      results.find((r) =>
        clean(r.name).includes(clean(title)) ||
        clean(title).includes(clean(r.name))
      ) || results[0];

    console.log("[Movies4u] Matched:", match?.name);

    // PAGE
    const movieResp = await fetch(match.href, {
      headers: HEADERS,
      skipSizeCheck: true,
    });

    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    const watchLinksRaw = [];

    // ----------------------
    // BROAD LINK EXTRACTION
    // ----------------------
    const selectors = [
      "div.downloads-btns-div a[href]",
      "div.download-btns a[href]",
      "div.download-links a[href]",
      "a.btn.btn-zip",
      "a[href*='hubcloud']",
      "a[href*='gdflix']",
      "a[href*='m4uplay']",
      "a[href*='m4ulinks']",
    ];

    for (const sel of selectors) {
      $movie(sel).each((i, el) => {
        const href = $movie(el).attr("href");
        if (href) watchLinksRaw.push(href);
      });
    }

    const watchLinks = [...new Set(watchLinksRaw)].filter(Boolean);

    console.log("[Movies4u] Links found:", watchLinks.length);

    const streams = [];

    // ----------------------
    // PROCESS LINKS
    // ----------------------
    for (const watchLink of watchLinks.slice(0, 20)) {
      try {
        let finalUrl = await resolveUrl(watchLink);

        const embedResp = await fetch(finalUrl, {
          headers: { ...HEADERS, Referer: BASE_URL + "/" },
          skipSizeCheck: true,
        });

        const embedHtml = await embedResp.text();

        let m3u8 = null;

        // direct
        m3u8 =
          embedHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0];

        // master
        if (!m3u8) {
          m3u8 =
            embedHtml.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];
        }

        // relative
        if (!m3u8) {
          const rel = embedHtml.match(/\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i)?.[0];
          if (rel) m3u8 = "https://m4uplay.store" + rel;
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

    console.log("[Movies4u] Streams returned:", streams.length);

    return streams;
  } catch (e) {
    console.log("[Movies4u FATAL]", e.message);
    return [];
  }
}

module.exports = {
  getStreams,
};
