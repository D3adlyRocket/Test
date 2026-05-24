// goojara.js
// Goojara - fixed for Nuvio module compatibility

const BASE_URL = "https://ww1.goojara.to";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
  "Accept": "*/*",
  "Referer": BASE_URL,
  "Cookie": "aGooz=dg18hh2eittp5e7s53u0e6bloh"
};

function extractQuality(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  return "Unknown";
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    const searchBody = new URLSearchParams({
      z: "Mwxxa3Vnaw",
      x: "b3716e05ff",
      q: title
    });

    const searchResp = await fetch(`${BASE_URL}/xmre.php`, {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: searchBody.toString(),
      skipSizeCheck: true
    });

    const searchHtml = await searchResp.text();
    const $ = cheerio.load(searchHtml);

    const results = [];
    $("li a").each((i, a) => {
      const href = $(a).attr("href");
      const t = $(a).text().trim();
      if (href) results.push({ title: t, url: href });
    });

    if (!results.length) return [];

    const lcTitle = title.toLowerCase();
    let match = results.find(r => r.title.toLowerCase().includes(lcTitle)) || results[0];

    const matchUrl = match.url.startsWith("http")
      ? match.url
      : `${BASE_URL}${match.url}`;

    const matchPageHtml = await (await fetch(matchUrl, { headers: HEADERS, skipSizeCheck: true })).text();
    const $match = cheerio.load(matchPageHtml);

    const showHref = $match("div.snfo h1 a").attr("href") || matchUrl;
    const showUrl = showHref.startsWith("http") ? showHref : `${BASE_URL}${showHref}`;

    const showHtml = await (await fetch(showUrl, { headers: HEADERS, skipSizeCheck: true })).text();
    const $show = cheerio.load(showHtml);

    let targetUrl = showUrl;

    const isTV = mediaType === "tv";

    if (isTV) {
      const seasonLink = $show("#sesh a.ste").attr("href") || "";
      if (!seasonLink) return [];

      const seasonHref =
        seasonLink.split("?s=")[0] + `?s=${season}`;

      const seasonUrl = seasonHref.startsWith("http")
        ? seasonHref
        : `${BASE_URL}${seasonHref}`;

      const seasonHtml = await (await fetch(seasonUrl, { headers: HEADERS, skipSizeCheck: true })).text();
      const $season = cheerio.load(seasonHtml);

      let epUrl = "";

      $season("div.seho").each((i, el) => {
        if (epUrl) return;

        const epText = $season("span.sea", el).text().trim();
        const epNum = parseInt(epText);

        if (epNum === episode) {
          const href = $season("a", el).attr("href");
          if (href) {
            epUrl = href.startsWith("http")
              ? href
              : `${BASE_URL}${href}`;
          }
        }
      });

      if (!epUrl) return [];
      targetUrl = epUrl;
    }

    const playerResp = await fetch(targetUrl, {
      headers: { ...HEADERS, Referer: BASE_URL },
      skipSizeCheck: true
    });

    const playerHtml = await playerResp.text();
    const $player = cheerio.load(playerHtml);

    const streams = [];

    const drlLinks = $player("#drl a").toArray();

    for (const a of drlLinks) {
      const href = $player(a).attr("href");
      if (!href) continue;

      try {
        const redirectResp = await fetch(href, {
          headers: {
            ...HEADERS,
            Referer: BASE_URL
          },
          redirect: "manual",
          skipSizeCheck: true
        });

        const embedUrl =
          redirectResp.headers.get?.("location") ||
          redirectResp.headers?.location;

        if (embedUrl && embedUrl.startsWith("http")) {
          streams.push({
            url: embedUrl,
            quality: "720p",
            title: "Goojara",
            subtitles: []
          });
        }
      } catch (_) {}
    }

    return streams;
  } catch (e) {
    console.error("[Goojara]", e);
    return [];
  }
}

/**
 * ✅ THIS IS THE FIX FOR NUVIO
 */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
