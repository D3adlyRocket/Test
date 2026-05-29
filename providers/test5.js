// movies4u.js  
// Fixed + Stable Nuvio-compatible Movies4u provider (TEST PATCH)

const cheerio = require("cheerio");

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";  
const FALLBACK_URL = "https://new1.movies4u.finance";  
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";  
const HUB_CLOUD_API = "https://hc-zf3c.vercel.app";

const HEADERS = {  
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",  
  "Referer": FALLBACK_URL,
  "Cookie": "xla=s4t"
};

let cachedBaseUrl = null;

// ---------------- BASE URL ----------------
async function getBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;

  try {
    const resp = await fetch(DOMAINS_URL);
    const data = await resp.json();
    cachedBaseUrl = data.movies4u || data.movies4uhd || FALLBACK_URL;
  } catch {
    cachedBaseUrl = FALLBACK_URL;
  }

  return cachedBaseUrl;
}

// ---------------- QUALITY ----------------
function extractQuality(text = "") {
  const u = text.toLowerCase();

  if (u.match(/\b2160p\b|\b4k\b|\buhd\b/)) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  if (u.includes("360")) return "360p";

  return "Unknown";
}

// ---------------- M3U8 QUALITY (FIXED CORE) ----------------
async function parseM3U8Quality(url) {
  try {
    const resp = await fetch(url);
    const text = await resp.text();

    const matches = [...text.matchAll(/RESOLUTION=(\d+)x(\d+)/g)];
    if (!matches.length) return null;

    let best = 0;

    for (const m of matches) {
      const h = parseInt(m[2]);
      if (h > best) best = h;
    }

    if (best >= 2160) return "4K";
    if (best >= 1080) return "1080p";
    if (best >= 720) return "720p";
    if (best >= 480) return "480p";

    return "Unknown";
  } catch {
    return null;
  }
}

// ---------------- META ----------------
function parseExtraMetadata(text = "") {
  const norm = text.toUpperCase();

  let lang = "Multi-Audio";
  if (norm.includes("DUAL")) lang = "Dual Audio";
  if (norm.includes("HINDI") && norm.includes("ENGLISH")) lang = "Dual Audio";

  const size = norm.match(/(\d+(\.\d+)?\s*(GB|MB))/i)?.[0] || "N/A";

  let format = "MKV";
  if (norm.includes("MP4")) format = "MP4";
  if (norm.includes("265") || norm.includes("HEVC")) format += " (x265)";
  if (norm.includes("264")) format += " (x264)";

  return {
    language: lang,
    size,
    format,
    extras: norm.includes("HDR") ? "HDR" : "Standard"
  };
}

// ---------------- SAFE DOM SCRAPER (FIXED) ----------------
function extractLinks($page) {
  const links = [];

  // BROAD + SAFE (fixes your "no streams" issue)
  $page("*").each((_, el) => {
    const node = $page(el);

    let href = node.attr("href") || "";

    // fallback: parent anchor
    if (!href) {
      const parentA = node.closest("a");
      if (parentA.length) href = parentA.attr("href") || "";
    }

    if (
      href &&
      (
        href.includes("m4uplay") ||
        href.includes("hubcloud") ||
        href.includes("m4ulinks")
      )
    ) {
      links.push({
        href,
        text: node.text()
      });
    }
  });

  return links;
}

// ---------------- DIRECT M3U8 ----------------
async function extractDirectM3u8(url) {
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, Referer: "https://m4uplay.store/" }
    });

    const html = await res.text();

    return html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] || null;
  } catch {
    return null;
  }
}

// ---------------- MAIN ----------------
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    // TMDB
    const tmdb = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`
    ).then(r => r.json());

    const title = tmdb.title || tmdb.name;
    if (!title) return [];

    // SEARCH (FIXED fallback logic)
    const searchHtml = await fetch(
      `${BASE_URL}/?s=${encodeURIComponent(title)}`
    ).then(r => r.text());

    const $ = cheerio.load(searchHtml);

    const results = [];

    $("article a").each((_, el) => {
      const href = $(el).attr("href");
      const name = $(el).text()?.trim();

      if (href && name) {
        results.push({ href, name });
      }
    });

    const match =
      results.find(r => r.name?.toLowerCase().includes(title.toLowerCase())) ||
      results[0];

    if (!match) return [];

    // PAGE
    const pageHtml = await fetch(match.href).then(r => r.text());
    const $page = cheerio.load(pageHtml);

    const links = extractLinks($page);

    if (!links.length) {
      console.log("[Movies4u] No links found on page");
      return [];
    }

    const streams = [];

    for (const l of links) {
      const direct = await extractDirectM3u8(l.href);

      if (!direct) continue;

      const m3u8Quality = await parseM3U8Quality(direct);

      const meta = parseExtraMetadata(l.text);

      streams.push({
        server: "M4U Player",
        quality: m3u8Quality || extractQuality(l.text) || "1080p",
        meta,
        url: direct,
        headers: {
          Referer: "https://m4uplay.store/",
          Origin: "https://m4uplay.store",
          "User-Agent": HEADERS["User-Agent"]
        }
      });
    }

    // SORT
    const weight = { "4K": 100, "1080p": 50, "720p": 25, "480p": 10 };

    streams.sort((a, b) => (weight[b.quality] || 0) - (weight[a.quality] || 0));

    // OUTPUT
    return streams.map(s => ({
      name: `Movies4u | ${s.quality} | [${s.server}]`,
      title: `🎬 ${title}\n⚡ ${s.quality} | 🌍 ${s.meta.language} | 💾 ${s.meta.size}\n🎞️ ${s.meta.format}`,
      quality: s.quality,
      url: s.url,
      headers: s.headers,
      subtitles: []
    }));

  } catch (e) {
    console.error("[Movies4u ERROR]", e);
    return [];
  }
}

module.exports = { getStreams };
