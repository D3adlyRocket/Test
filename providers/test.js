const cheerio = require('cheerio-without-node-native');
// onepace.js
// OnePace provider — fixes embed restrictions to extract actual video targets

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

    // 2. Load Series Page
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

    // 4. Extract underlying stream links from iframe embeds
    for (const epUrl of episodeLinks) {
      const fullUrl = epUrl.startsWith("http") ? epUrl : BASE_URL + epUrl;
      const epHtml = await (await fetch(fullUrl, { headers: HEADERS})).text();
      const epDoc = cheerio.load(epHtml);

      const bodyClass = epDoc("body").attr("class") || "";
      const termMatch = bodyClass.match(/(?:term|postid)-(\d+)/);
      if (!termMatch) continue;
      const term = termMatch[1];

      // Scan up to 8 backend iframe options
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
            let serverName = `Server ${i + 1}`;
            let playUrl = src;
            let isM3u8 = false;

            // Differentiate and extract stream targets per host signature
            if (src.includes("abyssplayer.com")) {
              serverName = "AbyssPlayer";
              // Deep extraction step: Try parsing packed file scripts if direct access allowed
              try {
                const embedHtml = await (await fetch(src, { headers: { "Referer": BASE_URL } })).text();
                const fileMatch = embedHtml.match(/file["']?\s*:\s*["']([^"']+\.m3u8[^"']*)/);
                if (fileMatch) { playUrl = fileMatch[1]; isM3u8 = true; }
              } catch (_) {}

            } else if (src.includes("gdmirrorbot") || src.includes("mirrorbot")) {
              serverName = "Mirrorbot";
              
            } else if (src.includes("rubystm.com")) {
              serverName = "Sruby / RubyStm";
              // Convert player standard embed patterns into direct paths if known
              if (src.includes("/e/")) {
                const id = src.split("/e/")[1];
                // Fallback structured API proxy call sign
                playUrl = `https://rubystm.com/api/source/${id}`;
              }

            } else if (src.includes("emturbovid.com") || src.includes("turbovid")) {
              serverName = "Omega / TurboVid";

            } else if (src.includes("vidcloud")) {
              serverName = "Vidcloud";

            } else if (src.includes("vidmoly")) {
              serverName = "VidMody / Vidmoly";
              try {
                const molyHtml = await (await fetch(src, { headers: { "User-Agent": HEADERS["User-Agent"] } })).text();
                const molyMatch = molyHtml.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)/);
                if (molyMatch) { playUrl = molyMatch[1]; isM3u8 = true; }
              } catch (_) {}
            }

            // Append structured payload back to video environment client
            streams.push({
              name: "OnePace",
              url: playUrl,
              quality: "Auto",
              title: `OnePace [${serverName}]`,
              subtitles: [],
              behaviorHints: {
                // If it's a raw parsed stream link, mark as ready, else signal client to mount a rendering container
                notWebReady: !isM3u8, 
                externalUrls: {
                  "Web Player": src
                },
                proxyHeaders: {
                  request: {
                    "User-Agent": HEADERS["User-Agent"],
                    "Origin": new URL(src).origin,
                    "Referer": src
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
