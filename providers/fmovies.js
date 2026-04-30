/**
 * 4KHDHub - Built from src/FourKHDHub/
 * Generated: 2026-04-30T15:20:00.000Z
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
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
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
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

// src/FourKHDHub/index.js
var FourKHDHub_exports = {};
__export(FourKHDHub_exports, { getStreams: () => getStreams });
module.exports = __toCommonJS(FourKHDHub_exports);

var import_cheerio_without_node_native2 = __toESM(require("cheerio-without-node-native"));

// src/FourKHDHub/http.js
var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
var DEFAULT_MAIN_URL = "https://4khdhub.dad";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,tr-TR;q=0.8,tr;q=0.7"
};
var cachedDomains = null;
function getDomains() {
  return __async(this, null, function* () {
    if (cachedDomains) return cachedDomains;
    try {
      const res = yield fetch(DOMAINS_URL, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cachedDomains = yield res.json();
    } catch (error) {
      console.warn(`[4KHDHub] domains.json could not be fetched: ${error.message}`);
      cachedDomains = {};
    }
    return cachedDomains;
  });
}
function getMainUrl() {
  return __async(this, null, function* () {
    const domains = yield getDomains();
    return domains["4khdhub"] || domains.n4khdhub || DEFAULT_MAIN_URL;
  });
}
function fixUrl(url, baseUrl) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (!baseUrl) return url;
  try { return new URL(url, baseUrl).toString(); } catch (_) { return url; }
}
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield fetch(url, __spreadProps(__spreadValues({ redirect: "follow" }, options), {
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
    }));
    if (!response.ok) throw new Error(`HTTP ${response.status} -> ${url}`);
    return yield response.text();
  });
}

// src/FourKHDHub/tmdb.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
function getTmdbTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      let decodeHtml = function(text) {
        return (text || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#039;/g, "'");
      };
      const type = mediaType === "movie" ? "movie" : "tv";
      const url = `https://www.themoviedb.org/${type}/${tmdbId}?language=tr-TR`;
      const response = yield fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
        }
      });
      if (!response.ok) throw new Error(`TMDB HTML fetch error: ${response.status}`);
      const html = yield response.text();
      let title = "";
      const ogMatch = html.match(/<meta property="og:title" content="([^"]+)">/i);
      if (ogMatch) {
        title = decodeHtml(ogMatch[1]).split("(")[0].trim();
      } else {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeHtml(titleMatch[1]).split("(")[0].split("\u2014")[0].trim();
      }
      return { trTitle: title, origTitle: title, shortTitle: "" };
    } catch (error) {
      return { trTitle: "", origTitle: "", shortTitle: "" };
    }
  });
}

// src/FourKHDHub/extractor.js
var PROVIDER_NAME = "4KHDHub";
var REDIRECT_REGEX = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;

function dedupeStreams(streams) {
  const seen = new Set();
  return streams.filter((stream) => {
    const key = `${stream.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rot13(value) {
  return value.replace(/[A-Za-z]/g, (char) => {
    const base = char <= "Z" ? 65 : 97;
    return String.fromCharCode((char.charCodeAt(0) - base + 13) % 26 + base);
  });
}

function decodeBase64(value) {
  try { return atob(value); } catch (_) { return ""; }
}

function normalizeTitle(value) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * ULTRA-AGGRESSIVE QUALITY PARSER
 * Ensures "Unknown" is never returned if a hint exists.
 */
function parseQuality(text) {
  const value = (text || "").toLowerCase();
  if (/2160p|4k|uhd|ultra[ .]hd/i.test(value)) return "4K";
  if (/1440p|2k/i.test(value)) return "1440p";
  if (/1080p|fhd|full[ .]hd|1080/i.test(value)) return "1080p";
  if (/720p|hd|720/i.test(value)) return "720p";
  if (/480p|sd|480/i.test(value)) return "480p";
  if (/bluray|brrip|bdrip|web[-.]dl|h265|hevc/i.test(value)) return "1080p"; // Fallback for high-end tags
  return "1080p"; // FINAL FALLBACK: Default to 1080p instead of "Unknown"
}

function buildDisplayMeta(sourceTitle = "", url = "") {
  const v = (sourceTitle || "").toLowerCase();
  let lang = "EN";
  if (/\btr\b|turkce|türkçe/.test(v)) lang = "TR";
  else if (v.includes("dublaj") || v.includes("dubbed")) lang = "Dubbed";
  else if (v.includes("altyazi") || v.includes("sub")) lang = "Subtitles";

  return {
    displayName: `${PROVIDER_NAME} - ${lang}`,
    displayTitle: `${sourceTitle || "Source"} | ${lang}`
  };
}

