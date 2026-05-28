// movies4u.js
// Fixed Nuvio-compatible Movies4u provider

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Referer": FALLBACK_URL,
  "Cookie": "xla=s4t"
};

const HUBCLOUD_API = "https://hc-zf3c.vercel.app";

let cachedBaseUrl = null;

// -----------------------
// BASE URL
// -----------------------
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

// -----------------------
// QUALITY
// -----------------------
function extractQuality(text) {
  const u = (text || "").toLowerCase();

  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  if (u.includes("360")) return "360p";

  return "Unknown";
}

// -----------------------
// HUB RESOLVER
// -----------------------
async function resolveHubCloud(hubUrl) {
  try {
    const api = `${HUBCLOUD_API}/api/extract?url=${encodeURIComponent(hubUrl)}`;

    const resp = await fetch(api, {
      headers: {
        "Accept": "application/json",
        "User-Agent": HEADERS["User-Agent"]
      },
      skipSizeCheck: true
    });

    console.log("[HUB STATUS]", resp.status);

    const data = await resp.json();
    console.log("[HUB DATA]", JSON.stringify(data).slice(0, 400));

    const links =
      data?.links ||
      data?.data?.links ||
      [];

    if (!Array.isArray(links) || !links.length) {
      console.log("[NO HUB LINKS]");
      return [];
    }

    return links
      .filter(l => l?.url)
      .map(l => ({
        name: "Movies4u",
        title: l.label || "Stream",
        quality: extractQuality((l.label || "") + " " + l.url),
        url: l.url,
        headers: {
          Referer: FALLBACK_URL + "/",
          "User-Agent": HEADERS["User-Agent"]
        },
        subtitles: []
      }));

  } catch (e) {
    console.log("[HubCloud Error]", e);
    return [];
  }
}

// -----------------------
// MAIN
// -----------------------
async function getStreams(tmdbId, mediaType = "movie") {
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

    $("article").each((_, el) => {
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

    // MOVIE PAGE
    const movieResp = await fetch(match.href, {
      headers: HEADERS,
      skipSizeCheck: true
    });

    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    const watchLinks = new Set();

    $movie("a[href]").each((_, el) => {
      const href = $movie(el).attr("href");
      if (!href) return;

      const l = href.toLowerCase();

      if (
        l.startsWith("javascript") ||
        l.startsWith("#")
      ) return;

      if (
        l.includes("m4u") ||
        l.includes("hubcloud") ||
        l.includes("hub-cloud") ||
        l.includes("fsl") ||
        l.includes("gdflix") ||
        l.includes("driveleech") ||
        l.includes("pixeldrain") ||
        l.includes("m4ulinks")
      ) {
        watchLinks.add(href);
      }
    });

    const streams = [];

    for (const watchLink of [...watchLinks]) {
      try {

        const lower = watchLink.toLowerCase();

        // -----------------------
        // M4ULINKS PAGE
        // -----------------------
        if (lower.includes("m4ulinks")) {

          const dlResp = await fetch(watchLink, {
            headers: HEADERS,
            skipSizeCheck: true
          });

          const dlHtml = await dlResp.text();
          const $$ = cheerio.load(dlHtml);

          const inner = [];

          $$("a[href]").each((_, el) => {
            const href = $$(el).attr("href");
            const l = (href || "").toLowerCase();

            if (
              l.includes("hubcloud") ||
              l.includes("fsl") ||
              l.includes("driveleech") ||
              l.includes("gdflix")
            ) {
              inner.push(href);
            }
          });

          for (const i of inner) {
            const hubStreams = await resolveHubCloud(i);
            if (hubStreams.length) streams.push(...hubStreams);
          }

          continue;
        }

        // -----------------------
        // HUB DIRECT
        // -----------------------
        if (
          lower.includes("hubcloud") ||
          lower.includes("hub-cloud") ||
          lower.includes("fsl") ||
          lower.includes("gdflix") ||
          lower.includes("driveleech") ||
          lower.includes("pixeldrain")
        ) {
          const hubStreams = await resolveHubCloud(watchLink);
          if (hubStreams.length) streams.push(...hubStreams);
          continue;
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
