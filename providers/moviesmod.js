// movies4u.js
// Fixed Nuvio-compatible Movies4u provider (WITH FSL / HUBCLOUD FIX)

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
   🔥 NEW FIX: DIRECT HUB/FSL DETECTION
======================= */
function isDirectStream(url) {
  if (!url) return false;

  return (
    url.includes("hub.homelander.buzz") ||
    url.includes("hubcloud") ||
    url.includes("fsl") ||
    url.includes("?token=") ||
    url.includes("r2.dev")
  );
}

/* =======================
   URL RESOLVER (FIXED)
======================= */
async function resolveUrl(url) {
  try {
    // 🔥 IMPORTANT FIX: if already final CDN/FSL link, return immediately
    if (isDirectStream(url)) return url;

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
   MAIN FUNCTION
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
          href.includes("m4ulinks") ||
          href.includes("hub") ||
          href.includes("fsl")
        )
      ) {
        watchLinks.push(href);
      }
    });

    const streams = [];

    /* =======================
       STREAM EXTRACTION
    ======================= */
    for (const watchLink of watchLinks.slice(0, 8)) {
      try {

        // 🔥 FIX 1: direct FSL/HUB links (NO parsing needed)
        const direct = await resolveUrl(watchLink);
        if (isDirectStream(direct)) {
          streams.push({
            name: "Movies4u",
            title: "Direct Cloud Stream",
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

        function unpack(p, a, c, k) {
          while (c--) {
            if (k[c]) {
              p = p.replace(
                new RegExp("\\b" + c.toString(a) + "\\b", "g"),
                k[c]
              );
            }
          }
          return p;
        }

        let m3u8 = null;

        /* =======================
           NORMAL STREAM DETECTION
        ======================= */
        m3u8 =
          embedHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0];

        if (!m3u8) {
          m3u8 =
            embedHtml.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];
        }

        if (!m3u8) {
          const rel =
            embedHtml.match(/\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i)?.[0];

          if (rel) {
            m3u8 = "https://m4uplay.store" + rel;
          }
        }

        /* =======================
           PACKED JS
        ======================= */
        if (!m3u8) {
          const packedMatch = embedHtml.match(
            /eval\(function\(p,a,c,k,e,d\).*?\}\('(.*)',(\d+),(\d+),'(.*)'\.split\('\|'\)/s
          );

          if (packedMatch) {
            try {
              const unpacked = unpack(
                packedMatch[1],
                parseInt(packedMatch[2]),
                parseInt(packedMatch[3]),
                packedMatch[4].split("|")
              );

              m3u8 =
                unpacked.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
                unpacked.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];
            } catch (_) {}
          }
        }

        if (!m3u8) continue;

        /* =======================
           FINAL STREAM PUSH
        ======================= */
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

      } catch (e) {}
    }

    return streams;

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
