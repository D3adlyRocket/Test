const cheerio = require('cheerio-without-node-native');
// onepace.js
// Direct Stream Fix: Routes traffic cleanly through the verified Cloudflare Worker proxy assets

const BASE_URL = "https://onepace.co";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const SYSTEM_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "*/*",
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

    // 4. Translate Embed Identifiers into Direct Stream Asset Playlists
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
          let rawMediaPlaylist = null;

          // neoncdn / polarisro proxy handling pulled straight from your devtools screenshot
          if (src.includes("reimoto") || src.includes("neon") || src.includes("polarisro.workers.dev")) {
            serverName = "NeonCDN Proxy";
            
            // If the iframe source itself contains the parsed URL param query string
            if (src.includes("?url=")) {
              rawMediaPlaylist = src;
            } else {
              // Reconstruct the verified, working endpoint layout manually
              const encodedTarget = encodeURIComponent(src);
              rawMediaPlaylist = `https://late-mud-43fb.polarisro.workers.dev/?url=${encodedTarget}`;
            }
          } 
          else if (src.includes("vidmoly.net")) {
            serverName = "VidMoly CDN";
            const videoId = src.split("/embed-")[1]?.split(".html")[0];
            if (videoId) {
              rawMediaPlaylist = `https://cdn.staticmoly.me/p/${videoId}/master.m3u8`;
            }
          } 
          else if (src.includes("emturbovid.com")) {
            serverName = "TurboVid / Omega";
            const videoId = src.split("/t/")[1] || src.split("/").pop();
            if (videoId) {
              rawMediaPlaylist = `https://turbovidhls.com/hls/${videoId}/master.m3u8`;
            }
          }
          else if (src.includes("rubystm.com")) {
            serverName = "RubyStm CDN";
            const videoId = src.split("/e/")[1] || src.split("/").pop();
            if (videoId) {
              rawMediaPlaylist = `https://185.237.107.43/v4/epu/${videoId}/master.m3u8`;
            }
          }

          if (rawMediaPlaylist) {
            streams.push({
              name: "OnePace",
              url: rawMediaPlaylist,
              quality: "Auto",
              title: `OnePace [${serverName}]`,
              subtitles: [],
              behaviorHints: {
                notWebReady: false, // Player can now play this directly!
                proxyHeaders: {
                  request: {
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
                    "Origin": "https://onepace.co",
                    "Referer": "https://onepace.co/"
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
    console.error("[OnePace Engine Failure]", e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
