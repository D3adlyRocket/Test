/**
 * 4KHDHub - Full Restoration
 * Fix: Restored .episode-item and .episode-download-item logic for Seasons 1-6
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

const cheerio = require("cheerio-without-node-native");

// --- Constants & Config ---
var BASE_URL = "https://4khdhub.dad";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

var domainCache = { url: BASE_URL, ts: 0 };

// --- Utility Functions ---
function atob(input) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let str = String(input).replace(/=+$/, "");
  let output = "";
  for (let bc = 0, bs, buffer, i = 0; buffer = str.charAt(i++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

function rot13Cipher(str) {
  return str.replace(/[a-zA-Z]/g, (c) => String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26));
}

function parseBytes(val) {
  if (!val) return 0;
  const match = val.match(/^([0-9.]+)\s*([a-zA-Z]+)$/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  let mult = 1;
  if (unit.includes("k")) mult = 1024;
  else if (unit.includes("m")) mult = 1024 * 1024;
  else if (unit.includes("g")) mult = 1024 * 1024 * 1024;
  return num * mult;
}

function formatBytes(val) {
  if (!val) return "N/A";
  const i = Math.floor(Math.log(val) / Math.log(1024));
  return (val / Math.pow(1024, i)).toFixed(2) * 1 + " " + ["B", "KB", "MB", "GB", "TB"][i];
}

// --- Networking ---
function fetchLatestDomain() {
  return __async(this, null, function* () {
    if (Date.now() - domainCache.ts < 36e5) return domainCache.url;
    try {
      const res = yield fetch(DOMAINS_URL);
      const data = yield res.json();
      if (data && data["4khdhub"]) {
        domainCache.url = data["4khdhub"];
        domainCache.ts = Date.now();
      }
    } catch (e) {}
    return domainCache.url;
  });
}

function fetchText(url, options = {}) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(url, __spreadValues({ headers: { "User-Agent": USER_AGENT } }, options));
      return yield res.text();
    } catch (e) { return null; }
  });
}

// --- TMDB & Search ---
function getTmdbDetails(tmdbId, type) {
  return __async(this, null, function* () {
    const endpoint = (type === "series" || type === "tv") ? "tv" : "movie";
    try {
      const res = yield fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`);
      const data = yield res.json();
      return {
        title: data.name || data.title,
        year: parseInt((data.first_air_date || data.release_date || "0").split("-")[0])
      };
    } catch (e) { return null; }
  });
}

function fetchPageUrl(name, year, isSeries) {
  return __async(this, null, function* () {
    const domain = yield fetchLatestDomain();
    const html = yield fetchText(`${domain}/?s=${encodeURIComponent(name)}`);
    if (!html) return null;
    const $ = cheerio.load(html);
    let foundUrl = null;
    $(".movie-card").each((_, el) => {
      const cardTitle = $(el).find(".movie-card-title").text().toLowerCase();
      const cardYear = $(el).find(".movie-card-meta").text();
      if (cardTitle.includes(name.toLowerCase()) && (cardYear.includes(year) || isSeries)) {
        foundUrl = $(el).attr("href");
        if (foundUrl && !foundUrl.startsWith("http")) foundUrl = domain + foundUrl;
      }
    });
    return foundUrl;
  });
}

// --- Resolvers ---
function resolveRedirectUrl(url) {
  return __async(this, null, function* () {
    const html = yield fetchText(url);
    if (!html) return null;
    try {
      const match = html.match(/'o','(.*?)'/);
      if (!match) return null;
      const decoded = JSON.parse(atob(rot13Cipher(atob(atob(match[1])))));
      return decoded.o ? atob(decoded.o) : null;
    } catch (e) { return null; }
  });
}

function extractHubCloud(url, baseMeta) {
  return __async(this, null, function* () {
    const html = yield fetchText(url, { headers: { Referer: url } });
    if (!html) return [];
    const urlMatch = html.match(/var url ?= ?'(.*?)'/);
    if (!urlMatch) return [];
    const linksHtml = yield fetchText(urlMatch[1], { headers: { Referer: url } });
    const $ = cheerio.load(linksHtml);
    const results = [];
    $("a").each((_, el) => {
      const text = $(el).text();
      const href = $(el).attr("href");
      if (!href) return;
      if (text.includes("FSL") || text.includes("Download File") || text.includes("PixelServer")) {
        results.push({
          source: text.includes("Pixel") ? "PixelServer" : "Cloud",
          url: text.includes("Pixel") ? href.replace("/u/", "/api/file/") : href,
          meta: __spreadProps(__spreadValues({}, baseMeta), { bytes: parseBytes($("#size").text()) || baseMeta.bytes })
        });
      }
    });
    return results;
  });
}

// --- Main Execution ---
async function getStreams(tmdbId, type, season, episode) {
  const details = await getTmdbDetails(tmdbId, type);
  if (!details) return [];
  const isSeries = type === "series" || type === "tv";
  const pageUrl = await fetchPageUrl(details.title, details.year, isSeries);
  if (!pageUrl) return [];

  const html = await fetchText(pageUrl);
  if (!html) return [];
  const $ = cheerio.load(html);
  const itemsToProcess = [];

  if (isSeries && season && episode) {
    const seasonStr = "S" + String(season).padStart(2, "0");
    const episodeStr = "Episode-" + String(episode).padStart(2, "0");
    
    // Look for Game of Thrones style Season containers
    $(".episode-item").each((_, el) => {
      const titleText = $(el).find(".episode-title").text();
      if (titleText.includes(seasonStr)) {
        $(el).find(".episode-download-item").each((_, item) => {
          if ($(item).text().includes(episodeStr)) itemsToProcess.push(item);
        });
      }
    });
    
    // Fallback if not in .episode-item (newer seasons)
    if (itemsToProcess.length === 0) {
      $(".download-item").each((_, el) => {
        const text = $(el).text();
        if (text.includes(seasonStr) && text.includes(`E${String(episode).padStart(2, "0")}`)) {
          itemsToProcess.push(el);
        }
      });
    }
  } else {
    $(".download-item").each((_, el) => itemsToProcess.push(el));
  }

  const streamPromises = itemsToProcess.map(async (item) => {
    const title = $(item).find(".file-title, .episode-file-title").text().trim();
    const sizeMatch = $(item).html().match(/([\d.]+ ?[GM]B)/);
    const heightMatch = $(item).html().match(/\d{3,}p/);
    const meta = { 
        height: heightMatch ? heightMatch[0] : (title.toLowerCase().includes("4k") ? "2160p" : "1080p"),
        bytes: sizeMatch ? parseBytes(sizeMatch[1]) : 0,
        title: title
    };

    let hubUrl = $(item).find('a:contains("HubCloud")').attr("href");
    if (!hubUrl) {
        const driveLink = $(item).find('a:contains("HubDrive")').attr("href");
        if (driveLink) {
            const resolvedDrive = await resolveRedirectUrl(driveLink);
            if (resolvedDrive) {
                const driveHtml = await fetchText(resolvedDrive);
                hubUrl = cheerio.load(driveHtml || "")('a:contains("HubCloud")').attr("href");
            }
        }
    }

    if (hubUrl) {
      const resolved = await resolveRedirectUrl(hubUrl);
      if (resolved) {
        const links = await extractHubCloud(resolved, meta);
        return links.map(l => ({
          name: `4KHDHub - ${l.source} ${l.meta.height}`,
          title: `${l.meta.title}\n${formatBytes(l.meta.bytes)}`,
          url: l.url,
          quality: l.meta.height
        }));
      }
    }
    return [];
  });

  const results = await Promise.all(streamPromises);
  return results.flat();
}

module.exports = { getStreams };
