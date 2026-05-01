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
var DEFAULT_MAIN_URL = "https://4khdhub.dad";

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
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
function getTmdbTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      let decodeHtml = function(text) {
        return (text || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#039;/g, "'");
      };
      const type = mediaType === "movie" ? "movie" : "tv";
      const url = `https://www.themoviedb.org/${type}/${tmdbId}?language=en-US`;
      const response = yield fetch(url, { headers: HEADERS });
      if (!response.ok) throw new Error(`TMDB HTML fetch error: ${response.status}`);
      const html = yield response.text();
      let title = "";
      const ogMatch = html.match(/<meta property="og:title" content="([^"]+)">/i);
      if (ogMatch) {
        title = decodeHtml(ogMatch[1]).split("(")[0].trim();
      } else {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
          title = decodeHtml(titleMatch[1]).split("(")[0].split("\u2014")[0].trim();
        }
      }
      const $ = import_cheerio_without_node_native.default.load(html);
      let origTitle = title;
      $("section.facts p").each((_, el) => {
        const text = $(el).text();
        if (text.includes("Original Title")) {
          const found = text.replace("Original Title", "").trim();
          if (found) origTitle = decodeHtml(found);
        }
      });
      return { trTitle: title, origTitle, shortTitle: title.split(":")[0].trim() };
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
    const fingerprint = `${stream.url}`.toLowerCase().replace(/\s/g, "");
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
  if (v.includes("hindi")) return "Hindi";
  if (v.includes("dual")) return "Dual Audio";
  return "English";
}

function buildDisplayMeta(sourceTitle = "", url = "", quality = "Auto", size = "", tech = "") {
  const lang = inferLanguageLabel(sourceTitle);
  const titleParts = [quality, lang, size, tech].filter(part => part && part !== "Auto");
  return {
    displayName: `${PROVIDER_NAME} - ${lang}`,
    displayTitle: titleParts.join(" | ") || "Stream"
  };
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

function cleanFileDetails(title) {
  const normalized = (title || "").toUpperCase().replace(/_/g, " ");
  const tags = ["WEB-DL", "BLURAY", "H265", "H264", "HEVC", "HDR", "10BIT"];
  return tags.filter(t => normalized.includes(t)).join(" ");
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
    const results = [];
    $("div.card-grid a, div.card-grid-small a, article a").each((_, el) => {
      const href = fixUrl($(el).attr("href"), mainUrl);
      if (!href || href.includes("/category/") || href.includes("/tag/")) return;
      const title = $(el).find("h3").first().text().trim() || $(el).attr("title") || $(el).text().trim();
      if (title) results.push({ title, href });
    });
    const q = normalizeTitle(query);
    const match = results.find(i => normalizeTitle(i.title).includes(q)) || results[0];
    return match ? match.href : null;
  });
}

function collectMovieLinks($, pageUrl) {
  const links = [];
  $("div.download-item, .entry-content a").each((_, el) => {
    const anchor = $(el).is('a') ? $(el) : $(el).find("a[href]").first();
    const href = fixUrl(anchor.attr("href"), pageUrl);
    if (!href || !href.includes('hub')) return;
    links.push({ url: href, label: $(el).text().trim() || "Download", rawHtml: $(el).html() });
  });
  return links;
}

