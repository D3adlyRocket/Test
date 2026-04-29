/**
 * patronDizipal - Built from src/patronDizipal/
 * Optimized for Android TV - High Stability 2026 Edition
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

// --- CONSTANTS ---
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var MAIN_URL = "https://dizipal2063.com";
var TV_UA = "Mozilla/5.0 (Linux; Android 10; BRAVIA 4K VH2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var HEADERS = {
  "User-Agent": TV_UA,
  "Referer": `${MAIN_URL}/`,
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8"
};

// --- UTILS (From HDHub4u Template) ---
function atob(value) {
  if (!value) return "";
  let input = String(value).replace(/=+$/, "");
  let output = "";
  let bc = 0, bs, buffer, idx = 0;
  while (buffer = input.charAt(idx++)) {
    buffer = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".indexOf(buffer);
    if (~buffer) {
      bs = bc % 4 ? bs * 64 + buffer : buffer;
      if (bc++ % 4) output += String.fromCharCode(255 & bs >> (-2 * bc & 6));
    }
  }
  return output;
}

// --- DIZIPAL CORE LOGIC ---
async function resolveMainUrl() {
  const domains = ["https://dizipal2064.com", "https://dizipal2063.com", "https://dizipal2065.com"];
  for (const domain of domains) {
    try {
      const res = await fetch(domain, { 
        method: "HEAD", 
        headers: { "User-Agent": TV_UA },
        signal: AbortSignal.timeout(4000) 
      });
      if (res.ok) return domain;
    } catch (e) {}
  }
  return domains[0];
}

async function extractStream(url, activeUrl) {
  try {
    const response = await fetch(url, { 
        headers: HEADERS,
        signal: AbortSignal.timeout(10000)
    });
    const html = await response.text();
    
    // Config Token Extractor
    const cfg = html.match(/data-cfg="([^"]+)"/) || html.match(/data-hash="([^"]+)"/);
    if (cfg) {
      const ajaxRes = await fetch(`${activeUrl}/ajax-player-config`, {
        method: "POST",
        headers: __spreadProps(__spreadValues({}, HEADERS), { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" }),
        body: `cfg=${encodeURIComponent(cfg[1])}`,
        signal: AbortSignal.timeout(8000)
      });
      const json = await ajaxRes.json();
      const streamUrl = json?.config?.v || json?.url;
      if (streamUrl) return streamUrl.replace(/\\\//g, "/");
    }
    return null;
  } catch (e) { return null; }
}

// --- MAIN EXPORT (getStreams) ---
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  console.log(`[Dizipal] TV Fetching: ${tmdbId}`);
  try {
    const activeUrl = await resolveMainUrl();
    
    // TMDB Info
    const tmdbRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=tr-TR`);
    const tmdbData = await tmdbRes.json();
    const query = tmdbData.title || tmdbData.name;
    if (!query) return [];

    // Search Dizipal (Native AJAX search)
    const searchRes = await fetch(`${activeUrl}/ajax-search?q=${encodeURIComponent(query)}`, {
        headers: __spreadProps(__spreadValues({}, HEADERS), { "X-Requested-With": "XMLHttpRequest" })
    });
    const searchData = await searchRes.json();
    
    if (!searchData.success || !searchData.results.length) return [];

    // Filter Match
    const matchType = mediaType === "movie" ? "Film" : "Dizi";
    const bestMatch = searchData.results.find(r => r.type === matchType) || searchData.results[0];
    let contentUrl = bestMatch.url.startsWith('http') ? bestMatch.url : activeUrl + bestMatch.url;

    // Episode Handling
    if (mediaType === "tv" && season && episode) {
      const pageRes = await fetch(contentUrl, { headers: HEADERS });
      const pageHtml = await pageRes.text();
      const epPattern = new RegExp(`${season}.*sezon.*${episode}.*b\xF6l\xFCm`, "i");
      const blocks = pageHtml.split('class="detail-episode-item');
      for (const block of blocks) {
        if (epPattern.test(block)) {
          const href = block.match(/href="([^"]+)"/);
          if (href) contentUrl = href[1].startsWith('http') ? href[1] : activeUrl + href[1];
        }
      }
    }

    const videoUrl = await extractStream(contentUrl, activeUrl);
    
    if (videoUrl) {
      return [{
        name: "Dizipal TV [1080p]",
        url: videoUrl,
        quality: "Auto",
        headers: {
          "User-Agent": TV_UA,
          "Referer": contentUrl,
          "Origin": activeUrl,
          "Connection": "keep-alive"
        }
      }];
    }
  } catch (err) {
    console.error("[Dizipal] TV Critical Error:", err.message);
  }
  return [];
}

// Module Export
module.exports = { getStreams };
