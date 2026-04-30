/**
 * FourKHDHub - FULL RESTORE + RESOLUTION FIX
 * Fixes: Search logic restored, resolution forced into titles.
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

var FourKHDHub_exports = {};
__export(FourKHDHub_exports, { getStreams: () => getStreams });
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
function getDomains() {
  return __async(this, null, function* () {
    if (cachedDomains) return cachedDomains;
    try {
      const res = yield fetch(DOMAINS_URL, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

// RESTORED: TMDB Title logic to ensure search finds content
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
function getTmdbTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      let decodeHtml = function(text) {
        return (text || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#039;/g, "'");
      };
      const type = mediaType === "movie" ? "movie" : "tv";
      const url = `https://www.themoviedb.org/${type}/${tmdbId}?language=tr-TR`;
      const response = yield fetch(url, { headers: HEADERS });
      if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
      const html = yield response.text();
      let title = "";
      const ogMatch = html.match(/<meta property="og:title" content="([^"]+)">/i);
      if (ogMatch) title = decodeHtml(ogMatch[1]).split("(")[0].trim();
      const $ = import_cheerio_without_node_native.default.load(html);
      let origTitle = title;
      $("section.facts p").each((_, el) => {
        const text = $(el).text();
        if (text.includes("Orijinal") || text.includes("Original")) {
          const found = text.replace(/Orijinal Ba\u015Fl\u0131k|Original Title/g, "").trim();
          if (found) origTitle = decodeHtml(found);
        }
      });
      return { trTitle: title, origTitle, shortTitle: origTitle.split(":")[0].trim() };
    } catch (error) { return { trTitle: "", origTitle: "", shortTitle: "" }; }
  });
}

function parseQuality(text) {
  const value = (text || "").toLowerCase();
  if (/2160p|4k|uhd|ultra[ .]?hd/i.test(value)) return "4K";
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

// FIXED: Hardcodes resolution into the stream title
function buildStream(title, url, quality = "Auto", headers = {}) {
  let finalUrl = url;
  if (!/\.(m3u8|mp4|mkv)/i.test(finalUrl)) finalUrl += finalUrl.includes("#") ? "" : "#.mkv";
  
  const q = parseQuality(title) !== "Auto" ? parseQuality(title) : quality;
  const lang = inferLanguageLabel(title);
  const source = url.toLowerCase().includes("hubcloud") ? "HubCloud" : "Source";

  return {
    name: `4KHDHub - ${lang}`,
    title: `${source} | ${q} | ${lang}`, // Explicitly shows resolution in the list
    url: finalUrl,
    quality: q,
    headers: Object.keys(headers).length ? headers : void 0
  };
}

// RESTORED: Full redirect and scraping logic
function rot13(v) { return v.replace(/[a-zA-Z]/g, (c) => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26)); }

function getRedirectLinks(url) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(url);
      const match = html.match(/s\('o','([A-Za-z0-9+/=]+)'/);
      if (!match) return "";
      const json = JSON.parse(atob(rot13(atob(atob(match[1])))));
      return atob(json.o || "").trim();
    } catch (e) { return ""; }
  });
}

function resolveHubcloud(url, sourceTitle, referer) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(url, { headers: { Referer: referer } });
      const $ = import_cheerio_without_node_native2.default.load(html);
      const headerText = $("div.card-header").text().trim() || sourceTitle;
      const streams = [];
      $("a.btn[href]").each((_, el) => {
        const link = $(el).attr("href");
        if (link && !link.includes("javascript")) {
          streams.push(buildStream(headerText, fixUrl(link, url), parseQuality(headerText), { Referer: url }));
        }
      });
      return streams;
    } catch (e) { return []; }
  });
}

async function extractStreams(tmdbId, mediaType, season, episode) {
  const { trTitle, origTitle, shortTitle } = await getTmdbTitle(tmdbId, mediaType);
  const mainUrl = await getMainUrl();
  const searchUrl = `${mainUrl}/?s=${encodeURIComponent(trTitle || origTitle)}`;
  const html = await fetchText(searchUrl);
  const $ = import_cheerio_without_node_native2.default.load(html);
  
  const postUrl = $("div.card-grid a").first().attr("href");
  if (!postUrl) return [];

  const postHtml = await fetchText(postUrl);
  const $post = import_cheerio_without_node_native2.default.load(postHtml);
  const links = [];

  // Logic for movies or episodes
  if (mediaType === "movie") {
    $post("div.download-item a[href]").each((_, el) => {
      links.push({ url: $(el).attr("href"), label: $(el).text() });
    });
  } else {
    // Basic episode filtering
    $post("div.episode-download-item").each((_, el) => {
      if ($(el).text().includes(`Episode-${episode}`)) {
        $(el).find("a").each((__, a) => links.push({ url: $(a).attr("href"), label: $(a).text() }));
      }
    });
  }

  let results = [];
  for (const item of links) {
    if (item.url.includes("id=")) {
      const redirected = await getRedirectLinks(item.url);
      if (redirected) results.push(...(await resolveHubcloud(redirected, item.label, postUrl)));
    } else if (item.url.includes("hubcloud")) {
      results.push(...(await resolveHubcloud(item.url, item.label, postUrl)));
    }
  }
  return results;
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try { return yield extractStreams(tmdbId, mediaType, season, episode); } catch (e) { return []; }
  });
}
