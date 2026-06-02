const cheerio = require('cheerio-without-node-native');
// onepace.js
// Overhauled deep extraction engine to crack open html wrappers and pull streaming assets directly.

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

    // 4. Extract and Deconstruct Every Available Option Inside the HTML Layer
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
          let customHeaders = Object.assign({}, SYSTEM_HEADERS);

          // Deep Scraping Resolution Logic per Embed Signature
          try {
            if (src.includes("vidmoly.net")) {
              serverName = "VidMoly";
              const targetHtml = await (await fetch(src, { headers: { "User-Agent": SYSTEM_HEADERS["User-Agent"] } })).text();
              const sourceMatch = targetHtml.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)/);
              if (sourceMatch) directStreamUrl = sourceMatch[1];

            } else if (src.includes("abyssplayer.com")) {
              serverName = "AbyssPlayer";
              const targetHtml = await (await fetch(src, { headers: { "Referer": BASE_URL } })).text();
              // Check for standard JS configuration fields or base arrays
              const sourceMatch = targetHtml.match(/["']?file["']?\s*:\s*["']([^"']+)["']/);
              if (sourceMatch && sourceMatch[1].includes(".m3u8")) directStreamUrl = sourceMatch[1];

            } else if (src.includes("rubystm.com")) {
              serverName = "RubyStm (Sruby)";
              const targetHtml = await (await fetch(src, { headers: { "Referer": BASE_URL } })).text();
              const sourceMatch = targetHtml.match(/file\s*:\s*["']([^"']+)["']/);
              if (sourceMatch) directStreamUrl = sourceMatch[1];

            } else if (src.includes("emturbovid.com")) {
              serverName = "TurboVid";
              const targetHtml = await (await fetch(src, { headers: { "Referer": BASE_URL } })).text();
              const sourceMatch = targetHtml.match(/source\s*src\s*=\s*["']([^"']+)["']/);
              if (sourceMatch) directStreamUrl = sourceMatch[1];

            } else if (src.includes("gdmirrorbot.nl") || src.includes("mirrorbot")) {
              serverName = "Mirrorbot";
              // Mirrorbot processes using structural variables. Follow redirect chain if it targets direct media
              const targetHtml = await (await fetch(src, { headers: { "Referer": BASE_URL } })).text();
              const sourceMatch = targetHtml.match(/window\.location\.replace\s*\(\s*["']([^"']+)["']/);
              if (sourceMatch) directStreamUrl = sourceMatch[1];
            }
          } catch (innerError) {
            console.error(`[Deep Scraping Error on Slot ${i}]:`, innerError.message);
          }

          // Output Stream Mapping Definition Block
          // If deep extraction fails to isolate the video file, we fall back to providing the container 
          // but supply exact Origin/Referer overrides so the application's underlying player module can process it.
          const finalUrl = directStreamUrl || src;
          const isDirectMedia = finalUrl.includes(".m3u8") || finalUrl.includes(".mp4") || finalUrl.includes(".woff");

          streams.push({
            name: "OnePace",
            url: finalUrl,
            quality: "Auto",
            title: `OnePace [${serverName}]${!directStreamUrl ? " (Embed Proxy)" : ""}`,
            subtitles: [],
            behaviorHints: {
              notWebReady: !isDirectMedia,
              proxyHeaders: {
                request: {
                  "User-Agent": SYSTEM_HEADERS["User-Agent"],
                  "Origin": new URL(src).origin,
                  "Referer": src,
                  "Accept": "*/*"
                }
              }
            }
          });

        } catch (_) {}
      }
    }

    return streams;
  } catch (e) {
    console.error("[OnePace Exception Handler]", e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