function collectEpisodeLinks($, pageUrl, season, episode) {
  const results = [];
  const s = parseInt(season, 10);
  const e = parseInt(episode, 10);

  // Strategy 1: The Badge List
  $("div.episodes-list div.season-item").each((_, seasonEl) => {
    const seasonText = $(seasonEl).find("div.episode-number").first().text();
    if (!seasonText.includes(s.toString())) return;
    $(seasonEl).find("div.episode-download-item").each((__, epEl) => {
      const epText = $(epEl).text();
      const epMatch = epText.match(/Episode[- ]?0*(\d+)/i) || epText.match(/E0*(\d+)/i);
      if (epMatch && parseInt(epMatch[1], 10) === e) {
        $(epEl).find("a[href]").each((___, a) => {
          results.push({ url: fixUrl($(a).attr("href"), pageUrl), label: $(epEl).text().trim(), rawHtml: $(epEl).html() });
        });
      }
    });
  });

  // Strategy 2: Button Groups (common for GoT)
  if (results.length === 0) {
    $(".entry-content p, .entry-content h4, .entry-content h3").each((_, el) => {
      const text = $(el).text().toLowerCase();
      if (text.includes(`season ${s}`) || text.includes(`s${s < 10 ? '0' + s : s}`)) {
        $(el).nextUntil('h3, h4, hr').find('a[href]').each((__, a) => {
          const btnText = $(a).text().toLowerCase();
          const epMatch = btnText.match(/episode[- ]?0*(\d+)/i) || btnText.match(/e0*(\d+)/i);
          if (epMatch && parseInt(epMatch[1], 10) === e) {
            results.push({ url: fixUrl($(a).attr("href"), pageUrl), label: $(a).text().trim(), rawHtml: btnText });
          } else if (btnText.includes("download") || btnText.includes("links")) {
            results.push({ url: fixUrl($(a).attr("href"), pageUrl), label: "Season Pack", rawHtml: text });
          }
        });
      }
    });
  }
  return results;
}

function resolveHubcloud(url, sourceTitle, referer, quality) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(url, { headers: { Referer: referer } });
      const $ = import_cheerio_without_node_native2.default.load(html);
      let entryUrl = fixUrl($("#download").attr("href") || $("a.btn-success").attr("href") || $("a.btn-primary").attr("href"), url);
      if (!entryUrl) return [];

      const dlHtml = yield fetchText(entryUrl, { headers: { Referer: url } });
      const $dl = import_cheerio_without_node_native2.default.load(dlHtml);
      const streams = [];
      $dl("a.btn[href]").each((_, el) => {
        const link = fixUrl($dl(el).attr("href"), entryUrl);
        if (!link || link.includes("worker")) return;
        const text = $dl(el).text().toLowerCase();
        let sub = text.includes("buzz") ? "Buzz" : (text.includes("pixel") ? "Pixel" : "Direct");
        streams.push({
          name: `${PROVIDER_NAME} - ${sub}`,
          title: `${quality} | ${cleanFileDetails(sourceTitle) || 'Stream'}`,
          url: link + (link.includes('#') ? "" : "#.mkv"),
          quality: quality,
          headers: { Referer: entryUrl }
        });
      });
      return streams;
    } catch (e) { return []; }
  });
}

function resolveLink(rawUrl, sourceTitle, referer = "", quality = "Auto") {
  return __async(this, null, function* () {
    let url = rawUrl;
    if (url.includes("id=")) {
      const red = yield getRedirectLinks(url);
      if (red) url = red;
    }
    const low = url.toLowerCase();
    if (low.includes("hubcloud") || low.includes("hubcdn") || low.includes("hubdrive")) {
      return yield resolveHubcloud(url, sourceTitle, referer, quality);
    }
    if (low.includes("pixeldrain")) {
      const id = url.split('/').pop();
      return [{ name: `${PROVIDER_NAME} - Pixel`, title: `${quality} | Direct`, url: `https://pixeldrain.com/api/file/${id}?download`, quality: quality }];
    }
    return [];
  });
}

function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const { trTitle, origTitle, shortTitle } = yield getTmdbTitle(tmdbId, mediaType);
    let contentUrl = yield searchContent(origTitle, mediaType);
    if (!contentUrl && trTitle) contentUrl = yield searchContent(trTitle, mediaType);
    if (!contentUrl) return [];

    const html = yield fetchText(contentUrl);
    const $ = import_cheerio_without_node_native2.default.load(html);
    const links = (mediaType === "movie") ? collectMovieLinks($, contentUrl) : collectEpisodeLinks($, contentUrl, season, episode);

    const allStreams = [];
    for (const linkItem of links) {
      const q = parseQuality(linkItem.rawHtml || linkItem.label);
      const res = yield resolveLink(linkItem.url, linkItem.label, contentUrl, q);
      allStreams.push(...res);
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
