const cheerio = require("cheerio");

const PROXY = (url) =>
  `https://r.jina.ai/http://${url}`;

async function fetchText(url) {
  const res = await fetch(PROXY(url));
  return await res.text();
}

function extractQuality(text = "") {
  const u = text.toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  return "Unknown";
}

// 🔥 CORE: iframe + media sniffing
async function resolveIframe(url, label = "STREAM") {
  try {
    const html = await fetchText(url);
    if (!html) return [];

    const $ = cheerio.load(html);
    const streams = [];

    // iframe sources
    $("iframe").each((_, el) => {
      const src = $(el).attr("src");
      if (!src) return;

      const full = src.startsWith("http") ? src : "https:" + src;

      streams.push({
        url: full,
        quality: "Unknown",
        title: label,
        subtitles: []
      });
    });

    // direct media
    $("source, video source").each((_, el) => {
      const src = $(el).attr("src");
      if (!src) return;

      const full = src.startsWith("http") ? src : "https:" + src;

      if (
        full.includes(".mp4") ||
        full.includes(".m3u8") ||
        full.includes("stream") ||
        full.includes("cdn")
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
  } catch (e) {
    return [];
  }
}

async function getStreams(testUrl) {
  try {
    const streams = await resolveIframe(testUrl, "IFRAME TEST");
    return streams;
  } catch (e) {
    return [];
  }
}

module.exports = { getStreams };
