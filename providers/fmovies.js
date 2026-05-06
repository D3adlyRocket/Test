/**
 * 4khdhub - Built from src/4khdhub/
 * Generated: 2026-05-03T21:33:16.718Z
 */
"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
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

// src/4khdhub/constants.js
var BASE_URL = "https://4khdhub.click";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";

// src/4khdhub/utils.js
var domainCache = { url: BASE_URL, ts: 0 };
function fetchLatestDomain() {
  return __async(this, null, function* () {
    const now = Date.now();
    if (now - domainCache.ts < 36e5) return domainCache.url;
    try {
      const response = yield fetch(DOMAINS_URL);
      const data = yield response.json();
      if (data && data["4khdhub"]) {
        domainCache.url = data["4khdhub"];
        domainCache.ts = now;
      }
    } catch (e) {}
    return domainCache.url;
  });
}

// src/4khdhub/http.js
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    try {
      const response = yield fetch(url, {
        headers: __spreadValues({
          "User-Agent": USER_AGENT
        }, options.headers)
      });
      return yield response.text();
    } catch (err) {
      console.log(`[4KHDHub] Request failed for ${url}: ${err.message}`);
      return null;
    }
  });
}

// src/4khdhub/tmdb.js
function getTmdbDetails(tmdbId, type) {
  return __async(this, null, function* () {
    const isSeries = type === "series" || type === "tv";
    const endpoint = isSeries ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    console.log(`[4KHDHub] Fetching TMDB details from: ${url}`);
    try {
      const response = yield fetch(url);
      const data = yield response.json();
      if (isSeries) {
        return {
          title: data.name,
          year: data.first_air_date ? parseInt(data.first_air_date.split("-")[0]) : 0
        };
      } else {
        return {
          title: data.title,
          year: data.release_date ? parseInt(data.release_date.split("-")[0]) : 0
        };
      }
    } catch (error) {
      console.log(`[4KHDHub] TMDB request failed: ${error.message}`);
      return null;
    }
  });
}

