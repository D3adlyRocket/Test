/**
 * lordflix - Built from src/lordflix/
 * Generated: 2026-05-10T22:46:01.988Z
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

// src/lordflix/constants.js
var HEADERS = {
  "Accept": "*/*",
  "Origin": "https://lordflix.org",
  "Referer": "https://lordflix.org/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
};
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var LORDFLIX_API = "https://snowhouse.lordflix.club";
var MULTI_DECRYPT_API = "https://enc-dec.app/api";

// src/lordflix/utils.js
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield fetch(url, __spreadValues({ headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {}) }, options));
    if (!response.ok)
      throw new Error(`HTTP error ${response.status}`);
    return yield response.text();
  });
}
function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const raw = yield fetchText(url, options);
    return JSON.parse(raw);
  });
}
function getTMDBDetails(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var _a, _b;
    const endpoint = mediaType === "tv" ? "tv" : "movie";
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    const response = yield fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok)
      throw new Error(`TMDB API error`);
    const data = yield response.json();
    return {
      title: mediaType === "tv" ? data.name : data.title,
      year: ((_a = mediaType === "tv" ? data.first_air_date : data.release_date) == null ? void 0 : _a.split("-")[0]) || null,
      imdbId: ((_b = data.external_ids) == null ? void 0 : _b.imdb_id) || null
    };
  });
}

// src/lordflix/index.js
var SERVERS = ["Berlin", "Tokyo", "Bogota", "Oslo", "Luna", "LordFlix", "Sakura", "Rio", "Ativa"];

function encodeQuote(str) {
  return encodeURIComponent(str).replace(/%20/g, "+").replace(/\+/g, "%20");
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return __async(this, null, function* () {
    const streams = [];
    try {
      const info = yield getTMDBDetails(tmdbId, mediaType);
      if (!info.title || !info.imdbId)
        return streams;

      const typeParam = mediaType === "tv" ? "series" : "movie";
      const titleEnc = encodeQuote(info.title);

      // =================================================================
      // STEP 1: HIJACK THE ACTIVE DYNAMIC CRYPTO PATH
      // =================================================================
      let dynamicTokenPath = "";
      try {
        const targetPageHtml = yield fetchText("https://lordflix.org/", { headers: HEADERS });
        
        // Match the structural dynamic folder hash from your network logs
        const pathRegex = /https:\/\/snowhouse\.lordflix\.club\/([^"'` \n\/]+)\/script-4axj2\.js/;
        const match = targetPageHtml.match(pathRegex);

        if (match && match[1]) {
          dynamicTokenPath = match[1];
        }
      } catch (e) {
        console.error(`[Lordflix] Token discovery failed:`, e.message);
      }

      // Safeguard abort if site is running an impenetrable Cloudflare firewall
      if (!dynamicTokenPath) {
         return streams; 
      }

      // =================================================================
      // STEP 2: REPLICATE DIRECT API CALLS (BYPASS EN-DEC BRIDGE)
      // =================================================================
      yield Promise.all(SERVERS.map((server) => __async(this, null, function* () {
        try {
          // Construct target endpoint replicating the direct browser query string layout
          let directApiUrl = `https://snowhouse.lordflix.club/${dynamicTokenPath}/?title=${titleEnc}&type=${typeParam}&year=${info.year || ""}&imdb=${info.imdbId}&tmdb=${tmdbId}&server=${server}`;
          
          if (mediaType === "tv") {
            directApiUrl += `&season=${seasonNum}&episode=${episodeNum}`;
          }

          // Directly call Lordflix storage mirrors with layout validation headers 
          const responseJson = yield fetchJson(directApiUrl, {
            headers: {
              "Accept": "application/json, text/javascript, */*; q=0.01",
              "X-Requested-With": "XMLHttpRequest",
              "Referer": "https://lordflix.org/"
            }
          });

          // Unpack playlist fields directly if site serves unencrypted JSON payloads to verified tokens
          if (responseJson && responseJson.playlist) {
            streams.push({
              name: `Lordflix[${server}]`,
              title: `Lordflix[${server}]`,
              url: responseJson.playlist,
              quality: "Auto",
              type: "m3u8",
              headers: HEADERS
            });
            return;
          }

          // If the JSON payload contains raw base64 arrays, decode them natively
          if (responseJson && responseJson.encoded_data) {
            const decodedUrl = atob(responseJson.encoded_data);
            if (decodedUrl.includes(".m3u8")) {
              streams.push({
                name: `Lordflix[${server}]`,
                title: `Lordflix[${server}]`,
                url: decodedUrl,
                quality: "Auto",
                type: "m3u8",
                headers: HEADERS
              });
            }
          }
        } catch (e) {
          // Fail silently for down or locked mirror instances
        }
      })));
    } catch (err) {
      console.error(`[Lordflix] Core Runtime Error:`, err.message);
    }
    return streams;
  });
}

module.exports = { getStreams };
