const cheerio = require('cheerio-without-node-native');
// onepace.js
// OnePace provider — scrapes https://onepace.co for One Pace anime arcs (sub & dub)

const BASE_URL = "https://onepace.co";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
  "Referer": BASE_URL + "/"
};

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. Get TMDB info (title)
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { headers: HEADERS})).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Determine if searching sub or dub series
    const seriesUrl = `${BASE_URL}/series/one-pace-english-sub/`;
    const doc = cheerio.load(await (await fetch(seriesUrl, { headers: HEADERS})).text());

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

    // 4. For each episode URL, extract term id then resolve iframe stream targets
    for (const epUrl of episodeLinks) {
      const fullUrl = epUrl.startsWith("http") ? epUrl : BASE_URL + epUrl;
      const epHtml = await (await fetch(fullUrl, { headers: HEADERS})).text();
      const epDoc = cheerio.load(epHtml);

      const bodyClass = epDoc("body").attr("class") || "";
      const termMatch = bodyClass.match(/(?:term|postid)-(\d+)/);
      if (!termMatch) continue;
      const term = termMatch[1];

      // Try the iframe slots
      for (let i = 0; i <= 7; i++) {
        try {
          const iframeUrl = `${BASE_URL}/?trdekho=${i}&trid=${term}&trtype=2`;
          const iframeHtml = await (await fetch(iframeUrl, { headers: HEADERS})).text();
          const iframeDoc = cheerio.load(iframeHtml);
          let src = iframeDoc("iframe").attr("src");
          
          if (src && src.startsWith("//")) {
            src = "https:" + src;
          }

          if (src && src.startsWith("http")) {
            // Determine Server Name based on the domain inside the iframe source
            let serverName = `Server ${i + 1}`;
            let finalUrl = src;
            let playerHeaders = Object.assign({}, HEADERS);

            if (src.includes("vidstream") || src.includes("as-cdn")) {
              serverName = "Vidstream";
            } else if (src.includes("rumble") || src.includes("mycloud")) {
              serverName = "Mycloud";
            } else if (src.includes("vmeas.cloud") || src.includes("vidmody")) {
              serverName = "VidMody";
            } else if (src.includes("turbosplayer") || src.includes("omega")) {
              serverName = "Omega";
            } else if (src.includes("reimoto") || src.includes("neon")) {
              serverName = "Neon";
            } else if (src.includes("silverpathacademy") || src.includes("mirrorbot")) {
              serverName = "Mirrorbot";
            }

            // Fallback check: If the iframe contains a direct file mapping pattern or a script array
            // we force behavior hints telling the video core to process it as a direct HLS source.
            const isDirectM3u8 = src.includes(".m3u8");

            streams.push({
              name: "OnePace",
              url: finalUrl,
              quality: "Auto",
              title: `OnePace [${serverName}]`,
              subtitles: [],
              behaviorHints: {
                // If it's a raw m3u8 link we can play directly, otherwise keep true for embedding webview handlers
                notWebReady: !isDirectM3u8, 
                proxyHeaders: {
                  request: {
                    "User-Agent": playerHeaders["User-Agent"],
                    "Referer": src // CRITICAL: The streaming servers validate if the referer is the iframe source URL
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
