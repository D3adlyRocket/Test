/**
 * flixindia - Built from src/flixindia/
 * Fully rewritten for the updated Next.js platform framework.
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

// src/flixindia/http.js
var BASE_URL = "https://mkvbase.site";
var BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Referer": "https://mkvbase.site/",
  "Upgrade-Insecure-Requests": "1"
};
var COOKIE_JAR = "";
function storeCookies(res) {
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    COOKIE_JAR = setCookie.split(";")[0];
    console.log("[HTTP][COOKIE] Stored:", COOKIE_JAR);
  }
}
function sleep(ms) {
  return __async(this, null, function* () {
    return new Promise((r) => setTimeout(r, ms));
  });
}
function requestWithRetry(fetchFn, label, retries = 3) {
  return __async(this, null, function* () {
    let attempt = 0;
    let delay = 500;
    while (attempt < retries) {
      try {
        console.log(`[HTTP][RETRY] ${label} attempt ${attempt + 1}/${retries}`);
        return yield fetchFn();
      } catch (err) {
        attempt++;
        console.log(`[HTTP][RETRY] ❌ ${label} failed:`, err.message);
        if (attempt >= retries) {
          console.log(`[HTTP][RETRY] ❌ ${label} giving up`);
          throw err;
        }
        yield sleep(delay);
        delay *= 2;
      }
    }
  });
}
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    return requestWithRetry(() => __async(this, null, function* () {
      const res = yield fetch(url, __spreadProps(__spreadValues({}, options), {
        headers: __spreadValues(__spreadValues(__spreadValues({}, BASE_HEADERS), COOKIE_JAR ? { Cookie: COOKIE_JAR } : {}), options.headers || {})
      }));
      storeCookies(res);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return yield res.text();
    }), `GET ${url}`);
  });
}

// src/flixindia/utils.js
var QUALITY_REGEX = /\b(camrip|hdcam|cam|hdtc|tc|telesync|ts|scr|screener|dvdscr)\b/i;
var STRICT_SUBSTRINGS = [
  "hqcam", "clean cam", "line audio", "xbet", "1xbet", "zip", "rar", "tar", "7z", "apk", "exe", "pdf"
];
function isBannedTitle(title) {
  const lower = title.toLowerCase();
  for (const word of STRICT_SUBSTRINGS) {
    if (lower.includes(word)) {
      console.log(`[FILTER] ❌ STRICT exclude "${title}" (matched: ${word})`);
      return true;
    }
  }
  if (QUALITY_REGEX.test(lower)) {
    console.log(`[FILTER] ❌ SOFT exclude "${title}" (quality tag match)`);
    return true;
  }
  return false;
}

// src/flixindia/hosts.js
function getHostname(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ""; }
}
function getPath(url) {
  try { return new URL(url).pathname.toLowerCase(); } catch (e) { return ""; }
}
function classifyHost(url) {
  const hostname = getHostname(url);
  const path = getPath(url);
  if (hostname.includes("hubcloud")) {
    let kind = "unknown";
    if (path.startsWith("/drive")) kind = "drive";
    else if (path.startsWith("/video")) kind = "video";
    console.log("[HOST] hubcloud →", kind, url);
    return { host: "hubcloud", kind };
  }
  if (hostname.includes("gdflix") || hostname.includes("gdlink")) {
    let kind = "unknown";
    if (path.startsWith("/file")) kind = "file";
    else if (path.startsWith("/pack")) kind = "pack";
    console.log("[HOST] gdflix →", kind, url);
    return { host: "gdflix", kind };
  }
  console.log("[HOST] unknown →", url);
  return { host: "unknown", kind: "unknown" };
}

// src/flixindia/quality.js
var QUALITY_PATTERNS = [
  { label: "2160p", regex: /\b2160p\b/i },
  { label: "1080p", regex: /\b1080p\b/i },
  { label: "720p", regex: /\b720p\b/i },
  { label: "480p", regex: /\b480p\b/i }
];
function extractQuality(title) {
  for (const q of QUALITY_PATTERNS) {
    if (q.regex.test(title)) {
      console.log(`[QUALITY] ${q.label} ← "${title}"`);
      return q.label;
    }
  }
  console.log(`[QUALITY] unknown ← "${title}"`);
  return "unknown";
}

// src/flixindia/search.js
var import_cheerio_without_node_native_search = __toESM(require("cheerio-without-node-native"));
function search(query) {
  return __async(this, null, function* () {
    console.log("\n[SEARCH] ▶ Starting HTML Search Scrape for:", query);
    try {
      // Next.js standard unified routing structure for search queries
      const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
      const html = yield fetchText(searchUrl);
      const $ = import_cheerio_without_node_native_search.default.load(html);
      const results = [];

      // Scrape any anchor tag that points to download portals matching your console logs
      $("a[href]").each((_, el) => {
        const title = $(el).text().trim();
        const url = $(el).attr("href");

        if (!title || !url) return;
        
        // Match only actual link entries matching host wrappers
        if (url.includes("hubcloud") || url.includes("gdflix") || url.includes("gdlink")) {
          if (isBannedTitle(title)) return;

          results.push(__spreadValues({
            title: title,
            url: url,
            quality: extractQuality(title)
          }, classifyHost(url)));
        }
      });

      console.log("[SEARCH] ▶ Total target results filtered:", results.length);
      return results;
    } catch (err) {
      console.log("[SEARCH] ❌ HTML parser search block broken:", err.message);
      return [];
    }
  });
}

// src/flixindia/hubcloud.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
function resolveHubCloud(entryUrl, meta) {
  return __async(this, null, function* () {
    console.log("\n[HUBCLOUD] ▶ Resolving Link:", entryUrl);
    const streams = [];
    
    try {
      const entryHtml = yield fetchText(entryUrl);
      const $entry = import_cheerio_without_node_native.default.load(entryHtml);
      let fileSize = null;
      
      try {
        const sizeText = $entry("li, div, p").filter((_, el) => $entry(el).text().includes("File Size")).text().trim();
        if (sizeText) {
          fileSize = sizeText.replace(/[\n\r\t]+/g, ' ');
          console.log(`[HUBCLOUD] 📦 File Size: ${fileSize}`);
        }
      } catch (err) {
        console.log("[HUBCLOUD] ⚠️ File size container parsing missed:", err.message);
      }

      let generatorUrl = null;
      $entry("a").each((_, el) => {
        const href = $entry(el).attr("href");
        const text = $entry(el).text().toLowerCase();
        if (href && (href.includes("/download") || href.includes("/drive") || text.includes("download") || text.includes("click here"))) {
           generatorUrl = href;
        }
      });

      if (!generatorUrl) {
        // Fallback: If the entryUrl is already the direct final target page
        generatorUrl = entryUrl;
      }
      
      console.log("[HUBCLOUD] Processing final redirection layer:", generatorUrl);
      const finalHtml = yield fetchText(generatorUrl);
      const $final = import_cheerio_without_node_native.default.load(finalHtml);
      
      $final("a[href]").each((_, el) => {
        const href = $final(el).attr("href");
        if (!href) return;
        
        let url;
        try { url = new URL(href); } catch (e) { return; }

        if (url.hostname.includes("pixeldrain")) {
          console.log("[HUBCLOUD] 🟣 PixelDrain matched:", url.href);
          const resolved = resolvePixelDrain(url);
          if (resolved) {
            streams.push({
              name: "Flixindia - hubcloud - PixelDrain",
              title: meta.title,
              url: resolved,
              quality: meta.quality,
              size: fileSize,
              source: "hubcloud-pixeldrain"
            });
          }
        } else if (href.includes("fsl") || $final(el).text().toLowerCase().includes("fast server") || href.includes("/d/")) {
           console.log("[HUBCLOUD] ✅ Stream Link Found:", href);
           streams.push({
              name: "Flixindia - hubcloud - FSL",
              title: meta.title,
              url: href,
              quality: meta.quality,
              size: fileSize,
              source: "hubcloud-fsl"
           });
        }
      });
    } catch (e) {
      console.log("[HUBCLOUD] ❌ Failed resolving asset node stream:", e.message);
    }

    const filtered = streams.filter((s) => {
      if (s.url.includes("gpdl") || s.url.includes("hubcdn")) {
        return false;
      }
      return true;
    });
    return filtered;
  });
}

function resolvePixelDrain(url) {
  try {
    const parts = url.pathname.split("/").filter(Boolean);
    let fileId = null;
    if (parts[0] === "u" && parts[1]) fileId = parts[1];
    else if (parts[0] === "file" && parts[1]) fileId = parts[1];
    else if (parts[0] === "api" && parts[1] === "file" && parts[2]) fileId = parts[2];
    
    if (!fileId) return null;
    return `https://${url.hostname}/api/file/${fileId}`;
  } catch (err) {
    return null;
  }
}

// src/flixindia/index.js
var TMDB_API_KEY = "919605fd567bbffcf76492a03eb4d527";
var TMDB_BASE = "https://api.themoviedb.org/3";
function pad2(num) { return String(num).padStart(2, "0"); }
function isV4Key(key) { return key && key.length > 40; }

function getTmdbTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      let endpoint = mediaType === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
      let url = `${TMDB_BASE}${endpoint}`;
      const options = { method: "GET", headers: {} };
      if (isV4Key(TMDB_API_KEY)) {
        options.headers.Authorization = `Bearer ${TMDB_API_KEY}`;
      } else {
        url += `?api_key=${TMDB_API_KEY}`;
      }
      
      const res = yield fetch(url, options);
      const data = yield res.json();
      if (mediaType === "movie") return (data == null ? void 0 : data.title) || null;
      if (mediaType === "tv") return (data == null ? void 0 : data.name) || null;
      return null;
    } catch (error) {
      return null;
    }
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const baseTitle = yield getTmdbTitle(tmdbId, mediaType);
      if (!baseTitle) {
        console.log("[FlixIndia] TMDB title could not be fetched.");
        return [];
      }
      let query = mediaType === "movie" ? baseTitle : `${baseTitle} S${pad2(season)}E${pad2(episode)}`;
      
      const results = yield search(query);
      if (!results || !Array.isArray(results)) return [];
      
      const limitedResults = results.slice(0, 5);
      const promises = limitedResults.map((item) => __async(this, null, function* () {
        try {
          if (item.host === "hubcloud") {
            const resolved = yield resolveHubCloud(item.url, {
              title: item.title,
              quality: item.quality
            });
            return resolved.map((stream) => ({
              name: stream.name,
              title: stream.title,
              url: stream.url,
              quality: stream.quality || "unknown",
              size: stream.size || null,
              headers: {}
            }));
          }
        } catch (err) {
          console.log(`[FlixIndia] Error processing item: ${err.message}`);
        }
        return [];
      }));
      const resultsArrays = yield Promise.all(promises);
      return resultsArrays.flat();
    } catch (err) {
      console.error(`[FlixIndia] Fatal exception: ${err.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
