"use strict";

/**
 * 4KHDHub - Unified Fixed Version
 * Merges high-res metadata parsing with reliable search logic.
 */

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
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

const cheerio = require("cheerio-without-node-native");

// --- Constants & Config ---
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const DEFAULT_BASE = "https://4khdhub.click";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// --- Utilities ---
function rot13(str) {
  return str.replace(/[a-zA-Z]/g, (c) => String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26));
}

function parseQuality(text) {
  const v = (text || "").toLowerCase();
  if (/2160p|4k|uhd/.test(v)) return "4K";
  if (/1080p/.test(v)) return "1080p";
  if (/720p/.test(v)) return "720p";
  return "HD";
}

// --- Domain & HTTP ---
let domainCache = { url: DEFAULT_BASE, ts: 0 };
async function getBaseUrl() {
  const now = Date.now();
  if (now - domainCache.ts < 36e5) return domainCache.url;
  try {
    const res = await fetch(DOMAINS_URL);
    const data = await res.json();
    if (data["4khdhub"]) {
      domainCache.url = data["4khdhub"];
      domainCache.ts = now;
    }
  } catch (e) { console.log("[4KHDHub] Domain fetch failed"); }
  return domainCache.url;
}

async function fetchText(url, options = {}) {
  try {
    const res = await fetch(url, __spreadValues({
      headers: { "User-Agent": USER_AGENT }
    }, options));
    return await res.text();
  } catch (e) { return null; }
}

// --- TMDB & Search Logic ---
async function getMediaInfo(tmdbId, type) {
  const endpoint = (type === "series" || type === "tv") ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return {
      title: data.name || data.title,
      year: parseInt((data.first_air_date || data.release_date || "0").split("-")[0])
    };
  } catch (e) { return null; }
}

async function resolveRedirect(url) {
  const html = await fetchText(url);
  if (!html) return null;
  try {
    const match = html.match(/'o','(.*?)'/);
    if (!match) return null;
    // Layered decoding: B64 -> B64 -> ROT13 -> B64
    const decoded = atob(rot13(atob(atob(match[1]))));
    const json = JSON.parse(decoded);
    return atob(json.o);
  } catch (e) { return null; }
}

// --- Main Scraper ---
async function getStreams(tmdbId, type, season, episode) {
  const info = await getMediaInfo(tmdbId, type);
  if (!info) return [];

  const domain = await getBaseUrl();
  const isSeries = type === "series" || type === "tv";
  const searchUrl = `${domain}/?s=${encodeURIComponent(info.title)}`;
  
  console.log(`[4KHDHub] Searching for: ${info.title} (${info.year})`);
  const searchHtml = await fetchText(searchUrl);
  if (!searchHtml) return [];

  const $ = cheerio.load(searchHtml);
  let pageUrl = null;

  $(".movie-card").each((_, el) => {
    const cardTitle = $(el).find(".movie-card-title").text().toLowerCase();
    const cardYear = parseInt($(el).find(".movie-card-meta").text());
    const cardType = $(el).find(".movie-card-format").text();

    const typeMatch = isSeries ? cardType.includes("Series") : cardType.includes("Movies");
    if (typeMatch && Math.abs(cardYear - info.year) <= 1) {
       // Simple title check
       if (cardTitle.includes(info.title.toLowerCase().substring(0, 5))) {
         pageUrl = $(el).attr("href");
         return false; 
       }
    }
  });

  if (!pageUrl) return [];

  const pageHtml = await fetchText(pageUrl);
  const $p = cheerio.load(pageHtml);
  const results = [];
  const items = [];

  if (isSeries && season && episode) {
    const sStr = "S" + String(season).padStart(2, "0");
    const eStr = "Episode-" + String(episode).padStart(2, "0");
    $p(".episode-item").each((_, el) => {
      if ($p(el).find(".episode-title").text().includes(sStr)) {
        $p(el).find(".episode-download-item").each((_, item) => {
          if ($p(item).text().includes(eStr)) items.push(item);
        });
      }
    });
  } else {
    $p(".download-item").each((_, el) => items.push(el));
  }

  for (const item of items) {
    const itemText = $p(item).text();
    const quality = parseQuality(itemText);
    const links = $p(item).find("a");

    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      const href = $p(a).attr("href");
      const name = $p(a).text();

      if (href && (name.includes("Hub") || name.includes("Cloud"))) {
        const direct = await resolveRedirect(href);
        if (direct) {
          results.push({
            name: `4KHDHub - ${name} [${quality}]`,
            title: `${info.title}\n${quality} Stream`,
            url: direct,
            quality: quality
          });
        }
      }
    }
  }

  return results;
}

module.exports = { getStreams };
