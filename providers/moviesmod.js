// movies4u.js
// Stable Nuvio-compatible provider (FIXED)

const cheerio = require("cheerio");

const DOMAINS_URL =
  "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";

const FALLBACK_URL = "https://new1.movies4u.finance";

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HUBCLOUD_API = "https://hc-zf3c.vercel.app";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: FALLBACK_URL,
  Cookie: "xla=s4t"
};

let cachedBaseUrl = null;

// -------------------- BASE URL
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

// -------------------- QUALITY
function extractQuality(t) {
  const u = (t || "").toLowerCase();

  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  return "Unknown";
}

// -------------------- HUB RESOLVER (SAFE)
async function resolveHubCloud(url) {
  try {
    const api = `${HUBCLOUD_API}/api/extract?url=${encodeURIComponent(url)}`;

    const resp = await fetch(api, {
      headers: {
        Accept: "application/json",
        "User-Agent": HEADERS["User-Agent"]
      },
      skipSizeCheck: true
    });

    const data = await resp.json();

    const links =
      data?.links ||
      data?.data?.links ||
      data?.data?.result ||
      data?.result ||
      data?.streams ||
      [];

    if (!Array.isArray(links) || !links.length) return [];

    return links
      .filter(l => l?.url)
      .map(l => ({
        name: "Movies4u",
        title: l.label || "Stream",
        quality: extractQuality(l.label + " " + l.url),
        url: l.url,
        headers: {
          Referer: FALLBACK_URL + "/",
          "User-Agent": HEADERS["User-Agent"]
        },
        subtitles: []
      }));
  } catch {
    return [];
  }
}

// -------------------- MAIN
async function getStreams(tmdbId, mediaType = "movie") {
  try {
    const BASE_URL = await getBaseUrl();

    const tmdb = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`,
      { skipSizeCheck: true }
    );

    const media = await tmdb.json();
    const title = media.title || media.name;

    if (!title) return [];

    // ---------------- SEARCH
    const search = await fetch(
      `${BASE_URL}/?s=${encodeURIComponent(title)}`,
      { headers: HEADERS, skipSizeCheck: true }
    );

    const html = await search.text();
    const $ = cheerio.load(html);

    const results = [];

    $("article").each((_, el) => {
      const a = $(el).find("h2 a, h3 a").first();
      const href = a.attr("href");
      const name = a.text().trim();

      if (href && name) results.push({ href, name });
    });

    if (!results.length) return [];

    const match =
      results.find(r =>
        r.name.toLowerCase().includes(title.toLowerCase())
      ) || results[0];

    if (!match) return [];

    // ---------------- MOVIE PAGE
    const page = await fetch(match.href, {
      headers: HEADERS,
      skipSizeCheck: true
    });

    const pageHtml = await page.text();
    const $movie = cheerio.load(pageHtml);

    const watchLinks = new Set();

    $movie("a[href]").each((_, el) => {
      const href = $movie(el).attr("href");
      if (!href) return;

      const l = href.toLowerCase();

      if (
        l.includes("hubcloud") ||
        l.includes("fsl") ||
        l.includes("m4u") ||
        l.includes("gdflix") ||
        l.includes("driveleech") ||
        l.includes("pixeldrain") ||
        l.includes("m4ulinks")
      ) {
        watchLinks.add(href);
      }
    });

    const streams = [];

    // ---------------- LOOP WATCH LINKS
    for (const link of watchLinks) {
      try {
        const lower = link.toLowerCase();

        // ---------------- HUB FLOW
        if (
          lower.includes("hubcloud") ||
          lower.includes("fsl") ||
          lower.includes("gdflix") ||
          lower.includes("driveleech") ||
          lower.includes("pixeldrain")
        ) {
          const hub = await resolveHubCloud(link);
          if (hub.length) streams.push(...hub);
          continue;
        }

        // ---------------- EMBED FLOW (RESTORED CRITICAL PART)
        const embed = await fetch(link, {
          headers: { ...HEADERS, Referer: BASE_URL + "/" },
          skipSizeCheck: true
        });

        const embedHtml = await embed.text();

        let m3u8 =
          embedHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
          embedHtml.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];

        if (m3u8?.includes("master.txt")) {
          m3u8 = m3u8.replace("master.txt", "master.m3u8");
        }

        if (!m3u8) continue;

        streams.push({
          name: "Movies4u",
          title: "Stream",
          quality: extractQuality(link + m3u8),
          url: m3u8,
          headers: {
            Referer: "https://m4uplay.store/",
            Origin: "https://m4uplay.store",
            "User-Agent": HEADERS["User-Agent"]
          },
          subtitles: []
        });
      } catch {}
    }

    return streams;
  } catch (e) {
    console.error("[Movies4u ERROR]", e);
    return [];
  }
}

module.exports = { getStreams };
