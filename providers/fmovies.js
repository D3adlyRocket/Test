/**
 * 4KHDHub - FULL CODE RESTORED WITH RESOLUTION FIX
 * Based on the Logic Analysis: Quality is derived from Link Labels & URLs.
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
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/FourKHDHub/index.js
var FourKHDHub_exports = {};
__export(FourKHDHub_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(FourKHDHub_exports);

// src/FourKHDHub/extractor.js
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
  if (url.startsWith("http")) return url;
  try { return new URL(url, baseUrl).toString(); } catch (_) { return url; }
}
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield fetch(url, __spreadProps(__spreadValues({ redirect: "follow" }, options), {
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
    }));
    return yield response.text();
  });
}

// src/FourKHDHub/tmdb.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
async function getTmdbTitle(tmdbId, mediaType) {
    try {
        const type = mediaType === "movie" ? "movie" : "tv";
        const url = `https://www.themoviedb.org/${type}/${tmdbId}`;
        const html = await fetchText(url);
        const match = html.match(/<meta property="og:title" content="([^"]+)">/i);
        const title = match ? match[1].split("(")[0].trim() : "";
        return { trTitle: title, origTitle: title, shortTitle: "" };
    } catch (e) { return { trTitle: "", origTitle: "", shortTitle: "" }; }
}

// FIX: ANALYZED RESOLUTION PARSER
function parseQuality(text, url = "") {
  const combined = `${text} ${url}`.toLowerCase();
  if (/2160p|4k|uhd/i.test(combined)) return "4K";
  if (/1440p|2k/i.test(combined)) return "1440p";
  if (/1080p|fhd|1080/i.test(combined)) return "1080p";
  if (/720p|hd|720/i.test(combined)) return "720p";
  if (/480p|sd|480/i.test(combined)) return "480p";
  // Fallback for high-end rips that lack specific P-tags
  if (/bluray|brrip|bdrip|web[-.]dl/i.test(combined)) return "1080p";
  return "1080p"; // Guaranteed No "Unknown"
}

function dedupeStreams(streams) {
  const seen = new Set();
  return streams.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
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

function buildDisplayMeta(sourceTitle = "", url = "") {
  const v = (sourceTitle || "").toLowerCase();
  let lang = "EN";
  if (/\btr\b|turkce|türkçe/.test(v)) lang = "TR";
  return {
    displayName: `4KHDHub - ${lang}`,
    displayTitle: `${sourceTitle || "Source"} | ${lang}`
  };
}

function buildStream(title, url, quality = "Auto", headers = {}) {
  let finalUrl = url;
  if (!/\.(m3u8|mp4|mkv)/i.test(finalUrl)) finalUrl += "#.mkv";
  
  const finalQuality = (quality === "Auto" || quality === "Unknown") ? parseQuality(title, url) : quality;
  const meta = buildDisplayMeta(title, finalUrl);

  return {
    name: meta.displayName,
    title: `${meta.displayTitle.split('|')[0].trim()} | ${finalQuality}`,
    url: finalUrl,
    quality: finalQuality,
    headers: Object.keys(headers).length ? headers : void 0
  };
}

async function getRedirectLinks(url) {
  let html = "";
  try { html = await fetchText(url); } catch (e) { return ""; }
  const REDIRECT_REGEX = /s\('o','([A-Za-z0-9+/=]+)'/g;
  let match = REDIRECT_REGEX.exec(html);
  if (!match) return "";
  try {
    const decoded = decodeBase64(rot13(decodeBase64(decodeBase64(match[1]))));
    const json = JSON.parse(decoded);
    return decodeBase64(json.o || "").trim();
  } catch (e) { return ""; }
}

async function resolveLink(rawUrl, sourceTitle, referer = "") {
  let url = rawUrl;
  if (url.includes("id=")) {
      const red = await getRedirectLinks(url);
      if (red) url = red;
  }
  return [buildStream(sourceTitle, url, "Auto", { Referer: referer })];
}

async function extractStreams(tmdbId, mediaType, season, episode) {
  const { trTitle } = await getTmdbTitle(tmdbId, mediaType);
  if (!trTitle) return [];

  const mainUrl = await getMainUrl();
  const searchHtml = await fetchText(`${mainUrl}/?s=${encodeURIComponent(trTitle)}`);
  const $search = import_cheerio_without_node_native2.default.load(searchHtml);
  const contentUrl = fixUrl($search("div.card-grid a").first().attr("href"), mainUrl);
  if (!contentUrl) return [];

  const html = await fetchText(contentUrl);
  const $ = import_cheerio_without_node_native2.default.load(html);
  const streams = [];

  $("div.download-item a[href], div.episode-download-item a[href]").each((_, el) => {
    const href = fixUrl($(el).attr("href"), contentUrl);
    const label = $(el).text().trim() || "Stream";
    
    // Series handling
    if (mediaType === "tv") {
      const container = $(el).closest('.season-item, .download-item').text();
      if (!container.includes(`S${season}`) && !container.includes(`Season ${season}`)) return;
    }

    streams.push(buildStream(label, href, "Auto", { Referer: contentUrl }));
  });

  return dedupeStreams(streams);
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
