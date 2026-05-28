// movies4u.js
// Multi-stream FIXED provider (Scraper + API + Host Resolver)

const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_URL = "https://new1.movies4u.finance";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Referer": FALLBACK_URL,
  "Cookie": "xla=s4t"
};

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

function getHost(url = "") {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function isValidStream(url = "") {
  return (
    url.includes("http") &&
    !url.includes("telegram") &&
    !url.includes("javascript:")
  );
}

// =======================
// MAIN
// =======================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const BASE_URL = await getBaseUrl();

    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const mediaInfo =
      await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    const streams = [];
    const seenHosts = new Set();

    // =========================================================
    // 1. SCRAPER PIPELINE (MULTI-HOST EXTRACTION)
    // =========================================================

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
      results.find(r => r.name.toLowerCase().includes(title.toLowerCase())) ||
      results[0];

    const movieResp = await fetch(match.href, {
      headers: HEADERS,
      skipSizeCheck: true
    });

    const movieHtml = await movieResp.text();
    const $movie = cheerio.load(movieHtml);

    const links = [];

    // collect ALL possible hosts
    $movie("a[href]").each((i, el) => {
      const href = $movie(el).attr("href") || "";
      if (isValidStream(href)) links.push(href);
    });

    const uniqueLinks = [...new Set(links)];

    // =========================================================
    // 2. RESOLVE EMBEDS → EXTRACT MULTI STREAMS
    // =========================================================

    for (const link of uniqueLinks.slice(0, 8)) {
      try {
        const res = await fetch(link, {
          headers: { ...HEADERS, Referer: BASE_URL + "/" },
          skipSizeCheck: true
        });

        const html = await res.text();

        const found = [];

        // direct m3u8
        const direct = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0];
        if (direct) found.push(direct);

        // master
        const master = html.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];
        if (master) found.push(master.replace("master.txt", "master.m3u8"));

        // iframe hop (GDFlix / HubCloud fix)
        const iframe = html.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
        if (iframe) {
          try {
            const ires = await fetch(iframe, { headers: HEADERS, skipSizeCheck: true });
            const ih = await ires.text();

            const i1 = ih.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i)?.[0];
            const i2 = ih.match(/https?:\/\/[^\s"'<>]+master\.txt[^\s"'<>]*/i)?.[0];

            if (i1) found.push(i1);
            if (i2) found.push(i2.replace("master.txt", "master.m3u8"));
          } catch {}
        }

        for (const url of found) {
          if (!url) continue;

          const host = getHost(url);
          if (seenHosts.has(host)) continue; // IMPORTANT DEDUPE BY HOST

          seenHosts.add(host);

          streams.push({
            name: `Movies4u (${host})`,
            title: `Movies4u Stream • ${extractQuality(url)}`,
            url,
            quality: extractQuality(url),
            subtitles: []
          });
        }

      } catch {}
    }

    // =========================================================
    // 3. API PIPELINE (MULTI STREAM SOURCE)
    // =========================================================

    try {
      const apiBase = "https://badboysxs-murph-api.hf.space";

      const apiUrl =
        mediaType === "tv"
          ? `${apiBase}/api/mfu/series?q=${encodeURIComponent(title)}&season=${season || 1}&episode=${episode || 1}`
          : `${apiBase}/api/mfu/movie?q=${encodeURIComponent(title)}`;

      const apiResp = await fetch(apiUrl, { skipSizeCheck: true });
      const apiData = await apiResp.json();

      if (apiData?.results?.length) {
        for (const row of apiData.results) {
          const url =
            row.direct_url ||
            row.episodes?.[0]?.direct_url;

          if (!url) continue;

          const host = getHost(url);
          if (seenHosts.has(host)) continue;

          seenHosts.add(host);

          streams.push({
            name: `Movies4u API (${host})`,
            title: `API • ${row.quality || "HD"} • ${row.audio_lang || "Original"}`,
            url,
            quality: row.quality || "HD",
            subtitles: []
          });
        }
      }
    } catch {}

    return streams;

  } catch (e) {
    console.error("[Movies4u]", e);
    return [];
  }
}

module.exports = { getStreams };