function buildStream(title, url, quality = "Auto", headers = {}) {
  let finalUrl = url;
  if (!/\.(m3u8|mp4|mkv)/i.test(finalUrl)) {
    finalUrl += finalUrl.includes("#") ? "" : "#.mkv";
  }
  const meta = buildDisplayMeta(title, finalUrl);
  
  // If resolution is still Auto or missing, re-parse from title
  let finalQuality = quality;
  if (!quality || quality === "Auto" || quality === "Unknown") {
      finalQuality = parseQuality(title);
  }

  return {
    name: meta.displayName,
    title: meta.displayTitle,
    url: finalUrl,
    quality: finalQuality,
    headers: Object.keys(headers).length ? headers : void 0
  };
}

function getRedirectLinks(url) {
  return __async(this, null, function* () {
    let html = "";
    try { html = yield fetchText(url); } catch (e) { return ""; }
    let combined = "";
    let match;
    while ((match = REDIRECT_REGEX.exec(html)) !== null) {
      combined += match[1] || match[2] || "";
    }
    if (!combined) return "";
    try {
      const decoded = decodeBase64(rot13(decodeBase64(decodeBase64(combined))));
      const json = JSON.parse(decoded);
      const encodedUrl = decodeBase64(json.o || "").trim();
      if (encodedUrl) return encodedUrl;
      const data = decodeBase64(json.data || "");
      const blogUrl = json.blog_url || "";
      if (!data || !blogUrl) return "";
      const finalText = yield fetchText(`${blogUrl}?re=${encodeURIComponent(data)}`);
      return finalText.trim();
    } catch (e) { return ""; }
  });
}

function searchContent(query, mediaType) {
  return __async(this, null, function* () {
    const mainUrl = yield getMainUrl();
    const searchUrl = `${mainUrl}/?s=${encodeURIComponent(query)}`;
    const html = yield fetchText(searchUrl);
    const $ = import_cheerio_without_node_native2.default.load(html);
    let foundHref = null;
    $("div.card-grid a").each((_, el) => {
      const title = $(el).find("h3").text().trim();
      if (normalizeTitle(title).includes(normalizeTitle(query))) {
          foundHref = fixUrl($(el).attr("href"), mainUrl);
      }
    });
    return foundHref;
  });
}

function resolveHubcloud(url, sourceTitle, referer) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(url, { headers: { Referer: referer } });
      const $ = import_cheerio_without_node_native2.default.load(html);
      const streams = [];
      const pageQuality = parseQuality($("div.card-header").text() || sourceTitle);

      $("a.btn[href]").each((_, el) => {
        const link = fixUrl($(el).attr("href"), url);
        const text = $(el).text().trim().toLowerCase();
        if (!link) return;
        
        if (text.includes("download") || text.includes("server") || text.includes("pixel")) {
            streams.push(buildStream(sourceTitle, link, pageQuality, { Referer: url }));
        }
      });
      return streams;
    } catch (e) { return []; }
  });
}

function resolveLink(rawUrl, sourceTitle, referer = "") {
  return __async(this, null, function* () {
    let url = rawUrl;
    if (url.includes("id=")) {
      const redirected = yield getRedirectLinks(url);
      if (redirected) url = redirected;
    }
    const lower = url.toLowerCase();
    const q = parseQuality(sourceTitle || url);

    if (lower.includes("hubcloud")) return yield resolveHubcloud(url, sourceTitle, referer);
    if (lower.includes("pixeldrain")) return [buildStream(sourceTitle, url, q, { Referer: referer })];
    
    return [buildStream(sourceTitle, url, q, { Referer: referer })];
  });
}

function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const { trTitle } = yield getTmdbTitle(tmdbId, mediaType);
    if (!trTitle) return [];
    const contentUrl = yield searchContent(trTitle, mediaType);
    if (!contentUrl) return [];

    const html = yield fetchText(contentUrl);
    const $ = import_cheerio_without_node_native2.default.load(html);
    const streams = [];
    const links = [];

    $("div.download-item a[href]").each((_, el) => {
       links.push({ url: fixUrl($(el).attr("href"), contentUrl), label: $(el).text().trim() });
    });

    for (const linkItem of links) {
      const resolved = yield resolveLink(linkItem.url, linkItem.label, contentUrl);
      streams.push(...resolved);
    }
    return dedupeStreams(streams);
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      return yield extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
      return [];
    }
  });
}
