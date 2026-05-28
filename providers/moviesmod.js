// movies4u.js
// Fixed Nuvio-compatible Movies4u provider (balanced fix: no over-filtering)

const cheerio = require("cheerio-without-node-native");

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

/* =======================
   BASE URL
======================= */
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

/* =======================
   QUALITY
======================= */
function extractQuality(text) {
  const u = (text || "").toLowerCase();

  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  if (u.includes("360")) return "360p";

  return "Unknown";
}

/* =======================
   SAFE FILTER (ONLY JUNK BLOCK)
======================= */
function isBadLink(url) {
  if (!url) return true;

  const u = url.toLowerCase();

  // ONLY block obvious junk (DO NOT OVERBLOCK)
  return (
    u.includes(".apk") ||
    u.includes(".zip") ||
    u.includes("install") ||
    u.includes("download-app")
  );
}

/* =======================
   STREAM DETECTOR (LOOSE - IMPORTANT)
======================= */
function isLikelyStream(url) {
  if (!url) return false;

  const u = url.toLowerCase();

  return (
    u.includes(".m3u8") ||
    u.includes(".mp4") ||
    u.includes("m4u") ||
    u.includes("hub") ||
    u.includes("fsl") ||
    u.includes("token=") ||
    u.includes("m4uplay") ||
    u.includes("m4ufree")
  );
}

/* =======================
   RESOLVE URL
======================= */
async function resolveUrl(url) {
  try {
    const resp = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      skipSizeCheck: true,
    });

    return resp.url || url;
  } catch (_) {
    return url;
  }
}

/* =======================
   MAIN
======================= */
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo =
      await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    /* =======================
       SEARCH
    ======================= */
    const searchResp = await fetch(
      `${BASE_URL}/?s=${encodeURIComponent(title)}`,
      {
        headers: HEADERS,
        skipSizeCheck: true,
      }
    );

    const searchHtml = await searchResp.text();
    const $ = cheerio.load(searchHtml);

    const results = [];

    $("article").each((i, el) => {
      const a = $(el).find("h2 a, h3 a").first();

      const href = a.attr("href");
      const name = a.text().trim();

      if (href && name) {
        results.push({ href, name });
      }
    });

    if (!results.length) return [];

    const match =
      results.find(r =>
        r.name.toLowerCase().includes(title.toLowerCase())
      ) || results[0];

    if (!match) return [];

    /* =======================
       MOVIE PAGE
    ======================= */
    const movieResp = await fetch(match.href, {
      headers: HEADERS,
      skipSizeCheck: true,
    });

    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    const watchLinks = [];

    $movie("a.btn.btn-zip, a[href]").each((i, el) => {
      const href = $movie(el).attr("href");

      if (
        href &&
        (
          href.includes("m4uplay") ||
          href.includes("m4ufree") ||
          href.includes("m4u") ||
          href.includes("hub") ||
          href.includes("fsl")
        )
      ) {
        watchLinks.push(href);
      }
    });

    const streams = [];

    /* =======================
       STREAM RESOLUTION
    ======================= */
    for (const watchLink of watchLinks.slice(0, 10)) {
      try {
        const direct = await resolveUrl(watchLink);

        // SAFE PUSH (FIXED LOGIC)
        if (
          direct &&
          !isBadLink(direct) &&
          isLikelyStream(direct)
        ) {
          streams.push({
            name: "Movies4u",
            title: "Direct Stream",
            quality: extractQuality(direct),
            url: direct,
            headers: {
              Referer: BASE_URL + "/",
              "User-Agent": HEADERS["User-Agent"],
            },
            subtitles: [],
          });

          continue;
        }

        const embedResp = await fetch(watchLink, {
          headers: {
            ...HEADERS,
            Referer: BASE_URL + "/",
          },
          skipSizeCheck: true,
        });

        const embedHtml = await embedResp.text();

        let m3u8 = null;

        // HLS
        m3u8 =
          embedHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0];

        // MP4 fallback
        if (!m3u8) {
          m3u8 =
            embedHtml.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i)?.[0];
        }

        if (!m3u8 || isBadLink(m3u8)) continue;

        streams.push({
          name: "Movies4u",
          title: "Movies4u Stream",
          quality: extractQuality(watchLink + " " + m3u8),
          url: m3u8,
          headers: {
            Referer: "https://m4uplay.store/",
            Origin: "https://m4uplay.store",
            "User-Agent": HEADERS["User-Agent"],
          },
          subtitles: [],
        });

      } catch (_) {}
    }

    /* =======================
       FINAL CLEANUP (IMPORTANT)
    ======================= */

    const seen = new Set();
    const finalStreams = [];

    for (const s of streams) {
      if (!s.url) continue;
      if (isBadLink(s.url)) continue;
      if (seen.has(s.url)) continue;

      seen.add(s.url);
      finalStreams.push(s);
    }

    return finalStreams;

  } catch (e) {
    console.error("[Movies4u]", e);
    return [];
  }
}

/* =======================
   EXPORT
======================= */
module.exports = {
  getStreams,
};
