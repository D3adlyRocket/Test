// goojara.js - Nuvio Compliant Provider Module
const cheerio = require('cheerio'); // Ensures parser parsing operations don't throw Reference errors

const BASE_URL = "https://ww1.goojara.to";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
  "Accept": "*/*",
  "Referer": BASE_URL + "/"
};

function extractQuality(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  return "720p"; // Safe baseline video fallback
}

/**
 * Dynamically fetches the Goojara landing assets to pull live cryptographic tokens
 */
async function fetchSearchTokens() {
  try {
    const res = await fetch(BASE_URL, { headers: HEADERS, skipSizeCheck: true });
    const html = await res.text();
    
    // Regex matching structures to isolate dynamic security tokens in Goojara's scripts
    const zMatch = html.match(/z\s*=\s*['"]([^'"]+)['"]/);
    const xMatch = html.match(/x\s*=\s*['"]([^'"]+)['"]/);
    
    return {
      z: zMatch ? zMatch[1] : "Mwxxa3Vnaw", // Fallback to hardcoded only if structural regex fails
      x: xMatch ? xMatch[1] : "b3716e05ff"
    };
  } catch (e) {
    return { z: "Mwxxa3Vnaw", x: "b3716e05ff" };
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. Resolve localized naming configuration structures via TMDB
    const type = mediaType === "tv" ? "tv" : "movie";
    const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { skipSizeCheck: true })).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Fetch fresh structural auth tokens prior to running search
    const tokens = await fetchSearchTokens();
    const searchBody = new URLSearchParams({
      z: tokens.z,
      x: tokens.x,
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

    const isTV = type === "tv";
    const lcTitle = title.toLowerCase();
    let match = results.find(r => r.title.toLowerCase().includes(lcTitle));
    if (!match) match = results[0];

    let matchUrl = match.url.startsWith("http") ? match.url : `${BASE_URL}${match.url.startsWith('/') ? '' : '/'}${match.url}`;

    const matchPageHtml = await (await fetch(matchUrl, { headers: HEADERS, skipSizeCheck: true })).text();
    const $match = cheerio.load(matchPageHtml);
    const showHref = $match("div.snfo h1 a").attr("href") || match.url;
    const showUrl = showHref.startsWith("http") ? showHref : `${BASE_URL}${showHref.startsWith('/') ? '' : '/'}${showHref}`;

    // 3. Evaluate specific Season & Episode layouts if TV Show context
    const showHtml = await (await fetch(showUrl, { headers: HEADERS, skipSizeCheck: true })).text();
    const $show = cheerio.load(showHtml);

    let targetUrl = showUrl;

    if (isTV) {
      const seasonLink = $show("#sesh a.ste").attr("href") || "";
      if (!seasonLink) return [];

      const totalSeasons = parseInt(seasonLink.split("?s=")[1]) || 1;
      if (season > totalSeasons) return [];

      const seasonHref = seasonLink.split("?s=")[0] + `?s=${season}`;
      const seasonUrl = seasonHref.startsWith("http") ? seasonHref : `${BASE_URL}${seasonHref.startsWith('/') ? '' : '/'}${seasonHref}`;

      const seasonHtml = await (await fetch(seasonUrl, { headers: HEADERS, skipSizeCheck: true })).text();
      const $season = cheerio.load(seasonHtml);

      let epUrl = "";
      $season("div.seho").each((i, el) => {
        if (epUrl) return;
        const epText = $season("span.sea", el).text().replace(/^0/, "").trim();
        const epNum = parseInt(epText);
        if (epNum === parseInt(episode)) {
          const href = $season("a", el).attr("href");
          epUrl = href ? (href.startsWith("http") ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`) : "";
        }
      });

      if (!epUrl) return [];
      targetUrl = epUrl;
    }

    // 4. Load Stream Host selection contexts
    const playerResp = await fetch(targetUrl, {
      headers: { ...HEADERS, Referer: BASE_URL },
      skipSizeCheck: true
    });
    const playerHtml = await playerResp.text();
    const $player = cheerio.load(playerHtml);

    const setCookie = playerResp.headers.get ? playerResp.headers.get("set-cookie") : "";
    const chkMatch = playerHtml.match(/_3chk\(\s*'([^']+)'\s*,\s*'([^']+)'/);
    const cookieStr = setCookie ? `${setCookie.split(";")[0]}${chkMatch ? `; ${chkMatch[1]}=${chkMatch[2]}` : ""}` : "";

    const streams = [];
    const drlLinks = $player("#drl a").toArray();

    for (const a of drlLinks) {
      let href = $player(a).attr("href") || "";
      if (!href) continue;
      
      if (href.startsWith("//")) href = "https:" + href;
      else if (!href.startsWith("http")) href = `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;

      try {
        const redirectResp = await fetch(href, {
          headers: {
            ...HEADERS,
            Referer: targetUrl,
            Cookie: cookieStr
          },
          redirect: "manual",
          skipSizeCheck: true
        });
        
        const embedUrl = redirectResp.headers.get ? redirectResp.headers.get("location") : "";
        if (embedUrl && embedUrl.startsWith("http")) {
          streams.push({
            name: "Goojara CDN",
            title: `Goojara Stream (${extractQuality(embedUrl)})`,
            url: embedUrl,
            quality: extractQuality(embedUrl).toLowerCase(),
            headers: {
              "User-Agent": HEADERS["User-Agent"],
              "Referer": BASE_URL + "/",
              "Connection": "keep-alive"
            },
            provider: "goojara"
          });
        }
      } catch (e) {}
    }

    return streams;
  } catch (e) {
    console.error("[Goojara Addon Engine Error]", e);
    return [];
  }
}

// --- Nuvio Environment Bridge Integration Layer ---
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else if (typeof global !== 'undefined') {
  global.getStreams = getStreams;
}
