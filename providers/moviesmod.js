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

const HUBCLOUD_API = "https://hc-zf3c.vercel.app";

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

  } catch {
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

    const data = await resp.json();

    const links = data?.links || data?.data?.links || [];

    if (!links.length) return [];

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

  } catch (e) {
    return [];
  }
}

async function getStreams(tmdbId, mediaType = "movie") {
  try {
    const BASE_URL = await getBaseUrl();

    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;

    if (!title) return [];

    const searchResp = await fetch(
      `${BASE_URL}/?s=${encodeURIComponent(title)}`,
      { headers: HEADERS }
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
      results.find(r =>
        r.name.toLowerCase().includes(title.toLowerCase())
      ) || results[0];

    const movieResp = await fetch(match.href, { headers: HEADERS });
    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    const watchLinks = new Set();

    $movie("a[href]").each((_, el) => {
      const href = $movie(el).attr("href");
      if (!href) return;

      const lower = href.toLowerCase();

      if (
        lower.startsWith("javascript") ||
        lower.startsWith("#")
      ) return;

      if (
        lower.includes("hubcloud") ||
        lower.includes("hub-cloud") ||
        lower.includes("fsl") ||
        lower.includes("gdflix") ||
        lower.includes("driveleech") ||
        lower.includes("pixeldrain") ||
        lower.includes("m4ulinks") ||
        lower.includes("m4uplay")
      ) {
        watchLinks.add(href);
      }
    });

    const streams = [];

    for (const watchLink of watchLinks) {
      try {
        const lower = watchLink.toLowerCase();

        console.log("[WATCH]", watchLink);

        // HUB DIRECT
        if (
          lower.includes("hubcloud") ||
          lower.includes("fsl") ||
          lower.includes("gdflix") ||
          lower.includes("driveleech") ||
          lower.includes("pixeldrain")
        ) {
          const hubStreams = await resolveHubCloud(watchLink);
          streams.push(...hubStreams);
          continue;
        }

        const embedResp = await fetch(watchLink, { headers: HEADERS });
        const embedHtml = await embedResp.text();

        let m3u8 =
          embedHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
          embedHtml.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];

        if (!m3u8) continue;

        if (m3u8.includes("master.txt")) {
          m3u8 = m3u8.replace("master.txt", "master.m3u8");
        }

        streams.push({
          name: "Movies4u",
          title: "Stream",
          quality: extractQuality(m3u8),
          url: m3u8,
          headers: {
            Referer: "https://m4uplay.store/",
            Origin: "https://m4uplay.store",
            "User-Agent": HEADERS["User-Agent"]
          },
          subtitles: []
        });

      } catch (e) {}
    }

    return streams;

  } catch (e) {
    console.error("[Movies4u ERROR]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
