/**
 * flixindia - Fixed & Updated
 * Generated: 2026-04-20
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

// --- HTTP Helper ---
var BASE_URL = "https://m.flixindia.xyz/";
var BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: BASE_URL,
  Origin: BASE_URL
};
var COOKIE_JAR = "";

function storeCookies(res) {
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    COOKIE_JAR = setCookie.split(";")[0];
  }
}

function fetchText(url, options = {}) {
  return __async(this, null, function* () {
    const res = yield fetch(url, __spreadProps(__spreadValues({}, options), {
      headers: __spreadValues(__spreadValues(__spreadValues({}, BASE_HEADERS), COOKIE_JAR ? { Cookie: COOKIE_JAR } : {}), options.headers || {})
    }));
    storeCookies(res);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return yield res.text();
  });
}

function fetchJson(url, options = {}) {
  return __async(this, null, function* () {
    const res = yield fetch(url, __spreadProps(__spreadValues({}, options), {
      headers: __spreadValues(__spreadValues(__spreadValues({}, BASE_HEADERS), COOKIE_JAR ? { Cookie: COOKIE_JAR } : {}), options.headers || {})
    }));
    storeCookies(res);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return yield res.json();
  });
}

// --- Utils ---
function extractCsrf(html) {
  const match = html.match(/CSRF_TOKEN\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

function classifyHost(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const path = new URL(url).pathname.toLowerCase();

    if (hostname.includes("hubcloud")) return { host: "hubcloud", kind: "video" };
    if (hostname.includes("gdflix") || hostname.includes("gdlink")) return { host: "gdflix", kind: "file" };
    if (hostname.includes("fastcdn-dl.pages.dev")) return { host: "fastcdn", kind: "direct" };
    
    return { host: "unknown", kind: "unknown" };
  } catch (e) {
    return { host: "unknown", kind: "unknown" };
  }
}

// --- Search ---
function search(query) {
  return __async(this, null, function* () {
    try {
      const homeHtml = yield fetchText(BASE_URL);
      const csrf = extractCsrf(homeHtml);
      if (!csrf) return [];

      const body = new URLSearchParams({ action: "search", csrf_token: csrf, q: query }).toString();
      const json = yield fetchJson(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });

      if (!json.results) return [];
      return json.results.map(item => __spreadValues({
        title: item.title,
        url: item.url,
        quality: item.title.match(/\b(1080p|720p|480p|2160p)\b/i)?.[0] || "HD"
      }, classifyHost(item.url)));
    } catch (err) {
      console.error("[SEARCH] Failed:", err.message);
      return [];
    }
  });
}

// --- Resolvers ---
var cheerio = __toESM(require("cheerio-without-node-native"));

function resolveGeneric(entryUrl, meta) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(entryUrl);
      const $ = cheerio.default.load(html);
      const streams = [];

      // 1. Handle Pages.dev (Instant Download)
      if (entryUrl.includes("pages.dev")) {
        const directUrl = new URL(entryUrl).searchParams.get("url");
        if (directUrl) {
          streams.push({ name: "FlixIndia - Instant", url: directUrl, quality: meta.quality, title: meta.title });
        }
        return streams;
      }

      // 2. Handle GDFlix / HubCloud (Scrape Download Button)
      let nextUrl = $("a#download, a.btn-success, a.btn-primary").attr("href");
      if (!nextUrl) return [];

      const finalHtml = yield fetchText(nextUrl);
      const $final = cheerio.default.load(finalHtml);

      // Extract all likely stream links
      $final("a[href]").each((_, el) => {
        const href = $final(el).attr("href");
        if (!href) return;
        
        if (href.includes("googleusercontent.com") || href.includes("pixeldrain") || href.includes("/zfile/")) {
          streams.push({
            name: `FlixIndia - ${meta.host || 'Cloud'}`,
            title: meta.title,
            url: href,
            quality: meta.quality
          });
        }
      });

      return streams;
    } catch (e) {
      return [];
    }
  });
}

// --- Main Export ---
const TMDB_API_KEY = "919605fd567bbffcf76492a03eb4d527";

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const tmdbData = await fetchJson(tmdbUrl);
    const title = mediaType === "movie" ? tmdbData.title : tmdbData.name;
    
    let query = title;
    if (mediaType === "tv") query += ` S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;

    const results = await search(query);
    const limited = results.slice(0, 6);
    
    const streamPromises = limited.map(item => resolveGeneric(item.url, item));
    const resultsArrays = await Promise.all(streamPromises);
    
    return resultsArrays.flat().filter(s => s.url);
  } catch (err) {
    return [];
  }
}

module.exports = { getStreams };
