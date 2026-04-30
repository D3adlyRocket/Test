/**
 * FourKHDHub - Full Restore & Resolution Fix
 * Focus: Restoring fetch capability while forcing 4K detection.
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

var FourKHDHub_exports = {};
__export(FourKHDHub_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(FourKHDHub_exports);

var import_cheerio_without_node_native2 = __toESM(require("cheerio-without-node-native"));

var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
var DEFAULT_MAIN_URL = "https://4khdhub.dad";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,tr-TR;q=0.8,tr;q=0.7"
};

var cachedDomains = null;
async function getDomains() {
  if (cachedDomains) return cachedDomains;
  try {
    const res = await fetch(DOMAINS_URL, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedDomains = await res.json();
  } catch (error) {
    cachedDomains = {};
  }
  return cachedDomains;
}

async function getMainUrl() {
  const domains = await getDomains();
  return domains["4khdhub"] || domains.n4khdhub || DEFAULT_MAIN_URL;
}

function fixUrl(url, baseUrl) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (!baseUrl) return url;
  try { return new URL(url, baseUrl).toString(); } catch (_) { return url; }
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, __spreadProps(__spreadValues({ redirect: "follow" }, options), {
    headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
  }));
  if (!response.ok) throw new Error(`HTTP ${response.status} -> ${url}`);
  return await response.text();
}

function parseQuality(text) {
  const value = (text || "").toLowerCase();
  if (/2160p|4k|uhd|ultrahd/i.test(value)) return "4K";
  if (/1440p|2k/i.test(value)) return "1440p";
  if (/1080p|fhd/i.test(value)) return "1080p";
  if (/720p|hd/i.test(value)) return "720p";
  if (/480p|sd/i.test(value)) return "480p";
  return "Auto";
}

function inferLanguageLabel(text = "") {
  const v = text.toLowerCase();
  if (/\btr\b|turkce|türkçe/.test(v)) return "TR";
  if (/\ben\b|english/.test(v)) return "EN";
  return "Dual";
}

function buildStream(title, url, quality = "Auto", headers = {}) {
  let finalUrl = url;
  if (!/\.(m3u8|mp4|mkv)/i.test(finalUrl)) {
    finalUrl += finalUrl.includes("#") ? "" : "#.mkv";
  }
  const q = parseQuality(title) !== "Auto" ? parseQuality(title) : quality;
  const lang = inferLanguageLabel(title);
  
  return {
    name: `4KHDHub - ${lang}`,
    title: `${q} | ${lang} | ${title.split('-')[0].trim()}`,
    url: finalUrl,
    quality: q,
    headers: Object.keys(headers).length ? headers : void 0
  };
}

async function getRedirectLinks(url) {
  try {
    const html = await fetchText(url);
    const REDIRECT_REGEX = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;
    let combined = "";
    let match;
    while ((match = REDIRECT_REGEX.exec(html)) !== null) {
      combined += match[1] || match[2] || "";
    }
    if (!combined) return "";
    const decoded = atob(combined.replace(/[A-Za-z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13))));
    const json = JSON.parse(decoded);
    return atob(json.o || "").trim();
  } catch (e) { return ""; }
}

async function resolveHubcloud(url, sourceTitle, referer) {
  try {
    const html = await fetchText(url, { headers: { Referer: referer } });
    const $ = import_cheerio_without_node_native2.default.load(html);
    const streams = [];
    const headerText = $("div.card-header").text() || sourceTitle;
    
    $("a.btn[href]").each((_, el) => {
      const link = $(el).attr("href");
      if (link && !link.includes("javascript")) {
        streams.push(buildStream(headerText, link, parseQuality(headerText), { Referer: url }));
      }
    });
    return streams;
  } catch (e) { return []; }
}

async function extractStreams(tmdbId, mediaType, season, episode) {
  const mainUrl = await getMainUrl();
  // Simplified search for testing
  const searchUrl = `${mainUrl}/?s=${tmdbId}`; 
  const html = await fetchText(searchUrl);
  const $ = import_cheerio_without_node_native2.default.load(html);
  
  const link = $("div.card-grid a").first().attr("href");
  if (!link) return [];

  const postHtml = await fetchText(link);
  const $post = import_cheerio_without_node_native2.default.load(postHtml);
  const streams = [];
  
  const downloadLinks = [];
  $post("a[href*='hubcloud'], a[href*='hubdrive']").each((_, el) => {
    downloadLinks.push({ url: $(el).attr("href"), label: $post(el).text() });
  });

  for (const item of downloadLinks) {
    const resolved = await resolveHubcloud(item.url, item.label, link);
    streams.push(...resolved);
  }

  return streams;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    return await extractStreams(tmdbId, mediaType, season, episode);
  } catch (error) {
    return [];
  }
}
