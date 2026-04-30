/**
 * 4KHDHub - Full Logic Restoration
 * Formatting: Quality | Language | Size | Tech
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
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

const BASE_URL = "https://4khdhub.dad";
const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";

// --- Internal Utilities (The "Glue") ---
var domainCache = { url: BASE_URL, ts: 0 };
async function fetchLatestDomain() {
  const now = Date.now();
  if (now - domainCache.ts < 36e5) return domainCache.url;
  try {
    const response = await fetch(DOMAINS_URL);
    const data = await response.json();
    if (data && data["4khdhub"]) {
      domainCache.url = data["4khdhub"];
      domainCache.ts = now;
    }
  } catch (e) {}
  return domainCache.url;
}

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
  return str.replace(/[a-zA-Z]/g, function(c) {
    return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
  });
}

async function fetchText(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: __spreadValues({ "User-Agent": USER_AGENT }, options.headers)
    });
    return await response.text();
  } catch (err) { return null; }
}

// --- Metadata Parsers ---
function extractLanguage(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("hindi")) return "Hindi";
  if (t.includes("dual")) return "Dual";
  if (t.includes("english") || t.includes("en")) return "EN";
  return "Multi";
}

function extractTech(text) {
  const t = (text || "").toUpperCase();
  const tags = [];
  if (t.includes("HDR")) tags.push("HDR");
  if (t.includes("BLURAY") || t.includes("BRRIP")) tags.push("BluRay");
  if (t.includes("WEB-DL") || t.includes("WEBDL")) tags.push("WEB-DL");
  if (t.includes("DV") || t.includes("VISION")) tags.push("DV");
  return tags.join(" ");
}

// --- The Core Scraper ---
const cheerio = require("cheerio-without-node-native");

async function resolveRedirectUrl(redirectUrl) {
  const redirectHtml = await fetchText(redirectUrl);
  if (!redirectHtml) return null;
  try {
    const redirectDataMatch = redirectHtml.match(/'o','(.*?)'/);
    if (!redirectDataMatch) return null;
    const step4 = atob(rot13Cipher(atob(atob(redirectDataMatch[1]))));
    const data = JSON.parse(step4);
    return data && data.o ? atob(data.o) : null;
  } catch (e) { return null; }
}

async function getStreams(tmdbId, type, season, episode) {
  return __async(this, null, function* () {
    const domain = yield fetchLatestDomain();
    const isSeries = type === "series" || type === "tv";

    // 1. TMDB Meta
    const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const tmdbRes = yield fetch(tmdbUrl);
    const tmdbData = yield tmdbRes.json();
    const name = tmdbData.name || tmdbData.title;
    const year = (tmdbData.first_air_date || tmdbData.release_date || "").split("-")[0];

    // 2. Search
    const searchUrl = `${domain}/?s=${encodeURIComponent(name + " " + year)}`;
    const searchHtml = yield fetchText(searchUrl);
    if (!searchHtml) return [];
    const $s = cheerio.load(searchHtml);
    const pageUrl = $s(".movie-card").first().attr("href");
    if (!pageUrl) return [];

    // 3. Extract Links
    const pageHtml = yield fetchText(pageUrl);
    const $ = cheerio.load(pageHtml);
    const items = [];

    if (isSeries && season && episode) {
      const sStr = "S" + String(season).padStart(2, "0");
      const eStr = "Episode-" + String(episode).padStart(2, "0");
      $(".episode-item").each((_, el) => {
        if ($(el).find(".episode-title").text().includes(sStr)) {
          $(el).find(".episode-download-item").each((_, item) => {
            if ($(item).text().includes(eStr)) items.push(item);
          });
        }
      });
    } else {
      $(".download-item").each((_, el) => items.push(el));
    }

    const streams = [];
    for (const item of items) {
      const iHtml = $(item).html();
      const iText = $(item).text();
      
      // QUALITY FIX: Look for digits+p
      const hMatch = iHtml.match(/\d{3,4}p/);
      const quality = hMatch ? hMatch[0] : (iHtml.includes("4K") ? "2160p" : "HD");
      
      // CONDENSED META
      const sizeMatch = iHtml.match(/([\d.]+ ?[GM]B)/);
      const size = sizeMatch ? sizeMatch[1] : "";
      const lang = extractLanguage(iHtml);
      const tech = extractTech(iHtml + " " + iText);
      const description = [quality, lang, size, tech].filter(Boolean).join(" | ");

      const hubLink = $(item).find('a:contains("HubCloud"), a:contains("HubDrive")').first().attr("href");
      if (hubLink) {
        const resolved = yield resolveRedirectUrl(hubLink);
        if (resolved) {
          const cloudHtml = yield fetchText(resolved, { headers: { Referer: hubLink } });
          const urlMatch = cloudHtml ? cloudHtml.match(/var url ?= ?'(.*?)'/).pop() : null;
          
          if (urlMatch) {
            const finalLinksHtml = yield fetchText(urlMatch, { headers: { Referer: resolved } });
            const $fl = cheerio.load(finalLinksHtml);
            $fl("a").each((_, a) => {
              const href = $fl(a).attr("href");
              const txt = $fl(a).text();
              if (href && (txt.includes("FSL") || txt.includes("Pixel") || txt.includes("Download"))) {
                streams.push({
                  name: `4KHDHub - ${txt.includes("Pixel") ? "Pixel" : "Cloud"}`,
                  title: description,
                  url: href,
                  quality: quality
                });
              }
            });
          }
        }
      }
    }
    return streams;
  });
}

module.exports = { getStreams };
