/**
 * flixindia - Unified Scraper Script
 * Stripped of UI debug dummies. Returns pure stream arrays.
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
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// --- HTTP CONFIGURATION ---
var BASE_URL = "https://mkvbase.site/"; 
var BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Referer: BASE_URL,
  Origin: BASE_URL,
  "X-Requested-With": "XMLHttpRequest"
};
var COOKIE_JAR = "";
var SCRAPINGANT_KEY = "4acd0c94714b4f2594690338dd24267c";
var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

function storeCookies(res) {
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    COOKIE_JAR = setCookie.split(";")[0];
  }
}

function sleep(ms) {
  return __async(this, null, function* () {
    return new Promise((r) => setTimeout(r, ms));
  });
}

function btoa(input) {
  let str = input;
  let output = "";
  for (let block = 0, charCode, i = 0, map = chars; str.charAt(i | 0) || (map = "=", i % 1); output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
    charCode = str.charCodeAt(i += 3 / 4);
    block = block << 8 | charCode;
  }
  return output;
}

function requestWithRetry(fetchFn, label, retries = 3) {
  return __async(this, null, function* () {
    let attempt = 0;
    let delay = 500;
    while (attempt < retries) {
      try {
        return yield fetchFn();
      } catch (err) {
        attempt++;
        if (attempt >= retries) throw err;
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return yield res.text();
    }), `GET ${url}`);
  });
}

function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    return requestWithRetry(() => __async(this, null, function* () {
      let finalUrl = url;
      let isScrapingAnt = false;

      if (SCRAPINGANT_KEY && SCRAPINGANT_KEY !== "YOUR_SCRAPINGANT_KEY_HERE" && url.includes("mkvbase.site")) {
        isScrapingAnt = true;
        const apiPath = url.replace("https://mkvbase.site", "");
        const jsSnippet = `
          fetch('${apiPath}', {
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': 'https://mkvbase.site/',
              'Origin': 'https://mkvbase.site'
            }
          })
          .then(r => r.text())
          .then(text => { 
             document.body.innerHTML = 'SUPER_SECRET_START' + text + 'SUPER_SECRET_END<div id="scrapingant-done"></div>';
          });
        `;
        const encodedSnippet = encodeURIComponent(btoa(jsSnippet));
        const targetUrl = encodeURIComponent("https://mkvbase.site");
        finalUrl = `https://api.scrapingant.com/v2/general?url=${targetUrl}&x-api-key=${SCRAPINGANT_KEY}&js_snippet=${encodedSnippet}&wait_for_selector=%23scrapingant-done`;
      }

      const res = yield fetch(finalUrl, __spreadProps(__spreadValues({}, options), {
        headers: __spreadValues(__spreadValues(__spreadValues({}, BASE_HEADERS), COOKIE_JAR ? { Cookie: COOKIE_JAR } : {}), options.headers || {})
      }));
      storeCookies(res);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (isScrapingAnt) {
        const rawHtml = yield res.text();
        const match = rawHtml.match(new RegExp("SUPER_SECRET_START(.*?)SUPER_SECRET_END", "s"));
        if (match) return JSON.parse(match[1]);
        throw new Error("Could not extract JSON from ScrapingAnt payload");
      }
      return yield res.json();
    }), `${method} ${url}`);
  });
}

// --- UTILS & FILTERING ---
var QUALITY_REGEX = /\b(camrip|hdcam|cam|hdtc|tc|telesync|ts|scr|screener|dvdscr)\b/i;
var STRICT_SUBSTRINGS = ["hqcam", "clean cam", "line audio", "xbet", "1xbet", "zip", "rar", "tar", "7z", "apk", "exe", "pdf"];

function isBannedTitle(title) {
  const lower = title.toLowerCase();
  for (const word of STRICT_SUBSTRINGS) {
    if (lower.includes(word)) return true;
  }
  return QUALITY_REGEX.test(lower);
}

function classifyHost(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const path = new URL(url).pathname.toLowerCase();
    if (hostname.includes("hubcloud")) {
      return { host: "hubcloud", kind: path.startsWith("/drive") ? "drive" : "video" };
    }
    if (hostname.includes("gdflix") || hostname.includes("gdlink")) {
      return { host: "gdflix", kind: path.startsWith("/file") ? "file" : "pack" };
    }
    return { host: "unknown", kind: "unknown" };
  } catch (e) {
    return { host: "unknown", kind: "unknown" };
  }
}

var QUALITY_PATTERNS = [
  { label: "2160p", regex: /\b2160p\b/i },
  { label: "1080p", regex: /\b1080p\b/i },
  { label: "720p", regex: /\b720p\b/i },
  { label: "480p", regex: /\b480p\b/i }
];

function extractQuality(title) {
  for (const q of QUALITY_PATTERNS) {
    if (q.regex.test(title)) return q.label;
  }
  return "unknown";
}

// --- SEARCH ENGINE ---
function search(query) {
  return __async(this, null, function* () {
    try {
      const url = `${BASE_URL}api/links?q=${encodeURIComponent(query)}`;
      const json = yield fetchJson(url, { method: "GET" });
      if (!json || !Array.isArray(json.results)) return [];

      const results = [];
      for (const item of json.results) {
        if (!(item != null ? void 0 : item.title) || !item.url || isBannedTitle(item.title)) continue;
        results.push(__spreadValues({
          title: item.title,
          url: item.url,
          quality: extractQuality(item.title)
        }, classifyHost(item.url)));
      }
      return results;
    } catch (err) {
      console.error("[FlixIndia] Search process failed:", err.message);
      return [];
    }
  });
}

// --- LINK RESOLUTION (HUBCLOUD & PIXELDRAIN) ---
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));

function resolveHubCloud(entryUrl, meta) {
  return __async(this, null, function* () {
    const streams = [];
    try {
      const entryHtml = yield fetchText(entryUrl);
      const $entry = import_cheerio_without_node_native.default.load(entryHtml);
      let fileSize = null;
      
      const sizeText = $entry("li").filter((_, el) => $entry(el).text().includes("File Size")).find("i").text().trim();
      if (sizeText) fileSize = sizeText;

      let generatorUrl = $entry("a#download").attr("href") || $entry("a").filter((_, el) => $entry(el).text().includes("Generate Direct Download Link")).attr("href");
      if (!generatorUrl) return streams;

      const finalHtml = yield fetchText(generatorUrl);
      const $final = import_cheerio_without_node_native.default.load(finalHtml);
      const fslUrl = $final("a#fsl").attr("href");

      if (fslUrl) {
        streams.push({
          name: "Flixindia - hubcloud - FSL",
          title: meta.title,
          url: fslUrl,
          quality: meta.quality,
          size: fileSize,
          source: "hubcloud-fsl"
        });
      }

      $final("a[href]").each((_, el) => {
        const href = $final(el).attr("href");
        if (!href) return;
        try {
          const url = new URL(href);
          if (url.hostname.includes("pixeldrain")) {
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
          }
          if (url.hostname.includes("workers.dev")) {
            streams.push({
              name: "Flixindia - hubcloud - CF Worker",
              title: meta.title,
              url: url.href,
              quality: meta.quality,
              size: fileSize,
              source: "hubcloud-worker"
            });
          }
        } catch (e) {}
      });
    } catch (err) {
      console.error("[HUBCLOUD] Page traversal anomaly:", err.message);
    }

    return streams.filter((s) => !s.url.includes("gpdl") && !s.url.includes("hubcdn"));
  });
}

function resolvePixelDrain(url) {
  try {
    const parts = url.pathname.split("/").filter(Boolean);
    let fileId = null;
    if (parts[0] === "u" && parts[1]) fileId = parts[1];
    else if (parts[0] === "file" && parts[1]) fileId = parts[1];
    else if (parts[0] === "api" && parts[1] === "file" && parts[2]) fileId = parts[2];
    
    return fileId ? `https://${url.hostname}/api/file/${fileId}` : null;
  } catch (err) {
    return null;
  }
}

// --- MAIN CONTROLLER ---
var TMDB_API_KEY = "919605fd567bbffcf76492a03eb4d527";
var TMDB_BASE = "https://api.themoviedb.org/3";

function pad2(num) { return String(num).padStart(2, "0"); }
function isV4Key(key) { return key && key.length > 40; }

function getTmdbTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      let url = `${TMDB_BASE}/${mediaType}/${tmdbId}`;
      const options = { method: "GET", headers: {} };
      if (isV4Key(TMDB_API_KEY)) options.headers.Authorization = `Bearer ${TMDB_API_KEY}`;
      else url += `?api_key=${TMDB_API_KEY}`;

      const data = yield fetchJson(url, options);
      return mediaType === "movie" ? (data?.title || null) : (data?.name || null);
    } catch (error) {
      return null;
    }
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const baseTitle = yield getTmdbTitle(tmdbId, mediaType);
      if (!baseTitle) return [];
      
      let query = mediaType === "movie" ? baseTitle : `${baseTitle} S${pad2(season)}E${pad2(episode)}`;
      const results = yield search(query);
      if (!Array.isArray(results) || results.length === 0) return [];

      const supportedResults = results.filter((item) => item.host === "hubcloud").slice(0, 5);
      if (supportedResults.length === 0) return [];

      const promises = supportedResults.map((item) => __async(this, null, function* () {
        try {
          const resolved = yield resolveHubCloud(item.url, { title: item.title, quality: item.quality });
          return resolved.map((stream) => ({
            name: stream.name,
            title: stream.title,
            url: stream.url,
            quality: stream.quality || "unknown",
            size: stream.size || null,
            headers: {}
          }));
        } catch (err) {
          return [];
        }
      }));

      const resultsArrays = yield Promise.all(promises);
      return resultsArrays.flat();
    } catch (err) {
      return [];
    }
  });
}

module.exports = { getStreams };
