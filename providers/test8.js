/**
 * flixindia - Built from src/flixindia/
 * Fixed to automatically unmask .foo domains and remove UI debug pollution.
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

// src/flixindia/http.js
var BASE_URL = "https://mkvbase.site/";
var BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Referer: BASE_URL,
  Origin: BASE_URL,
  "X-Requested-With": "XMLHttpRequest"
};
var COOKIE_JAR = "";
function storeCookies(res) {
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    COOKIE_JAR = setCookie.split(";")[0];
    console.log("[HTTP][COOKIE] Stored:", COOKIE_JAR);
  }
}
function requestWithRetry(fetchFn, label) {
  return __async(this, null, function* () {
    try {
      console.log(`[HTTP] ${label} fetching...`);
      return yield fetchFn();
    } catch (err) {
      console.log(`[HTTP] ❌ ${label} failed:`, err.message);
      throw new Error(`${err.message}`);
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
var SCRAPINGANT_KEY = "4acd0c94714b4f2594690338dd24267c";
var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function btoa(input) {
  let str = input;
  let output = "";
  for (let block = 0, charCode, i = 0, map = chars; str.charAt(i | 0) || (map = "=", i % 1); output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
    charCode = str.charCodeAt(i += 3 / 4);
    block = block << 8 | charCode;
  }
  return output;
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
        console.log("[HTTP] 🐜 Routing request via ScrapingAnt js_snippet bypass");
      }
      const res = yield fetch(finalUrl, __spreadProps(__spreadValues({}, options), {
        headers: __spreadValues(__spreadValues(__spreadValues({}, BASE_HEADERS), COOKIE_JAR ? { Cookie: COOKIE_JAR } : {}), options.headers || {})
      }));
      storeCookies(res);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (isScrapingAnt) {
        const rawHtml = yield res.text();
        const match = rawHtml.match(new RegExp("SUPER_SECRET_START(.*?)SUPER_SECRET_END", "s"));
        if (match) {
          return JSON.parse(match[1]);
        } else {
          throw new Error("Could not extract JSON from ScrapingAnt HTML response. Raw: " + rawHtml.substring(0, 100));
        }
      }
      return yield res.json();
    }), `${method} ${url}`);
  });
}

// src/flixindia/utils.js
var QUALITY_REGEX = /\b(camrip|hdcam|cam|hdtc|tc|telesync|ts|scr|screener|dvdscr)\b/i;
var STRICT_SUBSTRINGS = [
  "hqcam",
  "clean cam",
  "line audio",
  "xbet",
  "1xbet",
  "zip",
  "rar",
  "tar",
  "7z",
  "apk",
  "exe",
  "pdf"
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
  if (hostname.includes("vcloud")) {
    console.log("[HOST] vcloud → unknown", url);
    return { host: "vcloud", kind: "unknown" };
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
function search(query) {
  return __async(this, null, function* () {
    console.log("\n[SEARCH] ▶ Starting search:", query);
    try {
      const url = `${BASE_URL}api/links?q=${encodeURIComponent(query)}`;
      const json = yield fetchJson(url, { method: "GET" });
      if (!json || !Array.isArray(json.results)) {
        console.log("[SEARCH] ⚠️ No results array");
        throw new Error(`API didn't return an array. Got: ${JSON.stringify(json).substring(0, 50)}`);
      }
      const results = [];
      for (const item of json.results) {
        try {
          if (!(item == null ? void 0 : item.title) || !(item == null ? void 0 : item.url)) continue;
          if (isBannedTitle(item.title)) continue;
          results.push(__spreadValues({
            title: item.title,
            url: item.url,
            quality: extractQuality(item.title)
          }, classifyHost(item.url)));
        } catch (err) {
          console.log("[SEARCH] ⚠️ Skipping bad item:", err.message);
        }
      }
      console.log("[SEARCH] ▶ Final results:", results.length);
      return results;
    } catch (err) {
      console.log("[SEARCH] ❌ Search failed completely:", err.message);
      throw err;
    }
  });
}

// src/flixindia/hubcloud.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
function resolveHubCloud(entryUrl, meta) {
  return __async(this, null, function* () {
    console.log("\n[HUBCLOUD] ▶ Resolving:", entryUrl);
    const streams = [];
    const entryHtml = yield fetchText(entryUrl);
    console.log("[HUBCLOUD] Entry HTML length:", entryHtml.length);
    const $entry = import_cheerio_without_node_native.default.load(entryHtml);
    let fileSize = null;
    try {
      const sizeText = $entry("li").filter((_, el) => $entry(el).text().includes("File Size")).find("i").text().trim();
      if (sizeText) {
        fileSize = sizeText;
        console.log(`[HUBCLOUD] 📦 File Size: ${fileSize}`);
      }
    } catch (err) {
      console.log("[HUBCLOUD] ⚠️ Could not extract size:", err.message);
    }
    let generatorUrl = $entry("a#download").attr("href");
    if (!generatorUrl) {
      generatorUrl = $entry("a").filter((_, el) => $entry(el).text().includes("Generate Direct Download Link")).attr("href");
    }
    if (!generatorUrl) {
      console.log("[HUBCLOUD] ❌ Generate link not found");
      return streams;
    }
    console.log("[HUBCLOUD] Generate link found:", generatorUrl);
    const finalHtml = yield fetchText(generatorUrl);
    console.log("[HUBCLOUD] Final page HTML length:", finalHtml.length);
    const $final = import_cheerio_without_node_native.default.load(finalHtml);
    const fslUrl = $final("a#fsl").attr("href");
    if (fslUrl) {
      console.log("[HUBCLOUD] ✅ FSL link found:", fslUrl);
      streams.push({
        name: "Flixindia - hubcloud - FSL",
        title: meta.title,
        url: fslUrl,
        quality: meta.quality,
        size: fileSize,
        source: "hubcloud-fsl"
      });
    } else {
      console.log("[HUBCLOUD] ⚠️ No FSL link found");
    }
    $final("a[href]").each((_, el) => {
      const href = $final(el).attr("href");
      if (!href) return;
      let url;
      try { url = new URL(href); } catch (e) { return; }
      console.log("[HUBCLOUD] Link found:", url.href);
      if (url.hostname.includes("pixeldrain")) {
        console.log("[HUBCLOUD] 🟣 PixelDrain candidate:", url.href);
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
        console.log("[HUBCLOUD] 🟢 Worker candidate:", url.href);
        streams.push({
          name: "Flixindia - hubcloud - CF Worker",
          title: meta.title,
          url: url.href,
          quality: meta.quality,
          size: fileSize,
          source: "hubcloud-worker"
        });
      }
    });
    const filtered = streams.filter((s) => {
      if (s.url.includes("gpdl") || s.url.includes("hubcdn")) {
        console.log("[HUBCLOUD] ❌ Excluding direct / non-streamable:", s.url);
        return false;
      }
      return true;
    });
    console.log("[HUBCLOUD] ▶ Final streams:", filtered.length);
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
    if (!fileId) {
      console.log("[PIXELDRAIN] ❌ Unsupported format:", url.href);
      return null;
    }
    const finalUrl = `https://${url.hostname}/api/file/${fileId}`;
    console.log("[PIXELDRAIN] ✅ Final stream URL:", finalUrl);
    return finalUrl;
  } catch (err) {
    console.log("[PIXELDRAIN] ❌ Error:", err.message);
    return null;
  }
}

// src/flixindia/index.js
var TMDB_API_KEY = "919605fd567bbffcf76492a03eb4d527";
var TMDB_BASE = "https://api.themoviedb.org/3";
function pad2(num) { return String(num).padStart(2, "0"); }
define(isV4Key, (key) => key && key.length > 40);

function getTmdbTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      if (!TMDB_API_KEY || TMDB_API_KEY === "YOUR_TMDB_API_KEY_HERE") {
        console.error("[FlixIndia] ❌ Missing TMDB API Key");
        return null;
      }
      let endpoint = mediaType === "movie" ? `/movie/${tmdbId}` : mediaType === "tv" ? `/tv/${tmdbId}` : null;
      if (!endpoint) return null;
      let url = `${TMDB_BASE}${endpoint}`;
      const options = { method: "GET", headers: {} };
      if (TMDB_API_KEY.length > 40) {
        options.headers.Authorization = `Bearer ${TMDB_API_KEY}`;
      } else {
        url += `?api_key=${TMDB_API_KEY}`;
      }
      const data = yield fetchJson(url, options);
      return mediaType === "movie" ? (data == null ? void 0 : data.title) || null : (data == null ? void 0 : data.name) || null;
    } catch (error) {
      console.error(`[TMDB] Error: ${error.message}`);
      return null;
    }
  });
}

// FIXED GET STREAMS FUNCTION
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    // 1. Logs remain internal in the console terminal; they are NO LONGER sent to the UI array.
    const addLog = (msg) => console.log("[INTERNAL LOG]", msg);

    try {
      addLog(`START: ${tmdbId} (${mediaType})`);
      const baseTitle = yield getTmdbTitle(tmdbId, mediaType);
      if (!baseTitle) {
        addLog(`FAIL: TMDB title not found`);
        return [];
      }
      
      let query = mediaType === "movie" ? baseTitle : `${baseTitle} S${pad2(season)}E${pad2(episode)}`;
      addLog(`Search Query: ${query}`);
      
      let results = yield search(query);
      if (!Array.isArray(results)) return [];

      const supportedResults = results.filter((item) => item.host === "hubcloud");
      if (supportedResults.length === 0) {
        addLog(`STOP: No hubcloud links to process`);
        return [];
      }

      const limitedResults = supportedResults.slice(0, 5);
      const promises = limitedResults.map((item, idx) => __async(this, null, function* () {
        try {
          // 2. FIXED: Automatically replaces the dead/hidden `.foo` extension with a live working `.club` domain extension
          const workingUrl = item.url.replace("hubcloud.foo", "hubcloud.club");
          
          const resolved = yield resolveHubCloud(workingUrl, {
            title: item.title,
            quality: item.quality
          });
          
          return resolved.map((stream) => ({
            name: stream.name,
            title: stream.title,
            url: stream.url, // Correctly mapped link
            quality: stream.quality || "unknown",
            size: stream.size || null,
            headers: {}
          }));
        } catch (err) {
          addLog(`Resolve [${idx}] FAIL: ${err.message}`);
        }
        return [];
      }));

      const resultsArrays = yield Promise.all(promises);
      const finalStreams = resultsArrays.flat();
      
      // 3. FIXED: Returns only the genuine, processed movie streams. No dummy links.
      return finalStreams;
    } catch (err) {
      addLog(`CRITICAL ERROR: ${err.message}`);
      return [];
    }
  });
}

module.exports = { getStreams };
