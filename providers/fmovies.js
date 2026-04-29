/**
 * patronDizipal - Nuvio TV Professional Edition
 * Mapping: Dizipal Logic -> HDHub4u/UHD 559-Line Template
 * Optimized for Android TV / Nuvio Environment
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
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

// --- GLOBAL CONFIGURATION ---
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var MAIN_URL = "https://dizipal2063.com";
var TV_UA = "Mozilla/5.0 (Linux; Android 10; BRAVIA 4K VH2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// --- UTILITIES: ENCRYPTION & DECRYPTION (FULL TEMPLATE) ---
var BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

function atob(value) {
  if (!value) return "";
  let input = String(value).replace(/=+$/, "");
  let output = "";
  let bc = 0, bs, buffer, idx = 0;
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

function rot13(value) {
  return value.replace(/[a-zA-Z]/g, function(c) {
    return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
  });
}

// --- TITLE SIMILARITY ENGINE (CRITICAL FOR TV SEARCH) ---
function normalizeTitle(title) {
  if (!title) return "";
  return title.toLowerCase()
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/[:\-_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function getSimilarity(s1, s2) {
  var longer = s1.toLowerCase(), shorter = s2.toLowerCase();
  if (s1.length < s2.length) { longer = s2; shorter = s1; }
  var longerLength = longer.length;
  if (longerLength == 0) return 1;
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
  var costs = new Array();
  for (var i = 0; i <= s1.length; i++) {
    var lastValue = i;
    for (var j = 0; j <= s2.length; j++) {
      if (i == 0) costs[j] = j;
      else if (j > 0) {
        var newValue = costs[j - 1];
        if (s1.charAt(i - 1) != s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// --- NETWORK LAYER: LINEAR FETCH & TIMEOUTS ---
async function fetchWithTimeout(url, options = {}) {
  const { timeout = 12000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, __spreadProps(__spreadValues({}, options), { signal: controller.signal }));
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// --- DOMAIN RESOLVER (RECURSIVE) ---
async function resolveDomain() {
  const domains = ["https://dizipal2064.com", "https://dizipal2063.com", "https://dizipal2065.com", "https://dizipal2066.com"];
  for (const d of domains) {
    try {
      const res = await fetchWithTimeout(d, { method: "HEAD", timeout: 4000 });
      if (res.ok) return d;
    } catch (e) {}
  }
  return MAIN_URL;
}

// --- TMDB METADATA ENGINE ---
function getMediaInfo(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=tr-TR`;
    const res = yield fetch(url);
    const data = yield res.json();
    return {
      title: data.name || data.title,
      year: parseInt((data.first_air_date || data.release_date || "0").split("-")[0]),
      original_title: data.original_name || data.original_title
    };
  });
}

// --- SEARCH ENGINE: AJAX + SIMILARITY ---
async function dizipalSearch(query, domain, mediaInfo) {
  try {
    const res = await fetchWithTimeout(`${domain}/ajax-search?q=${encodeURIComponent(query)}`, {
      headers: { "X-Requested-With": "XMLHttpRequest", "User-Agent": TV_UA }
    });
    const data = await res.json();
    if (!data.success) return null;

    let bestMatch = null;
    let maxScore = 0;

    data.results.forEach(item => {
      const score = getSimilarity(mediaInfo.title, item.title);
      if (score > maxScore) {
        maxScore = score;
        bestMatch = item;
      }
    });

    return (maxScore > 0.6) ? bestMatch : null;
  } catch (e) { return null; }
}

// --- EXTRACTOR: CONFIG TOKEN FLOW ---
async function extractDizipal(targetUrl, domain) {
  return __async(this, null, function* () {
    try {
      const res = yield fetchWithTimeout(targetUrl, { headers: { "User-Agent": TV_UA } });
      const html = yield res.text();
      
      const configMatch = html.match(/data-cfg="([^"]+)"/) || html.match(/data-hash="([^"]+)"/);
      if (!configMatch) return null;

      const playerRes = yield fetchWithTimeout(`${domain}/ajax-player-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": TV_UA,
          "Referer": targetUrl
        },
        body: `cfg=${encodeURIComponent(configMatch[1])}`
      });

      const config = yield playerRes.json();
      const streamUrl = config?.config?.v || config?.url;
      
      if (streamUrl) {
        return {
          url: streamUrl.replace(/\\\//g, "/"),
          headers: { "User-Agent": TV_UA, "Referer": targetUrl, "Origin": domain }
        };
      }
      return null;
    } catch (e) { return null; }
  });
}

// --- MAIN EXPORT: getStreams ---
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    const domain = await resolveDomain();
    const mediaInfo = await getMediaInfo(tmdbId, mediaType);
    
    // Attempt multiple query permutations (Template style)
    let searchResult = await dizipalSearch(mediaInfo.title, domain, mediaInfo);
    if (!searchResult && mediaInfo.original_title) {
      searchResult = await dizipalSearch(mediaInfo.original_title, domain, mediaInfo);
    }

    if (!searchResult) return [];

    let finalUrl = searchResult.url.startsWith('http') ? searchResult.url : domain + searchResult.url;

    // TV Show Episode Logic
    if (mediaType === "tv" && season && episode) {
      const pageRes = await fetchWithTimeout(finalUrl, { headers: { "User-Agent": TV_UA } });
      const pageHtml = await pageRes.text();
      const epRegex = new RegExp(`${season}.*sezon.*${episode}.*b\xF6l\xFCm`, "i");
      
      const parts = pageHtml.split('class="detail-episode-item');
      for (const part of parts) {
        if (epRegex.test(part)) {
          const href = part.match(/href="([^"]+)"/);
          if (href) {
            finalUrl = href[1].startsWith('http') ? href[1] : domain + href[1];
            break;
          }
        }
      }
    }

    const stream = await extractDizipal(finalUrl, domain);

    if (stream) {
      return [{
        name: "Dizipal Nuvio-TV",
        url: stream.url,
        quality: "Auto",
        headers: stream.headers
      }];
    }
  } catch (err) {
    console.log(`[Critical] Dizipal Failure: ${err.message}`);
  }
  return [];
}

// --- EXPORT WRAPPER ---
var patron
