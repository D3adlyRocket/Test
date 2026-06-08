const cheerio = require('cheerio-without-node-native');

// dudefilms.js
// DudeFilms - Hindi/Bollywood/South Indian movie & series site (dudefilms.sarl)
// Uses Cinemeta for metadata enhancement

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
 * Bypasses GoFile to grab the direct, playable .mkv/.mp4 link 
 * Requires requesting an anonymous token first.
 */
async function resolveGofile(url) {
  if (!url || !url.includes('gofile.io')) return url;
  
  try {
    // 1. Generate an anonymous account token
    const accountRes = await (await fetch("https://api.gofile.io/accounts", {
      method: "POST"
    })).json();
    const token = accountRes.data.token;

    // 2. Fetch the folder/file contents using the token
    const contentId = url.split('/').pop();
    const contentRes = await (await fetch(`https://api.gofile.io/contents/${contentId}?wt=4fd6sg89d7s6`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    })).json();

    // 3. Extract the direct cold-storage link (as seen in Screenshot 1)
    const children = contentRes.data.children;
    const fileKey = Object.keys(children)[0];
    return children[fileKey].link;
  } catch (e) {
    console.error("[GoFile Bypass Failed]", e);
    return url; // Fallback to original url if API fails
  }
}

/**
 * Automates the AJAX payload found in your screenshot to get the hidden link.
 */
async function extractStreamFromButton(btnUrl) {
  if (!btnUrl) return null;
  
  try {
    const btnHtml = await (await fetch(btnUrl, { headers: HEADERS })).text();

    // 1. Look for the 24-char hex ID sent in the POST payload
    const idMatch = btnHtml.match(/["']?id["']?\s*:\s*["']([a-f0-9]{24})["']/i) ||
                    btnHtml.match(/data-id=["']([a-f0-9]{24})["']/i);

    if (idMatch) {
      const payloadId = idMatch[1];
      
      // Based on your network tab, the endpoint name starts with 'download'
      const postUrl = new URL('/download', btnUrl).href; 

      const apiRes = await fetch(postUrl, {
        method: 'POST',
        headers: {
          ...HEADERS,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          captchaValue: null,
          id: payloadId,
          method: "indexDownlaod" // Spelled exactly like your payload screenshot
        })
      });

      const apiData = await apiRes.json();
      let finalUrl = apiData.url || apiData.link;

      if (finalUrl) {
        return await resolveGofile(finalUrl);
      }
    }

    // 2. Fallback: If no AJAX ID is found, check for traditional href links
    const $btn = cheerio.load(btnHtml);
    let fallbackUrl = null;
    $btn("a.maxbutton").each((i, a) => {
      const href = $btn(a).attr("href");
      if (href && href.startsWith("http")) fallbackUrl = href;
    });

    if (fallbackUrl) {
       return await resolveGofile(fallbackUrl);
    }

  } catch (e) {
    console.error("[Extraction Error on URL:]", btnUrl, e);
  }

  // 3. Absolute fallback
  return await resolveGofile(btnUrl);
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. Get title from TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search DudeFilms
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

    // 3. Load show/movie page
    const pageHtml = await (await fetch(pageUrl, { headers: HEADERS})).text();
    const $page = cheerio.load(pageHtml);
    const streams = [];

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
                const finalStreamUrl = await extractStreamFromButton(epUrl);
                
                if (finalStreamUrl) {
                  streams.push({
                    url: finalStreamUrl,
                    quality: extractQuality(finalStreamUrl) || extractQuality(epUrl),
                    title: `DudeFilms [S${season}E${episode}]`,
                    subtitles: []
                  });
                  found = true;
                  break;
                }
              }
            } catch (e) {}
          }
          sibling = sibling.next();
        }
      }
    } else {
      // Movie logic
      const maxButtons = $page("a.maxbutton").toArray();
      for (const btn of maxButtons) {
        const btnUrl = $page(btn).attr("href");
        const finalStreamUrl = await extractStreamFromButton(btnUrl);
        
        if (finalStreamUrl) {
          streams.push({
            url: finalStreamUrl,
            quality: extractQuality(finalStreamUrl) || extractQuality(btnUrl),
            title: `DudeFilms`,
            subtitles: []
          });
        }
      }
    }

    return streams;
  } catch (e) {
    console.error("[DudeFilms]", e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
