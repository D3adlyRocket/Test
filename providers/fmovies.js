/**
 * brazucaplay - Fixed for English Language Support
 * Generated: 2026-04-30
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
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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

// src/utils/ua.js
var require_ua = __commonJS({
  "src/utils/ua.js"(exports2, module2) {
    var UA_POOL = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    ];
    function getRandomUA2() {
      return UA_POOL[0];
    }
    module2.exports = { getRandomUA: getRandomUA2, UA_POOL };
  }
});

// src/utils/http.js
var require_http = __commonJS({
  "src/utils/http.js"(exports2, module2) {
    var { getRandomUA: getRandomUA2 } = require_ua();
    var sessionUA = null;
    function setSessionUA2(ua) { sessionUA = ua; }
    function getSessionUA() { return sessionUA || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"; }
    async function request(url, options) {
        const headers = Object.assign({ "User-Agent": getSessionUA() }, options.headers);
        return await fetch(url, { ...options, headers });
    }
    module2.exports = { 
        request, 
        fetchHtml: async (url, opt) => (await request(url, opt)).text(),
        fetchJson: async (url, opt) => (await request(url, opt)).json(),
        setSessionUA: setSessionUA2,
        getSessionUA
    };
  }
});

// src/utils/sorting.js
var QUALITY_SCORE = { "4K": 100, "1080p": 80, "720p": 70, "480p": 60, "HD": 75 };
function sortStreamsByQuality(streams) {
    return [...streams].sort((a, b) => (QUALITY_SCORE[b.quality] || 0) - (QUALITY_SCORE[a.quality] || 0));
}

// src/utils/engine.js
function normalizeLanguage(lang) {
    const l = (lang || "").toLowerCase();
    if (l.includes("en") || l.includes("ing") || l.includes("sub") || l.includes("vose")) return "English/Sub";
    if (l.includes("lat") || l.includes("spa") || l.includes("esp")) return "Spanish";
    return "English"; 
}

async function finalizeStreams(streams, providerName) {
    if (!Array.isArray(streams)) return [];
    const sorted = sortStreamsByQuality(streams);
    return sorted.map(s => ({
        name: `${providerName} - ${s.quality}`,
        title: `${normalizeLanguage(s.language || s.title)} - ${s.quality}`,
        url: s.url,
        quality: s.quality,
        headers: s.headers
    }));
}

// Main Logic
var { fetchJson, setSessionUA } = require_http();
var TMDB_API_KEY = "d131017ccc6e5462a81c9304d21476de";
var API_DEC = "https://enc-dec.app/api/dec-videasy";

async function getStreams(tmdbId = "76600", mediaType = "movie", season = null, episode = null) {
    const currentUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    setSessionUA(currentUA);
    
    const results = [];
    try {
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
        const tmdbData = await fetchJson(tmdbUrl);
        const cleanTitle = tmdbData.title || tmdbData.name;
        const year = (tmdbData.release_date || tmdbData.first_air_date || "").split("-")[0];

        const searchUrl = `https://api2.videasy.net/cuevana/sources-with-title?title=${encodeURIComponent(cleanTitle)}&mediaType=${mediaType}&year=${year}&tmdbId=${tmdbId}`;
        
        const encryptedRes = await fetch(searchUrl, { headers: { "User-Agent": currentUA } });
        const encryptedText = await encryptedRes.text();

        // Send to decoder
        const decResponse = await fetch(API_DEC, {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": currentUA },
            body: JSON.stringify({ text: encryptedText, id: tmdbId })
        });

        const decData = await decResponse.json();
        const sources = decData.result?.sources || [];

        for (const source of sources) {
            if (source.url) {
                results.push({
                    language: "English", // Forcing English focus
                    url: source.url,
                    quality: source.quality || "HD",
                    headers: {
                        "User-Agent": currentUA,
                        "Referer": "https://videasy.net/",
                        "Origin": "https://videasy.net"
                    }
                });
            }
        }
    } catch (e) {
        console.error("Error fetching streams:", e.message);
    }

    return finalizeStreams(results, "Brazuca");
}

module.exports = { getStreams };
