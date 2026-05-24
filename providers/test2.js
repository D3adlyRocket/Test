// fourkHDhub.js
// 4K HDHUB provider - Nuvio compatible scraper

const BASE_URL = "https://4khdhub.dad";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  "Referer": `${BASE_URL}/`
};

// ⚠️ Nuvio may or may not provide cheerio globally
const cheerio = require("cheerio");

function extractQuality(str = "") {
  const u = str.toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  return "Unknown";
}

async function resolveRedirect(rawUrl) {
  try {
    if (!rawUrl.includes("id=")) return rawUrl;

    const resp = await fetch(rawUrl, {
      headers: HEADERS,
      redirect: "follow"
    });

    return resp.url || rawUrl;
  } catch (e) {
    console.log("[redirect error]", e);
    return rawUrl;
  }
}

async function resolveHubCloud(url) {
  try {
    const html1 = await (await fetch(url, { headers: HEADERS })).text();
    const $1 = cheerio.load(html1);

    let href = $1("#download").attr("href");
    if (!href) return null;

    if (!href.startsWith("http")) {
      const base = url.match(/^(https?:\/\/[^/]+)/)?.[1] || "";
      href = base + "/" + href.replace(/^\//, "");
    }

    const html2 = await (await fetch(href, { headers: HEADERS })).text();
    const $2 = cheerio.load(html2);

    const header = $2("div.card-header").text();
    const quality = extractQuality(header);

    const streams = [];

    $2("a.btn").each((_, el) => {
      const link = $2(el).attr("href");
      const label = ($2(el).text() || "").toLowerCase().trim();

      if (!link) return;

      if (link.match(/\.(mp4|mkv|m3u8)/i)) {
        streams.push({
          url: link,
          quality,
          title: `4KHDHUB [${label}]`
        });
      } else if (
        label.includes("download") ||
        label.includes("server") ||
        label.includes("fsl") ||
        link.startsWith("http")
      ) {
        streams.push({
          url: link,
          quality,
          title: `4KHDHUB [${label}]`
        });
      }
    });

    return streams.length ? streams : null;
  } catch (e) {
    console.log("[hubcloud error]", e);
    return null;
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. TMDB lookup
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    if (!mediaInfo) return [];

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search site
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
    const searchHtml = await (await fetch(searchUrl, { headers: HEADERS })).text();
    const $ = cheerio.load(searchHtml);

    const results = [];

    $("div.card-grid a").each((_, el) => {
      const href = $(el).attr("href");
      const t = $("h3", el).text().trim();

      if (href) {
        results.push({ title: t, url: href });
      }
    });

    if (!results.length) return [];

    const lcTitle = title.toLowerCase();
    let match = results.find(r => r.title.toLowerCase().includes(lcTitle));
    if (!match) match = results[0];

    const pageUrl = match.url.startsWith("http")
      ? match.url
      : `${BASE_URL}${match.url}`;

    // 3. Load page
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS })).text();
    const $page = cheerio.load(pageHtml);

    const streams = [];
    const isTV = mediaType === "tv";

    // =========================
    // TV SHOW LOGIC
    // =========================
    if (isTV) {
      let found = false;

      $page("div.episodes-list div.season-item").each((_, seasonEl) => {
        if (found) return;

        const seasonText = $page(seasonEl).text();
        const seasonMatch = seasonText.match(/S?(\d+)/);

        if (!seasonMatch || parseInt(seasonMatch[1]) !== season) return;

        $page("div.episode-download-item", seasonEl).each((_, epItem) => {
          if (found) return;

          const epText = $page(epItem).text();
          const epMatch = epText.match(/Episode-0*(\d+)/);

          if (!epMatch || parseInt(epMatch[1]) !== episode) return;

          found = true;

          $page("a", epItem).each((_, a) => {
            const href = $page(a).attr("href");

            if (href && href.startsWith("http")) {
              streams.push({
                url: href,
                quality: extractQuality(epText),
                title: `4KHDHUB [S${season}E${episode}]`,
                subtitles: []
              });
            }
          });
        });
      });
    }

    // =========================
    // MOVIE LOGIC
    // =========================
    else {
      const hrefs = [];

      $page("div.download-item a").each((_, el) => {
        const href = $page(el).attr("href");
        if (href && href.startsWith("http")) hrefs.push(href);
      });

      for (const href of hrefs.slice(0, 5)) {
        try {
          const resolved = await resolveRedirect(href);

          if (resolved.includes("hubcloud")) {
            const hubStreams = await resolveHubCloud(resolved);
            if (hubStreams) {
              streams.push(...hubStreams.map(s => ({ ...s, subtitles: [] })));
            }
          } else {
            streams.push({
              url: resolved,
              quality: extractQuality(resolved),
              title: "4KHDHUB",
              subtitles: []
            });
          }
        } catch (e) {
          console.log("[stream error]", e);
        }
      }
    }

    return streams;
  } catch (e) {
    console.log("[4KHDHUB FATAL]", e);
    return [];
  }
}

// ✅ CRITICAL FIX: Nuvio requires export
module.exports = {
  getStreams
};
