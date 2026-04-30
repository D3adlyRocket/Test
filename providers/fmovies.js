/**
 * 4KHDHub - Built from src/4KHDHub/
 * Updated: 2026-04-30
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

// src/4KHDHub/index.js
var FourKHDHub_exports = {};
__export(FourKHDHub_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(FourKHDHub_exports);

// src/4KHDHub/extractor.js
var import_cheerio_without_node_native2 = __toESM(require("cheerio-without-node-native"));

// src/4KHDHub/http.js
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
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (!baseUrl) return url;
  try {
    return new URL(url, baseUrl).toString();
  } catch (_) {
    return url;
  }
}
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield fetch(url, __spreadProps(__spreadValues({
      redirect: "follow"
    }, options), {
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
    }));
    if (!response.ok) throw new Error(`HTTP ${response.status} -> ${url}`);
    return yield response.text();
  });
}

// src/4KHDHub/tmdb.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
function getTmdbTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      let decodeHtml = (text) => (text || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#039;/g, "'");
      const type = mediaType === "movie" ? "movie" : "tv";
      const url = `https://www.themoviedb.org/${type}/${tmdbId}?language=tr-TR`;
      const response = yield fetch(url, { headers: HEADERS });
      if (!response.ok) throw new Error(`TMDB HTML fetch error: ${response.status}`);
      const html = yield response.text();
      let title = "";
      const ogMatch = html.match(/<meta property="og:title" content="([^"]+)">/i);
      if (ogMatch) title = decodeHtml(ogMatch[1]).split("(")[0].trim();
      const $ = import_cheerio_without_node_native.default.load(html);
      let origTitle = title;
      $("section.facts p").each((_, el) => {
        const text = $(el).text();
        if (text.includes("Orijinal Ba\u015Fl\u0131k") || text.includes("Original Title")) {
          const found = text.replace("Orijinal Ba\u015Fl\u0131k", "").replace("Original Title", "").trim();
          if (found) origTitle = decodeHtml(found);
        }
      });
      return { trTitle: title, origTitle, shortTitle: origTitle.split(":")[0].trim() };
    } catch (error) {
      return { trTitle: "", origTitle: "", shortTitle: "" };
    }
  });
}

// src/4KHDHub/extractor.js
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

function parseQuality(text) {
  const value = (text || "").toLowerCase();
  const heightMatch = value.match(/\d{3,4}p/);
  if (heightMatch) return heightMatch[0];
  if (/2160p|4k|uhd/.test(value)) return "2160p";
  if (/1080p/.test(value)) return "1080p";
  if (/720p/.test(value)) return "720p";
  return "Auto";
}

function inferLanguageLabel(text = "") {
  const v = text.toLowerCase();
  if (/\btr\b|turkce|türkçe/.test(v)) return "TR";
  if (/\ben\b|english/.test(v)) return "EN";
  if (v.includes("hindi")) return "Hindi";
  if (v.includes("dual audio") || v.includes("dual")) return "Dual";
  if (v.includes("altyazi") || v.includes("sub")) return "Sub";
  return "EN";
}

function cleanTechnicalDetails(title) {
  const normalized = (title || "").toUpperCase();
  const tags = [];
  if (normalized.includes("HDR")) tags.push("HDR");
  if (normalized.includes("BLURAY")) tags.push("BluRay");
  if (normalized.includes("WEB-DL") || normalized.includes("WEBDL")) tags.push("WEB-DL");
  if (normalized.includes("NF")) tags.push("NF");
  if (normalized.includes("DV") || normalized.includes("VISION")) tags.push("DV");
  if (normalized.includes("HEVC") || normalized.includes("H265")) tags.push("H265");
  return tags.join(" ");
}

// CONDENSED FORMATTING LOGIC
function buildStream(sourceText, url, quality, size = "", server = "Source") {
  const lang = inferLanguageLabel(sourceText);
  const tech = cleanTechnicalDetails(sourceText);
  
  // Format: Quality | Language | Size | Technical Details
  const displayTitle = [
    quality,
    lang,
    size,
    tech
  ].filter(Boolean).join(" | ");

  let finalUrl = url;
  if (!/\.(m3u8|mp4|mkv)/i.test(finalUrl)) {
    finalUrl += finalUrl.includes("#") ? "" : "#.mkv";
  }

  return {
    name: `${PROVIDER_NAME} - ${server}`,
    title: displayTitle,
    url: finalUrl,
    quality: quality
  };
}

function getRedirectLinks(url) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(url);
      let combined = "";
      let match;
      while ((match = REDIRECT_REGEX.exec(html)) !== null) {
        combined += match[1] || match[2] || "";
      }
      if (!combined) return "";
      const decoded = decodeBase64(rot13(decodeBase64(decodeBase64(combined))));
      const json = JSON.parse(decoded);
      return decodeBase64(json.o || "").trim();
    } catch (error) {
      return "";
    }
  });
}

function resolveHubcloud(url, sourceTitle, referer, quality) {
  return __async(this, null, function* () {
    try {
      const baseHeaders = referer ? { Referer: referer } : {};
      const html = yield fetchText(url, { headers: baseHeaders });
      const $ = import_cheerio_without_node_native2.default.load(html);
      
      const sizeText = $("i#size").first().text().trim();
      const headerText = $("div.card-header").first().text().trim() || sourceTitle;
      const finalQuality = quality !== "Auto" ? quality : parseQuality(headerText);
      
      const streams = [];
      $("a.btn[href]").each((_, el) => {
        const link = fixUrl($(el).attr("href"), url);
        const text = $(el).text().trim().toLowerCase();
        let serverName = "Cloud";
        
        if (text.includes("buzz")) serverName = "BuzzServer";
        else if (text.includes("pixel")) serverName = "Pixeldrain";
        else if (text.includes("fsl")) serverName = "FSL";

        if (link) {
           streams.push(buildStream(headerText, link, finalQuality, sizeText, serverName));
        }
      });
      return streams;
    } catch (e) { return []; }
  });
}

function resolveLink(rawUrl, sourceTitle, referer = "", quality = "Auto") {
  return __async(this, null, function* () {
    let url = rawUrl;
    if (url.includes("id=")) {
      const redirected = yield getRedirectLinks(url);
      if (redirected) url = redirected;
    }
    const lower = url.toLowerCase();
    if (lower.includes("hubcloud")) return yield resolveHubcloud(url, sourceTitle, referer, quality);
    if (lower.includes("pixeldrain")) return [buildStream(sourceTitle, url, quality, "", "Pixeldrain")];
    return [];
  });
}

function searchContent(query, mediaType) {
  return __async(this, null, function* () {
    const mainUrl = yield getMainUrl();
    const html = yield fetchText(`${mainUrl}/?s=${encodeURIComponent(query)}`);
    const $ = import_cheerio_without_node_native2.default.load(html);
    let found = null;
    $("div.card-grid a").each((_, el) => {
      const title = $(el).find("h3").text().trim();
      if (normalizeTitle(title).includes(normalizeTitle(query))) {
        found = fixUrl($(el).attr("href"), mainUrl);
      }
    });
    return found;
  });
}

function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const { trTitle, origTitle } = yield getTmdbTitle(tmdbId, mediaType);
    let contentUrl = yield searchContent(trTitle || origTitle, mediaType);
    if (!contentUrl) return [];

    const html = yield fetchText(contentUrl);
    const $ = import_cheerio_without_node_native2.default.load(html);
    const links = [];

    if (mediaType === "movie") {
      $("div.download-item").each((_, el) => {
        const url = $(el).find("a").attr("href");
        if (url) links.push({ url, label: $(el).text(), html: $(el).html() });
      });
    } else {
      // Series logic
      $("div.episode-download-item").each((_, el) => {
        const text = $(el).text();
        const epMatch = text.match(/Episode-?0*(\d+)/i);
        if (epMatch && parseInt(epMatch[1]) === Number(episode)) {
          $(el).find("a").each((__, a) => {
            links.push({ url: $(a).attr("href"), label: text, html: $(el).html() });
          });
        }
      });
    }

    const allStreams = [];
    for (const item of links) {
      const q = parseQuality(item.html || item.label);
      allStreams.push(...yield resolveLink(item.url, item.label, contentUrl, q));
    }
    return dedupeStreams(allStreams);
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
