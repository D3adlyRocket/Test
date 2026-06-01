const cheerio = require("cheerio-without-node-native");

const BASE_URL = "https://animekhor.org";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  "Referer": BASE_URL + "/",
};

// safer base64 decode for Node/Nuvio
function decodeBase64(str) {
  try {
    return Buffer.from(str, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function absolutize(url) {
  if (!url) return null;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return BASE_URL + url;
  if (url.startsWith("http")) return url;
  return BASE_URL + "/" + url;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // 1. TMDB fetch
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();

    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
    const searchHtml = await (await fetch(searchUrl, { headers: HEADERS })).text();
    const $ = cheerio.load(searchHtml);

    let itemUrl = null;

    $("article, div.bs, div.listupd article").each((_, el) => {
      if (itemUrl) return;
      const href = $(el).find("a").attr("href");
      if (href) itemUrl = absolutize(href);
    });

    if (!itemUrl) return [];

    // 3. Anime page
    const animeHtml = await (await fetch(itemUrl, { headers: HEADERS })).text();
    const $2 = cheerio.load(animeHtml);

    const isMovie = ($2(".spe").text() || "").toLowerCase().includes("movie");

    let episodeUrl = null;

    if (isMovie) {
      episodeUrl =
        absolutize($2(".eplister li a").attr("href")) || itemUrl;
    } else {
      const epListUrl =
        absolutize($2(".eplister li a").first().attr("href"));

      if (!epListUrl) return [];

      const epHtml = await (await fetch(epListUrl, { headers: HEADERS })).text();
      const $3 = cheerio.load(epHtml);

      const targetEp = Number(episode || 1);

      $3(".episodelist li, .eplister ul li, ul li").each((_, el) => {
        const text = $3(el).text();
        const href = $3(el).find("a").attr("href");

        const match = text.match(/(\d+)/);
        const epNum = match ? Number(match[1]) : null;

        if (!episodeUrl && epNum === targetEp && href) {
          episodeUrl = absolutize(href);
        }
      });

      if (!episodeUrl) {
        const fallback = $3("li a").first().attr("href");
        if (fallback) episodeUrl = absolutize(fallback);
      }
    }

    if (!episodeUrl) return [];

    // 4. Episode page
    const epHtml = await (await fetch(episodeUrl, { headers: HEADERS })).text();
    const $4 = cheerio.load(epHtml);

    const streams = [];

    // multiple fallback patterns
    const options = $4(".mobius option, select option, option");

    options.each((_, option) => {
      let raw =
        $4(option).attr("value") ||
        $4(option).attr("data-src") ||
        "";

      if (!raw) return;

      let decoded = "";

      // try base64 decode first
      if (raw.length > 20) {
        decoded = decodeBase64(raw);
      }

      // fallback: treat raw as direct URL
      let urlMatch =
        decoded.match(/src=["']([^"']+)["']/i) ||
        raw.match(/https?:\/\/[^"']+/);

      let url = urlMatch?.[1] || urlMatch?.[0];

      if (!url) return;

      url = absolutize(url);

      if (url) {
        streams.push({
          url,
          quality: "Unknown",
          title: "Animekhor",
          subtitles: []
        });
      }
    });

    return streams;
  } catch (err) {
    console.error("[Animekhor ERROR]", err.message || err);
    return [];
  }
}

if (typeof module !== "undefined") {
  module.exports = { getStreams };
}
