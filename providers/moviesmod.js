// movies4u.js
// Nuvio-compatible Movies4u provider (FIXED: FSL + HubCloud + TV seasons)

const cheerio = require("cheerio");

const DOMAINS_URL =
  "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Cookie: "xla=s4t",
};

let cachedBaseUrl = null;

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

function extractQuality(text = "") {
  const u = text.toLowerCase();
  if (u.includes("2160") || u.includes("4k")) return "4K";
  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  return "Unknown";
}

/* =========================
   IMPROVED CLOUD RESOLVER
========================= */
async function resolveCloudStream(shortenerUrl) {
  try {
    const res1 = await fetch(shortenerUrl, {
      headers: HEADERS,
      redirect: "follow",
      skipSizeCheck: true,
    });

    const finalUrl = res1.url;
    const html1 = await res1.text();

    // 🔥 direct stream detection
    let direct =
      html1.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
      html1.match(/https?:\/\/[^\s"'<>]+\/playlist\.m3u8[^\s"'<>]*/i)?.[0];

    if (direct) return direct;

    let gateway =
      html1.match(/window\.location\.replace\(['"](.*?)['"]\)/)?.[1] ||
      html1.match(
        /meta\s+http-equiv=["']refresh["']\s+content=["']\d+;\s*url=(.*?)["']/i
      )?.[1];

    if (!gateway && finalUrl !== shortenerUrl) gateway = finalUrl;
    if (!gateway) return null;

    const res2 = await fetch(gateway, {
      headers: { ...HEADERS, Referer: shortenerUrl },
      skipSizeCheck: true,
    });

    const html2 = await res2.text();

    // iframe fallback (FSL / HubCloud / GDFlix)
    const iframe =
      html2.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1] ||
      html2.match(
        /src=["'](https?:\/\/(?:hubcloud|fsl|gdflix|player)[^"']+)["']/i
      )?.[1];

    if (iframe) {
      const res3 = await fetch(iframe, {
        headers: { ...HEADERS, Referer: gateway },
        skipSizeCheck: true,
      });

      const html3 = await res3.text();

      return (
        html3.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0] ||
        html3.match(/https?:\/\/[^\s"'<>]+\/download\?[^"'<>]*/i)?.[0] ||
        null
      );
    }

    return null;
  } catch (e) {
    return null;
  }
}

/* =========================
   MAIN STREAM FUNCTION
========================= */
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();
    const streams = [];

    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    const searchResp = await fetch(
      `${BASE_URL}/?s=${encodeURIComponent(title)}`,
      { headers: HEADERS, skipSizeCheck: true }
    );

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
      results.find((r) =>
        r.name.toLowerCase().includes(title.toLowerCase())
      ) || results[0];

    const movieResp = await fetch(match.href, {
      headers: HEADERS,
      skipSizeCheck: true,
    });

    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    /* =========================
       STRATEGY A: STREAM LINKS
    ========================= */
    const watchLinks = [];

    $movie("a.btn.btn-zip, div.download-links-div a[href], a[href]").each(
      (i, el) => {
        const href = $movie(el).attr("href");
        const text = ($movie(el).text() || "").toLowerCase();

        if (
          href &&
          (href.includes("m4uplay") ||
            href.includes("m4ufree") ||
            href.includes("m4ulinks") ||
            text.includes("fsl") ||
            text.includes("hub") ||
            text.includes("cloud"))
        ) {
          watchLinks.push(href);
        }
      }
    );

    for (const watchLink of watchLinks.slice(0, 5)) {
      try {
        const embedResp = await fetch(watchLink, {
          headers: { ...HEADERS, Referer: BASE_URL + "/" },
          skipSizeCheck: true,
        });

        const embedHtml = await embedResp.text();

        let m3u8 =
          embedHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0];

        if (m3u8) {
          streams.push({
            name: "Movies4u",
            title: "Direct Stream",
            quality: extractQuality(m3u8),
            url: m3u8,
            headers: {
              Referer: "https://m4uplay.store/",
              Origin: "https://m4uplay.store",
              "User-Agent": HEADERS["User-Agent"],
            },
            subtitles: [],
          });
        }
      } catch (_) {}
    }

    /* =========================
       STRATEGY B: CLOUD LINKS
    ========================= */
    const rawDownloadButtons = [];

    $movie(
      "div.downloads-btns-div a[href], div.download-links-div a[href], li a[href]"
    ).each((i, el) => {
      const href = $movie(el).attr("href");
      const text = ($movie(el).text() || "").trim();

      if (!href) return;

      if (
        href.includes("m4ulinks") ||
        href.includes("hub") ||
        href.includes("fsl") ||
        href.includes("gdflix") ||
        text.match(/fsl|hub|cloud|download|server|mirror/i)
      ) {
        rawDownloadButtons.push({ href, text });
      }
    });

    const processed = new Set();

    for (const btn of rawDownloadButtons.slice(0, 15)) {
      try {
        const resolved = await resolveCloudStream(btn.href);

        if (resolved && !processed.has(resolved)) {
          processed.add(resolved);

          streams.push({
            name: "Movies4u (Cloud)",
            title: btn.text || "Cloud Stream",
            quality: extractQuality(btn.text + resolved),
            url: resolved,
            headers: {
              "User-Agent": HEADERS["User-Agent"],
              Referer: "https://gamerxyt.com/",
            },
            subtitles: [],
          });
        }
      } catch (_) {}
    }

    /* =========================
       TV FIX (IMPORTANT)
    ========================= */
    if (mediaType !== "movie") {
      const seasonLinks = [];

      $movie("div.download-links-div h4").each((i, el) => {
        const h4Text = $movie(el).text();
        const sMatch = h4Text.match(/Season\s*(\d+)/i);
        if (!sMatch) return;

        const sNum = parseInt(sMatch[1]);
        if (season && sNum !== parseInt(season)) return;

        const nextEl = $movie(el).next();

        nextEl.find("a[href]").each((j, a) => {
          const href = $movie(a).attr("href");
          if (href) seasonLinks.push({ href, season: sNum });
        });
      });

      for (const { href, season: sNum } of seasonLinks.slice(0, 5)) {
        try {
          const resolved = await resolveCloudStream(href);

          if (resolved) {
            streams.push({
              name: "Movies4u TV",
              title: `S${sNum}`,
              quality: extractQuality(resolved),
              url: resolved,
              subtitles: [],
            });
          }
        } catch (_) {}
      }
    }

    return streams;
  } catch (e) {
    return [];
  }
}

module.exports = {
  getStreams,
};
