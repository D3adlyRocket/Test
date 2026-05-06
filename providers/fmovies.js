/**
 * 4KHDHub - Built from src/4KHDHub/
 * Final Polish: Updated User-Agent for Mobile/Desktop compatibility
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
var DEFAULT_MAIN_URL = "https://4khdhub.fans"; // UPDATED DOMAIN

var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1"
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
      cachedDomains = {};
    }
    return cachedDomains;
  });
}
function getMainUrl() {
  return __async(this, null, function* () {
    const domains = yield getDomains();
    // Try domains.json first, then fallback to current working fans/click domains
    return domains["4khdhub"] || domains.n4khdhub || "https://4khdhub.fans" || "https://4khdhub.click" || DEFAULT_MAIN_URL;
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
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || { "Referer": url })
    }));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} -> ${url}`);
    }
    return yield response.text();
  });
}

// src/4KHDHub/tmdb.js
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
        headers: HEADERS
      });
      if (!response.ok) {
        throw new Error(`TMDB HTML fetch error: ${response.status}`);
      }
      const html = yield response.text();
      let title = "";
      const ogMatch = html.match(/<meta property="og:title" content="([^"]+)">/i);
      if (ogMatch) {
        title = decodeHtml(ogMatch[1]).split("(")[0].trim();
      } else {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
          title = decodeHtml(titleMatch[1]).split("(")[0].split("\u2014")[0].split("\xE2\u20AC\u201D")[0].trim();
        }
      }
      const $ = import_cheerio_without_node_native.default.load(html);
      let origTitle = title;
      $("section.facts p").each((_, el) => {
        const text = $(el).text();
        if (text.includes("Orijinal Ba\u015Fl\u0131k") || text.includes("Original Title")) {
          const found = text.replace("Orijinal Ba\u015Fl\u0131k", "").replace("Original Title", "").trim();
          if (found)
            origTitle = decodeHtml(found);
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
  const seenFingerprints = new Set();
  return streams.filter((stream) => {
    const fingerprint = `${stream.title}|${stream.quality}`.toLowerCase().replace(/\s/g, "");
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
  const langs = [];
  if (v.includes("hindi")) langs.push("Hindi");
  if (v.includes("english")) langs.push("English");
  if (v.includes("dual")) return "Dual Audio";
  return langs[0] || "EN";
}

function buildDisplayMeta(sourceTitle = "", url = "", quality = "Auto", size = "", tech = "") {
  const lang = inferLanguageLabel(sourceTitle);
  return {
    displayName: `${PROVIDER_NAME} - ${lang}`,
    displayTitle: [quality, lang, size].filter(Boolean).join(" | ")
  };
}

function parseQuality(text) {
  const value = (text || "").toLowerCase();
  if (/2160p|4k/.test(value)) return "2160p";
  if (/1080p/.test(value)) return "1080p";
  if (/720p/.test(value)) return "720p";
  return "Auto";
}

function getRedirectLinks(url) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(url);
      const reMatch = html.match(/reurl\s*=\s*['"]([^'"]+)['"]/);
      if (reMatch) {
        let d = reMatch[1].includes("?r=") ? reMatch[1].split("?r=").pop() : reMatch[1];
        return decodeBase64(d) || d;
      }
      let combined = "";
      let match;
      while ((match = REDIRECT_REGEX.exec(html)) !== null) combined += match[1] || match[2] || "";
      if (!combined && url.includes("id=")) combined = url.split('id=')[1].split('::')[0];
      
      const res = decodeBase64(rot13(decodeBase64(decodeBase64(combined))));
      return res || decodeBase64(combined);
    } catch (_) { return ""; }
  });
}

function searchContent(query, mediaType) {
  return __async(this, null, function* () {
    const mainUrl = yield getMainUrl();
    const html = yield fetchText(`${mainUrl}/?s=${encodeURIComponent(query)}`);
    const $ = import_cheerio_without_node_native2.default.load(html);
    let found = null;
    $("div.card-grid a, div.card-grid-small a").each((_, el) => {
      const title = $(el).find("h3").text().trim() || $(el).attr("title");
      if (normalizeTitle(title).includes(normalizeTitle(query))) found = fixUrl($(el).attr("href"), mainUrl);
    });
    return found;
  });
}

function collectMovieLinks($, pageUrl) {
  const links = [];
  $("div.download-item").each((_, el) => {
    const anchor = $(el).find("a[href]").first();
    if (anchor.attr("href")) links.push({ url: fixUrl(anchor.attr("href"), pageUrl), label: "Movie", rawHtml: $(el).html() });
  });
  return links;
}

function collectEpisodeLinks($, pageUrl, season, episode) {
  const links = [];
  const s = parseInt(season);
  const e = parseInt(episode);
  $("div.download-item, div.episodes-list").each((_, el) => {
    const text = $(el).text().toLowerCase();
    if (text.includes(`season ${s}`) || text.includes(`s${s.toString().padStart(2, '0')}`)) {
      $(el).find("a[href]").each((__, a) => {
        const aText = $(a).text().toLowerCase() + " " + text;
        if (aText.includes(`episode ${e}`) || aText.includes(`e${e.toString().padStart(2, '0')}`)) {
          links.push({ url: fixUrl($(a).attr("href"), pageUrl), label: $(a).text().trim() });
        }
      });
    }
  });
  return links;
}

function buildStream(title, url, quality, size) {
  const meta = buildDisplayMeta(title, url, quality, size);
  return { name: meta.displayName, title: meta.displayTitle, url: url + (url.includes("#") ? "" : "#.mkv"), quality: quality };
}

function resolveLink(rawUrl, sourceTitle, contentUrl, quality = "Auto") {
  return __async(this, null, function* () {
    let url = rawUrl;
    if (url.includes("id=")) {
      const redir = yield getRedirectLinks(url);
      if (redir) url = redir;
    }
    if (url.includes("hubcloud") || url.includes("hubcdn")) {
      const html = yield fetchText(url, { headers: { "Referer": contentUrl } });
      const $ = import_cheerio_without_node_native2.default.load(html);
      const streams = [];
      $("a.btn[href]").each((_, el) => {
        let link = fixUrl($(el).attr("href"), url);
        if (link.includes("pixeldrain")) link = `https://pixeldrain.com/api/file/${link.split('/').pop()}?download`;
        streams.push(buildStream(sourceTitle, link, parseQuality($(el).text()), $("i#size").text()));
      });
      return streams;
    }
    return [buildStream(sourceTitle, url, quality, "")];
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const { trTitle, origTitle } = yield getTmdbTitle(tmdbId, mediaType);
      const contentUrl = (yield searchContent(trTitle)) || (yield searchContent(origTitle));
      if (!contentUrl) return [];

      const html = yield fetchText(contentUrl);
      const $ = import_cheerio_without_node_native2.default.load(html);
      const links = (mediaType === "movie") ? collectMovieLinks($, contentUrl) : collectEpisodeLinks($, contentUrl, season, episode);

      const allStreams = [];
      for (const item of links) {
        const resolved = yield resolveLink(item.url, item.label, contentUrl);
        allStreams.push(...resolved);
      }
      return dedupeStreams(allStreams);
    } catch (e) { return []; }
  });
}
