// movies4u.js
// Fixed Nuvio-compatible Movies4u provider

const cheerio = require("cheerio");

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

// =======================
// NUVIO EXPORT FIX
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

    $("article, .post, .result-item, .item, li").each((i, el) => {
      const a = $(el).find("h2 a, h3 a").first();

      const href = a.attr("href");
      const name = a.text().trim();

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

    if (!match) return [];

    // MOVIE PAGE
    const movieResp = await fetch(match.href, {
      headers: HEADERS,
      skipSizeCheck: true
    });

    const movieHtml = await movieResp.text();

    const $movie = cheerio.load(movieHtml);

    const watchLinksRaw = [];

// ORIGINAL MOVIES4U DOWNLOAD BUTTONS (MOST IMPORTANT)
$movie("div.downloads-btns-div a[href]").each((i, el) => {
  const href = $movie(el).attr("href");

  if (href) {
    watchLinksRaw.push(href);
  }
});

// ZIP / WATCH BUTTONS
$movie("a.btn.btn-zip").each((i, el) => {
  const href = $movie(el).attr("href");

  if (href) {
    watchLinksRaw.push(href);
  }
});

// EXTRA FALLBACK DISCOVERY
$movie("a[href]").each((i, el) => {

  const href = $movie(el).attr("href") || "";

  if (
    href.includes("hubcloud") ||
    href.includes("gdflix") ||
    href.includes("m4uplay") ||
    href.includes("m4ufree")
  ) {
    watchLinksRaw.push(href);
  }

});

// also keep original button selector
$movie("a.btn.btn-zip").each((i, el) => {
  const href = $movie(el).attr("href");

  if (href) {
    watchLinksRaw.push(href);
  }
});

// dedupe
const watchLinks = [
  ...new Set(
    watchLinksRaw
      .filter(Boolean)
      .map(l => l.split("?")[0])
  )
];

    const streams = [];

    for (const watchLink of watchLinks.slice(0, 30)) {

      try {

        let finalUrl = watchLink;

// resolve redirects first
try {
  finalUrl = await resolveUrl(watchLink);
} catch (_) {}

// fetch resolved page
const embedResp = await fetch(finalUrl, {
  headers: {
    ...HEADERS,
    Referer: BASE_URL + "/"
  },
  redirect: "follow",
  skipSizeCheck: true
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
// ======================
// HUBCLOUD / GDFLIX FIX
// ======================

// hubcloud embeds
if (
  !m3u8 &&
  (
    finalUrl.includes("hubcloud") ||
    finalUrl.includes("gdflix") ||
    finalUrl.includes("m4ulinks")
  )
) {

  // iframe extraction
  const iframeSrc =
    embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];

  if (iframeSrc) {

    try {

      const iframeUrl =
        iframeSrc.startsWith("http")
          ? iframeSrc
          : new URL(iframeSrc, finalUrl).href;

      const iframeResp = await fetch(iframeUrl, {
        headers: {
          ...HEADERS,
          Referer: finalUrl
        },
        redirect: "follow",
        skipSizeCheck: true
      });

      const iframeHtml = await iframeResp.text();

      // direct m3u8
      m3u8 =
        iframeHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0];

      // master.txt
      if (!m3u8) {
        m3u8 =
          iframeHtml.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];
      }

      // relative stream path
      if (!m3u8) {

        const rel =
          iframeHtml.match(/\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i)?.[0];

        if (rel) {
          m3u8 = "https://m4uplay.store" + rel;
        }
      }

    } catch (_) {}
  }
}
        

// DIRECT LINK
if (!m3u8) {
  m3u8 =
    embedHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0];
}

// master.txt
if (!m3u8) {
  m3u8 =
    embedHtml.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];
}

// Relative stream path
if (!m3u8) {
  const rel =
    embedHtml.match(/\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i)?.[0];

  if (rel) {
    m3u8 = "https://m4uplay.store" + rel;
  }
}

// PACKED JS
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
        unpacked.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0];

      if (!m3u8) {
        m3u8 =
          unpacked.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];
      }

      if (!m3u8) {
        const rel =
          unpacked.match(/\/(?:3o|stream)\/[^\s"'<>]+(?:m3u8|txt)/i)?.[0];

        if (rel) {
          m3u8 = "https://m4uplay.store" + rel;
        }
      }

    } catch (_) {}
  }
}

// Convert master.txt to m3u8
if (m3u8 && m3u8.includes("master.txt")) {
  m3u8 = m3u8.replace("master.txt", "master.m3u8");
}

// FINAL PLAYABLE URL
const playableUrl = m3u8 || finalUrl;

// skip junk
if (
  !playableUrl ||
  playableUrl.includes("telegram") ||
  playableUrl.includes("facebook")
) {
  continue;
}

streams.push({
  name: "Movies4u",
  title: `Movies4u ${extractQuality(playableUrl)}`,
  quality: extractQuality(playableUrl),

  url: playableUrl,

  headers: {
    Referer: "https://m4uplay.store/",
    Origin: "https://m4uplay.store",
    "User-Agent": HEADERS["User-Agent"]
  },

  subtitles: []
});

      } catch (e) {
  console.log("[Movies4u ERROR]", e.message);
}
    }

    return streams;

  } catch (e) {
    console.error("[Movies4u]", e);
    return [];
  }
}

// =======================
// REQUIRED FOR NUVIO
// =======================

module.exports = {
  getStreams
};
