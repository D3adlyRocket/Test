const cheerio = require("cheerio");

const BASE_URL =
  "https://piratexplay.cc";

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

  if (s.includes("360"))
    return "360p";

  return "Unknown";
}

// =====================================
// PROXY FETCH
// =====================================
function proxy(url) {

  return `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;

}

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
// EXTRACT REAL VIDEO LINKS
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
    // direct m3u8/mp4 regex
    // =================================
    const matches =
      html.match(
        /https?:\/\/[^\s"'<>]+?\.(m3u8|mp4)[^\s"'<>]*/gi
      ) || [];

    for (const link of matches) {

      streams.push({
        url: link,
        quality:
          extractQuality(link),
        title:
          `${label} [direct]`,
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
    // jwplayer sources
    // =================================
    const scriptText =
      $("script")
      .map((_, el) =>
        $(el).html()
      )
      .get()
      .join("\n");

    const jwMatches =
      scriptText.match(
        /file\s*:\s*["'](https?:\/\/[^"']+)["']/gi
      ) || [];

    for (const m of jwMatches) {

      const urlMatch =
        m.match(
          /https?:\/\/[^"']+/
        );

      if (!urlMatch)
        continue;

      streams.push({
        url: urlMatch[0],
        quality:
          extractQuality(
            urlMatch[0]
          ),
        title:
          `${label} [jwplayer]`,
        subtitles: []
      });

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

    console.log(
      "[PIRATEX TITLE]",
      title
    );

    // =================================
    // SEARCH
    // =================================
    const searchUrl =
      `${BASE_URL}/?s=${encodeURIComponent(title)}`;

    const searchHtml =
      await fetchText(
        searchUrl
      );

    if (!searchHtml)
      return [];

    const $s =
      cheerio.load(searchHtml);

    let pageUrl =
      null;

    $s("a").each((_, el) => {

      if (pageUrl)
        return;

      const href =
        $s(el).attr("href");

      const txt =
        (
          $s(el).text() || ""
        ).toLowerCase();

      if (
        href &&
        href.startsWith("http") &&
        txt.includes(
          title.toLowerCase()
        )
      ) {

        pageUrl = href;

      }

    });

    // fallback
    if (!pageUrl) {

      const first =
        $s("a[href*='piratexplay']")
        .first()
        .attr("href");

      if (first)
        pageUrl = first;

    }

    if (!pageUrl)
      return [];

    console.log(
      "[PIRATEX PAGE]",
      pageUrl
    );

    // =================================
    // TV HANDLING
    // =================================
    if (
      mediaType === "tv"
    ) {

      const showHtml =
        await fetchText(
          pageUrl
        );

      const $show =
        cheerio.load(
          showHtml
        );

      let epUrl =
        null;

      $show("a").each((_, el) => {

        if (epUrl)
          return;

        const href =
          $show(el)
          .attr("href");

        const txt =
          $show(el)
          .text();

        const s =
          txt.match(
            /S(\d+)/i
          );

        const e =
          txt.match(
            /E(\d+)/i
          );

        if (
          s &&
          e &&
          parseInt(s[1]) === parseInt(season || 1) &&
          parseInt(e[1]) === parseInt(episode || 1)
        ) {

          epUrl = href;

        }

      });

      if (epUrl)
        pageUrl = epUrl;

    }

    // =================================
    // FINAL PAGE
    // =================================
    const finalHtml =
      await fetchText(
        pageUrl
      );

    if (!finalHtml)
      return [];

    const $ =
      cheerio.load(
        finalHtml
      );

    const streams =
      [];

    // =================================
    // iframe extraction
    // =================================
    $("iframe").each((_, el) => {

      const src =
        $(el).attr("src") ||
        $(el).attr("data-src");

      if (
        !src ||
        !src.startsWith("http")
      ) return;

      streams.push(src);

    });

    const finalStreams =
      [];

    // =================================
    // DEEP EXTRACTION
    // =================================
    for (const iframe of streams) {

      try {

        const extracted =
          await extractVideoLinks(
            iframe,
            "Piratexplay"
          );

        finalStreams.push(
          ...extracted
        );

      } catch (e) {}

    }

    // dedupe
    const seen =
      new Set();

    return finalStreams.filter(s => {

      if (
        seen.has(s.url)
      ) return false;

      seen.add(s.url);

      return true;

    });

  } catch (e) {

    console.log(
      "[PIRATEX ERROR]",
      e
    );

    return [];

  }

}

module.exports = {
  getStreams
};
