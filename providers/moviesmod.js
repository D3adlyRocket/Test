// movies4u.js
// Fixed Nuvio-compatible Movies4u provider (MULTI-QUALITY FIXED)

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

function extractQuality(text = "") {
  const u = text.toLowerCase();

  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  if (u.includes("360")) return "360p";

  return "Unknown";
}

// 🔥 NEW: extract ALL m3u8 links, not just one
function extractAllStreams(html) {
  const results = new Set();

  const regex = /https?:\/\/[^\s"'<>]+(?:m3u8|master\.txt)[^\s"'<>]*/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    let url = match[0];

    // convert master.txt → master.m3u8 (important fix)
    if (url.includes("master.txt")) {
      url = url.replace("master.txt", "master.m3u8");
    }

    results.add(url);
  }

  return [...results];
}

// unpack helper
function unpack(p, a, c, k) {
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
    }
  }
  return p;
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
      results.find(r =>
        r.name.toLowerCase().includes(title.toLowerCase())
      ) || results[0];

    if (!match) return [];

    const movieResp = await fetch(match.href, {
      headers: HEADERS,
      skipSizeCheck: true
    });

    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    const watchLinks = [];

    $movie("a.btn.btn-zip").each((i, el) => {
      const href = $movie(el).attr("href");

      if (
        href &&
        (href.includes("m4uplay") || href.includes("m4u"))
      ) {
        watchLinks.push(href);
      }
    });

    const streams = [];

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

        // 🔥 STEP 1: unpack if needed
        let html = embedHtml;

        const packedMatch = embedHtml.match(
          /eval\(function\(p,a,c,k,e,d\).*?\)\((.*)\)/s
        );

        if (packedMatch) {
          try {
            const args = packedMatch[1];
            const parts = args.split(/,(?=(?:[^']*'[^']*')*[^']*$)/);

            if (parts.length >= 4) {
              html += unpack(
                parts[0].replace(/['"]/g, ""),
                parseInt(parts[1]),
                parseInt(parts[2]),
                parts[3].replace(/['"]|\.split\('\|'\)/g, "").split("|")
              );
            }
          } catch (_) {}
        }

        // 🔥 STEP 2: EXTRACT ALL STREAMS
        const allStreams = extractAllStreams(html);

        if (!allStreams.length) continue;

        // 🔥 STEP 3: PUSH ALL QUALITIES (THIS WAS MISSING BEFORE)
        for (const url of allStreams) {
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

      } catch (e) {}
    }

    return streams;

  } catch (e) {
    console.error("[Movies4u]", e);
    return [];
  }
}

module.exports = { getStreams };
