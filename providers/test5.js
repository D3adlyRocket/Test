const cheerio = require("cheerio-without-node-native");

const BASE_URL = "https://onepace.co";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36",
  "Referer": BASE_URL + "/"
};

// =====================================================
// SAFE FETCH
// =====================================================

async function safeFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (e) {
    return null;
  }
}

// =====================================================
// EXTRACT M3U8 (STRICT - no fallback abuse)
// =====================================================

function extractM3U8(html) {
  if (!html) return null;

  const match =
    html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/i);

  if (!match) return null;

  const url = match[0];

  // ❌ FILTER OUT GLOBAL FALLBACK CDNs
  if (
    url.includes("turboviplay") &&
    url.includes("/data3/")
  ) {
    return null;
  }

  return url;
}

// =====================================================
// RESOLVE EMBED
// =====================================================

async function resolveEmbed(url, referer) {

  const res = await safeFetch(url, {
    headers: {
      ...HEADERS,
      Referer: referer
    }
  });

  if (!res) return null;

  const html = await res.text();

  return extractM3U8(html);
}

// =====================================================
// MAIN
// =====================================================

async function getStreams(tmdbId, mediaType, season, episode) {

  try {

    const streams = [];

    // =====================================================
    // SERIES PAGE
    // =====================================================

    const seriesRes = await safeFetch(
      `${BASE_URL}/series/one-pace-english-sub/`,
      { headers: HEADERS }
    );

    if (!seriesRes) return [];

    const doc = cheerio.load(await seriesRes.text());

    const episodes = [];

    doc("ul.seasons-lst.anm-a li").each((_, el) => {

      const href = doc(el).find("a").attr("href");

      if (href) {
        episodes.push(href);
      }
    });

    if (!episodes.length) return [];

    const epIndex = Math.max(0, parseInt(episode || 1) - 1);

    const epUrl = episodes[epIndex]
      ? (episodes[epIndex].startsWith("http")
          ? episodes[epIndex]
          : BASE_URL + episodes[epIndex])
      : BASE_URL + episodes[0];

    // =====================================================
    // EPISODE PAGE
    // =====================================================

    const epRes = await safeFetch(epUrl, {
      headers: HEADERS
    });

    if (!epRes) return [];

    const epHtml = await epRes.text();

    const epDoc = cheerio.load(epHtml);

    const bodyClass = epDoc("body").attr("class") || "";
    const termMatch = bodyClass.match(/(?:term|postid)-(\d+)/);

    if (!termMatch) return [];

    const term = termMatch[1];

    // =====================================================
    // SERVER LOOP (KEY FIX HERE)
    // =====================================================

    const seen = new Set();

    for (let i = 0; i <= 7; i++) {

      const iframeUrl =
        `${BASE_URL}/?trdekho=${i}&trid=${term}&trtype=2`;

      const iframeRes = await safeFetch(iframeUrl, {
        headers: HEADERS
      });

      if (!iframeRes) continue;

      const iframeHtml = await iframeRes.text();

      const $ = cheerio.load(iframeHtml);

      let src = $("iframe").attr("src");

      if (!src) continue;

      if (!src.startsWith("http")) {
        src = new URL(src, BASE_URL).href;
      }

      const m3u8 = await resolveEmbed(src, iframeUrl);

      if (!m3u8) continue;

      // 🔥 CRITICAL FIX:
      // prevent SAME CDN reused across episodes/servers
      const key = m3u8.split("?")[0];

      if (seen.has(key)) continue;

      seen.add(key);

      streams.push({
        name: "OnePace",
        url: m3u8,
        quality: "1080p",
        type: "hls",
        title: `Server ${i + 1}`,
        subtitles: [],

        behaviorHints: {
          notWebReady: false,
          proxyHeaders: {
            request: {
              ...HEADERS,
              Referer: src,
              Origin: new URL(src).origin
            }
          }
        }
      });
    }

    return streams;

  } catch (e) {
    console.log("[Fatal]", e);
    return [];
  }
}

module.exports = { getStreams };
