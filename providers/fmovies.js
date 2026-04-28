/**
 * patronDizipal - Full Logic - Optimized for Android TV
 * Generated: 2026-04-29T22:54:42.309Z
 */
"use strict";

const cheerio = require("cheerio-without-node-native");

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

// src/patronDizipal/index.js
var patronDizipal_exports = {};
__export(patronDizipal_exports, {
  getStreams: () => getStreams
});

// src/patronDizipal/http.js
var MAIN_URL = "https://dizipal2063.com";
// TV FIX: Updated User Agent
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 11; Sony Bravia 4K Build/RP1A.200720.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
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
        const res = yield fetch(`${domain}/`, {
          method: "HEAD",
          headers: HEADERS,
          signal: AbortSignal.timeout(8e3) // TV FIX: Higher timeout
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
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} -> ${url}`);
    }
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

// src/patronDizipal/tmdb.js
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
      } else {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
          trTitle = decodeHtml(titleMatch[1]).split("(")[0].split("\u2014")[0].trim();
        }
      }
      if (!trTitle) return null;
      let origTitle = trTitle;
      const origMatch = html.match(/<h3 class="caption" dir="auto">([^<]+)<\/h3>/i) || html.match(/<strong class="original_title">([^<]+)<\/strong>/i);
      if (origMatch) {
        const cleaned = decodeHtml(origMatch[1]).replace("Orijinal Başlık", "").replace("Original Title", "").replace("Orijinal Adı", "").replace("Orijinal Adi", "").trim();
        if (cleaned.length > 0) origTitle = cleaned;
      }
      const shortTitle = trTitle.split(" ").slice(0, 2).join(" ");
      const yearMatch = html.match(/\((\d{4})\)/);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;
      return { trTitle, origTitle, shortTitle, year };
    } catch (e) {
      return null;
    }
  });
}

function getTmdbTitleFromApi(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const type = mediaType === "movie" ? "movie" : "tv";
      const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=tr-TR`;
      const response = yield fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = yield response.json();
      const trTitle = data.title || data.name || "";
      const origTitle = data.original_title || data.original_name || trTitle;
      const shortTitle = trTitle.split(" ").slice(0, 2).join(" ");
      const dateStr = data.release_date || data.first_air_date || "";
      const year = dateStr ? parseInt(dateStr.substring(0, 4)) : null;
      if (!trTitle) return null;
      return { trTitle, origTitle, shortTitle, year };
    } catch (e) {
      return null;
    }
  });
}

function getTmdbTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const htmlResult = yield getTmdbTitleFromHtml(tmdbId, mediaType);
    if (htmlResult) return htmlResult;
    const apiResult = yield getTmdbTitleFromApi(tmdbId, mediaType);
    if (apiResult) return apiResult;
    return { trTitle: "", origTitle: "", shortTitle: "", year: null };
  });
}

// src/patronDizipal/extractor.js
function resolveDizipal(url, activeUrl) {
  return __async(this, null, function* () {
    try {
      const siteUrl = activeUrl || MAIN_URL;
      const response = yield fetchWithResponse(url);
      const html = yield response.text();
      const setCookie = response.headers.get("set-cookie");
      const cookies = setCookie ? setCookie.split(",").map((c) => c.split(";")[0]).join("; ") : "";
      const configToken = extractConfigToken(html);
      if (configToken) {
        const stream = yield resolveViaPlayerConfig(configToken, url, cookies, siteUrl);
        if (stream) return stream;
      }
      const embedUrl = extractDirectEmbed(html);
      if (embedUrl) return yield resolveEmbed(embedUrl, url);
      const directM3u8 = extractM3u8FromPage(html);
      if (directM3u8) return { url: directM3u8, quality: "Auto", headers: { "Referer": url } };
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
    /data-hash="([^"]+)"/,
    /data-token="([^"]+)"/,
    /data-key="([^"]+)"/,
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
    /data-frame="([^"]+)"/i,
    /<iframe[^>]+src="([^"]+)"/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && !match[1].includes("youtube") && !match[1].includes("google")) {
      return fixUrl(match[1]);
    }
  }
  return null;
}

