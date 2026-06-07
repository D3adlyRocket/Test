const cheerio = require('cheerio-without-node-native');
// dudefilms.js
// DudeFilms Engine - Dynamic Multi-Host Stream Resolver

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
 * Follows the dynamic routing chain through gamerxyt / bonuscaf wrapper nodes
 */
async function resolveIntermediatePage(targetUrl) {
  try {
    const fetchOptions = {
      headers: {
        "User-Agent": HEADERS["User-Agent"],
        "Referer": BASE_URL
      }
    };

    // 1. Fetch initial landing response string
    const response = await fetch(targetUrl, fetchOptions);
    const htmlText = await response.text();
    
    // Check if the page is forcing a hardcoded script redirection to an ad network
    const bonuscafMatch = htmlText.match(/window\.location\.href\s*=\s*['"]([^'"]+bonuscaf\.com\/go\/[^'"]+)['"]/);
    if (bonuscafMatch) {
      const adRedirectUrl = bonuscafMatch[1];
      // Fetch the redirect wall container safely to read the internal structural elements
      const followRes = await fetch(adRedirectUrl, fetchOptions);
      return await followRes.text();
    }
    
    return htmlText;
  } catch (e) {
    console.error("[Resolver Request Failure]", e);
    return "";
  }
}

/**
 * Extracts true playable file configurations out of parsed document nodes
 */
function extractMediaStreams(htmlContent, fallbackUrl) {
  const $ = cheerio.load(htmlContent);
  const streams = [];

  // Precision extraction filter targeting explicitly defined server element button tags
  $('a[href*="hubcloud"], a[href*="obobsession"], a[href*="pixeldrain"], a[href*="busycdn"], a.btn-success, a.btn-danger').each((i, el) => {
    const href = $(el).attr('href');
    const label = $(el).text().trim().replace(/\s+/g, ' ');
    
    if (href && href.startsWith('http') && !href.includes('bonuscaf') && !href.includes('gamerxyt')) {
      streams.push({
        url: href,
        quality: extractQuality(href !== fallbackUrl ? href : fallbackUrl),
        title: `DudeFilms [${label || 'HighSpeed Server'}]`
      });
    }
  });

  return streams;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. Resolve Target Metadata Title via TMDB API
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Query Site Directory Index
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

    // 3. Parse Destination Show/Movie Framework Page
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS})).text();
    const $page = cheerio.load(pageHtml);

    const intermediateUrls = [];

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
                if (epUrl) intermediateUrls.push(epUrl);
                found = true;
                break;
              }
            } catch (e) {}
          }
          sibling = sibling.next();
        }
      }
    } else {
      // Movie Link Matrix Extraction
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
              intermediateUrls.push(href);
            }
          });
        } catch (e) {}
      }
    }

    // 4. Trace the intermediate redirection layers to clean out junk components
    const finalStreams = [];
    for (const link of intermediateUrls) {
      // Intercept wrapper paths and extract real data payload
      if (link.includes("gamerxyt.com") || link.includes("hubcloud") || link.includes("gdflix") || link.includes("filepress")) {
        const resolvedHtml = await resolveIntermediatePage(link);
        if (resolvedHtml) {
          const extracted = extractMediaStreams(resolvedHtml, link);
          finalStreams.push(...extracted);
        }
      } else {
        // Safe direct fallback mechanism
        finalStreams.push({
          url: link,
          quality: extractQuality(link),
          title: "DudeFilms (Direct Stream Link)"
        });
      }
    }

    // Remove duplicates or unparsed blank strings before rendering sources array
    return finalStreams.filter((item, pos, self) => self.findIndex(v => v.url === item.url) === pos);
  } catch (e) {
    console.error("[DudeFilms Engine Critical Malfunction]", e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
