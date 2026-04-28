"use strict";

var cheerio = require("cheerio-without-node-native");

/**
 * patronDizipal - Built from src/patronDizipal/
 * Optimized for Android TV 
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
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

// --- HTTP CONFIGURATION ---
var MAIN_URL = "https://dizipal2063.com";
// TV FIX: Using a Sony Bravia User-Agent helps trigger TV-optimized streams (HLS/m3u8)
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; BRAVIA 4K VH2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8"
};
var KNOWN_DOMAINS = [
  "https://dizipal2063.com",
  "https://dizipal2064.com",
  "https://dizipal2062.com",
  "https://dizipal2061.com",
  "https://dizipal2060.com",
  "https://dizipal2059.com"
];
var _resolvedUrl = null;

function resolveMainUrl() {
  return __async(this, null, function* () {
    if (_resolvedUrl) return _resolvedUrl;
    for (const domain of KNOWN_DOMAINS) {
      try {
        // TV FIX: Increased timeout to 8s for slower TV network modules
        const res = yield fetch(`${domain}/`, {
          method: "HEAD",
          headers: HEADERS,
          signal: AbortSignal.timeout(8e3) 
        });
        if (res.ok || res.status === 302 || res.status === 301) {
          const finalUrl = new URL(res.url).origin;
          _resolvedUrl = finalUrl;
          return finalUrl;
        }
      } catch (_) {}
    }
    _resolvedUrl = KNOWN_DOMAINS[0];
    return _resolvedUrl;
  });
}

function fixUrl(url, baseUrl = MAIN_URL) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  try {
    return new URL(url, baseUrl).toString();
  } catch (_) {
    return url;
  }
}

function fetchWithResponse(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield fetch(url, __spreadProps(__spreadValues({}, options), {
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
    }));
    if (!response.ok) throw new Error(`HTTP ${response.status} -> ${url}`);
    return response;
  });
}

function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const res = yield fetchWithResponse(url, options);
    return yield res.text();
  });
}

function fetchJSON(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const text = yield fetchText(url, options);
    try {
      return JSON.parse(text.replace(/^\ufeff/, ""));
    } catch (e) {
      throw new Error(`JSON parse hatası: ${e.message}`);
    }
  });
}

// --- TMDB MODULE ---
var TMDB_API_KEY = "500330721680edb6d5f7f12ba7cd9023";
var PROVIDER_TAG = "[Dizipal]";

function decodeHtml(text) {
  return (text || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#039;/g, "'");
}

function getTmdbTitleFromHtml(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const type = mediaType === "movie" ? "movie" : "tv";
      const url = `https://www.themoviedb.org/${type}/${tmdbId}?language=tr-TR`;
      const response = yield fetch(url, { headers: HEADERS });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = yield response.text();
      let trTitle = "";
      const ogMatch = html.match(/<meta property="og:title" content="([^"]+)">/i);
      if (ogMatch) {
        trTitle = decodeHtml(ogMatch[1]).split("(")[0].trim();
      }
      const yearMatch = html.match(/\((\d{4})\)/);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;
      return { trTitle, year };
    } catch (e) {
      return null;
    }
  });
}

function getTmdbTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const htmlResult = yield getTmdbTitleFromHtml(tmdbId, mediaType);
    if (htmlResult) return __spreadValues({ origTitle: "", shortTitle: "" }, htmlResult);
    return { trTitle: "", origTitle: "", shortTitle: "", year: null };
  });
}

// --- EXTRACTOR MODULE ---
function resolveDizipal(url, activeUrl) {
  return __async(this, null, function* () {
    try {
      const response = yield fetchWithResponse(url);
      const html = yield response.text();
      const setCookie = response.headers.get("set-cookie");
      const cookies = setCookie ? setCookie.split(",").map((c) => c.split(";")[0]).join("; ") : "";
      
      const configToken = extractConfigToken(html);
      if (configToken) {
        const stream = yield resolveViaPlayerConfig(configToken, url, cookies, activeUrl);
        if (stream) return stream;
      }
      
      const embedUrl = extractDirectEmbed(html);
      if (embedUrl) return yield resolveEmbed(embedUrl, url);
      
      return null;
    } catch (e) {
      return null;
    }
  });
}

function extractConfigToken(html) {
  const patterns = [
    /id="videoContainer"[^>]+data-cfg="([^"]+)"/,
    /data-cfg="([^"]+)"/,
    /playerConfig\s*=\s*["']([^"']+)["']/,
    /cfg\s*:\s*["']([^"']+)["']/
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractDirectEmbed(html) {
  const patterns = [
    /iframe[^>]+src="([^"]*(?:embed|player|watch)[^"]+)"/i,
    /data-frame="([^"]+)"/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && !match[1].includes("youtube")) return fixUrl(match[1]);
  }
  return null;
}

function resolveViaPlayerConfig(configToken, refererUrl, cookies, siteUrl) {
  return __async(this, null, function* () {
    try {
      const baseUrl = siteUrl || MAIN_URL;
      const configRes = yield fetch(`${baseUrl}/ajax-player-config`, {
        method: "POST",
        headers: __spreadValues(__spreadProps(__spreadValues({}, HEADERS), {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "Origin": baseUrl,
          "Referer": refererUrl
        }), cookies ? { "Cookie": cookies } : {}),
        body: `cfg=${encodeURIComponent(configToken)}`
      });
      const configJson = yield configRes.json();
      const rawUrl = configJson?.config?.v || configJson?.url || configJson?.data?.url;
      if (!rawUrl) return null;
      return yield resolveEmbed(fixUrl(rawUrl.replace(/\\\//g, "/")), refererUrl);
    } catch (e) {
      return null;
    }
  });
}

function resolveEmbed(embedUrl, refererUrl) {
  return __async(this, null, function* () {
    if (embedUrl.includes("imagestoo")) return yield resolveImagestoo(embedUrl);
    return yield resolveStandard(embedUrl, refererUrl);
  });
}

function resolveImagestoo(embedUrl) {
  return __async(this, null, function* () {
    const videoId = embedUrl.split("/").filter(Boolean).pop();
    const apiUrl = `https://imagestoo.com/player/index.php?data=${videoId}&do=getVideo`;
    const response = yield fetch(apiUrl, {
      method: "POST",
      headers: __spreadProps(__spreadValues({}, HEADERS), { "X-Requested-With": "XMLHttpRequest", "Referer": embedUrl })
    });
    const data = yield response.json();
    if (data.securedLink) {
      return { url: fixUrl(data.securedLink.replace(/\\\//g, "/")), quality: "Auto", headers: { "Referer": embedUrl } };
    }
    return null;
  });
}

function resolveStandard(embedUrl, referer) {
  return __async(this, null, function* () {
    const html = yield fetchText(embedUrl, { headers: { "Referer": referer } });
    const m3u8Match = html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) || html.match(/["']([^"']*\.m3u8[^"']*)["']/i);
    if (m3u8Match) return { url: m3u8Match[1], quality: "Auto", headers: { "Referer": embedUrl } };
    return null;
  });
}

// --- MAIN STREAM HANDLER (STREMIO/TV COMPATIBLE) ---
async function getStreams(tmdbId, type, season, episode) {
  return __async(this, null, function* () {
    try {
      const activeUrl = yield resolveMainUrl();
      const { trTitle, year } = yield getTmdbTitle(tmdbId, type);
      if (!trTitle) return [];

      const matchType = type === "movie" ? "Film" : "Dizi";
      const searchUrl = `${activeUrl}/ajax-search?q=${encodeURIComponent(trTitle)}`;
      const results = yield fetchJSON(searchUrl, {
        headers: { "X-Requested-With": "XMLHttpRequest", "Referer": `${activeUrl}/` }
      });

      if (!results?.success) return [];
      const match = results.results.find((r) => {
        if (r.type !== matchType) return false;
        return !year || !r.year || Math.abs(year - r.year) <= 1;
      });

      if (!match) return [];
      let contentUrl = fixUrl(match.url, activeUrl);

      if (type === "tv" || type === "series") {
        const seriesHtml = yield fetchText(contentUrl);
        const epPattern = new RegExp(`${season}.*[Ss]ezon.*${episode}.*[Bb]ölüm`, "i");
        const $ = cheerio.load(seriesHtml);
        let epUrl = null;
        
        $("a").each((_, el) => {
          if (epPattern.test($(el).text())) {
            const href = $(el).attr("href");
            epUrl = fixUrl(href, activeUrl);
          }
        });
        if (!epUrl) return [];
        contentUrl = epUrl;
      }

      const stream = yield resolveDizipal(contentUrl, activeUrl);
      if (stream) {
        // TV FIX: Returning array of objects with the specific keys TV apps look for
        return [{
          name: `Dizipal TV`,
          title: `${trTitle} ${type === 'tv' ? `S${season}E${episode}` : ''}\n${stream.quality || 'Auto'}`,
          url: stream.url,
          // TV FIX: Passing headers inside the object for ExoPlayer
          headers: __spreadValues({ "User-Agent": HEADERS["User-Agent"] }, stream.headers || {}),
          behaviorHints: {
            bingeGroup: `dizipal-${tmdbId}`,
            notWeb: true
          }
        }];
      }
    } catch (e) {
      console.error(`[Dizipal] Global Error: ${e.message}`);
    }
    return [];
  });
}

module.exports = { getStreams };
