const cheerio = require("cheerio-without-node-native");

// ============================================================
// OnePace Provider (FINAL FIXED VERSION)
// ============================================================

const BASE_URL = "https://onepace.co";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Referer": BASE_URL + "/"
};

// ============================================================
// Safe fetch
// ============================================================

async function safeFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (e) {
    console.log("[Fetch error]", e);
    return null;
  }
}

// ============================================================
// Extract m3u8 (robust)
// ============================================================

function extractM3U8(html) {
  if (!html) return null;

  return (
    html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/i)?.[0] ||
    html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i)?.[1] ||
    html.match(/source\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i)?.[1]
  );
}

// ============================================================
// Resolve embed → stream
// ============================================================

async function resolveEmbed(url, referer) {
  try {
    const res = await safeFetch(url, {
      headers: {
        ...HEADERS,
        Referer: referer || BASE_URL
      }
    });

    if (!res) return null;

    const html = await res.text();

    const m3u8 = extractM3U8(html);

    if (!m3u8) return null;

    return {
      url: m3u8,
      referer: url,
      origin: new URL(url).origin
    };

  } catch (e) {
    console.log("[resolveEmbed error]", e);
    return null;
  }
}

// ============================================================
// MAIN FUNCTION
// ============================================================

async function getStreams(tmdbId, mediaType, season, episode) {

  try {

    const streams = [];

    // ========================================================
    // Load OnePace series page
    // ========================================================

    const seriesRes = await safeFetch(
      `${BASE_URL}/series/one-pace-english-sub/`,
      { headers: HEADERS }
    );

    if (!seriesRes) return [];

    const seriesHtml = await seriesRes.text();

    const doc = cheerio.load(seriesHtml);

    // ========================================================
    // Build episode list (ORDERED)
    // ========================================================

    const episodes = [];

    doc("ul.seasons-lst.anm-a li").each((_, el) => {

      const $el = doc(el);

      const href = $el.find("a").attr("href");
      const title = $el.text().trim();

      if (href) {
        episodes.push({ href, title });
      }
    });

    if (!episodes.length) return [];

    console.log("[OnePace] Episodes:", episodes.length);

    // ========================================================
    // Select correct episode
    // ========================================================

    const epIndex = Math.max(0, parseInt(episode || 1) - 1);
    const selected = episodes[epIndex] || episodes[0];

    const epUrl = selected.href.startsWith("http")
      ? selected.href
      : BASE_URL + selected.href;

    console.log("[OnePace] Selected:", selected.title);

    // ========================================================
    // Load episode page
    // ========================================================

    const epRes = await safeFetch(epUrl, {
      headers: HEADERS
    });

    if (!epRes) return [];

    const epHtml = await epRes.text();
    const epDoc = cheerio.load(epHtml);

    // ========================================================
    // CRITICAL: keep original OnePace server system
    // ========================================================

    const bodyClass = epDoc("body").attr("class") || "";
    const termMatch = bodyClass.match(/(?:term|postid)-(\d+)/);

    if (!termMatch) return [];

    const term = termMatch[1];

    console.log("[OnePace] Term:", term);

    // ========================================================
    // SERVER LOOP (FIXED CORE ISSUE)
    // ========================================================

    const seenHosts = new Set();

    for (let i = 0; i <= 7; i++) {

      try {

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

        // ====================================================
        // Resolve embed
        // ====================================================

        const resolved = await resolveEmbed(src, iframeUrl);

        if (!resolved?.url) continue;

        const host = new URL(resolved.url).host;

        // 🔥 IMPORTANT: prevent duplicate CDN streams
        if (seenHosts.has(host)) continue;

        seenHosts.add(host);

        streams.push({
          name: "OnePace",
          url: resolved.url,
          quality: "1080p",
          type: "hls",
          title: `OnePace Server ${i + 1}`,
          subtitles: [],

          behaviorHints: {
            notWebReady: false,
            proxyHeaders: {
              request: {
                ...HEADERS,
                Referer: resolved.referer,
                Origin: resolved.origin
              }
            }
          }
        });

      } catch (e) {
        console.log("[Server error]", e);
      }
    }

    // ========================================================
    // Final dedupe (extra safety)
    // ========================================================

    const final = [];
    const seen = new Set();

    for (const s of streams) {
      if (!seen.has(s.url)) {
        seen.add(s.url);
        final.push(s);
      }
    }

    console.log("[OnePace] Final streams:", final.length);

    return final;

  } catch (e) {
    console.log("[OnePace fatal]", e);
    return [];
  }
}

module.exports = { getStreams };
