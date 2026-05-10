/**
 * vegamovies - Built from src/vegamovies/
 * Generated: 2026-05-10T21:52:03.585Z
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
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
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

// src/vegamovies/http.js
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};
var TMDB_API_KEY = "d2c5a27beedf492e5483163d0f6c5870";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var EXTRACTOR_BASE_URL = "https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json";
var MAIN_URL = "https://vegamovies.vodka";
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield fetch(url, __spreadValues({
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
    }, options));
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} for ${url}`);
    }
    return yield response.text();
  });
}
function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const raw = yield fetchText(url, options);
    return JSON.parse(raw);
  });
}
function getTMDBDetails(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var _a;
    const endpoint = mediaType === "tv" ? "tv" : "movie";
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    const response = yield fetch(url, {
      headers: { "Accept": "application/json" }
    });
    if (!response.ok)
      throw new Error(`TMDB API error: ${response.status}`);
    const data = yield response.json();
    const title = mediaType === "tv" ? data.name : data.title;
    const releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
    const year = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;
    return { title, year, imdbId: ((_a = data.external_ids) == null ? void 0 : _a.imdb_id) || null, data };
  });
}
function getLatestBaseUrl(source) {
  return __async(this, null, function* () {
    try {
      const data = yield fetchJson(EXTRACTOR_BASE_URL);
      return data[source] || null;
    } catch (e) {
      return null;
    }
  });
}
function extractQuality(url) {
  if (!url)
    return "Unknown";
  const patterns = [/(\d{3,4})p/i, /(\d{3,4})k/i];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) {
      const q = parseInt(m[1]);
      if (q >= 240 && q <= 4320)
        return `${q}p`;
    }
  }
  if (url.includes(".m3u8"))
    return "Adaptive";
  return "Unknown";
}
function normalizeTitle(title) {
  if (!title)
    return "";
  return title.toLowerCase().replace(/\b(the|a|an)\b/g, "").replace(/[:\-_]/g, " ").replace(/\s+/g, " ").replace(/[^\w\s]/g, "").trim();
}
function calculateTitleSimilarity(title1, title2) {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);
  if (norm1 === norm2)
    return 1;
  const words1 = norm1.split(/\s+/).filter((w) => w.length > 0);
  const words2 = norm2.split(/\s+/).filter((w) => w.length > 0);
  if (words1.length === 0 || words2.length === 0)
    return 0;
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = words1.filter((w) => set2.has(w));
  const union = /* @__PURE__ */ new Set([...words1, ...words2]);
  const jaccard = intersection.length / union.size;
  const extraWordsCount = words2.filter((w) => !set1.has(w)).length;
  let score = jaccard - extraWordsCount * 0.05;
  if (words1.length > 0 && words1.every((w) => set2.has(w)))
    score += 0.2;
  return score;
}
function findBestTitleMatch(mediaInfo, searchResults) {
  if (!searchResults || searchResults.length === 0)
    return null;
  let bestMatch = null;
  let bestScore = 0;
  for (const result of searchResults) {
    let score = calculateTitleSimilarity(mediaInfo.title, result.title);
    if (mediaInfo.year && result.year) {
      const yearDiff = Math.abs(mediaInfo.year - result.year);
      if (yearDiff === 0)
        score += 0.2;
      else if (yearDiff <= 1)
        score += 0.1;
      else if (yearDiff > 5)
        score -= 0.3;
    }
    if (score > bestScore && score > 0.3) {
      bestScore = score;
      bestMatch = result;
    }
  }
  return bestMatch;
}
function getBaseUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch (e) {
    return url;
  }
}
function resolveRedirects(url, maxRedirects = 7) {
  return __async(this, null, function* () {
    let currentUrl = url;
    let loopCount = 0;
    while (loopCount < maxRedirects) {
      try {
        const res = yield fetch(currentUrl, { method: "HEAD", redirect: "manual" });
        if (res.status === 200 || res.status >= 300 && res.status <= 399) {
          const location = res.headers.get("Location");
          if (!location)
            break;
          currentUrl = location;
        } else
          break;
        loopCount++;
      } catch (e) {
        return null;
      }
    }
    return currentUrl;
  });
}

