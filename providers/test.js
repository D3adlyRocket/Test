/**
 * 4KHDHub - FULL RESTORED VERSION
 * Version: 6.0 | Fixes: GoT S1-6, Pack Filtering, Android TV UA
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
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var DEFAULT_MAIN_URL = "https://4khdhub.dad";

var HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Connection": "keep-alive",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none"
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
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  try { return new URL(url, baseUrl).toString(); } catch (_) { return url; }
}

function fetchText(url, options = {}) {
  return __async(this, null, function* () {
    const response = yield fetch(url, __spreadProps(__spreadValues({ redirect: "follow" }, options), {
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
    }));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return yield response.text();
  });
}

// src/4KHDHub/tmdb.js
function getTmdbTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const type = mediaType === "movie" ? "movie" : "tv";
      const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
      const response = yield fetch(url, { headers: HEADERS });
      const data = yield response.json();
      const title = data.name || data.title || "";
      const origTitle = data.original_name || data.original_title || title;
      let shortTitle = "";
      if (origTitle && (origTitle.includes(":") || origTitle.toLowerCase().includes(" and "))) {
        shortTitle = origTitle.split(":")[0].split(/ and /i)[0].trim();
      }
      return { trTitle: title, origTitle, shortTitle };
    } catch (error) { return { trTitle: "", origTitle: "", shortTitle: "" }; }
  });
}

// src/4KHDHub/extractor.js
var PROVIDER_NAME = "4KHDHub";
var REDIRECT_REGEX = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;

function dedupeStreams(streams) {
  const seenFingerprints = new Set();
  return streams.filter((stream) => {
    const fingerprint = `${stream.url}`.toLowerCase();
    if (seenFingerprints.has(fingerprint)) return false;
    seenFingerprints.add(fingerprint);
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

function inferLanguageLabel(text = "") {
  const v = text.toLowerCase();
  if (v.includes("hindi") && v.includes("english")) return "Dual Audio";
  if (v.includes("hindi")) return "Hindi";
  if (v.includes("tamil")) return "Tamil";
  if (v.includes("telugu")) return "Telugu";
  return "English";
}

function parseQuality(text) {
  const value = (text || "").toLowerCase();
  if (value.includes("2160p") || value.includes("4k")) return "2160p";
  if (value.includes("1080p")) return "1080p";
  if (value.includes("720p")) return "720p";
  if (value.includes("480p")) return "480p";
  return "Auto";
}

function cleanFileDetails(title) {
  const normalized = (title || "").toUpperCase();
  const allowed = ["WEB-DL", "WEBRIP", "BLURAY", "HDRIP", "H265", "H264", "HEVC", "DDP5.1", "DV", "HDR10"];
  const parts = normalized.split(/[ ._]+/);
  return parts.filter(p => allowed.includes(p)).join(" ");
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
      const decoded = JSON.parse(decodeBase64(rot13(decodeBase64(decodeBase64(combined)))));
      return decodeBase64(decoded.o || "").trim();
    } catch (e) { return ""; }
  });
}

function collectEpisodeLinks($, pageUrl, season, episode) {
  const sNum = Number(season);
  const eNum = Number(episode);
  const episodes = [];
  const packs = [];

  // Scrape every link on the page for maximum GoT S1-6 coverage
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.includes("/category/") || href === "#") return;

    const fullUrl = fixUrl(href, pageUrl);
    // Get text from the link AND the surrounding element (cell/div/paragraph)
    const contextText = ($(el).text() + " " + $(el).parent().text() + " " + $(el).closest('tr').text()).toLowerCase();
    
    const hasS = new RegExp(`s(?:eason)?\\s*0*${sNum}\\b`, "i").test(contextText);
    const hasE = new RegExp(`(?:episode|ep|e)\\s*0*${eNum}\\b`, "i").test(contextText);
    const isPack = contextText.includes("pack") || contextText.includes("complete");

    if (hasS && hasE) {
      episodes.push({ url: fullUrl, label: `S${sNum} E${eNum}`, rawHtml: contextText });
    } else if (hasS && isPack) {
      packs.push({ url: fullUrl, label: `S${sNum} Pack`, rawHtml: contextText });
    }
  });

  // PRIORITY: If we found specific episodes, do not return packs. 
  // If we found zero episodes (like in a GoT megapost), return the pack.
  return episodes.length > 0 ? episodes : packs;
}

function resolveLink(rawUrl, sourceTitle, referer = "", quality = "Auto") {
  return __async(this, null, function* () {
    let url = rawUrl;
    if (url.includes("id=")) {
      const redirected = yield getRedirectLinks(url);
      if (redirected) url = redirected;
    }

    const lower = url.toLowerCase();
    const streams = [];
    
    if (lower.includes("hubcloud") || lower.includes("hubdrive") || lower.includes("hubcdn")) {
      try {
        const html = yield fetchText(url, { headers: { Referer: referer } });
        const $ = import_cheerio_without_node_native2.default.load(html);
        const size = $("i#size").text().trim();
        const header = $("div.card-header").text().trim();
        const q = quality !== "Auto" ? quality : parseQuality(header);
        const tech = cleanFileDetails(header);
        
        $("a.btn[href]").each((_, el) => {
          const dlLink = fixUrl($(el).attr("href"), url);
          if (dlLink && !dlLink.includes("login")) {
            let finalUrl = dlLink;
            if (!/\.(m3u8|mp4|mkv)/i.test(finalUrl)) finalUrl += "#.mkv";
            
            streams.push({
              name: `${PROVIDER_NAME} - ${inferLanguageLabel(sourceTitle)}`,
              title: `${sourceTitle} | ${q} | ${size} ${tech}`.trim(),
              url: finalUrl,
              quality: q
            });
          }
        });
      } catch (e) {}
    }
    return streams;
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const { trTitle, origTitle } = yield getTmdbTitle(tmdbId, mediaType);
      const mainUrl = yield getMainUrl();
      const searchUrl = `${mainUrl}/?s=${encodeURIComponent(trTitle)}`;
      const searchHtml = yield fetchText(searchUrl);
      const $search = import_cheerio_without_node_native2.default.load(searchHtml);
      
      let contentUrl = "";
      $search("div.card-grid a, div.card-grid-small a").each((_, el) => {
        const t = $search(el).find("h3").text() || $search(el).attr("title");
        if (normalizeTitle(t).includes(normalizeTitle(trTitle))) contentUrl = fixUrl($search(el).attr("href"), mainUrl);
      });

      if (!contentUrl) return [];

      const pageHtml = yield fetchText(contentUrl);
      const $page = import_cheerio_without_node_native2.default.load(pageHtml);
      const links = (mediaType === "movie") ? [] : collectEpisodeLinks($page, contentUrl, season, episode);

      const allStreams = [];
      for (const item of links) {
        const resolved = yield resolveLink(item.url, item.label, contentUrl, parseQuality(item.rawHtml));
        allStreams.push(...resolved);
      }
      return dedupeStreams(allStreams);
    } catch (e) { return []; }
  });
}
