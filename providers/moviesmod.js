// movies4u.js
// Fixed Nuvio-compatible Movies4u provider (SCRAPER + API HYBRID)

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

// =======================
// MAIN
// =======================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    // TMDB
    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo =
      await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();

    const title = mediaInfo.title || mediaInfo.name;

    if (!title) return [];

    const streams = [];

    // =========================================================
    // 1. SCRAPER PIPELINE (YOUR ORIGINAL LOGIC - PRESERVED)
    // =========================================================

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

      if (href && name) {
        results.push({ href, name });
      }
    });

    if (!results.length) return [];

    const match =
      results.find(r =>
        r.name.toLowerCase().includes(title.toLowerCase())
      ) || results[0];

    if (!match?.href) return [];

    const movieResp = await fetch(match.href, {
      headers: HEADERS,
      skipSizeCheck: true
    });

    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    const watchLinksRaw = [];

    // EXTRA DISCOVERY
    $movie("a[href]").each((i, el) => {
      const href = $movie(el).attr("href") || "";

      if (
        href.includes("m4uplay") ||
        href.includes("m4ufree") ||
        href.includes("m4u") ||
        href.includes("hubcloud") ||
        href.includes("gdflix")
      ) {
        watchLinksRaw.push(href);
      }
    });

    // BUTTON LINKS
    $movie("a.btn.btn-zip").each((i, el) => {
      const href = $movie(el).attr("href");

      if (
        href &&
        (
          href.includes("m4uplay") ||
          href.includes("m4ufree") ||
          href.includes("m4u") ||
          href.includes("hubcloud") ||
          href.includes("gdflix")
        )
      ) {
        watchLinksRaw.push(href);
      }
    });

    const watchLinks = [
      ...new Set(
        watchLinksRaw
          .filter(Boolean)
          .map(l => l.split("?")[0])
      )
    ];

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

    for (const watchLink of watchLinks.slice(0, 5)) {
      try {
        const embedResp = await fetch(watchLink, {
          headers: {
            ...HEADERS,
            Referer: BASE_URL + "/"
          },
          skipSizeCheck: true
        });

        const embedHtml = await embedResp.text();

        let m3u8 = null;

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

        if (!m3u8) continue;

        streams.push({
          name: "Movies4u",
          title: "Movies4u Stream",
          url: m3u8,
          quality: extractQuality(watchLink + " " + m3u8),
          subtitles: []
        });

      } catch (_) {}
    }

    // =========================================================
    // 2. API PIPELINE (ADDED MULTI-LINK SOURCE)
    // =========================================================

    try {
      const apiBase = "https://badboysxs-murph-api.hf.space";

      const apiUrl =
        mediaType === "tv"
          ? `${apiBase}/api/mfu/series?q=${encodeURIComponent(title)}&season=${season || 1}&episode=${episode || 1}`
          : `${apiBase}/api/mfu/movie?q=${encodeURIComponent(title)}`;

      const apiResp = await fetch(apiUrl, { skipSizeCheck: true });
      const apiData = await apiResp.json();

      if (apiData?.results?.length) {
        for (const row of apiData.results) {
          const directUrl =
            row.direct_url ||
            row.episodes?.[0]?.direct_url;

          if (!directUrl) continue;

          streams.push({
            name: "Movies4u API",
            title: `Movies4u | ${row.quality || "HD"} | ${row.audio_lang || "Original"}`,
            url: directUrl,
            quality: row.quality || "HD",
            subtitles: []
          });
        }
      }
    } catch (_) {}

    return streams;

  } catch (e) {
    console.error("[Movies4u]", e);
    return [];
  }
}

// =======================

module.exports = { getStreams };
