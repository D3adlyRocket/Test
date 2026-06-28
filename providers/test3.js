/**
 * vidlink - Enhanced Version
 * Generated: 2026-06-29
 */
var __defProp = Object.defineProperty;
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
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// Configuration
const VIDLINK_API = "https://vidlink.pro/api/b";
const DECRYPT_API = "https://enc-dec.app/api";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  "Accept": "application/json,*/*",
  "Referer": "https://vidlink.pro/",
  "Origin": "https://vidlink.pro"
};

// Enhanced Request Handler
function makeRequest(url) {
  return __async(this, null, function* () {
    const response = yield fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  });
}

// Adaptive Parser to find streams regardless of JSON structure
function findStreamsInResponse(data) {
  const found = [];
  function recursiveSearch(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.url && (obj.url.includes('.m3u8') || obj.url.startsWith('http'))) {
      found.push(obj);
    }
    for (const key in obj) {
      if (typeof obj[key] === 'object') recursiveSearch(obj[key]);
      else if (typeof obj[key] === 'string' && (obj[key].includes('.m3u8'))) {
        found.push({ url: obj[key], quality: key });
      }
    }
  }
  recursiveSearch(data);
  return found;
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log(`[Vidlink] Fetching for ${tmdbId}`);
    try {
      // 1. Decrypt ID
      const encResp = yield makeRequest(`${DECRYPT_API}/enc-vidlink?text=${tmdbId}`);
      const encJson = yield encResp.json();
      const encData = encJson.result;
      
      // 2. Fetch from Vidlink
      const epUrl = (mediaType === "tv") 
        ? `${VIDLINK_API}/tv/${encData}/${season}/${episode}` 
        : `${VIDLINK_API}/movie/${encData}`;
        
      const epResp = yield makeRequest(epUrl);
      const data = yield epResp.json();

      // 3. Adaptive Processing
      const extracted = findStreamsInResponse(data);
      
      return extracted.map(s => ({
        name: "Vidlink",
        title: s.quality || "Auto",
        url: s.url,
        type: "m3u8",
        headers: HEADERS,
        provider: "vidlink"
      }));

    } catch (error) {
      console.error(`[Vidlink] Error: ${error.message}`);
      return [];
    }
  });
}

module.exports = { getStreams };
