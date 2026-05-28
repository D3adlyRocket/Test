// movies4u.js
// Fixed Nuvio-compatible Movies4u provider (FULL FIX)

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Referer": FALLBACK_URL,
  "Cookie": "xla=s4t"
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

  } catch (_) {
    cachedBaseUrl = FALLBACK_URL;
  }

  return cachedBaseUrl;
}

function extractQuality(text) {
  const u = (text || "").toLowerCase();

  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  if (u.includes("360")) return "360p";

  return "Unknown";
}

// =======================
// HELPERS
// =======================

function dedupe(arr, key = "url") {
  const seen = new Set();
  return arr.filter(i => {
    if (!i[key]) return false;
    if (seen.has(i[key])) return false;
    seen.add(i[key]);
    return true;
  });
}

// =======================
// MAIN
// =======================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo =
      await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();

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

    $("article").each((i, el) => {
      const a = $(el).find("h2 a, h3 a").first();
      const href = a.attr("href");
      const name = a.text().trim();

      if (href && name) results.push({ href, name });
    });

    if (!results.length) return [];

    const match =
      results.find(r => r.name.toLowerCase().includes(title.toLowerCase())) ||
      results[0];

    if (!match) return [];

    // PAGE
    const movieResp = await fetch(match.href, {
      headers: HEADERS,
      skipSizeCheck: true
    });

    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    let watchLinks = [];

    // 1. btn-zip links
    $movie("a.btn.btn-zip").each((i, el) => {
      const href = $movie(el).attr("href");
      if (href) watchLinks.push(href);
    });

    // 2. fallback m4u links anywhere
    $movie("a[href]").each((i, el) => {
      const href = $movie(el).attr("href");
      if (href && href.includes("m4u")) watchLinks.push(href);
    });

    watchLinks = [...new Set(watchLinks)];

    const streams = [];

    // =======================
    // PROCESS EACH LINK
    // =======================
    for (const watchLink of watchLinks.slice(0, 10)) {
      try {
        const embedResp = await fetch(watchLink, {
          headers: { ...HEADERS, Referer: BASE_URL + "/" },
          skipSizeCheck: true
        });

        const html = await embedResp.text();

        let found = [];

        // 1. direct m3u8/txt
        const direct = html.match(/https?:\/\/[^\s"'<>]+(?:m3u8|txt)[^\s"'<>]*/g);
        if (direct) found.push(...direct);

        // 2. iframe sources
        const iframe = html.match(/<iframe[^>]+src=["']([^"']+)["']/gi);
        if (iframe) {
          iframe.forEach(i => {
            const src = i.match(/src=["']([^"']+)["']/)?.[1];
            if (src && src.includes("m4u")) found.push(src);
          });
        }

        // 3. relative stream paths
        const rel = html.match(/\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/g);
        if (rel) {
          rel.forEach(r => found.push("https://m4uplay.store" + r));
        }

        found = [...new Set(found)];

        for (const url of found) {
          streams.push({
            name: "Movies4u",
            title: "Movies4u Stream",
            quality: extractQuality(url),
            url,
            headers: {
              Referer: "https://m4uplay.store/",
              Origin: "https://m4uplay.store",
              "User-Agent": HEADERS["User-Agent"]
            },
            subtitles: []
          });
        }

      } catch (_) {}
    }

    return dedupe(streams, "url");

  } catch (e) {
    console.error("[Movies4u]", e);
    return [];
  }
}

module.exports = { getStreams };
