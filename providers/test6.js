const cheerio = require('cheerio-without-node-native');
// onepace.js
// OnePace provider — scrapes https://onepace.co for One Pace anime arcs (sub & dub)
// Searches by arc name, then iterates over up to 8 iframe slots per episode

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
    const title = mediaInfo.title ||
  mediaInfo.name ||
  "";

if (!title.toLowerCase().includes("one piece")) {
  return [];
}

    // 2. Determine if searching sub or dub series
    const seriesUrl = `${BASE_URL}/series/one-pace-english-sub/`;
    const doc = cheerio.load(await (await fetch(seriesUrl, { headers: HEADERS})).text());

    // 3. Find the arc matching the current season
    const streams = [];
    let arcHref = null;
    let termId = null;

    // Each season-bx block represents one arc
    const seasonBoxes = doc("div.seasons.aa-crd > div.seasons-bx").toArray();

    // Try to find episode link by season number
    let episodeLinks = [];
    if (season && episode) {
      for (const box of seasonBoxes) {
        const $box = doc(box);
        // seasons are listed numerically; look for one matching our season
        const epItems = $box.find("ul.seasons-lst.anm-a li").toArray();
        // The season number is in span text like S1-E1
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

    // If no direct match, fall back to first episode of first arc
    if (episodeLinks.length === 0 && seasonBoxes.length > 0) {
      const firstArcEps = doc("ul.seasons-lst.anm-a li").first().find("a").attr("href");
      if (firstArcEps) episodeLinks.push(firstArcEps);
    }

    // 4. For each episode URL, extract streams
for (const epUrl of episodeLinks) {
  const fullUrl = epUrl.startsWith("http")
    ? epUrl
    : BASE_URL + epUrl;

  const epHtml = await (
    await fetch(fullUrl, { headers: HEADERS })
  ).text();

  const epDoc = cheerio.load(epHtml);

  const bodyClass = epDoc("body").attr("class") || "";
  const termMatch = bodyClass.match(/(?:term|postid)-(\d+)/);

  if (!termMatch) continue;

  const term = termMatch[1];

  for (let i = 0; i <= 7; i++) {
    try {
      const iframeUrl =
        `${BASE_URL}/?trdekho=${i}&trid=${term}&trtype=2`;

      const iframeHtml = await (
        await fetch(iframeUrl, { headers: HEADERS })
      ).text();

      const iframeDoc = cheerio.load(iframeHtml);

      let src = iframeDoc("iframe").attr("src");

      if (!src) continue;

      // Handle relative URLs
      if (src.startsWith("//")) {
        src = "https:" + src;
      } else if (src.startsWith("/")) {
        src = BASE_URL + src;
      }

      // Fetch nested iframe page
      // Better timeout safety
const controller = new AbortController();

const timeout = setTimeout(() => {
  controller.abort();
}, 10000);

const nestedHtml = await (
  await fetch(src, {
    headers: {
      ...HEADERS,
      Referer: iframeUrl
    },
    signal: controller.signal
  })
).text();

clearTimeout(timeout);

      // Try extracting direct m3u8/mp4
      let videoUrl = null;

      // m3u8
      let match =
        nestedHtml.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/i);

      if (match) {
        videoUrl = match[0];
      }

      // mp4 fallback
      if (!videoUrl) {
        match =
          nestedHtml.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/i);

        if (match) {
          videoUrl = match[0];
        }
      }

      // jwplayer/file fallback
      if (!videoUrl) {
        match =
          nestedHtml.match(/file\s*:\s*["']([^"']+)["']/i);

        if (match) {
          videoUrl = match[1];
        }
      }

      // fallback to iframe source itself
      if (!videoUrl) {
        videoUrl = src;
      }

      // Skip invalid URLs
      if (!videoUrl.startsWith("http")) continue;
      if (videoUrl.includes(".jpg") || videoUrl.includes(".png") || videoUrl.includes("about:blank")
) continue;

      // Prevent duplicate links
      if (streams.some(s => s.url === videoUrl)) continue;
      
      streams.push({
        name: "OnePace",
        title: `OnePace Server ${i + 1}`,
        url: videoUrl,
        quality: videoUrl.includes("1080") ? "1080p"
  : videoUrl.includes("720") ? "720p"
  : "HD",
        subtitles: [],
        behaviorHints: {
          proxyHeaders: {
            request: {
            "User-Agent": HEADERS["User-Agent"],
            "Referer": videoUrl,
            "Origin": new URL(videoUrl).origin
          }
          }
        }
      });

    } catch (e) {
      console.log("Server error", i, e);
    }
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
