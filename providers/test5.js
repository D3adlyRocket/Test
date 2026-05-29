// movies4u.js
// Fixed Nuvio-compatible Movies4u provider (stable + corrected quality handling)

const cheerio = require("cheerio");

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const HUB_CLOUD_API = "https://hc-zf3c.vercel.app";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Referer": FALLBACK_URL,
  "Cookie": "xla=s4t"
};

let cachedBaseUrl = null;

/* ---------------- BASE URL ---------------- */
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

/* ---------------- QUALITY DETECTION ---------------- */
function extractQuality(text = "") {
  const u = text.toLowerCase();

  if (u.includes("2160") || u.includes("4k") || u.includes("uhd")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  if (u.includes("360")) return "360p";

  return "Unknown";
}

/* ---------------- METADATA ---------------- */
function parseExtraMetadata(text = "") {
  const norm = text.toUpperCase();

  let lang = "Multi-Audio";
  if (norm.includes("DUAL")) lang = "Multi Audio";
  if (norm.includes("ENGLISH") && !norm.includes("HINDI")) lang = "English";

  const sizeMatch = norm.match(/(\d+(?:\.\d+)?\s*[MGB]B)/i);
  let size = sizeMatch ? sizeMatch[0].replace(/\s+/g, "") : "N/A";

  if (size === "N/A") {
    const backupMatch = norm.match(/(\d+\.\d+)\s?G/);
    if (backupMatch) size = backupMatch[1] + "GB";
  }

  let format = "MKV";
  if (norm.includes("MP4")) format = "MP4";
  if (norm.includes("HEVC") || norm.includes("H265") || norm.includes("X265"))
    format += " (x265)";
  else if (norm.includes("H264") || norm.includes("X264")) format += " (x264)";

  const extras = [];
  if (norm.includes("HDR")) extras.push("HDR");
  if (norm.includes("ATMOS") || norm.includes("DOLBY")) extras.push("Dolby");
  if (norm.includes("10BIT")) extras.push("10-Bit");
  if (norm.includes("REMUX")) extras.push("Remux");

  return {
    language: lang,
    size,
    format,
    extras: extras.length ? extras.join(" | ") : "Standard"
  };
}

/* ---------------- QUALITY FIX (IMPORTANT PART) ---------------- */
function resolveBestQuality({ detected, url, text }) {
  // priority order (FIXES YOUR ISSUE)
  return (
    detected ||
    extractQuality(url) ||
    extractQuality(text) ||
    "1080p"
  );
}

/* ---------------- HUB CLOUD ---------------- */
function cleanServerName(serverText = "") {
  let clean = serverText.toLowerCase();

  if (clean.includes("fsl") || clean.includes("fast")) return "FSL Server";
  if (clean.includes("pixel")) return "PixelDrain";
  if (clean.includes("drive")) return "Cloud Drive";

  return "HubCloud Server";
}

async function resolveAllHubCloudLinks(url) {
  try {
    const api = `${HUB_CLOUD_API}/api/extract?url=${encodeURIComponent(url)}`;
    const resp = await fetch(api, { headers: { Accept: "application/json" } });
    const data = await resp.json();
    return data?.links || [];
  } catch {
    return [];
  }
}

/* ---------------- DIRECT M3U8 ---------------- */
async function extractDirectM3u8(url) {
  try {
    const resp = await fetch(url, {
      headers: { ...HEADERS, Referer: "https://m4uplay.store/" }
    });

    const html = await resp.text();

    let m3u8 =
      html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
      html.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];

    if (m3u8) return m3u8.replace("master.txt", "master.m3u8");
  } catch {}

  return null;
}

/* ---------------- STREAM ROUTER ---------------- */
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    const year = (mediaInfo.release_date || mediaInfo.first_air_date || "").split("-")[0];

    const searchResp = await fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`);
    const $ = cheerio.load(await searchResp.text());

    const first = $("article a").first().attr("href");
    if (!first) return [];

    const pageResp = await fetch(first);
    const $page = cheerio.load(await pageResp.text());

    const streams = [];

    const links = [];
    $page("a[href*='m4uplay']").each((_, el) => {
      links.push($(el).attr("href"));
    });

    for (const link of links) {
      const direct = await extractDirectM3u8(link);
      if (!direct) continue;

      const detectedQuality = extractQuality(direct);

      streams.push({
        server: "Player Direct",
        quality: resolveBestQuality({
          detected: detectedQuality,
          url: direct,
          text: title
        }),
        meta: parseExtraMetadata(title),
        url: direct,
        headers: {
          Referer: "https://m4uplay.store/",
          Origin: "https://m4uplay.store",
          "User-Agent": HEADERS["User-Agent"]
        }
      });
    }

    return streams.map(s => ({
      name: `Movies4u | ${s.quality} | [${s.server}]`,
      title: `${title} - ${year}\n${s.quality} | ${s.meta.language} | ${s.meta.size}`,
      url: s.url,
      headers: s.headers,
      quality: s.quality,
      subtitles: []
    }));

  } catch (e) {
    console.error("[Movies4u ERROR]", e);
    return [];
  }
}

module.exports = { getStreams };
