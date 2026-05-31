const cheerio = require("cheerio-without-node-native");

// OnePace provider
const BASE_URL = "https://onepace.co";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
  Referer: BASE_URL + "/",
};

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. TMDB fetch
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl, { headers: HEADERS })).json();

    const title = mediaInfo.title || mediaInfo.name || "";
    if (!title) return [];

    // (optional safety only — not strict)
    if (!title.toLowerCase().includes("one piece")) {
      return [];
    }

    // 2. Load OnePace page
    const seriesUrl = `${BASE_URL}/series/one-pace-english-sub/`;
    const doc = cheerio.load(
      await (await fetch(seriesUrl, { headers: HEADERS })).text()
    );

    const streams = [];
    const seasonBoxes = doc("div.seasons.aa-crd > div.seasons-bx").toArray();

    let episodeLinks = [];

    // 3. Find episode
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

        if (episodeLinks.length) break;
      }
    }

    // fallback
    if (!episodeLinks.length && seasonBoxes.length) {
      const first = doc("ul.seasons-lst.anm-a li")
        .first()
        .find("a")
        .attr("href");

      if (first) episodeLinks.push(first);
    }

    // 4. Extract streams
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
          const iframeUrl = `${BASE_URL}/?trdekho=${i}&trid=${term}&trtype=2`;

          const iframeHtml = await (
            await fetch(iframeUrl, { headers: HEADERS })
          ).text();

          const iframeDoc = cheerio.load(iframeHtml);

          let src = iframeDoc("iframe").attr("src");
          if (!src) continue;

          // fix relative URLs
          if (src.startsWith("//")) src = "https:" + src;
          if (src.startsWith("/")) src = BASE_URL + src;

          // timeout fetch (safe)
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          let finalHtml = "";

          try {
            finalHtml = await (
              await fetch(src, {
                headers: {
                  ...HEADERS,
                  Referer: iframeUrl,
                },
                signal: controller.signal,
              })
            ).text();
          } catch (e) {
            clearTimeout(timeout);
            continue;
          }

          clearTimeout(timeout);

          // extract direct links (optional)
          let videoUrl = null;

          let match = finalHtml.match(
            /https?:\/\/[^"' ]+\.m3u8[^"' ]*/i
          );
          if (match) videoUrl = match[0];

          if (!videoUrl) {
            match = finalHtml.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/i);
            if (match) videoUrl = match[0];
          }

          if (!videoUrl) {
            match = finalHtml.match(
              /file\s*:\s*["']([^"']+)["']/i
            );
            if (match) videoUrl = match[1];
          }

          // IMPORTANT fallback (restored working behavior)
          if (!videoUrl) {
            videoUrl = src;
          }

          if (!videoUrl || !videoUrl.startsWith("http")) continue;

          // skip junk
          if (
            videoUrl.includes(".jpg") ||
            videoUrl.includes(".png") ||
            videoUrl.includes(".gif") ||
            videoUrl.includes("about:blank")
          ) {
            continue;
          }

          // avoid duplicates
          if (streams.some((s) => s.url === videoUrl)) continue;

          streams.push({
            name: "OnePace",
            url: videoUrl,
            title: `OnePace Server ${i + 1}`,
            quality: "HD",
            subtitles: [],
            behaviorHints: {
              notWebReady: true,
              proxyHeaders: {
                request: {
                  ...HEADERS,
                },
              },
            },
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
}