function extractM3u8FromPage(html) {
  const match = html.match(/["']([^"']*\.m3u8[^"']*)["']/);
  return match ? match[1] : null;
}

function resolveViaPlayerConfig(configToken, refererUrl, cookies, siteUrl) {
  return __async(this, null, function* () {
    var _a, _b, _c;
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
      if (!configRes.ok) return null;
      const configText = yield configRes.text();
      let configJson;
      try {
        configJson = JSON.parse(configText);
      } catch (e) { return null; }
      const rawUrl = ((_a = configJson == null ? void 0 : configJson.config) == null ? void 0 : _a.v) || ((_b = configJson == null ? void 0 : configJson.config) == null ? void 0 : _b.url) || (configJson == null ? void 0 : configJson.url) || ((_c = configJson == null ? void 0 : configJson.data) == null ? void 0 : _c.url) || null;
      if (!rawUrl) return null;
      const embedUrl = fixUrl(rawUrl.replace(/\\\//g, "/"));
      return yield resolveEmbed(embedUrl, refererUrl);
    } catch (e) { return null; }
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
    var _a;
    const videoId = embedUrl.split("/").filter(Boolean).pop();
    const apiUrl = `https://imagestoo.com/player/index.php?data=${videoId}&do=getVideo`;
    const response = yield fetch(apiUrl, {
      method: "POST",
      headers: __spreadProps(__spreadValues({}, HEADERS), {
        "X-Requested-With": "XMLHttpRequest",
        "Referer": embedUrl
      })
    });
    if (!response.ok) throw new Error(`Imagestoo API hatası: ${response.status}`);
    const setCookie = response.headers.get("set-cookie");
    const sessionCookie = setCookie ? ((_a = setCookie.split(",").find((c) => c.includes("fireplayer_player"))) == null ? void 0 : _a.split(";")[0]) || "" : "";
    const data = yield response.json();
    const securedLink = data.securedLink ? data.securedLink.replace(/\\\//g, "/") : null;
    if (securedLink) {
      return {
        url: fixUrl(securedLink),
        quality: "Auto",
        headers: __spreadValues({ "Referer": embedUrl }, sessionCookie ? { "Cookie": sessionCookie } : {})
      };
    }
    return null;
  });
}

function resolveStandard(embedUrl, referer) {
  return __async(this, null, function* () {
    const html = yield fetchText(embedUrl, { headers: { "Referer": referer } });
    const m3u8Match = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) || html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) || html.match(/["']([^"']*\.m3u8[^"']*)["']/i);
    if (m3u8Match) return { url: m3u8Match[1], quality: "Auto", headers: { "Referer": embedUrl } };
    const mp4Match = html.match(/["']([^"']*\.mp4[^"']*)["']/i);
    if (mp4Match) return { url: mp4Match[1], quality: "Auto", headers: { "Referer": embedUrl } };
    return null;
  });
}

// --- TV EXPORT LOGIC ---
async function getStreams(tmdbId, type, season, episode) {
  return __async(this, null, function* () {
    try {
      const activeUrl = yield resolveMainUrl();
      const { trTitle, origTitle, shortTitle, year } = yield getTmdbTitle(tmdbId, type);
      if (!trTitle && !origTitle) return [];
      
      const matchType = type === "movie" ? "Film" : "Dizi";
      const queries = [...new Set([trTitle, origTitle, shortTitle].filter((q) => q && q.length > 1))];
      let match = null;

      for (const query of queries) {
        const searchUrl = `${activeUrl}/ajax-search?q=${encodeURIComponent(query)}`;
        try {
          const results = yield fetchJSON(searchUrl, {
            headers: { "X-Requested-With": "XMLHttpRequest", "Referer": `${activeUrl}/` }
          });
          if (!results?.success || !Array.isArray(results.results)) continue;
          match = results.results.find((r) => {
            if (r.type !== matchType) return false;
            const normalize = (str) => (str || "").toLowerCase().replace(/[^a-z0-9ğüşıöç]/g, "");
            const rTitle = normalize(r.title);
            const titleMatches = rTitle === normalize(trTitle) || rTitle === normalize(origTitle);
            const yearMatches = !year || !r.year || Math.abs(year - r.year) <= 1;
            return titleMatches && yearMatches;
          });
          if (match) break;
        } catch (err) {}
      }

      if (!match) return [];
      let contentUrl = fixUrl(match.url, activeUrl);

      if (type === "tv") {
        const seriesHtml = yield fetchText(contentUrl);
        const $ = cheerio.load(seriesHtml);
        const epPattern = new RegExp(`${season}.*[Ss]ezon.*${episode}.*[Bb]ölüm`, "i");
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
        return [{
          name: "Dizipal TV",
          title: `[Dizipal] ${trTitle} ${type === 'tv' ? `S${season}E${episode}` : ''}`,
          url: stream.url,
          headers: __spreadValues({ "User-Agent": HEADERS["User-Agent"] }, stream.headers || {}),
          behaviorHints: { notWeb: true }
        }];
      }
    } catch (e) {
      console.error(`[Dizipal] Global Error: ${e.message}`);
    }
    return [];
  });
}

module.exports = { getStreams };
