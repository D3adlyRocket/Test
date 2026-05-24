const cheerio = require("cheerio");

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

// Proxy (critical for Nuvio reliability)
const PROXY = (url) =>
  `https://r.jina.ai/http://${url}`;

async function fetchText(url) {
  try {
    const res = await fetch(PROXY(url));
    return await res.text();
  } catch (e) {
    return "";
  }
}

function extractQuality(text = "") {
  const u = text.toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  return "Unknown";
}

// Extract any playable links from HTML
async function extractStreamsFromHtml(url, label = "TEST STREAM") {
  const html = await fetchText(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const streams = [];

  $("iframe, video source, source, a").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("href");
    if (!src) return;

    const full = src.startsWith("http") ? src : "https:" + src;

    if (
      full.includes(".mp4") ||
      full.includes(".m3u8") ||
      full.includes("stream") ||
      full.includes("cdn") ||
      full.includes("googlevideo")
    ) {
      streams.push({
        url: full,
        quality: extractQuality(full),
        title: label,
        subtitles: []
      });
    }
  });

  return streams;
}

async function getStreams(tmdbId, mediaType) {
  try {
    // -------------------------
    // 1. TMDB TEST (PROVES API WORKS)
    // -------------------------
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const media = await (await fetch(tmdbUrl)).json();

    const title = media.title || media.name;
    if (!title) return [];

    console.log("[NUVIO TEST] Title:", title);

    // -------------------------
    // 2. CONTROL TEST SOURCE (SAFE PUBLIC PAGE)
    // -------------------------
    // This page contains predictable media/iframe structures
    const testUrl = "https://www.sample-videos.com/";

    const streams = await extractStreamsFromHtml(
      testUrl,
      `NUVIO TEST - ${title}`
    );

    // -------------------------
    // 3. FALLBACK TEST (DIRECT VIDEO SAMPLE)
    // -------------------------
    streams.push({
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      quality: "1080p",
      title: `NUVIO FALLBACK - ${title}`,
      subtitles: []
    });

    return streams;
  } catch (e) {
    console.log("[NUVIO TEST ERROR]", e);
    return [];
  }
}

module.exports = {
  getStreams
};