// src/vegamovies/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
function resolveVCloud(url, baseUrl) {
  return __async(this, null, function* () {
    const streams = [];
    try {
      const docHtml = yield fetchText(url, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: baseUrl }) });
      const $ = import_cheerio_without_node_native.default.load(docHtml);
      let link = "";
      if (url.includes("/video/")) {
        link = $("div.vd > center > a").attr("href") || "";
      } else {
        const script = $("script:containsData(url)").html() || "";
        const m = script.match(/var url = '([^']*)'/);
        link = m ? m[1] : "";
      }
      if (!link.startsWith("https://"))
        link = baseUrl + link;
      const videoPageHtml = yield fetchText(link, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: baseUrl }) });
      const $video = import_cheerio_without_node_native.default.load(videoPageHtml);
      const header = $video("div.card-header").text() || "";
      const size = $video("i#size").text() || "";
      const quality = header || extractQuality(link);
      const buttons = $video("h2 a.btn").get();
      for (const el of buttons) {
        const a = $video(el);
        const text = a.text();
        const href = a.attr("href");
        if (!href)
          continue;
        let streamUrl = href;
        let serverName = "";
        if (text.includes("FSL Server"))
          serverName = "[FSL Server]";
        else if (text.includes("FSLv2"))
          serverName = "[FSLv2]";
        else if (text.includes("Mega Server"))
          serverName = "[Mega]";
        else if (text.includes("Download File"))
          serverName = "[Download]";
        else if (text.includes("BuzzServer")) {
          serverName = "[BuzzServer]";
          try {
            const res = yield fetch(`${href}/download`, {
              headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: href }),
              redirect: "manual"
            });
            const dlink = res.headers.get("hx-redirect");
            if (dlink)
              streamUrl = getBaseUrl(href) + dlink;
          } catch (e) {
          }
        } else if (href.includes("pixeldra")) {
          streamUrl = href.includes("download") ? href : `${getBaseUrl(href)}/api/file/${href.split("/").pop()}?download`;
          serverName = "[Pixeldrain]";
        } else if (text.includes("10Gbps")) {
          serverName = "[10Gbps]";
          const redirectUrl = yield resolveRedirects(href);
          if (redirectUrl) {
            streamUrl = redirectUrl.includes("link=") ? redirectUrl.split("link=")[1] : redirectUrl;
          }
        } else
          continue;
        if (streamUrl) {
          streams.push({
            name: `VCloud${serverName} ${header}[${size}]`,
            title: `VCloud${serverName}`,
            url: streamUrl,
            quality,
            headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: "https://vcloud.su/" })
          });
        }
      }
    } catch (e) {
      console.log(`[VCloud] Error: ${e.message}`);
    }
    return streams;
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var _a;
    console.log(`[VegaMovies] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);
    const allStreams = [];
    try {
      const mediaInfo = yield getTMDBDetails(tmdbId, mediaType);
      console.log(`[VegaMovies] TMDB Info: "${mediaInfo.title}" (${mediaInfo.year || "N/A"})`);
      const baseUrl = (yield getLatestBaseUrl("vegamovies")) || MAIN_URL;
      const searchUrl = `${baseUrl}/search.php?q=${encodeURIComponent(mediaInfo.title)}`;
      const searchHtml = yield fetchText(searchUrl);
      const searchData = JSON.parse(searchHtml);
      const searchResults = [];
      if (searchData.hits) {
        for (const hit of searchData.hits) {
          const doc = hit.document;
          searchResults.push({
            title: doc.post_title,
            url: doc.permalink.startsWith("http") ? doc.permalink : doc.permalink,
            year: parseInt((_a = doc.post_title.match(/\((\d{4})\)/)) == null ? void 0 : _a[1]) || null
          });
        }
      }
      if (searchResults.length === 0) {
        console.log("[VegaMovies] No search results found.");
        return [];
      }
      const bestMatch = findBestTitleMatch(mediaInfo, searchResults);
      if (!bestMatch) {
        console.log("[VegaMovies] No confident match found.");
        return [];
      }
      console.log(`[VegaMovies] Selected: "${bestMatch.title}"`);
      const detailHtml = yield fetchText(bestMatch.url);
      const $ = import_cheerio_without_node_native.default.load(detailHtml);
      const sources = [];
      $("h3 > a, h5 > a, a").each((i, el) => {
        const a = $(el);
        const href = a.attr("href");
        const text = a.text();
        if (href && (text.includes("V-Cloud") || text.includes("Download") || href.includes("vcloud"))) {
          sources.push({ url: href, server: text });
        }
      });
      for (const source of sources) {
        if (source.url.includes("vcloud")) {
          const vcloudBase = (yield getLatestBaseUrl("vcloud")) || "https://vcloud.su";
          const streams = yield resolveVCloud(source.url, vcloudBase);
          allStreams.push(...streams);
        } else {
          allStreams.push({
            name: `VegaMovies [${source.server || "Stream"}]`,
            title: source.server || "VegaMovies",
            url: source.url,
            quality: extractQuality(source.url),
            headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: baseUrl })
          });
        }
      }
      console.log(`[VegaMovies] Total streams found: ${allStreams.length}`);
      return allStreams;
    } catch (error) {
      console.error(`[VegaMovies] Error: ${error.message}`);
      return [];
    }
  });
}

// src/vegamovies/index.js
module.exports = { getStreams };
