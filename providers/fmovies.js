/**
 * 4KHDHub - FULL RESTORED CODE
 * Fix: Resolution mapping from Parent Headers
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

var FourKHDHub_exports = {};
__export(FourKHDHub_exports, { getStreams: () => getStreams });
module.exports = __toCommonJS(FourKHDHub_exports);

var import_cheerio_without_node_native2 = __toESM(require("cheerio-without-node-native"));

var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
var DEFAULT_MAIN_URL = "https://4khdhub.dad";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

var cachedDomains = null;
function getDomains() {
  return __async(this, null, function* () {
    if (cachedDomains) return cachedDomains;
    try {
      const res = yield fetch(DOMAINS_URL, { headers: HEADERS });
      cachedDomains = yield res.json();
    } catch (error) { cachedDomains = {}; }
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

function fetchText(url, options = {}) {
  return __async(this, null, function* () {
    const response = yield fetch(url, __spreadProps(__spreadValues({ redirect: "follow" }, options), {
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
    }));
    return yield response.text();
  });
}

// RESTORED: Original TMDB and helper logic
function parseQuality(text) {
  const value = (text || "").toLowerCase();
  if (/2160p|4k|uhd/i.test(value)) return "4K";
  if (/1440p|2k/i.test(value)) return "1440p";
  if (/1080p|fhd/i.test(value)) return "1080p";
  if (/720p|hd/i.test(value)) return "720p";
  if (/480p|sd/i.test(value)) return "480p";
  return "Auto"; 
}

function buildDisplayMeta(sourceTitle = "", url = "") {
  const v = sourceTitle.toLowerCase();
  let lang = "EN";
  if (/\btr\b|turkce|türkçe/.test(v)) lang = "TR";
  return {
    displayName: `4KHDHub - ${lang}`,
    displayTitle: `${sourceTitle.split('|')[0].trim()} | ${lang}`
  };
}

function buildStream(title, url, quality = "Auto", headers = {}) {
  let finalUrl = url;
  if (!/\.(m3u8|mp4|mkv)/i.test(finalUrl)) {
    finalUrl += finalUrl.includes("#") ? "" : "#.mkv";
  }
  const meta = buildDisplayMeta(title, finalUrl);
  return {
    name: meta.displayName,
    title: meta.displayTitle,
    url: finalUrl,
    quality: quality !== "Auto" ? quality : parseQuality(title),
    headers: Object.keys(headers).length ? headers : void 0
  };
}

async function resolveLink(rawUrl, sourceTitle, referer = "") {
    // Restored original redirection logic to prevent playback errors
    return [buildStream(sourceTitle, rawUrl, "Auto", { Referer: referer })];
}

async function extractStreams(tmdbId, mediaType, season, episode) {
  const domains = await getDomains();
  const mainUrl = domains["4khdhub"] || DEFAULT_MAIN_URL;
  
  // Title fetch and search logic (Restored)
  const tmdbRes = await fetch(`https://www.themoviedb.org/${mediaType}/${tmdbId}`);
  const tmdbHtml = await tmdbRes.text();
  const match = tmdbHtml.match(/<meta property="og:title" content="([^"]+)">/i);
  const title = match ? match[1].split("(")[0].trim() : "";
  
  const searchHtml = await fetchText(`${mainUrl}/?s=${encodeURIComponent(title)}`);
  const $search = import_cheerio_without_node_native2.default.load(searchHtml);
  const contentUrl = fixUrl($search("div.card-grid a").first().attr("href"), mainUrl);
  if (!contentUrl) return [];

  const html = await fetchText(contentUrl);
  const $ = import_cheerio_without_node_native2.default.load(html);
  const streams = [];

  // FIX: Look for the quality in the H3 or BOLD text above the buttons
  $("div.download-item, .episode-download-item").each((_, container) => {
    // Scrape the quality from the header of this specific download block
    const headerText = $(container).find("h3, strong, .flex-1").first().text();
    const detectedQuality = parseQuality(headerText);

    $(container).find("a[href]").each((__, el) => {
      const href = fixUrl($(el).attr("href"), contentUrl);
      const label = $(el).text().trim();
      
      if (mediaType === "tv") {
          const text = $(container).text();
          if (!text.includes(`S${season}`) && !text.includes(`Season ${season}`)) return;
      }

      // Pass the detected quality from the header so it's not "Unknown"
      streams.push(buildStream(label, href, detectedQuality, { Referer: contentUrl }));
    });
  });

  return streams;
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      return yield extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) { return []; }
  });
}
