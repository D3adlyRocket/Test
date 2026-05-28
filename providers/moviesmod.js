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
   FINAL FILTER ONLY
======================= */
function isBad(url) {
  if (!url) return true;
  const u = url.toLowerCase();

  return (
    u.includes(".apk") ||
    u.includes(".zip") ||
    u.includes("install") ||
    u.includes("download-app")
  );
}

/* =======================
   HUB / FSL DETECTOR
======================= */
function isHubLike(url) {
  if (!url) return false;
  const u = url.toLowerCase();

  return (
    u.includes("hub") ||
    u.includes("fsl") ||
    u.includes("homelander") ||
    u.includes("gamerxyt") ||
    u.includes("token=")
  );
}

/* =======================
   RESOLVE (SAFE)
======================= */
async function resolveUrl(url) {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      skipSizeCheck: true,
    });

    return res.url || url;
  } catch {
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

      if (href && name) results.push({ href, name });
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

    const links = [];

    /* =======================
       🔥 LAYER 1: DOWNLOAD BLOCKS (IMPORTANT FIX)
    ======================= */
    $movie("div.downloads-btns-div a[href], div.download-links-div a[href]").each((i, el) => {
      const href = $movie(el).attr("href");
      if (href) links.push(href);
    });

    /* =======================
       🔥 LAYER 2: EMBED LINKS
    ======================= */
    $movie("a[href]").each((i, el) => {
      const href = $movie(el).attr("href");

      if (
        href &&
        (
          href.includes("m4u") ||
          href.includes("m4uplay") ||
          href.includes("m4ufree") ||
          href.includes("hub") ||
          href.includes("fsl") ||
          href.includes("search-recover") ||
          href.includes("archive")
        )
      ) {
        links.push(href);
      }
    });

    const streams = [];

    /* =======================
       RESOLUTION ENGINE
    ======================= */
    for (const link of links.slice(0, 15)) {
      try {
        const resolved = await resolveUrl(link);

        if (isBad(resolved)) continue;

        /* =======================
           HUB / FSL DIRECT
        ======================= */
        if (isHubLike(resolved)) {
          streams.push({
            name: "Movies4u",
            title: "Hub/FSL Stream",
            quality: extractQuality(resolved),
            url: resolved,
            headers: {
              Referer: BASE_URL + "/",
              "User-Agent": HEADERS["User-Agent"],
            },
            subtitles: [],
          });

          continue;
        }

        /* =======================
           EMBED STREAM PARSER
        ======================= */
        const embedResp = await fetch(link, {
          headers: {
            ...HEADERS,
            Referer: BASE_URL + "/",
          },
          skipSizeCheck: true,
        });

        const html = await embedResp.text();

        let stream =
          html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
          html.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i)?.[0];

        if (!stream || isBad(stream)) continue;

        streams.push({
          name: "Movies4u",
          title: "Stream",
          quality: extractQuality(stream),
          url: stream,
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
       FINAL CLEANUP
    ======================= */
    const seen = new Set();
    const finalStreams = [];

    for (const s of streams) {
      if (!s.url) continue;
      if (isBad(s.url)) continue;
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
