const cheerio = require("cheerio");

const BASE_URL =
  "https://dudefilms.sarl";

const TMDB_API_KEY =
  "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0",
  "Referer":
    `${BASE_URL}/`
};

// ======================================
// QUALITY
// ======================================
function extractQuality(str = "") {

  const u = str.toLowerCase();

  if (u.includes("2160p") || u.includes("4k"))
    return "4K";

  if (u.includes("1080p"))
    return "1080p";

  if (u.includes("720p"))
    return "720p";

  if (u.includes("480p"))
    return "480p";

  return "Unknown";
}

// ======================================
// PROXY FETCH
// ======================================
const PROXY = (url) =>
  `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;

async function fetchText(url) {

  try {

    const res = await fetch(
      PROXY(url),
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

// ======================================
// NORMALIZE URL
// ======================================
function normalizeUrl(url) {

  if (!url) return null;

  if (url.startsWith("http"))
    return url;

  if (url.startsWith("//"))
    return "https:" + url;

  if (url.startsWith("/"))
    return BASE_URL + url;

  return `${BASE_URL}/${url}`;
}

// ======================================
// EXTRACT STREAMS
// ======================================
async function extractStreams(url, label) {

  try {

    const html =
      await fetchText(url);

    if (!html) return [];

    const $ = cheerio.load(html);

    const streams = [];

    // ==================================
    // direct media
    // ==================================
    $("source, video source").each((_, el) => {

      const src =
        $(el).attr("src");

      if (!src) return;

      const full =
        normalizeUrl(src);

      if (
        full.includes(".mp4") ||
        full.includes(".m3u8")
      ) {

        streams.push({
          url: full,
          quality:
            extractQuality(full),
          title: label,
          subtitles: []
        });

      }

    });

    // ==================================
    // iframe extraction
    // ==================================
    $("iframe").each((_, el) => {

      const src =
        $(el).attr("src");

      if (!src) return;

      const full =
        normalizeUrl(src);

      streams.push({
        url: full,
        quality:
          extractQuality(full),
        title:
          `${label} [iframe]`,
        subtitles: []
      });

    });

    // ==================================
    // button links
    // ==================================
    $("a").each((_, el) => {

      const href =
        $(el).attr("href");

      const text =
        ($(el).text() || "")
        .trim();

      if (!href) return;

      const full =
        normalizeUrl(href);

      const lc =
        text.toLowerCase();

      if (
        lc.includes("download") ||
        lc.includes("watch") ||
        lc.includes("stream") ||
        lc.includes("server") ||
        lc.includes("play") ||
        full.includes(".mp4") ||
        full.includes(".m3u8")
      ) {

        streams.push({
          url: full,
          quality:
            extractQuality(
              text + " " + full
            ),
          title:
            `${label} [${text}]`,
          subtitles: []
        });

      }

    });

    return streams;

  } catch (e) {
    return [];
  }
}

// ======================================
// MAIN
// ======================================
async function getStreams(
  tmdbId,
  mediaType,
  season,
  episode
) {

  try {

    // ==================================
    // TMDB
    // ==================================
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

    console.log(
      "[DUDEFILMS TITLE]",
      title
    );

    // ==================================
    // SEARCH
    // ==================================
    const searchUrl =
      `${BASE_URL}/page/1/?s=${encodeURIComponent(title)}`;

    const searchHtml =
      await fetchText(searchUrl);

    if (!searchHtml)
      return [];

    const $ =
      cheerio.load(searchHtml);

    const results = [];

    // broad extraction
    $("a").each((_, el) => {

      const href =
        $(el).attr("href");

      const text =
        ($(el).text() || "")
        .trim();

      if (
        !href ||
        !text
      ) return;

      if (
        href.includes(BASE_URL)
      ) {

        results.push({
          title: text,
          url: href
        });

      }

    });

    if (!results.length) {
      console.log(
        "[DUDEFILMS] No results"
      );

      return [];
    }

    // ==================================
    // MATCH
    // ==================================
    const lcTitle =
      title.toLowerCase();

    let match =
      results.find(r =>
        r.title
         .toLowerCase()
         .includes(lcTitle)
      ) || results[0];

    if (!match)
      return [];

    const pageUrl =
      normalizeUrl(match.url);

    console.log(
      "[DUDEFILMS PAGE]",
      pageUrl
    );

    // ==================================
    // EXTRACT
    // ==================================
    let streams =
      await extractStreams(
        pageUrl,
        `DudeFilms - ${title}`
      );

    // ==================================
    // FOLLOW BUTTON LINKS
    // ==================================
    const extraStreams = [];

    for (const s of streams.slice(0, 10)) {

      try {

        const nested =
          await extractStreams(
            s.url,
            s.title
          );

        extraStreams.push(
          ...nested
        );

      } catch (e) {}

    }

    streams.push(
      ...extraStreams
    );

    // dedupe
    const seen =
      new Set();

    streams =
      streams.filter(s => {

        if (
          seen.has(s.url)
        ) return false;

        seen.add(s.url);

        return true;

      });

    return streams.slice(0, 20);

  } catch (e) {

    console.log(
      "[DUDEFILMS ERROR]",
      e
    );

    return [];
  }
}

module.exports = {
  getStreams
};
