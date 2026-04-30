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
    const response = yield fetch(url, __spreadProps(__spreadValues({ redirect: "follow" }, options), {
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
    }));
    if (!response.ok)
      throw new Error(`HTTP ${response.status} -> ${url}`);
    return yield response.text();
  });
}

var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
function getTmdbTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      function decodeHtml(text) {
        return (text || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#039;/g, "'");
      }
      const type = mediaType === "movie" ? "movie" : "tv";
      const url = `https://www.themoviedb.org/${type}/${tmdbId}?language=tr-TR`;
      const response = yield fetch(url, { headers: HEADERS });
      if (!response.ok)
        throw new Error(`TMDB error: ${response.status}`);
      const html = yield response.text();
      let title = "";
      const ogMatch = html.match(/<meta property="og:title" content="([^"]+)">/i);
      if (ogMatch) {
        title = decodeHtml(ogMatch[1]).split("(")[0].trim();
      }
      const $ = import_cheerio_without_node_native.default.load(html);
      let origTitle = title;
      $("section.facts p").each((_, el) => {
        const text = $(el).text();
        if (text.includes("Orijinal") || text.includes("Original")) {
          const found = text.replace(/Orijinal Ba\u015Fl\u0131k|Original Title/g, "").trim();
          if (found)
            origTitle = decodeHtml(found);
        }
      });
      return {
        trTitle: title,
        origTitle,
        shortTitle: origTitle.split(":")[0].trim()
      };
    } catch (error) {
      return { trTitle: "", origTitle: "", shortTitle: "" };
    }
  });
}

function parseQuality(text) {
  const value = (text || "").toLowerCase();
  if (value.includes("2160p") || value.includes("4k") || value.includes("uhd"))
    return "4K";
  if (value.includes("1440p") || value.includes("2k"))
    return "1440p";
  if (value.includes("1080p") || value.includes("fhd"))
    return "1080p";
  if (value.includes("720p") || value.includes("hd"))
    return "720p";
  if (value.includes("480p") || value.includes("sd"))
    return "480p";
  return "Auto";
}

function inferLanguageLabel(text = "") {
  const v = text.toLowerCase();
  if (/\btr\b|turkce|türkçe/.test(v))
    return "TR";
  if (/\ben\b|english/.test(v))
    return "EN";
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
    title: `${q} | ${lang} | ${title.split("-")[0].trim()}`,
    url: finalUrl,
    quality: q,
    headers: Object.keys(headers).length ? headers : void 0
  };
}

function rot13(v) {
  return v.replace(/[a-zA-Z]/g, (c) => String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26));
}

function getRedirectLinks(url) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(url);
      const match = html.match(/s\('o','([A-Za-z0-9+/=]+)'/);
      if (!match)
        return "";
      const b64_1 = match[1];
      const dec_1 = atob(b64_1);
      const dec_2 = atob(dec_1);
      const rot = rot13(dec_2);
      const dec_3 = atob(rot);
      const json = JSON.parse(dec_3);
      return atob(json.o || "").trim();
    } catch (e) {
      return "";
    }
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
    } catch (e) {
      return [];
    }
  });
}

function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const { trTitle, origTitle, shortTitle } = yield getTmdbTitle(tmdbId, mediaType);
    const mainUrl = yield getMainUrl();
    const isSeries = mediaType === "tv" || mediaType === "series";
    const queries = [];
    if (isSeries) {
      queries.push(`${shortTitle} S${String(season).padStart(2, "0")}`);
      queries.push(shortTitle);
    } else {
      queries.push(origTitle);
      if (trTitle && trTitle !== origTitle)
        queries.push(trTitle);
    }
    let postUrl = "";
    for (const q of queries) {
      const searchUrl = `${mainUrl}/?s=${encodeURIComponent(q)}`;
      const searchHtml = yield fetchText(searchUrl);
      const $search = import_cheerio_without_node_native2.default.load(searchHtml);
      $search("div.card-grid a").each((_, el) => {
        const href = $search(el).attr("href");
        const title = $search(el).text().toLowerCase();
        if (postUrl)
          return;
        if (isSeries) {
          if (title.includes(`season ${season}`) || title.includes(`s${season}`)) {
            postUrl = href;
          }
        } else {
          postUrl = href;
        }
      });
      if (postUrl)
        break;
    }
    if (!postUrl)
      return [];
    const postHtml = yield fetchText(postUrl);
    const $post = import_cheerio_without_node_native2.default.load(postHtml);
    const downloadLinks = [];
    if (isSeries) {
      $post("div.episode-download-item").each((_, el) => {
        const text = $post(el).text();
        const epMatch = text.match(/Episode-(\d+)/i);
        if (epMatch && parseInt(epMatch[1]) === parseInt(episode)) {
          $post(el).find("a").each((__, a) => {
            downloadLinks.push({ url: $post(a).attr("href"), label: $post(a).text() });
          });
        }
      });
    } else {
      $post("div.download-item a[href]").each((_, el) => {
        downloadLinks.push({ url: $post(el).attr("href"), label: $post(el).text() });
      });
    }
    let allResults = [];
    for (const item of downloadLinks) {
      if (item.url.includes("id=")) {
        const redirected = yield getRedirectLinks(item.url);
        if (redirected) {
          const resolved = yield resolveHubcloud(redirected, item.label, postUrl);
          allResults = [...allResults, ...resolved];
        }
      } else if (item.url.includes("hubcloud")) {
        const resolved = yield resolveHubcloud(item.url, item.label, postUrl);
        allResults = [...allResults, ...resolved];
      }
    }
    return allResults;
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
