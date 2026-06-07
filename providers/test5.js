const cheerio = require('cheerio-without-node-native');
// dudefilms.js
// DudeFilms - Hindi/Bollywood/South Indian movie & series site

const BASE_URL = "https://dudefilms.irish";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  "Referer": `${BASE_URL}/`
};

function extractQuality(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  return "Unknown";
}

/**
 * Universal resolver for Filepress, Gkyfilehost, Gdflix, and Dtflix
 */
async function resolveGenericHost(url, providerName) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": HEADERS["User-Agent"] } });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const streams = [];

    // Look for common direct stream/download link patterns used by these specific templates
    // Pattern 1: Look for explicit stream, watch online, or fast download buttons
    $('a[href*="/download/"], a[href*="/stream/"], a.btn-success, a.btn-primary').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) {
        streams.push({
          url: href,
          quality: extractQuality(url),
          title: `DudeFilms (${providerName})`
        });
      }
    });

    // Pattern 2: Fallback to searching all anchors on the landing page if Pattern 1 yields nothing
    if (streams.length === 0) {
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        // Filter out typical UI layout paths, only grab apparent stream links
        if (href && href.startsWith('http') && !href.includes('login') && !href.includes('register') && !href.includes('telegram')) {
          streams.push({
            url: href,
            quality: extractQuality(url),
            title: `DudeFilms (${providerName} Alt)`
          });
        }
      });
    }

    return streams;
  } catch (err) {
    console.error(`[Resolver Error - ${providerName}]`, err);
    return [];
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. Get title from TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search
    const searchUrl = `${BASE_URL}/page/1/?s=${encodeURIComponent(title)}`;
    const searchHtml = await (await fetch(searchUrl, { headers: HEADERS})).text();
    const $ = cheerio.load(searchHtml);

    const results = [];
    $("div.simple-grid-grid-post").each((i, el) => {
      const href = $("h3 a", el).attr("href");
      const t = $("h3", el).text().trim();
      if (href) results.push({ title: t, url: href });
    });

    if (!results.length) return [];

    const isTV = mediaType === "tv";
    const lcTitle = title.toLowerCase();
    let match = results.find(r => r.title.toLowerCase().includes(lcTitle));
    if (!match) match = results[0];

    const pageUrl = match.url.startsWith("http") ? match.url : `${BASE_URL}${match.url}`;

    // 3. Load show page
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS})).text();
    const $page = cheerio.load(pageHtml);

    const intermediateLinks = [];

    if (isTV) {
      let found = false;
      const h4s = $page("h4").toArray();

      for (const h4 of h4s) {
        if (found) break;
        const h4Text = $page(h4).text();
        const seasonMatch = h4Text.match(/\bSeason\s*(\d+)\b/i);
        if (!seasonMatch || parseInt(seasonMatch[1]) !== season) continue;

        let sibling = $page(h4).next();
        while (sibling.length && sibling.prop("tagName") === "P") {
          const seasonButtons = sibling.find("a.maxbutton").toArray();
          for (const btn of seasonButtons) {
            if (found) break;
            const seasonPageUrl = $page(btn).attr("href");
            if (!seasonPageUrl) continue;

            try {
              const seasonPageHtml = await (await fetch(seasonPageUrl, { headers: HEADERS})).text();
              const $seasonPage = cheerio.load(seasonPageHtml);

              const epButtons = $seasonPage("a.maxbutton-ep").toArray();
              for (const epBtn of epButtons) {
                const epText = $seasonPage(epBtn).text();
                const epMatch = epText.match(/(?:Episode|Ep|E)\s*(\d+)/i);
                if (!epMatch || parseInt(epMatch[1]) !== episode) continue;

                const epUrl = $seasonPage(epBtn).attr("href");
                if (epUrl) {
                  intermediateLinks.push(epUrl);
                }
                found = true;
                break;
              }
            } catch (e) {}
          }
          sibling = sibling.next();
        }
      }
    } else {
      // Movie: gather redirect landing urls from the page buttons
      const maxButtons = $page("a.maxbutton").toArray();
      for (const btn of maxButtons) {
        try {
          const btnUrl = $page(btn).attr("href");
          if (!btnUrl) continue;
          const btnHtml = await (await fetch(btnUrl, { headers: HEADERS})).text();
          const $btn = cheerio.load(btnHtml);
          $btn("a.maxbutton").each((i, a) => {
            const href = $btn(a).attr("href");
            if (href && href.startsWith("http")) {
              intermediateLinks.push(href);
            }
          });
        } catch (e) {}
      }
    }

    // 4. Resolve the intermediate links into true playable streams
    const finalStreams = [];
    for (const rawUrl of intermediateLinks) {
      if (rawUrl.includes("filepress")) {
        const resolved = await resolveGenericHost(rawUrl, "Filepress");
        finalStreams.push(...resolved);
      } else if (rawUrl.includes("gkyfilehost")) {
        const resolved = await resolveGenericHost(rawUrl, "GkyFileHost");
        finalStreams.push(...resolved);
      } else if (rawUrl.includes("dtflix")) {
        const resolved = await resolveGenericHost(rawUrl, "DtFlix");
        finalStreams.push(...resolved);
      } else if (rawUrl.includes("gdflix")) {
        const resolved = await resolveGenericHost(rawUrl, "GdFlix");
        finalStreams.push(...resolved);
      } else if (rawUrl.includes("gofile")) {
        const resolved = await resolveGenericHost(rawUrl, "GoFile");
        finalStreams.push(...resolved);
      } else {
        // Fallback placeholder if it's already a direct streaming format
        finalStreams.push({
          url: rawUrl,
          quality: extractQuality(rawUrl),
          title: "DudeFilms (Direct Link)"
        });
      }
    }

    // Filter out duplicates and empty results before returning
    return finalStreams.filter(stream => stream.url);
  } catch (e) {
    console.error("[DudeFilms Global Error]", e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
