/**
 * patronDizipal - Full TV Template Integration
 * Built from the 559-line HDHub4u / UHDMovies Architecture
 * Generated: 2026-04-29
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
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var MAIN_URL = "https://dizipal2063.com";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; BRAVIA 4K VH2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Referer": `${MAIN_URL}/`,
  "X-Requested-With": "XMLHttpRequest"
};

// --- UTILS (Full 559-line Template Utilities) ---
function rot13(value) {
  return value.replace(/[a-zA-Z]/g, function(c) {
    return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
  });
}

function atob(value) {
  if (!value) return "";
  let input = String(value).replace(/=+$/, "");
  let output = "";
  let bc = 0, bs, buffer, idx = 0;
  const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  while (buffer = input.charAt(idx++)) {
    buffer = BASE64_CHARS.indexOf(buffer);
    if (~buffer) {
      bs = bc % 4 ? bs * 64 + buffer : buffer;
      if (bc++ % 4) {
        output += String.fromCharCode(255 & bs >> (-2 * bc & 6));
      }
    }
  }
  return output;
}

function normalizeTitle(title) {
  if (!title) return "";
  return title.toLowerCase().replace(/\b(the|a|an)\b/g, "").replace(/[:\-_]/g, " ").replace(/\s+/g, " ").replace(/[^\w\s]/g, "").trim();
}

function calculateTitleSimilarity(title1, title2) {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);
  if (norm1 === norm2) return 1;
  const words1 = norm1.split(/\s+/).filter((w) => w.length > 0);
  const words2 = norm2.split(/\s+/).filter((w) => w.length > 0);
  if (words1.length === 0 || words2.length === 0) return 0;
  const set2 = new Set(words2);
  const intersection = words1.filter((w) => set2.has(w));
  return intersection.length / new Set([...words1, ...words2]).size;
}

// --- CORE FETCHERS ---
async function getCurrentDomain() {
  const domains = ["https://dizipal2064.com", "https://dizipal2063.com", "https://dizipal2065.com"];
  for (const domain of domains) {
    try {
      const res = await fetch(domain, { method: "HEAD", signal: AbortSignal.timeout(3000) });
      if (res.ok) return domain;
    } catch (e) {}
  }
  return MAIN_URL;
}

async function getTMDBDetails(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const endpoint = mediaType === "tv" ? "tv" : "movie";
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=tr-TR`;
    const response = yield fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(`TMDB Error`);
    const data = yield response.json();
    return { 
      title: mediaType === "tv" ? data.name : data.title, 
      year: parseInt((data.release_date || data.first_air_date || "0000").split("-")[0]) 
    };
  });
}

// --- EXTRACTION ENGINE ---
async function extractDizipalStream(targetUrl, domain) {
  try {
    const res = await fetch(targetUrl, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    const html = await res.text();
    
    // Dizipal specific Player Config Token
    const cfgMatch = html.match(/data-cfg="([^"]+)"/) || html.match(/data-hash="([^"]+)"/);
    if (cfgMatch) {
      const ajaxRes = await fetch(`${domain}/ajax-player-config`, {
        method: "POST",
        headers: __spreadProps(__spreadValues({}, HEADERS), { "Content-Type": "application/x-www-form-urlencoded" }),
        body: `cfg=${encodeURIComponent(cfgMatch[1])}`,
        signal: AbortSignal.timeout(8000)
      });
      const config = await ajaxRes.json();
      let streamUrl = config?.config?.v || config?.url;
      if (streamUrl) {
        streamUrl = streamUrl.replace(/\\\//g, "/");
        return { 
          url: streamUrl, 
          headers: { "User-Agent": HEADERS["User-Agent"], "Referer": targetUrl, "Origin": domain } 
        };
      }
    }
    return null;
  } catch (e) { return null; }
}

// --- SEARCH & EPISODE LOGIC ---
async function dizipalSearch(query, domain) {
  try {
    const searchUrl = `${domain}/ajax-search?q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, { headers: HEADERS });
    const data = await res.json();
    if (!data.success) return [];
    return data.results.map(r => ({
      title: r.title || r.name,
      url: r.url.startsWith('http') ? r.url : domain + r.url,
      type: r.type // 'Film' or 'Dizi'
    }));
  } catch (e) { return []; }
}

// --- EXPORTED getStreams FUNCTION ---
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  console.log(`[Dizipal] TV Start: ${tmdbId}`);
  try {
    const domain = await getCurrentDomain();
    const mediaInfo = await getTMDBDetails(tmdbId, mediaType);
    
    const results = await dizipalSearch(mediaInfo.title, domain);
    if (!results.length) return [];

    // Title matching logic from your template
    let bestMatch = results[0];
    let maxScore = 0;
    results.forEach(res => {
      const score = calculateTitleSimilarity(mediaInfo.title, res.title);
      if (score > maxScore) {
        maxScore = score;
        bestMatch = res;
      }
    });

    let targetUrl = bestMatch.url;

    // TV Show Episode Navigator
    if (mediaType === "tv" && season && episode) {
      const pageRes = await fetch(targetUrl, { headers: HEADERS });
      const pageHtml = await pageRes.text();
      const epPattern = new RegExp(`${season}.*sezon.*${episode}.*b\xF6l\xFCm`, "i");
      const blocks = pageHtml.split('class="detail-episode-item');
      for (const block of blocks) {
        if (epPattern.test(block)) {
          const hrefMatch = block.match(/href="([^"]+)"/);
          if (hrefMatch) {
            targetUrl = hrefMatch[1].startsWith('http') ? hrefMatch[1] : domain + hrefMatch[1];
            break;
          }
        }
      }
    }

    const stream = await extractDizipalStream(targetUrl, domain);
    
    if (stream) {
      return [{
        name: "Dizipal TV",
        url: stream.url,
        quality: "1080p",
        headers: stream.headers
      }];
    }
  } catch (err) {
    console.error(`[Dizipal Error] ${err.message}`);
  }
  return [];
}

module.exports = { getStreams };
