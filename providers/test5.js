"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
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
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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

// src/formatter.js
var require_formatter = __commonJS({
  "src/formatter.js"(exports2, module2) {
    function normalizePlaybackHeaders(headers) {
      if (!headers || typeof headers !== "object") return headers;
      const normalized = {};
      for (const [key, value] of Object.entries(headers)) {
        if (value == null) continue;
        const lowerKey = String(key).toLowerCase();
        if (lowerKey === "user-agent") normalized["User-Agent"] = value;
        else if (lowerKey === "referer" || lowerKey === "referrer") normalized["Referer"] = value;
        else if (lowerKey === "origin") normalized["Origin"] = value;
        else if (lowerKey === "accept") normalized["Accept"] = value;
        else if (lowerKey === "accept-language") normalized["Accept-Language"] = value;
        else normalized[key] = value;
      }
      return normalized;
    }
    function shouldForceNotWebReadyForPlugin(stream, providerName, headers, behaviorHints) {
      const text = [
        stream == null ? void 0 : stream.url,
        stream == null ? void 0 : stream.name,
        stream == null ? void 0 : stream.title,
        stream == null ? void 0 : stream.server,
        providerName
      ].filter(Boolean).join(" ").toLowerCase();
      if (text.includes("mixdrop") || text.includes("m1xdrop") || text.includes("mxcontent")) {
        return true;
      }
      if (text.includes("loadm") || text.includes("loadm.cam")) {
        return true;
      }
      return false;
    }
    
    // Extracted layout builder mimicking the StreamingCommunity structure
    function buildTitle(stream, providerName) {
      let quality = stream.quality || "1080p";
      const audioType = stream.language === "Italian" ? "Multi-Audio" : "Dual-Audio";
      const qIcon = quality.includes("4K") || quality.includes("2160") ? "🌟" : "💎";
      
      let line1 = "🎬 ";
      if (stream.episodeInfo && stream.episodeInfo !== "Movie") {
        line1 += `${stream.episodeInfo} | ${stream.originalTitle || "Stream"}`;
      } else {
        line1 += `${stream.originalTitle || "Stream"}${stream.year ? " (" + stream.year + ")" : ""}`;
      }

      const langFlag = stream.language === "Italian" ? "🇮🇹 Italian" : "🌍 English/Sub";
      const sizeTag = stream.size ? stream.size : "Variable Size";
      const line2 = `${qIcon} ${quality} | 🌍 ${langFlag} | 💾 ${sizeTag}`;

      const formatTag = stream.type ? String(stream.type).toUpperCase() : "HLS";
      const durationTag = stream.duration ? `${stream.duration} min` : "90 min";
      const line3 = `🎞️ ${formatTag} | ⏱️ ${durationTag} | 📼 AVC • 🔊 AAC`;

      return `${line1}\n${line2}\n${line3}`;
    }

    function formatStream2(stream, providerName) {
      let quality = stream.quality || "1080p";
      const audioType = stream.language === "Italian" ? "Multi-Audio" : "Dual-Audio";
      
      // Forces consistent Header Title assignment
      const finalHeaderName = `🎦 ${providerName || "CinemaCity"} | ${quality} | ${audioType}`;
      const generatedTitle = buildTitle(stream, providerName);

      const behaviorHints = stream.behaviorHints && typeof stream.behaviorHints === "object" ? __spreadValues({}, stream.behaviorHints) : {};
      let finalHeaders = stream.headers;
      finalHeaders = normalizePlaybackHeaders(finalHeaders);

      return __spreadProps(__spreadValues({}, stream), {
        name: finalHeaderName,
        title: generatedTitle,
        description: generatedTitle,
        behaviorHints
      });
    }
    module2.exports = { formatStream: formatStream2 };
  }
});

