/**
 * an1me - Built from src/an1me/
 * Generated: 2026-06-03T16:41:06.938Z
 */
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/an1me/index.js
var axios = require("axios");
var cheerio = require("cheerio");
var BASE_URL = "https://an1me.to";
var TMDB_API = "https://api.themoviedb.org/3";
var TMDB_KEYS = ["d7ce857613dc6a1cf739e2f8367b92e0"];
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": "https://an1me.to/"
};
function getMediaTitles(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const typePath = mediaType === "movie" ? "movie" : "tv";
    for (const key of TMDB_KEYS) {
      try {
        const url = `${TMDB_API}/${typePath}/${tmdbId}?api_key=${key}`;
        const res = yield axios.get(url);
        if (res.data) {
          const titles = /* @__PURE__ */ new Set();
          if (res.data.name) titles.add(res.data.name);
          if (res.data.title) titles.add(res.data.title);
          return Array.from(titles);
        }
      } catch (err) {
        continue;
      }
    }
    return ["One Piece"];
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log(`[An1me] Fetching streams for TMDB:${tmdbId} | S${season}E${episode}`);
    const streams = [];
    const queryTitles = yield getMediaTitles(tmdbId, mediaType);
    const targetEpisode = String(episode);
    for (let title of queryTitles) {
      try {
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const directPaths = [
          `${BASE_URL}/anime/${slug}/`,
          `${BASE_URL}/${slug}/`,
          `${BASE_URL}/anime/${slug}-greek-subs/`
        ];
        let catalogHtml = "";
        for (const path of directPaths) {
          try {
            const res = yield axios.get(path, { headers: HEADERS });
            if (res.data) {
              catalogHtml = res.data;
              console.log(`[An1me] Successfully reached catalog node: ${path}`);
              break;
            }
          } catch (e) {
            continue;
          }
        }
        if (!catalogHtml) {
          try {
            const fallbackSearch = yield axios.get(`${BASE_URL}/?s=${encodeURIComponent(title)}`, { headers: HEADERS });
            catalogHtml = fallbackSearch.data;
          } catch (err) {
            console.error("[An1me] Base indexing failure:", err.message);
          }
        }
        if (!catalogHtml) continue;
        const $ = cheerio.load(catalogHtml);
        let exactEpisodeUrl = "";
        $("a").each((_, el) => {
          const href = $(el).attr("href");
          if (!href) return;
          const cleanHref = href.toLowerCase();
          const epRegex = new RegExp(`[\\b-_/]${targetEpisode}([\\b-_/]|$|\\?)`);
          if (epRegex.test(cleanHref) && !cleanHref.includes("/anime/") && !cleanHref.includes("?s=")) {
            exactEpisodeUrl = href;
            return false;
          }
        });
        if (exactEpisodeUrl) {
          console.log(`[An1me] Matching Episode Node Found: ${exactEpisodeUrl}`);
          const pageRes = yield axios.get(exactEpisodeUrl, { headers: HEADERS });
          const page$ = cheerio.load(pageRes.data);
          page$("iframe, video, source, embed").each((_, videoEl) => {
            let src = page$(videoEl).attr("src") || page$(videoEl).attr("data-src") || page$(videoEl).attr("data-lazy-src");
            if (!src) return;
            if (src.startsWith("//")) src = "https:" + src;
            if (!src.includes("google") && !src.includes("facebook") && !src.includes("analytics")) {
              streams.push({
                name: "An1me (GR)",
                title: videoEl.name === "video" ? "Direct Source (GR Subs)" : "External Mirror Player",
                url: src,
                quality: "720p/1080p",
                headers: HEADERS
              });
            }
          });
          if (streams.length > 0) break;
        }
      } catch (err) {
        console.error(`[An1me] Runtime failure parsing entry "${title}":`, err.message);
      }
    }
    return streams;
  });
}
module.exports = { getStreams };
