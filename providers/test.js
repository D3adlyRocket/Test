const cheerio = require("cheerio");

const BASE_URL =
  "https://onepace.co";

const TMDB_API_KEY =
  "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0",
  "Referer":
    `${BASE_URL}/`
};

// =====================================
// QUALITY
// =====================================
function extractQuality(str = "") {

  const s =
    str.toLowerCase();

  if (
    s.includes("2160") ||
    s.includes("4k")
  ) return "4K";

  if (s.includes("1080"))
    return "1080p";

  if (s.includes("720"))
    return "720p";

  if (s.includes("480"))
    return "480p";

  return "Unknown";
}

// =====================================
// PROXY
// =====================================
function proxy(url) {

  return `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;

}

// =====================================
// FETCH TEXT
// =====================================
async function fetchText(url) {

  try {

    const res =
      await fetch(
        proxy(url),
        {
          headers: HEADERS,
          skipSizeCheck: true
        }
      );

    return await res.text();

  } catch (e) {

    return "";

  }

}

// =====================================
// EXTRACT VIDEO URLS
// =====================================
async function extractVideoLinks(
  url,
  label
) {

  try {

    const html =
      await fetchText(url);

    if (!html)
      return [];

    const streams = [];

    // =================================
    // m3u8 direct
    // =================================
    const m3u8 =
      html.match(
        /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi
      ) || [];

    for (const link of m3u8) {

      streams.push({
        url: link,
        quality:
          extractQuality(link),
        title:
          `${label} [m3u8]`,
        subtitles: []
      });

    }

    // =================================
    // mp4 direct
    // =================================
    const mp4 =
      html.match(
        /https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/gi
      ) || [];

    for (const link of mp4) {

      streams.push({
        url: link,
        quality:
          extractQuality(link),
        title:
          `${label} [mp4]`,
        subtitles: []
      });

    }

    // =================================
    // source tags
    // =================================
    const $ =
      cheerio.load(html);

    $("source").each((_, el) => {

      const src =
        $(el).attr("src");

      if (
        src &&
        src.startsWith("http")
      ) {

        streams.push({
          url: src,
          quality:
            extractQuality(src),
          title:
            `${label} [source]`,
          subtitles: []
        });

      }

    });

    // =================================
    // iframe fallback
    // =================================
    $("iframe").each((_, el) => {

      const src =
        $(el).attr("src");

      if (
        src &&
        src.startsWith("http")
      ) {

        streams.push({
          url: src,
          quality: "Unknown",
          title:
            `${label} [iframe]`,
          subtitles: []
        });

      }

    });

    // dedupe
    const seen =
      new Set();

    return streams.filter(s => {

      if (
        seen.has(s.url)
      ) return false;

      seen.add(s.url);

      return true;

    });

  } catch (e) {

    return [];

  }

}

// =====================================
// MAIN
// =====================================
async function getStreams(
  tmdbId,
  mediaType,
  season,
  episode
) {

  try {

    // =================================
    // TMDB
    // =================================
    const tmdbUrl =
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    const media =
      await (
        await fetch(
          tmdbUrl,
          {
            skipSizeCheck: true
          }
        )
      ).json();

    const title =
      media.title ||
      media.name;

    if (!title)
      return [];

    // =================================
    // SERIES PAGE
    // =================================
    const seriesUrl =
      `${BASE_URL}/series/one-pace-english-sub/`;

    const html =
      await fetchText(
        seriesUrl
      );

    if (!html)
      return [];

    const $ =
      cheerio.load(html);

    const streams = [];

    // =================================
    // FIND EPISODE
    // =================================
    let episodeUrl =
      null;

    $("li").each((_, el) => {

      if (episodeUrl)
        return;

      const txt =
        $(el).text();

      const s =
        txt.match(/S(\d+)/i);

      const e =
        txt.match(/E(\d+)/i);

      if (
        !s ||
        !e
      ) return;

      if (
        parseInt(s[1]) === parseInt(season || 1) &&
        parseInt(e[1]) === parseInt(episode || 1)
      ) {

        const href =
          $(el)
          .find("a")
          .attr("href");

        if (href)
          episodeUrl =
            href.startsWith("http")
              ? href
              : BASE_URL + href;

      }

    });

    // fallback
    if (!episodeUrl) {

      const first =
        $("li a")
        .first()
        .attr("href");

      if (first) {

        episodeUrl =
          first.startsWith("http")
            ? first
            : BASE_URL + first;

      }

    }

    if (!episodeUrl)
      return [];

    console.log(
      "[ONEPACE EP]",
      episodeUrl
    );

    // =================================
    // EP PAGE
    // =================================
    const epHtml =
      await fetchText(
        episodeUrl
      );

    if (!epHtml)
      return [];

    const epDoc =
      cheerio.load(epHtml);

    const bodyClass =
      epDoc("body")
      .attr("class") || "";

    const match =
      bodyClass.match(
        /(?:term|postid)-(\d+)/
      );

    if (!match)
      return [];

    const term =
      match[1];

    // =================================
    // SERVERS
    // =================================
    for (
      let i = 0;
      i <= 7;
      i++
    ) {

      try {

        const iframePage =
          `${BASE_URL}/?trdekho=${i}&trid=${term}&trtype=2`;

        const iframeHtml =
          await fetchText(
            iframePage
          );

        if (!iframeHtml)
          continue;

        const iframeDoc =
          cheerio.load(
            iframeHtml
          );

        const iframeSrc =
          iframeDoc("iframe")
          .attr("src");

        if (!iframeSrc)
          continue;

        // =================================
        // EXTRACT REAL VIDEO
        // =================================
        const extracted =
          await extractVideoLinks(
            iframeSrc,
            `OnePace Server ${i + 1}`
          );

        streams.push(
          ...extracted
        );

      } catch (e) {}

    }

    // dedupe
    const seen =
      new Set();

    return streams.filter(s => {

      if (
        seen.has(s.url)
      ) return false;

      seen.add(s.url);

      return true;

    });

  } catch (e) {

    console.log(
      "[ONEPACE ERROR]",
      e
    );

    return [];

  }

}

module.exports = {
  getStreams
};
