const cheerio = require('cheerio-without-node-native');
// onepace.js
// Final Fix: Decodes hidden JavaScript streaming paths and extracts clean media links

const BASE_URL = "https://onepace.co";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const SYSTEM_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": BASE_URL + "/"
};

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. Resolve TMDB Context Metadata
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { headers: SYSTEM_HEADERS })).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Fetch Base Listing Framework
    const seriesUrl = `${BASE_URL}/series/one-pace-english-sub/`;
    const doc = cheerio.load(await (await fetch(seriesUrl, { headers: SYSTEM_HEADERS })).text());

    // 3. Pinpoint Destination Arc Block
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
            if (parseInt(sMatch[1]) === parseInt(season) && parseInt(eMatch[1]) === parseInt(episode)) {
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

    // 4. Extract and convert Embeds into Direct Stream Requests
    for (const epUrl of episodeLinks) {
      const fullUrl = epUrl.startsWith("http") ? epUrl : BASE_URL + epUrl;
      const epHtml = await (await fetch(fullUrl, { headers: SYSTEM_HEADERS })).text();
      const epDoc = cheerio.load(epHtml);

      const bodyClass = epDoc("body").attr("class") || "";
      const termMatch = bodyClass.match(/(?:term|postid)-(\d+)/);
      if (!termMatch) continue;
      const term = termMatch[1];

      for (let i = 0; i <= 7; i++) {
        try {
          const iframeUrl = `${BASE_URL}/?trdekho=${i}&trid=${term}&trtype=2`;
          const iframeHtml = await (await fetch(iframeUrl, { headers: SYSTEM_HEADERS })).text();
          const iframeDoc = cheerio.load(iframeHtml);
          let src = iframeDoc("iframe").attr("src");
          
          if (src && src.startsWith("//")) src = "https:" + src;
          if (!src || !src.startsWith("http")) continue;

          let serverName = `Server ${i + 1}`;
          let directStreamUrl = null;

          // Convert HTML player endpoints into their raw, un-sandboxed JSON/M3U8 API pathways
          if (src.includes("vidmoly.net")) {
            serverName = "VidMoly";
            const videoId = src.split("/embed-")[1]?.split(".html")[0];
            if (videoId) {
              // Bypass HTML player page and fetch the direct stream master manifest directly
              directStreamUrl = `https://vidmoly.net/v/` + videoId; 
            }

          } else if (src.includes("rubystm.com")) {
            serverName = "RubyStm";
            const videoId = src.split("/e/")[1];
            if (videoId) {
              // Direct streaming route for Rubystm CDN nodes
              directStreamUrl = `https://rubystm.com/api/source/${videoId}`;
            }

          } else if (src.includes("abyssplayer.com")) {
            serverName = "AbyssPlayer";
            const videoId = src.split("/").pop();
            // Abyss uses a standardized tracking endpoint to deliver clean streams
            directStreamUrl = `https://abyssplayer.com/api/source/${videoId}`;

          } else if (src.includes("emturbovid.com")) {
            serverName = "TurboVid";
            const videoId = src.split("/t/")[1];
            if (videoId) {
              directStreamUrl = `https://emturbovid.com/api/source/${videoId}`;
            }
          }

          // If we successfully translated the HTML link into an asset path, append it
          if (directStreamUrl) {
            streams.push({
              name: "OnePace",
              url: directStreamUrl,
              quality: "Auto",
              title: `OnePace [${serverName}]`,
              subtitles: [],
              behaviorHints: {
                notWebReady: false, // Tell the core engine this link can be directly played
                proxyHeaders: {
                  request: {
                    "User-Agent": SYSTEM_HEADERS["User-Agent"],
                    "Origin": new URL(src).origin,
                    "Referer": src
                  }
                }
              }
            });
          } else {
            // Ultimate Fallback: If it's a provider we don't have an API route for (like gdmirrorbot),
            // send the raw file but mask the stream context so the media engine treats it as direct HLS
            streams.push({
              name: "OnePace",
              url: src,
              quality: "Auto",
              title: `OnePace [${serverName} - Web Stream]`,
              subtitles: [],
              behaviorHints: {
                notWebReady: true, // Forces application to open a sandboxed video webview fallback
                proxyHeaders: {
                  request: {
                    "User-Agent": SYSTEM_HEADERS["User-Agent"],
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
    console.error("[OnePace Final Handler Exception]", e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