// src/4khdhub/utils.js
function atob(input) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let str = String(input).replace(/=+$/, "");
  if (str.length % 4 === 1) {
    throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
  }
  let output = "";
  for (let bc = 0, bs, buffer, i = 0; buffer = str.charAt(i++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}
function rot13Cipher(str) {
  return str.replace(/[a-zA-Z]/g, function(c) {
    return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
  });
}
function levenshteinDistance(s, t) {
  if (s === t)
    return 0;
  const n = s.length;
  const m = t.length;
  if (n === 0)
    return m;
  if (m === 0)
    return n;
  const d = [];
  for (let i = 0; i <= n; i++) {
    d[i] = [];
    d[i][0] = i;
  }
  for (let j = 0; j <= m; j++) {
    d[0][j] = j;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = s.charAt(i - 1) === t.charAt(j - 1) ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[n][m];
}
function parseBytes(val) {
  if (typeof val === "number")
    return val;
  if (!val)
    return 0;
  const match = val.match(/^([0-9.]+)\s*([a-zA-Z]+)$/);
  if (!match)
    return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  let multiplier = 1;
  if (unit.indexOf("k") === 0)
    multiplier = 1024;
  else if (unit.indexOf("m") === 0)
    multiplier = 1024 * 1024;
  else if (unit.indexOf("g") === 0)
    multiplier = 1024 * 1024 * 1024;
  else if (unit.indexOf("t") === 0)
    multiplier = 1024 * 1024 * 1024 * 1024;
  return num * multiplier;
}
function formatBytes(val) {
  if (val === 0)
    return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  let i = Math.floor(Math.log(val) / Math.log(k));
  if (i < 0)
    i = 0;
  return parseFloat((val / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// src/4khdhub/search.js
var cheerio = require("cheerio-without-node-native");
function fetchPageUrl(name, year, isSeries, season) {
  return __async(this, null, function* () {
    const domain = yield fetchLatestDomain();
    
    // MODIFIED SEARCH: If it's a series, search for Title + Season (e.g. "Black Mirror Season 1")
    // This solves the issue where only the latest season post is found.
    const searchQuery = isSeries && season ? `${name} Season ${season}` : (name + (year ? " " + year : ""));
    
    const searchUrl = `${domain}/?s=${encodeURIComponent(searchQuery)}`;
    console.log(`[4KHDHub] Search Request URL: ${searchUrl}`);
    const html = yield fetchText(searchUrl);
    if (!html) {
      console.log("[4KHDHub] Search failed: No HTML response");
      return null;
    }
    const $ = cheerio.load(html);
    const candidates = $("a.movie-card").map((_, el) => {
      const cardTitle = $(el).find("h3").text().trim() || ($(el).attr("aria-label") || "").replace(/\s+details$/i, "").trim();
      const cleanedTitle = cardTitle.replace(/\[.*?]/g, "").trim();
      
      const distance = levenshteinDistance(cleanedTitle.toLowerCase(), name.toLowerCase());
      const titleMatch = cleanedTitle.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(cleanedTitle.toLowerCase()) || distance < 6;
      
      if (!titleMatch) return null;
      
      let href = $(el).attr("href");
      if (href && !href.startsWith("http")) {
        href = domain + (href.startsWith("/") ? "" : "/") + href;
      }
      return { href, distance, title: cleanedTitle };
    }).get().filter((candidate) => candidate && candidate.href);
    
    if (candidates.length === 0) return null;
    const matchingCards = candidates.sort((a, b) => a.distance - b.distance);
    return matchingCards[0].href;
  });
}

// src/4khdhub/extractor.js
var cheerio2 = require("cheerio-without-node-native");
function resolveRedirectUrl(redirectUrl) {
  return __async(this, null, function* () {
    if (!redirectUrl) return null;
    const redirectHtml = yield fetchText(redirectUrl);
    if (!redirectHtml) return redirectUrl;
    try {
      const patterns = [/'o','(.*?)'/, /['"]o['"],\s*['"]([^'"]+)['"]/, /'o'\s*:\s*'([^']+)'/, /window\.atob\(['"]([^'"]+)['"]\)/, /var\s+o\s*=\s*['"]([^'"]+)['"]/];
      let redirectDataMatch = null;
      for (const pattern of patterns) {
        redirectDataMatch = redirectHtml.match(pattern);
        if (redirectDataMatch) break;
      }
      if (!redirectDataMatch || !redirectDataMatch[1]) return redirectUrl;
      const step1 = atob(redirectDataMatch[1]);
      const step2 = atob(step1);
      const step3 = rot13Cipher(step2);
      const step4 = atob(step3);
      const redirectData = JSON.parse(step4);
      if (redirectData && redirectData.o) return atob(redirectData.o);
      return redirectUrl;
    } catch (e) {
      return redirectUrl;
    }
  });
}
function extractSourceResults($, el) {
  return __async(this, null, function* () {
    const localHtml = $(el).html();
    if (!localHtml) return null;
    const sizeMatch = localHtml.match(/([\d.]+ ?[GM]B)/);
    const heightMatch = localHtml.match(/\d{3,}p/);
    const title = $(el).find(".file-title, .episode-file-title, .file-name, span").text().trim();
    let height = heightMatch ? parseInt(heightMatch[0]) : 0;
    if (height === 0 && (title.includes("4K") || title.includes("4k") || localHtml.includes("4K") || localHtml.includes("4k"))) height = 2160;
    const meta = { bytes: sizeMatch ? parseBytes(sizeMatch[1]) : 0, height, title: title || "Download" };
    let hubCloudLink = $(el).find("a").filter((_, a) => {
      const text = $(a).text();
      return text.includes("HubCloud") || text.includes("hubcloud");
    }).attr("href");
    if (hubCloudLink) {
      const resolved = yield resolveRedirectUrl(hubCloudLink);
      if (resolved) return { url: resolved, meta };
    }
    let hubDriveLink = $(el).find("a").filter((_, a) => {
      const text = $(a).text();
      return text.includes("HubDrive") || text.includes("hubdrive");
    }).attr("href");
    if (hubDriveLink) {
      const resolvedDrive = yield resolveRedirectUrl(hubDriveLink);
      const driveUrl = resolvedDrive || hubDriveLink;
      if (driveUrl) {
        const hubDriveHtml = yield fetchText(driveUrl);
        if (hubDriveHtml) {
          const $2 = cheerio2.load(hubDriveHtml);
          const innerCloudLink = $2('a').filter((_, a) => {
            const href = $2(a).attr("href") || "";
            const text = $2(a).text().toLowerCase();
            return text.includes("hubcloud") || href.includes("hubcloud");
          }).attr("href");
          if (innerCloudLink) return { url: innerCloudLink, meta };
        }
        return { url: driveUrl, meta };
      }
    }
    const fallbackLink = $(el).find("a[href]").filter((_, a) => {
      const href = $(a).attr("href");
      return href && (href.includes("hubcloud") || href.includes("hubdrive") || href.includes("pixeldrain"));
    }).attr("href");
    if (fallbackLink) return { url: fallbackLink, meta };
    return null;
  });
}
function extractHubCloud(hubCloudUrl, baseMeta) {
  return __async(this, null, function* () {
    if (!hubCloudUrl) return [];
    const redirectHtml = yield fetchText(hubCloudUrl, { headers: { Referer: hubCloudUrl } });
    if (!redirectHtml) return [];
    const urlPatterns = [/var\s+url\s*=\s*'([^']+)'/, /var\s+url\s*=\s*"([^"]+)"/, /'url'\s*:\s*'([^']+)'/];
    let finalLinksUrl = null;
    for (const pattern of urlPatterns) {
      const match = redirectHtml.match(pattern);
      if (match && match[1]) {
        finalLinksUrl = match[1];
        break;
      }
    }
    if (!finalLinksUrl) return [];
    const linksHtml = yield fetchText(finalLinksUrl, { headers: { Referer: hubCloudUrl } });
    if (!linksHtml) return [];
    const $ = cheerio2.load(linksHtml);
    const results = [];
    const sizeText = $("#size, #file-size, span[id*='size']").text();
    const currentMeta = __spreadProps(__spreadValues({}, baseMeta), { bytes: parseBytes(sizeText) || baseMeta.bytes });
    $("a").each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr("href");
      if (!href) return;
      if (text.includes("FSL") || text.toLowerCase().includes("download")) {
        results.push({ source: "FSL", url: href, meta: currentMeta });
      } else if (text.includes("PixelServer") || href.includes("pixeldrain")) {
        results.push({ source: "PixelServer", url: href.replace("/u/", "/api/file/"), meta: currentMeta });
      }
    });
    return results;
  });
}

// src/4khdhub/index.js
var cheerio3 = require("cheerio-without-node-native");
function getStreams(tmdbId, type, season, episode) {
  return __async(this, null, function* () {
    try {
      const tmdbDetails = yield getTmdbDetails(tmdbId, type);
      if (!tmdbDetails) return [];
      const { title, year } = tmdbDetails;
      const isSeries = type === "series" || type === "tv";
      
      // Fixed Search for Series
      const pageUrl = yield fetchPageUrl(title, year, isSeries, season);
      if (!pageUrl) return [];
      
      const html = yield fetchText(pageUrl);
      if (!html) return [];
      const $ = cheerio3.load(html);
      const itemsToProcess = [];
      
      if (isSeries && season && episode) {
        const sNum = parseInt(season, 10);
        const eNum = parseInt(episode, 10);
        const sStr = "S" + String(sNum).padStart(2, "0");
        const eStr = "E" + String(eNum).padStart(2, "0");
        const seCode = sStr + eStr;

        // Series Logic Fix: Search for the specific episode block
        $(".download-item, .post-content p, .post-content div, tr").each((_, el) => {
          const text = $(el).text().toLowerCase();
          const hasEp = text.includes(seCode.toLowerCase()) || 
                        (text.includes(`episode ${eNum}`) && !text.includes(`episode ${eNum + 1}`));
          
          if (hasEp) {
            const hasLink = $(el).find("a[href*='hubcloud'], a[href*='hubdrive'], a[href*='id=']").length > 0;
            if (hasLink) itemsToProcess.push(el);
          }
        });
      } else {
        // Movie Logic
        $(".download-item, .file-item, .movie-file").each((_, el) => {
          if ($(el).find("a[href]").length > 0) itemsToProcess.push(el);
        });
      }
      
      if (itemsToProcess.length === 0) return [];
      
      const results = yield Promise.all(itemsToProcess.map((item) => __async(this, null, function* () {
        const sourceResult = yield extractSourceResults($, item);
        if (sourceResult && sourceResult.url) {
          const links = yield extractHubCloud(sourceResult.url, sourceResult.meta);
          return links.map(l => ({
            name: `4KHDHub - ${l.source} ${sourceResult.meta.height}p`,
            title: `${sourceResult.meta.title}\n${formatBytes(l.meta.bytes)}`,
            url: l.url,
            quality: `${sourceResult.meta.height}p`
          }));
        }
        return [];
      })));
      return results.flat();
    } catch (err) {
      return [];
    }
  });
}
module.exports = { getStreams };
