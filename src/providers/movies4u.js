/**
 * Movies4u - Built on 4KHDHub Framework
 * Optimized for Nuvio Android TV & Mobile
 */
"use strict";

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
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

var cheerio = require("cheerio-without-node-native");
var MAIN_URL = "https://new1.movies4u.style";
var M4UPLAY_BASE = "https://m4uplay.store";
var TMDB_KEY = "1b3113663c9004682ed61086cf967c44";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Framework standard fetcher
function fetchText(url, options = {}) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(url, {
        headers: __spreadValues({ "User-Agent": USER_AGENT }, options.headers)
      });
      return yield response.text();
    } catch (err) {
      return null;
    }
  });
}

// Movies4u Specific: Unpacker for hidden JS
function unpack(p, a, c, k) {
  while (c--) { if (k[c]) p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]); }
  return p;
}

function getTmdbDetails(tmdbId, type) {
  return __async(this, null, function* () {
    const endpoint = (type === "series" || type === "tv") ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}`;
    try {
      const response = yield fetch(url);
      const data = yield response.json();
      return {
        title: data.name || data.title,
        year: (data.first_air_date || data.release_date || "0").split("-")[0]
      };
    } catch (e) { return null; }
  });
}

function getStreams(tmdbId, type, season, episode) {
  return __async(this, null, function* () {
    const details = yield getTmdbDetails(tmdbId, type);
    if (!details) return [];

    const searchUrl = `${MAIN_URL}/?s=${encodeURIComponent(details.title)}`;
    const searchHtml = yield fetchText(searchUrl, { headers: { "Referer": MAIN_URL } });
    if (!searchHtml) return [];

    const $ = cheerio.load(searchHtml);
    let postUrl = $("h3.entry-title a").first().attr("href");
    if (!postUrl) return [];

    const pageHtml = yield fetchText(postUrl, { headers: { "Referer": MAIN_URL } });
    if (!pageHtml) return [];

    const $page = cheerio.load(pageHtml);
    const streams = [];
    const watchLinks = [];

    // Find M4UPlay buttons
    $page("a.btn.btn-zip").each((_, el) => {
      const href = $page(el).attr("href");
      if (href && href.includes("m4uplay")) {
        watchLinks.push({
          url: href,
          label: $page(el).text().trim()
        });
      }
    });

    for (const link of watchLinks) {
      try {
        const embedHtml = yield fetchText(link.url, { headers: { "Referer": postUrl } });
        if (!embedHtml) continue;

        let sourceToSearch = embedHtml;
        const packerMatch = embedHtml.match(/eval\(function\(p,a,c,k,e,d\)\{.*?\}\s*\((.*)\)\s*\)/s);
        
        if (packerMatch) {
          try {
            const parts = packerMatch[1].split(",");
            const p = parts[0].replace(/['"]/g, "");
            const a = parseInt(parts[1]);
            const c = parseInt(parts[2]);
            const k = parts[3].split(".split('|')")[0].replace(/['"]/g, "").split("|");
            sourceToSearch += unpack(p, a, c, k);
          } catch (e) {}
        }

        const m3u8Match = sourceToSearch.match(/(https?:\/\/[^\s"']+\.(?:m3u8|txt)(?:\?[^\s"']*)?)/);
        if (m3u8Match) {
          let streamUrl = m3u8Match[1];
          if (streamUrl.startsWith("/")) streamUrl = M4U_PLAY + streamUrl;

          streams.push({
            name: `Movies4u - ${link.label || 'Auto'}`,
            title: `${details.title} (${details.year})\nMovies4u Instant Server`,
            url: streamUrl,
            quality: link.label.includes("1080") ? "1080p" : "720p",
            headers: {
              "User-Agent": USER_AGENT,
              "Referer": M4U_PLAY + "/",
              "Origin": M4U_PLAY
            }
          });
        }
      } catch (e) {}
    }

    return streams;
  });
}

module.exports = { getStreams };
