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

let cachedBaseUrl = null;

async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;

  try {
    const resp = await fetch(DOMAINS_URL, {
      skipSizeCheck: true
    });

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

async function resolveUrl(url) {
  try {
    const resp = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      skipSizeCheck: true
    });

    return resp.url || url;

  } catch (_) {
    return url;
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {

    const BASE_URL = await getBaseUrl();

    // TMDB metadata
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

    // SEARCH
    const searchResp = await fetch(
      `${BASE_URL}/?s=${encodeURIComponent(title)}`,
      {
        headers: HEADERS,
        skipSizeCheck: true
      }
    );

    const searchHtml = await searchResp.text();
    const $ = cheerio.load(searchHtml);

    const results = [];

    $("article").each((i, el) => {

      const a = $(el)
        .find("h2 a, h3 a")
        .first();

      const href = a.attr("href");

      const name = a
        .text()
        .replace(/\(\d{4}\)/, "")
        .trim();

      if (href && name) {
        results.push({
          href,
          name
        });
      }
    });

    if (!results.length) return [];

    const match =
      results.find(r =>
        r.name.toLowerCase().includes(title.toLowerCase())
      ) || results[0];

    if (!match?.href) return [];

    // LOAD PAGE
    const pageResp = await fetch(match.href, {
      headers: HEADERS,
      skipSizeCheck: true
    });

    const pageHtml = await pageResp.text();
    const $p = cheerio.load(pageHtml);

    const streams = [];

    // =========================
    // MOVIES
    // =========================

    if (mediaType === "movie") {

      const links = [];

      $p("a[href]").each((i, el) => {

        const href = $p(el).attr("href") || "";
        const text = $p(el).text().toLowerCase();

        if (
          href.startsWith("http") &&
          (
            text.includes("download") ||
            text.includes("drive") ||
            text.includes("watch") ||
            href.includes("drive") ||
            href.includes("hubcloud") ||
            href.includes("gdflix") ||
            href.includes("pixeldrain")
          )
        ) {
          links.push(href);
        }
      });

      const uniqueLinks = [...new Set(links)];

      for (const link of uniqueLinks.slice(0, 10)) {

        const finalUrl = await resolveUrl(link);

        streams.push({
          url: finalUrl,
          quality: extractQuality(link + finalUrl),
          title: `Movies4u`,
          subtitles: []
        });
      }

      return streams;
    }

    // =========================
    // TV SERIES
    // =========================

    const episodeLinks = [];

    $p("a[href]").each((i, el) => {

      const href = $p(el).attr("href") || "";
      const text = $p(el).text();

      const epMatch =
        text.match(/episode\s*(\d+)/i);

      if (!epMatch) return;

      const epNum = parseInt(epMatch[1]);

      if (epNum !== parseInt(episode || 1))
        return;

      if (href.startsWith("http")) {
        episodeLinks.push(href);
      }
    });

    if (!episodeLinks.length) {
      return [];
    }

    for (const epLink of episodeLinks.slice(0, 5)) {

      try {

        const epResp = await fetch(epLink, {
          headers: HEADERS,
          skipSizeCheck: true
        });

        const epHtml = await epResp.text();
        const $ep = cheerio.load(epHtml);

        const foundLinks = [];

        $ep("a[href]").each((i, el) => {

          const href = $ep(el).attr("href") || "";

          if (
            href.startsWith("http") &&
            !href.includes("telegram")
          ) {
            foundLinks.push(href);
          }
        });

        for (const lnk of foundLinks.slice(0, 5)) {

          const finalUrl = await resolveUrl(lnk);

          streams.push({
            url: finalUrl,
            quality: extractQuality(lnk),
            title: `Movies4u S${season}E${episode}`,
            subtitles: []
          });
        }

      } catch (_) {}
    }

    return streams;

  } catch (e) {
    console.error("[Movies4u]", e);
    return [];
  }
}

/**
 * ✅ REQUIRED FOR NUVIO
 */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
