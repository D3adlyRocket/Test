// movies4u.js
// Safe fixed version (keeps working flow + adds HubCloud properly)

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

// ---------------- BASE URL ----------------
async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;

  try {
    const resp = await fetch(DOMAINS_URL, { skipSizeCheck: true });
    const data = await resp.json();
    cachedBaseUrl = data.movies4u || data.movies4uhd || FALLBACK_URL;
  } catch {
    cachedBaseUrl = FALLBACK_URL;
  }

  return cachedBaseUrl;
}

// ---------------- QUALITY ----------------
function extractQuality(t) {
  t = (t || "").toLowerCase();
  if (t.includes("2160") || t.includes("4k")) return "4K";
  if (t.includes("1080")) return "1080p";
  if (t.includes("720")) return "720p";
  if (t.includes("480")) return "480p";
  return "Unknown";
}

// ---------------- HUB RESOLVE (SAFE) ----------------
async function resolveHubcloud(url) {
  try {
    const id = url.match(/[?&]id=([^&]+)/)?.[1];
    const token = url.match(/[?&]token=([^&]+)/)?.[1];

    if (!id || !token) return null;

    const api =
      `https://hubcloud.php?host=hubcloud&id=${id}&token=${encodeURIComponent(token)}`;

    const res = await fetch(api, {
      headers: HEADERS,
      skipSizeCheck: true,
    });

    const html = await res.text();

    return (
      html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
      html.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i)?.[0] ||
      null
    );
  } catch {
    return null;
  }
}

// ---------------- MAIN ----------------
async function getStreams(tmdbId, mediaType = "movie") {
  try {
    const BASE_URL = await getBaseUrl();

    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // SEARCH
    const searchResp = await fetch(
      `${BASE_URL}/?s=${encodeURIComponent(title)}`,
      { headers: HEADERS }
    );

    const searchHtml = await searchResp.text();
    const $ = cheerio.load(searchHtml);

    const results = [];

    $("article").each((_, el) => {
      const a = $(el).find("a").first();
      const href = a.attr("href");
      const name = a.text().trim();

      if (href && name) results.push({ href, name });
    });

    if (!results.length) return [];

    const match =
      results.find((r) =>
        r.name.toLowerCase().includes(title.toLowerCase())
      ) || results[0];

    if (!match) return [];

    // MOVIE PAGE
    const movieResp = await fetch(match.href, { headers: HEADERS });
    const movieHtml = await movieResp.text();
    const $m = cheerio.load(movieHtml);

    const watchLinks = [];

    $m("a.btn.btn-zip").each((_, el) => {
      const href = $m(el).attr("href");
      if (href) watchLinks.push(href);
    });

    const streams = [];

    // ---------------- STREAMS ----------------
    for (const link of watchLinks.slice(0, 5)) {
      try {
        const embed = await fetch(link, {
          headers: { ...HEADERS, Referer: BASE_URL + "/" },
        });

        const html = await embed.text();

        let stream =
          html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
          html.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i)?.[0];

        // 🔥 HUBCLOUD SAFE DETECT (NOT STRICT)
        const hub =
          html.match(/hubcloud\.php\?host=hubcloud[^"'<> ]+/i)?.[0];

        if (hub && !stream) {
          const resolved = await resolveHubcloud(hub);
          if (resolved) stream = resolved;
        }

        if (!stream) continue;

        if (stream.includes(".apk")) continue;

        streams.push({
          name: "Movies4u",
          title: "Stream",
          quality: extractQuality(stream),
          url: stream,
          headers: {
            Referer: "https://m4uplay.store/",
            "User-Agent": HEADERS["User-Agent"],
          },
          subtitles: [],
        });
      } catch {}
    }

    return streams;
  } catch (e) {
    console.error("[Movies4u]", e);
    return [];
  }
}

module.exports = { getStreams };