// src/fetch_helper.js
var require_fetch_helper = __commonJS({
  "src/fetch_helper.js"(exports2, module2) {
    var FETCH_TIMEOUT = 3e4;
    function createTimeoutSignal(timeoutMs) {
      const parsed = Number.parseInt(String(timeoutMs), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { signal: void 0, cleanup: null, timed: false };
      }
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        return { signal: AbortSignal.timeout(parsed), cleanup: null, timed: true };
      }
      if (typeof AbortController !== "undefined" && typeof setTimeout === "function") {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, parsed);
        return { signal: controller.signal, cleanup: () => clearTimeout(timeoutId), timed: true };
      }
      return { signal: void 0, cleanup: null, timed: false };
    }
    function fetchWithTimeout(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        if (typeof fetch === "undefined") {
          throw new Error("No fetch implementation found!");
        }
        const _a = options, { timeout } = _a, fetchOptions = __objRest(_a, ["timeout"]);
        const requestTimeout = timeout || FETCH_TIMEOUT;
        const timeoutConfig = createTimeoutSignal(requestTimeout);
        const requestOptions = __spreadValues({}, fetchOptions);
        if (timeoutConfig.signal) {
          if (requestOptions.signal && typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
            requestOptions.signal = AbortSignal.any([requestOptions.signal, timeoutConfig.signal]);
          } else if (!requestOptions.signal) {
            requestOptions.signal = timeoutConfig.signal;
          }
        }
        try {
          const response = yield fetch(url, requestOptions);
          return response;
        } catch (error) {
          if (error && error.name === "AbortError" && timeoutConfig.timed) {
            throw new Error(`Request to ${url} timed out after ${requestTimeout}ms`);
          }
          throw error;
        } finally {
          if (typeof timeoutConfig.cleanup === "function") {
            timeoutConfig.cleanup();
          }
        }
      });
    }
    module2.exports = { fetchWithTimeout, createTimeoutSignal };
  }
});

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    var { createTimeoutSignal } = require_fetch_helper();
    var USER_AGENT2 = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function checkQualityFromPlaylist(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
          if (!url.includes(".m3u8")) return null;
          const finalHeaders = __spreadValues({}, headers);
          if (!finalHeaders["User-Agent"]) {
            finalHeaders["User-Agent"] = USER_AGENT2;
          }
          const timeoutConfig = createTimeoutSignal(3e3);
          try {
            const response = yield fetch(url, { headers: finalHeaders, signal: timeoutConfig.signal });
            if (!response.ok) return null;
            const text = yield response.text();
            const quality = checkQualityFromText2(text);
            if (quality) console.log(`[QualityHelper] Detected ${quality} from playlist: ${url}`);
            return quality;
          } finally {
            if (typeof timeoutConfig.cleanup === "function") {
              timeoutConfig.cleanup();
            }
          }
        } catch (e) {
          return null;
        }
      });
    }
    function checkQualityFromText2(text) {
      if (!text) return null;
      if (/RESOLUTION=\d+x2160/i.test(text) || /RESOLUTION=2160/i.test(text)) return "4K";
      if (/RESOLUTION=\d+x1440/i.test(text) || /RESOLUTION=1440/i.test(text)) return "1440p";
      if (/RESOLUTION=\d+x1080/i.test(text) || /RESOLUTION=1080/i.test(text)) return "1080p";
      if (/RESOLUTION=\d+x720/i.test(text) || /RESOLUTION=720/i.test(text)) return "720p";
      if (/RESOLUTION=\d+x480/i.test(text) || /RESOLUTION=480/i.test(text)) return "480p";
      return null;
    }
    function getQualityFromUrl(url) {
      if (!url) return null;
      const urlPath = url.split("?")[0].toLowerCase();
      if (urlPath.includes("4k") || urlPath.includes("2160")) return "4K";
      if (urlPath.includes("1440") || urlPath.includes("2k")) return "1440p";
      if (urlPath.includes("1080") || urlPath.includes("fhd")) return "1080p";
      if (urlPath.includes("720") || urlPath.includes("hd")) return "720p";
      if (urlPath.includes("480") || urlPath.includes("sd")) return "480p";
      if (urlPath.includes("360")) return "360p";
      return null;
    }
    module2.exports = { checkQualityFromPlaylist, getQualityFromUrl, checkQualityFromText: checkQualityFromText2 };
  }
});

