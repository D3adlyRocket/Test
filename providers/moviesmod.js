// movies4u.js
// Fixed Nuvio-compatible Movies4u provider (HubCloud API fix included)

const cheerio = require("cheerio");

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: FALLBACK_URL,
  Cookie: "xla=s4t",
};

let cachedBaseUrl = null;

// ----------------------
// BASE URL
// ----------------------
async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;

  try {
    const resp = await fetch(DOMAINS_URL, { skipSizeCheck: true });
    const data = await resp.json();

    cachedBaseUrl = data.movies4u || data.movies4uhd || FALLBACK_URL;
  } catch (_) {
    cachedBaseUrl = FALLBACK_URL;
  }

  return cachedBaseUrl;
}

// ----------------------
// QUALITY
// ----------------------
function extractQuality(text) {
  const u = (text || "").toLowerCase();
  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  return "Unknown";
}

// ----------------------
// HUBCLOUD FIX (CORE)
// ----------------------
async function resolveHubcloudApi(url) {
  try {
    const id = url.match(/[?&]id=([^&]+)/)?.[1];
    const token = url.match(/[?&]token=([^&]+)/)?.[1];

    if (!id || !token) return null;

    const apiUrl = `https://hubcloud.php?host=hubcloud&id=${id}&token=${encodeURIComponent(
      token
    )}`;

    const res = await fetch(apiUrl, {
      headers: {
        ...HEADERS,
        Referer: "https://hubcloud.foo/",
      },
      skipSizeCheck: true,
    });

    const html = await res.text();

    let stream =
      html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
      html.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i)?.[0] ||
      html.match(/https?:\/\/pub-[a-zA-Z0-9\-]+\.r2\.dev[^\s"'<>]*/i)?.[0] ||
      html.match(/https?:\/\/[^\s"'<>]+token=[^\s"'<>]*/i)?.[0];

    return stream || null;
  } catch {
    return null;
  }
}

// ----------------------
// SAFE RESOLVE
// ----------------------
async function resolveUrl(url) {
  try {
    const resp = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      skipSizeCheck: true,
    });

    return resp.url || url;
  } catch {
    return url;
  }
}

// ----------------------
// MAIN
// ----------------------
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    // TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // SEARCH
    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, {
      headers: HEADERS,
      skipSizeCheck: true,
    });

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
      results.find((r) => r.name.toLowerCase().includes(title.toLowerCase())) ||
      results[0];

    if (!match) return [];

    // MOVIE PAGE
    const movieResp = await fetch(match.href, {
      headers: HEADERS,
      skipSizeCheck: true,
    });

    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    const watchLinks = [];

    $movie("a.btn.btn-zip").each((i, el) => {
      const href = $movie(el).attr("href");
      if (href) watchLinks.push(href);
    });

    const streams = [];

    // ----------------------
    // STREAM RESOLUTION
    // ----------------------
    for (const watchLink of watchLinks.slice(0, 6)) {
      try {
        const embedResp = await fetch(watchLink, {
          headers: { ...HEADERS, Referer: BASE_URL + "/" },
          skipSizeCheck: true,
        });

        const embedHtml = await embedResp.text();

        let m3u8 =
          embedHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
          embedHtml.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];

        // ----------------------
        // HUBCLOUD FALLBACK DETECTION
        // ----------------------
        const hubMatch = embedHtml.match(
          /https?:\/\/hubcloud[^"'<> ]+hubcloud\.php[^"'<> ]+/i
        );

        if (hubMatch) {
          const resolved = await resolveHubcloudApi(hubMatch[0]);
          if (resolved) m3u8 = resolved;
        }

        // convert master.txt
        if (m3u8 && m3u8.includes("master.txt")) {
          m3u8 = m3u8.replace("master.txt", "master.m3u8");
        }

        // ❌ filter junk
        if (!m3u8) continue;
        if (m3u8.includes(".apk")) continue;
        if (m3u8.includes("Movies4u.apk")) continue;

        streams.push({
          name: "Movies4u",
          title: "HubCloud Stream",
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

    return streams;
  } catch (e) {
    console.error("[Movies4u]", e);
    return [];
  }
}

module.exports = {
  getStreams,
};
