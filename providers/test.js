/**
 * 4KHDHub - FULL RESTORED ARCHITECTURE (485+ Lines)
 * Fixes: GoT S1-6 Table Parsing, Android TV UA, and Pack Priority Logic
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

// Full Header stack to prevent Android TV / Cloudflare blocks
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1"
};

var cachedDomains = null;
function getDomains() {
  return __async(this, null, function* () {
    if (cachedDomains)
      return cachedDomains;
    try {
      const res = yield fetch(DOMAINS_URL, { headers: HEADERS });
      if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
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
  if (!url)
    return "";
  if (url.startsWith("http://") || url.startsWith("https://"))
    return url;
  if (url.startsWith("//"))
    return `https:${url}`;
  if (!baseUrl)
    return url;
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
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} -> ${url}`);
    }
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
      if (!response.ok)
        throw new Error(`TMDB fetch error: ${response.status}`);
      const data = yield response.json();
      const title = data.name || data.title || "";
      const origTitle = data.original_name || data.original_title || title;
      let shortTitle = "";
      if (origTitle && (origTitle.includes(":") || origTitle.toLowerCase().includes(" and "))) {
        shortTitle = origTitle.split(":")[0].split(/ and /i)[0].trim();
      }
      return { trTitle: title, origTitle, shortTitle };
    } catch (error) {
      return { trTitle: "", origTitle: "", shortTitle: "" };
    }
  });
}

// src/4KHDHub/extractor.js
var PROVIDER_NAME = "4KHDHub";
var REDIRECT_REGEX = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;

function dedupeStreams(streams) {
  const seenFingerprints = new Set();
  return streams.filter((stream) => {
    const fingerprint = `${stream.url}`.toLowerCase();
    if (seenFingerprints.has(fingerprint))
      return false;
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
  try {
    return atob(value);
  } catch (_) {
    return "";
  }
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
  if (v.includes("dual audio") || v.includes("dual")) return "Dual Audio";
  return "English";
}

function buildDisplayMeta(sourceTitle = "", url = "", quality = "Auto", size = "", tech = "") {
  const lang = inferLanguageLabel(sourceTitle);
  const titleParts = [quality, lang, size, tech].filter((part) => part && part !== "Auto");
  let baseInfo = titleParts.join(" | ") || "Stream";
  
  if (/^S\d+/i.test(sourceTitle)) {
    return {
      displayName: `${PROVIDER_NAME} - ${lang}`,
      displayTitle: `${sourceTitle} | ${baseInfo}`
    };
  }
  return {
    displayName: `${PROVIDER_NAME} - ${lang}`,
    displayTitle: baseInfo
  };
}

function parseQuality(text) {
  const value = (text || "").toLowerCase();
  const heightMatch = value.match(/\d{3,4}p/);
  if (heightMatch) return heightMatch[0];
  if (/2160p|4k|uhd/.test(value)) return "2160p";
  if (/1440p/.test(value)) return "1440p";
  if (/1080p/.test(value)) return "1080p";
  if (/720p/.test(value)) return "720p";
  if (/480p/.test(value)) return "480p";
  return "Auto";
}
function cleanFileDetails(title) {
  const normalized = (title || "").replace(/\.[a-z0-9]{2,4}$/i, "").replace(/WEB[-_. ]?DL/gi, "WEB-DL").replace(/WEB[-_. ]?RIP/gi, "WEBRIP").replace(/H[ .]?265/gi, "H265").replace(/H[ .]?264/gi, "H264");
  const allowed = new Set(["WEB-DL", "WEBRIP", "BLURAY", "HDRIP", "DVDRIP", "H264", "H265", "HEVC", "AAC", "AC3", "DTS", "HDR", "DV"]);
  const parts = normalized.split(/[ ._]+/).map((part) => part.toUpperCase());
  return [...new Set(parts.filter(p => allowed.has(p)))].join(" ");
}

function getRedirectLinks(url) {
  return __async(this, null, function* () {
    let html = "";
    try {
      html = yield fetchText(url);
    } catch (error) {
      return "";
    }
    let combined = "";
    let match;
    while ((match = REDIRECT_REGEX.exec(html)) !== null) {
      combined += match[1] || match[2] || "";
    }
    if (!combined)
      return "";
    try {
      const decoded = decodeBase64(rot13(decodeBase64(decodeBase64(combined))));
      const json = JSON.parse(decoded);
      return decodeBase64(json.o || "").trim();
    } catch (error) {
      return "";
    }
  });
}

function searchContent(query, mediaType) {
  return __async(this, null, function* () {
    const mainUrl = yield getMainUrl();
    const searchUrl = `${mainUrl}/?s=${encodeURIComponent(query)}`;
    const html = yield fetchText(searchUrl);
    const $ = import_cheerio_without_node_native2.default.load(html);
    const results = [];
    $("div.card-grid a, div.card-grid-small a").each((_, el) => {
      const href = fixUrl($(el).attr("href"), mainUrl);
      if (!href || href.includes("/category/")) return;
      const title = $(el).find("h3").first().text().trim() || $(el).attr("title");
      if (title) results.push({ title, href });
    });
    const q = normalizeTitle(query);
    const best = results.find(i => normalizeTitle(i.title) === q) || results.find(i => normalizeTitle(i.title).includes(q));
    return best ? best.href : null;
  });
}

function collectMovieLinks($, pageUrl) {
  const links = [];
  $("div.download-item, .card-body").each((_, el) => {
    const anchor = $(el).find("a[href]").first();
    const href = fixUrl(anchor.attr("href"), pageUrl);
    if (!href) return;
    links.push({ url: href, label: $(el).text().trim(), rawHtml: $(el).html() });
  });
  return links;
}

function collectEpisodeLinks($, pageUrl, season, episode) {
  const sNum = Number(season);
  const eNum = Number(episode);
  const episodes = [];
  const packs = [];

  // NUCLEAR SCAN: Iterate every link on the page for GoT S1-6 table compatibility
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.includes("/category/") || href === "#") return;

    const fullUrl = fixUrl(href, pageUrl);
    const parent = $(el).closest('tr, div, p, li');
    const contextText = ($(el).text() + " " + parent.text()).toLowerCase();
    
    const hasS = new RegExp(`s(?:eason)?\\s*0*${sNum}\\b`, "i").test(contextText);
    const hasE = new RegExp(`(?:episode|ep|e)\\s*0*${eNum}\\b`, "i").test(contextText);
    const isPack = contextText.includes("pack") || contextText.includes("complete");

    if (hasS && hasE) {
      episodes.push({ url: fullUrl, label: `S${sNum} E${eNum}`, rawHtml: contextText });
    } else if (hasS && isPack) {
      packs.push({ url: fullUrl, label: `S${sNum} Pack`, rawHtml: contextText });
    }
  });

  // Returns episodes if found, otherwise returns packs
  return episodes.length > 0 ? episodes : packs;
}

function buildStream(title, url, quality = "Auto", headers = {}, size = "", tech = "") {
  let finalUrl = url;
  if (!/\.(m3u8|mp4|mkv)/i.test(finalUrl))
    finalUrl += finalUrl.includes("#") ? "" : "#.mkv";
  const meta = buildDisplayMeta(title, finalUrl, quality, size, tech);
  return { 
    name: meta.displayName, 
    title: meta.displayTitle, 
    url: finalUrl, 
    quality, 
    headers: Object.keys(headers).length ? headers : void 0 
  };
}

function resolveHubcloud(url, sourceTitle, referer, quality) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(url, { headers: { Referer: referer } });
      const $ = import_cheerio_without_node_native2.default.load(html);
      const size = $("i#size").first().text().trim();
      const header = $("div.card-header").first().text().trim();
      const tech = cleanFileDetails(header);
      const foundQuality = quality !== "Auto" ? quality : parseQuality(header);
      
      const streams = [];
      $("a.btn[href]").each((_, el) => {
        const link = fixUrl($(el).attr("href"), url);
        if (link && !link.includes("login")) {
          streams.push(buildStream(sourceTitle, link, foundQuality, { Referer: url }, size, tech));
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
    if (lower.includes("hubcloud") || lower.includes("hubdrive") || lower.includes("hubcdn")) {
      return yield resolveHubcloud(url, sourceTitle, referer, quality);
    }
    return [buildStream(sourceTitle, url, quality, referer ? { Referer: referer } : {})];
  });
}

function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const { trTitle, origTitle, shortTitle } = yield getTmdbTitle(tmdbId, mediaType);
    let contentUrl = yield searchContent(trTitle, mediaType);
    if (!contentUrl && origTitle) contentUrl = yield searchContent(origTitle, mediaType);
    if (!contentUrl) return [];

    const html = yield fetchText(contentUrl);
    const $ = import_cheerio_without_node_native2.default.load(html);
    const links = (mediaType === "movie") ? collectMovieLinks($, contentUrl) : collectEpisodeLinks($, contentUrl, season, episode);
    
    const allStreams = [];
    for (const linkItem of links) {
      const q = parseQuality(linkItem.rawHtml || linkItem.label);
      const resolved = yield resolveLink(linkItem.url, linkItem.label, contentUrl, q);
      allStreams.push(...resolved);
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
