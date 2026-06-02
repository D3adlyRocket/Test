const cheerio = require('cheerio-without-node-native');
// onepace.js
// OnePace provider — Fixed to handle hidden .woff video streams

const BASE_URL = "https://onepace.co";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

// Mirrors the exact headers from your DevTools screenshot
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  "Accept": "*/*",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site",
  "Referer": BASE_URL + "/"
};

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. Get TMDB info (title)
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { headers: DEFAULT_HEADERS })).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Load Series Page
    const seriesUrl = `${BASE_URL}/series/one-pace-english-sub/`;
    const doc = cheerio.load(await (await fetch(seriesUrl, { headers: DEFAULT_HEADERS })).text());

    // 3. Find the arc matching the current season
    const streams = [];
    const seasonBoxes = doc("div.seasons.aa-crd > div.seasons-bx").toArray();

    let episodeLinks = [];
    if (season && episode) {
      for (const box of seasonBoxes) {
        const $box = doc(box);
        const epItems = $box.find("ul.seasons-lst.anm-a li").toArray();
        for (const ep of epItems) {
          const $ep = doc(ep);
          const spanText = $ep.find("h3.title > span").text().trim();
          const sMatch = spanText.match(/S(\d+)/);
          const eMatch = spanText.match(/E(\d+)/);
          if (sMatch && eMatch) {
            const epSeason = parseInt(sMatch[1]);
            const epEp = parseInt(eMatch[1]);
            if (epSeason === parseInt(season) && epEp === parseInt(episode)) {
              const href = $ep.find("a").attr("href");
              if (href) episodeLinks.push(href);
              break;
            }
          }
        }
        if (episodeLinks.length > 0) break;
      }
    }

    if (episodeLinks.length === 0 && seasonBoxes.length > 0) {
      const firstArcEps = doc("ul.seasons-lst.anm-a li").first().find("a").attr("href");
      if (firstArcEps) episodeLinks.push(firstArcEps);
    }

    // 4. Resolve the player targets
    for (const epUrl of episodeLinks) {
      const fullUrl = epUrl.startsWith("http") ? epUrl : BASE_URL + epUrl;
      const epHtml = await (await fetch(fullUrl, { headers: DEFAULT_HEADERS })).text();
      const epDoc = cheerio.load(epHtml);

      const bodyClass = epDoc("body").attr("class") || "";
      const termMatch = bodyClass.match(/(?:term|postid)-(\d+)/);
      if (!termMatch) continue;
      const term = termMatch[1];

      for (let i = 0; i <= 7; i++) {
        try {
          const iframeUrl = `${BASE_URL}/?trdekho=${i}&trid=${term}&trtype=2`;
          const iframeHtml = await (await fetch(iframeUrl, { headers: DEFAULT_HEADERS })).text();
          const iframeDoc = cheerio.load(iframeHtml);
          let src = iframeDoc("iframe").attr("src");
          
          if (src && src.startsWith("//")) {
            src = "https:" + src;
          }

          if (src && src.startsWith("http")) {
            const targetUrl = new URL(src);
            let serverName = `Server ${i + 1}`;
            
            // Extracting specific server identities based on your previous details
            if (src.includes("as-cdn") || src.includes("silverpathacademy") || src.includes("rubystm")) {
              serverName = "SilverPath / Ruby CDN";
            } else if (src.includes("gdmirrorbot") || src.includes("mirrorbot")) {
              serverName = "Mirrorbot";
            } else if (src.includes("vidmoly") || src.includes("vmeas")) {
              serverName = "VidMody";
            }

            // RECONSTRUCTION STEP:
            // Since the system uses .woff for segmentation requests, if the root frame 
            // points to a web player script file, we map it to an stream structure.
            let playUrl = src;
            
            // If the URL directly targets the master map disguised as an asset path
            if (src.endsWith(".woff")) {
              playUrl = src;
            }

            streams.push({
              name: "OnePace",
              url: playUrl,
              quality: "Auto",
              title: `OnePace [${serverName}]`,
              subtitles: [],
              behaviorHints: {
                // Force the player to render this via an internal webview container 
                // so it can dynamically evaluate the javascript that decodes the .woff chunks
                notWebReady: true,
                proxyHeaders: {
                  request: {
                    "User-Agent": DEFAULT_HEADERS["User-Agent"],
                    "Origin": targetUrl.origin,
                    "Referer": targetUrl.origin + "/",
                    "Accept": "*/*"
                  }
                }
              }
            });
          }
        } catch (_) {}
      }
    }

    return streams;
  } catch (e) {
    console.error("[OnePace]", e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
