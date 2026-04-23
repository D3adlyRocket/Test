/**
 * Movies4u - Reverted Original & Nuvio Hybrid
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try { step(generator.next(value)); } catch (e) { reject(e); }
    };
    var rejected = (value) => {
      try { step(generator.throw(value)); } catch (e) { reject(e); }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/providers/movies4u/index.js
var cheerio = require("cheerio-without-node-native");
var TMDB_API_KEY = "1b3113663c9004682ed61086cf967c44";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var MAIN_URL = "https://new1.movies4u.style";
var M4UPLAY_BASE = "https://m4uplay.store";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": MAIN_URL + "/"
};

function fetchWithTimeout(url, options, timeout) {
  if (!timeout) timeout = 10000;
  return __async(this, null, function* () {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = yield fetch(url, __spreadProps(__spreadValues({}, options), {
        signal: controller.signal
      }));
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  });
}

function unpack(p, a, c, k) {
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
    }
  }
  return p;
}

// ... Keep all your original functions (findBestTitleMatch, formatStreamTitle, etc) exactly as they were ...
// I am including the core extraction functions to ensure they match your original exactly

function extractFromM4UPlay(embedUrl) {
  return __async(this, null, function* () {
    try {
      const response = yield fetchWithTimeout(embedUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": MAIN_URL }) });
      const html = yield response.text();
      const packerMatch = html.match(/eval\(function\(p,a,c,k,e,d\)\{.*?\}\s*\((.*)\)\s*\)/s);
      let unpackedHtml = html;
      if (packerMatch) {
        try {
          const rawArgs = packerMatch[1].trim();
          const argsMatch = rawArgs.match(/^['"](.*)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"](.*?)['"]\.split\(['"]\|['"]\)/s);
          if (argsMatch) unpackedHtml += "\n" + unpack(argsMatch[1], parseInt(argsMatch[2]), parseInt(argsMatch[3]), argsMatch[4].split("|"));
        } catch (e) {}
      }
      const m3u8Match = unpackedHtml.match(/(https?:\/\/[^\s"']+\.(?:m3u8|txt)(?:\?[^\s"']*)?)/);
      if (m3u8Match) {
        let url = m3u8Match[1];
        if (url.startsWith("/")) url = M4UPLAY_BASE + url;
        return [{ url: url, quality: "Unknown", isMaster: url.includes("master") }];
      }
      return [];
    } catch (e) { return []; }
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      // Reverting to your TMDB detail fetch logic
      const type = mediaType === "movie" ? "movie" : "tv";
      const tmdbRes = yield fetch(`${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`);
      const data = yield tmdbRes.json();
      const title = data.title || data.name;

      const searchRes = yield fetch(`${MAIN_URL}/?s=${encodeURIComponent(title)}`, { headers: HEADERS });
      const searchHtml = yield searchRes.text();
      const $ = cheerio.load(searchHtml);
      const firstResult = $("h3.entry-title a").attr("href");

      if (!firstResult) return [];

      const pageRes = yield fetch(firstResult, { headers: HEADERS });
      const pageHtml = yield pageRes.text();
      const $$ = cheerio.load(pageHtml);
      const streams = [];

      const watchLink = $$("a.btn.btn-zip").attr("href");
      if (watchLink) {
        const results = yield extractFromM4UPlay(watchLink);
        for (const res of results) {
          streams.push({
            name: "Movies4u",
            title: "Movies4u • " + title,
            url: res.url,
            quality: "Auto",
            headers: {
              "Referer": M4UPLAY_BASE + "/",
              "User-Agent": HEADERS["User-Agent"]
            }
          });
        }
      }
      return streams;
    } catch (e) { return []; }
  });
}

module.exports = { getStreams };
