const cheerio = require("cheerio");

// ======================================
// STATIC VALUES
// ======================================
const BASE_URL =
  "https://dataapi.yomoviesapk.com/";

const TMDB_API_KEY =
  "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "cf-access-client-id":
    "e3a15ad999dab7f3592f3d855e0ec6ed.access",

  "cf-access-client-secret":
    "8a22536e2dac86369a2caa911d55a89a109939cc69e6646e51bf5d8527a1dca5",

  "user-agent":
    "Mozilla/5.0"
};

// ======================================
// QUALITY
// ======================================
function inferQuality(str = "") {
  const l = str.toLowerCase();

  if (l.includes("2160") || l.includes("4k"))
    return "4K";

  if (l.includes("1080"))
    return "1080p";

  if (l.includes("720"))
    return "720p";

  if (l.includes("480"))
    return "480p";

  if (l.includes("360"))
    return "360p";

  return "Unknown";
}

// ======================================
// FETCH JSON
// ======================================
async function fetchJson(url) {
  try {

    const res = await fetch(url, {
      headers: HEADERS,
      skipSizeCheck: true
    });

    const text = await res.text();

    return JSON.parse(text);

  } catch (e) {
    return null;
  }
}

// ======================================
// RESOLVE VIDEO LINKS
// ======================================
async function resolveVideo(url) {
  try {

    // direct media
    if (
      url.includes(".mp4") ||
      url.includes(".m3u8")
    ) {
      return [url];
    }

    // load page
    const html = await (
      await fetch(url, {
        headers: HEADERS,
        skipSizeCheck: true
      })
    ).text();

    const $ = cheerio.load(html);

    const found = [];

    // iframe
    $("iframe").each((_, el) => {
      const src = $(el).attr("src");

      if (src && src.startsWith("http")) {
        found.push(src);
      }
    });

    // source
    $("source").each((_, el) => {
      const src = $(el).attr("src");

      if (src) {
        found.push(src);
      }
    });

    // video
    $("video").each((_, el) => {
      const src = $(el).attr("src");

      if (src) {
        found.push(src);
      }
    });

    return found;

  } catch (e) {
    return [];
  }
}

// ======================================
// SEARCH
// ======================================
async function searchRingZ(title) {

  const endpoints = [
    "Nwm.json",
    "Nws.json",
    "lstanime.json"
  ];

  const lcTitle = title.toLowerCase();

  for (const ep of endpoints) {

    try {

      const data =
        await fetchJson(BASE_URL + ep);

      if (!data) continue;

      // broader extraction
      const arrays = [];

      for (const k of Object.keys(data)) {
        if (Array.isArray(data[k])) {
          arrays.push(...data[k]);
        }
      }

      for (const item of arrays) {

        const name =
          (item.mn ||
           item.name ||
           item.title ||
           "").toLowerCase();

        if (!name) continue;

        if (
          name.includes(lcTitle) ||
          lcTitle.includes(name)
        ) {
          return item;
        }
      }

    } catch (e) {}
  }

  return null;
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
        await fetch(tmdbUrl, {
          skipSizeCheck: true
        })
      ).json();

    const title =
      media.title ||
      media.name;

    if (!title) return [];

    console.log("[RINGZ TITLE]", title);

    // ==================================
    // SEARCH
    // ==================================
    const item =
      await searchRingZ(title);

    if (!item) {
      console.log("[RINGZ] No match");
      return [];
    }

    // ==================================
    // EXTRACT URLS
    // ==================================
    const streams = [];

    for (const key of Object.keys(item)) {

      try {

        const value = item[key];

        if (
          typeof value !== "string"
        ) continue;

        if (
          !value.startsWith("http")
        ) continue;

        // TV filtering
        if (
          mediaType === "tv" &&
          episode
        ) {
          const epNum =
            key.match(/\d+/)?.[0];

          if (
            epNum &&
            parseInt(epNum) !==
            parseInt(episode)
          ) {
            continue;
          }
        }

        // resolve stream
        const resolved =
          await resolveVideo(value);

        if (
          resolved &&
          resolved.length
        ) {

          for (const r of resolved) {

            streams.push({
              url: r,
              quality:
                inferQuality(
                  r + " " + key
                ),
              title:
                `RingZ [${key}]`,
              subtitles: []
            });

          }

        } else {

          streams.push({
            url: value,
            quality:
              inferQuality(
                value + " " + key
              ),
            title:
              `RingZ [${key}]`,
            subtitles: []
          });

        }

      } catch (e) {}
    }

    return streams.slice(0, 20);

  } catch (e) {
    console.log("[RINGZ ERROR]", e);
    return [];
  }
}

// ======================================
// EXPORT
// ======================================
module.exports = {
  getStreams
};