// src/cinemacity/index.js
var { formatStream } = require_formatter();
var { fetchWithTimeout } = require_fetch_helper();
var BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
function base64Decode(str) {
  try {
    if (typeof atob === "function") {
      return decodeURIComponent(escape(atob(str)));
    }
  } catch (e) {}
  try {
    let output = "";
    let buffer = 0;
    let bits = 0;
    const input = String(str || "").replace(/[^A-Za-z0-9+/=]/g, "");
    for (let i = 0; i < input.length; i++) {
      const char = input.charAt(i);
      if (char === "=") break;
      const value = BASE64_CHARS.indexOf(char);
      if (value < 0) continue;
      buffer = buffer << 6 | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        output += String.fromCharCode(buffer >> bits & 255);
      }
    }
    try {
      return decodeURIComponent(escape(output));
    } catch (e) {
      return output;
    }
  } catch (e) {
    console.error("[CinemaCity] Base64 decode error:", e);
    return "";
  }
}
var BASE_URL = base64Decode("aHR0cHM6Ly9jaW5lbWFjaXR5LmNj");
var USER_AGENT = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
var FETCH_TIMEOUT = 1e4;
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var SITEMAP_URL = `${BASE_URL}/news_pages.xml`;
var SITEMAP_CACHE_MS = 60 * 60 * 1e3;
var sitemapCache = null;
function getMappingApiUrl() {
  return "https://animemapping.realbestia.com";
}
function normalizeConfigBoolean(value) {
  if (value === true) return true;
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on", "enabled", "checked"].includes(normalized);
}
function getMappingLanguage(providerContext = null) {
  const explicit = String((providerContext == null ? void 0 : providerContext.mappingLanguage) || "").trim().toLowerCase();
  if (explicit === "it") return "it";
  return normalizeConfigBoolean(providerContext == null ? void 0 : providerContext.easyCatalogsLangIt) ? "it" : null;
}
function fetchViaWorker(url) {
  return __async(this, null, function* () {
    const path = url.startsWith("http") ? new URL(url).pathname + new URL(url).search : url;
    const targetUrl = ("https://" + base64Decode("Y2MubGVhbmhodTA2MTIwNi53b3JrZXJzLmRldg==")).replace(/\/+$/, "") + (path.startsWith("/") ? path : "/" + path);
    const response = yield fetchWithTimeout(targetUrl, {
      timeout: FETCH_TIMEOUT,
      headers: { "User-Agent": USER_AGENT }
    });
    if (!response.ok) throw new Error(`Worker HTTP ${response.status}`);
    return yield response.text();
  });
}
function decodeHtmlEntities(str) {
  return String(str || "").replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec))).replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&ndash;|&mdash;/g, "-").replace(/\u2013|\u2014/g, "-");
}
function normalizeTitle(value) {
  return decodeHtmlEntities(String(value || "")).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}
