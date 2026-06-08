const cheerio = require('cheerio-without-node-native');

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
 * Precision Host Resolver built from actual DevTools logs
 */
async function resolveHostPage(landingUrl) {
  try {
    const res = await fetch(landingUrl, { headers: { "User-Agent": HEADERS["User-Agent"], "Referer": BASE_URL } });
    const html = await res.text();
    const $ = cheerio.load(html);
    const streams = [];

    // 1. FILEPRESS RESOLVER: Extract ID from URL structure and map directly to CDN
    if (landingUrl.includes('filepress')) {
      const fileIdMatch = landingUrl.match(/\/file\/([a-zA-Z0-9]+)/);
      if (fileIdMatch) {
        streams.push({
          url: `https://new5.filepress.wiki/api/file/download/${fileIdMatch[1]}`,
          quality: extractQuality(landingUrl),
          title: "DudeFilms (Filepress HighSpeed Server)"
        });
      }
    }

    // 2. HUBCLOUD FSL RESOLVER: Emulate live minute token attachment
    const fslAnchor = $('#fsl');
    if (fslAnchor.length) {
      let rawHref = fslAnchor.attr('href');
      if (rawHref && rawHref.startsWith('http')) {
        const currentMinute = new Date().getMinutes();
        const authenticatedUrl = rawHref.includes('?') ? `${rawHref}&${currentMinute}` : `${rawHref}?${currentMinute}`;
        streams.push({
          url: authenticatedUrl,
          quality: extractQuality(landingUrl),
          title: "DudeFilms (HubCloud FSL Stream Server)"
        });
      }
    }

    // 3. PIXELDRAIN RESOLVER: Extract dynamic script variable hidden inside page text
    const scriptText = $('script').text();
    if (scriptText.includes('var pxl =')) {
      const pxlMatch = scriptText.match(/var\s+pxl\s*=\s*['"]([^'"]+)['"]/);
      if (pxlMatch && pxlMatch[1]) {
        streams.push({
          url: pxlMatch[1],
          quality: extractQuality(landingUrl),
          title: "DudeFilms (Pixeldrain Mirror Server)"
        });
      }
    }

    // 4. CLOUD BACKUPS: Capture active 10Gbps or BusyCDN elements cleanly
    $('a[href*="hubcloud.cx"], a[href*="busycdn.xyz"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) {
        streams.push({
          url: href,
          quality: extractQuality(href),
          title: "DudeFilms (Cloud Multi-Mirror Server)"
        });
      }
    });

    return streams;
  } catch (err) {
    console.error(`[Scraper Error Context]`, err);
    return [];
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

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
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS})).text();
    const $page = cheerio.load(pageHtml);
    const hostLandingLinks = [];

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
                if (epUrl) hostLandingLinks.push(epUrl);
                found = true;
                break;
              }
            } catch (e) {}
          }
          sibling = sibling.next();
        }
      }
    } else {
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
              hostLandingLinks.push(href);
            }
          });
        } catch (e) {}
      }
    }

    const finalStreams = [];
    for (const rawUrl of hostLandingLinks) {
      if (rawUrl.includes("hubcloud") || rawUrl.includes("filepress") || rawUrl.includes("gkyfilehost") || rawUrl.includes("dtflix") || rawUrl.includes("gdflix")) {
        const resolved = await resolveHostPage(rawUrl);
        finalStreams.push(...resolved);
      } else {
        finalStreams.push({
          url: rawUrl,
          quality: extractQuality(rawUrl),
          title: "DudeFilms (Direct Alternative Link)"
        });
      }
    }

    return finalStreams.filter((item, pos, self) => 
      item.url && 
      !item.url.endsWith('/admin') && 
      !item.url.endsWith('.fans/') && 
      !item.url.includes('t.me/') &&
      self.findIndex(v => v.url === item.url) === pos
    );
  } catch (e) {
    console.error("[Global Error Catch]", e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