function compactTitle(value) {
  return normalizeTitle(value).replace(/\s+/g, "");
}
function extractYearFromMetadata(metadata) {
  const date = (metadata == null ? void 0 : metadata.release_date) || (metadata == null ? void 0 : metadata.first_air_date) || "";
  const year = Number.parseInt(String(date).slice(0, 4), 10);
  return Number.isInteger(year) ? year : null;
}
function getSignificantTokens(value) {
  const stopwords = /* @__PURE__ */ new Set([
    "the", "a", "an", "of", "and", "in", "on", "to", "for", "at", "by", "is", "it", 
    "il", "lo", "la", "gli", "le", "un", "uno", "una", "di", "da", "del", "della", 
    "dei", "e", "o", "con", "per", "su", "tra", "fra"
  ]);
  return normalizeTitle(value).split(/\s+/).filter((token) => token.length > 1 && !stopwords.has(token));
}
function parseSitemapEntries(xml) {
  const entries = [];
  const regex = /<loc>(https:\/\/cinemacity\.cc\/(movies|tv-series)\/\d+-([a-z0-9-]+)\.html)<\/loc>/gi;
  let match;
  while ((match = regex.exec(String(xml || ""))) !== null) {
    const url = match[1];
    const kind = match[2];
    const slug = match[3];
    const yearMatch = slug.match(/-(\d{4})$/);
    const year = yearMatch ? Number.parseInt(yearMatch[1], 10) : null;
    const titleSlug = yearMatch ? slug.slice(0, -5) : slug;
    const title = titleSlug.replace(/-/g, " ");
    entries.push({
      url,
      kind,
      title,
      normalizedTitle: normalizeTitle(title),
      compactTitle: compactTitle(title),
      tokens: getSignificantTokens(title),
      year: Number.isInteger(year) ? year : null
    });
  }
  return entries;
}
function fetchSitemapEntries(providerContext = null) {
  return __async(this, null, function* () {
    if (sitemapCache && sitemapCache.expiresAt > Date.now()) {
      return sitemapCache.entries;
    }
    let sitemapProxy = "https://" + base64Decode("Y2MubGVhbmhodTA2MTIwNi53b3JrZXJzLmRldg==");
    const sitemapPath = SITEMAP_URL.startsWith("http") ? new URL(SITEMAP_URL).pathname : SITEMAP_URL;
    if (sitemapProxy) {
      const firstPageUrl = sitemapProxy.endsWith("/") ? `${sitemapProxy.slice(0, -1)}${sitemapPath}?page=1&perPage=500` : `${sitemapProxy}${sitemapPath}?page=1&perPage=500`;
      const firstResp = yield fetchWithTimeout(firstPageUrl, {
        timeout: FETCH_TIMEOUT,
        headers: { "User-Agent": USER_AGENT }
      });
      if (firstResp.ok) {
        const totalEntries = parseInt(firstResp.headers.get("x-total-entries") || "0", 10);
        const firstXml = yield firstResp.text();
        let allEntries = parseSitemapEntries(firstXml);
        if (totalEntries > 0) {
          const perPage = 500;
          const totalPages = Math.ceil(totalEntries / perPage);
          const pageFetches = [];
          for (let p = 2; p <= totalPages; p++) {
            const pageUrl = sitemapProxy.endsWith("/") ? `${sitemapProxy.slice(0, -1)}${sitemapPath}?page=${p}&perPage=500` : `${sitemapProxy}${sitemapPath}?page=${p}&perPage=500`;
            pageFetches.push(
              fetchWithTimeout(pageUrl, { timeout: FETCH_TIMEOUT, headers: { "User-Agent": USER_AGENT } }).then((r) => r.ok ? r.text() : "").then((xml2) => {
                if (xml2) allEntries = allEntries.concat(parseSitemapEntries(xml2));
              }).catch(() => {})
            );
          }
          yield Promise.all(pageFetches);
        }
        if (allEntries.length > 0) {
          sitemapCache = { entries: allEntries, expiresAt: Date.now() + SITEMAP_CACHE_MS };
          return allEntries;
        }
      }
    }
    return [];
  });
}
function scoreSitemapEntry(entry, expectedTitles, expectedYear) {
  let bestScore = 0;
  for (const title of expectedTitles) {
    const normalized = normalizeTitle(title);
    const compact = compactTitle(title);
    if (!normalized || !compact) continue;
    let score = 0;
    if (entry.normalizedTitle === normalized || entry.compactTitle === compact) score = 1e3;
    else if (entry.normalizedTitle.startsWith(normalized) || normalized.startsWith(entry.normalizedTitle)) score = 500;
    if (expectedYear && entry.year) {
      score += entry.year === expectedYear ? 50 : -Math.abs(entry.year - expectedYear) * 3;
    }
    bestScore = Math.max(bestScore, score);
  }
  return bestScore;
}
function extractImdbIdFromHtml(html) {
  const matches = String(html || "").match(/\btt\d{5,}\b/gi) || [];
  for (const match of matches) {
    if (/^tt\d{5,}$/i.test(match)) return match.toLowerCase();
  }
  return null;
}
function verifyCandidateImdb(candidateUrl, expectedImdbId) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchViaWorker(candidateUrl);
      return extractImdbIdFromHtml(html);
    } catch (e) {
      return null;
    }
  });
}
function searchBySitemap(id, providerType, providerContext = null) {
  return __async(this, null, function* () {
    const expectedImdbId = /^tt\d{5,}$/i.test(String(id || "").trim()) ? String(id).trim().toLowerCase() : null;
    const metadata = yield getTmdbMetadata(id, providerType);
    const expectedTitles = Array.from(new Set([
      metadata == null ? void 0 : metadata.title,
      metadata == null ? void 0 : metadata.name
    ].filter(Boolean)));
    if (expectedTitles.length === 0) return null;
    const expectedYear = extractYearFromMetadata(metadata);
    const expectedKind = providerType === "movie" ? "movies" : "tv-series";
    const entries = yield fetchSitemapEntries(providerContext);
    let bestEntry = null;
    let bestScore = -Infinity;
    for (const entry of entries) {
      if (entry.kind !== expectedKind) continue;
      const score = scoreSitemapEntry(entry, expectedTitles, expectedYear);
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }
    if (!bestEntry || bestScore < 250) return null;
    return { url: bestEntry.url, title: expectedTitles[0] || bestEntry.title };
  });
}
function getTmdbMetadata(id, providerType) {
  return __async(this, null, function* () {
    try {
      let metadataUrl = null;
      const normalizedId = String(id || "").trim();
      const normalizedType = providerType === "movie" ? "movie" : "tv";
      if (/^tt\d+$/i.test(normalizedId)) {
        metadataUrl = `https://api.themoviedb.org/3/find/${encodeURIComponent(normalizedId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=en-US`;
      }
      if (!metadataUrl) return null;
      const response = yield fetchWithTimeout(metadataUrl, { timeout: FETCH_TIMEOUT });
      if (!response.ok) return null;
      const payload = yield response.json();
      const results = normalizedType === "movie" ? payload == null ? void 0 : payload.movie_results : payload == null ? void 0 : payload.tv_results;
      return Array.isArray(results) && results.length > 0 ? results[0] : null;
    } catch (e) {
      return null;
    }
  });
}
var parseCompositeSeriesId = (rawId, season, episode) => {
  const parsed = {
    normalizedId: String(rawId || "").trim(),
    season: Number.isInteger(season) ? season : Number.parseInt(season, 10) || 1,
    episode: Number.isInteger(episode) ? episode : Number.parseInt(episode, 10) || 1
  };
  return parsed;
};
function buildDownloadUrl(fileVal, movieTitle) {
  const baseEnd = fileVal.indexOf("/public_files/");
  if (baseEnd === -1) return null;
  const cdnBase = fileVal.substring(0, baseEnd + "/public_files/".length);
  const rest = fileVal.substring(baseEnd + "/public_files/".length);
  const parts = rest.split(",");
  const video = parts.find((p) => p.includes("1080p") && p.endsWith(".mp4")) || parts.find((p) => p.endsWith(".mp4"));
  if (!video) return null;
  const itaAudio = parts.find((p) => /italian|italiano/i.test(p) && p.endsWith(".m4a"));
  return { url: cdnBase + rest + ".urlset/master.m3u8", hasItalian: !!itaAudio };
}
function extractStreamFromAtob(html, movieTitle, season, episode) {
  const atobRegex = /atob\s*\(\s*['"]([^"']{20,})['"]\s*\)/gi;
  let match;
  while ((match = atobRegex.exec(html)) !== null) {
    try {
      const decoded = base64Decode(match[1]);
      const jsonMatch = decoded.match(new RegExp("file\\s*:\\s*'(\\[.*?\\])'", "s"));
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (parsed[0].folder && Array.isArray(parsed[0].folder)) {
            const ep = parsed[(season || 1) - 1].folder[(episode || 1) - 1];
            if (ep && ep.file) return buildDownloadUrl(ep.file, movieTitle);
          }
          const fileVal = parsed[0].file;
          if (fileVal && fileVal.startsWith("http")) return buildDownloadUrl(fileVal, movieTitle);
        }
      }
    } catch (e) {}
  }
  return null;
}
function extractDownloadLinks(html) {
  const links = [];
  const anchorRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1].trim();
    if (!/\.(mp4|m3u8|mkv)([?#].*)?$/i.test(href)) continue;
    links.push({ url: href, text: match[2].replace(/<[^>]+>/g, "").trim().toLowerCase() });
  }
  return links;
}
function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    const parsedRequest = parseCompositeSeriesId(id, season, episode);
    id = parsedRequest.normalizedId;
    season = parsedRequest.season;
    episode = parsedRequest.episode;
    let imdbId = String(id || "").trim();
    const providerType = type === "tv" || type === "series" || type === "anime" ? "tv" : "movie";
    if (!imdbId.startsWith("tt")) return [];
    try {
      let searchResult = yield searchBySitemap(imdbId, providerType, providerContext);
      if (!searchResult || !searchResult.url) return [];
      const movieUrl = searchResult.url;
      const movieTitle = (searchResult.title || imdbId).replace(/\s*\(.*?\)\s*/g, "").trim();
      const metadata = yield getTmdbMetadata(imdbId, providerType);
      const releaseYear = extractYearFromMetadata(metadata);
      const duration = metadata ? metadata.runtime : null;
      let html = yield fetchViaWorker(movieUrl);
      if (html.length < 500) return [];
      const links = extractDownloadLinks(html);
      let hasItalian = false;
      if (links.length === 0) {
        const atobResult = extractStreamFromAtob(html, movieTitle, season, episode);
        if (atobResult) {
          links.push({ url: atobResult.url, text: "" });
          hasItalian = atobResult.hasItalian;
        }
      }
      if (links.length === 0) return [];
      let selectedUrl = links[0].url;
      const result = {
        name: "CinemaCity",
        url: selectedUrl,
        quality: "1080p",
        type: "hls",
        language: hasItalian ? "Italian" : "",
        originalTitle: movieTitle,
        year: releaseYear,
        duration: duration,
        episodeInfo: type === "tv" || type === "series" ? `S${season}E${episode}` : "Movie",
        behaviorHints: { notWebReady: true },
        headers: { "Referer": "https://cinemacity.cc/" }
      };
      return [formatStream(result, "CinemaCity")];
    } catch (e) {
      return [];
    }
  });
}
module.exports = { getStreams };
