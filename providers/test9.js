/** StreamPlay - generated from src/providers/streamplay.js */
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
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
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

// src/config/domains.js
var require_domains = __commonJS({
  "src/config/domains.js"(exports2, module2) {
    module2.exports = Object.freeze({
      TMDB_API: "https://api.themoviedb.org/3",
      PHISHER_DOMAINS: "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json",
      WORKER: "https://lucky-star-3059.salman-sohail93.workers.dev",
      MOVIESDRIVE_FALLBACK: "https://new1.moviesdrive.christmas",
      VEGAMOVIES_FALLBACK: "https://vegamovies.catering",
      MOVIES4U_FALLBACK: "https://new2.movies4u.clinic",
      FOURKHDHUB_FALLBACK: "https://4khdhub.one",
      MULTIMOVIES_FALLBACK: "https://multimovies.makeup",
      CASTLE_API: "https://api.hlowb.com",
      NEXDRIVE: "https://nexdrive.fit",
      HUBCLOUD: "https://hubcloud.cx",
      VCLOUD: "https://vcloud.zip",
      FASTDL: "https://fastdl.zip",
      GDFLIX_MIRRORS: ["https://new3.gdflix.cfd", "https://new2.gdflix.cfd"]
    });
  }
});

// src/providers/castle.js
var require_castle = __commonJS({
  "src/providers/castle.js"(exports2, module2) {
    "use strict";
    var __defProp2 = Object.defineProperty;
    var __getOwnPropSymbols2 = Object.getOwnPropertySymbols;
    var __hasOwnProp2 = Object.prototype.hasOwnProperty;
    var __propIsEnum2 = Object.prototype.propertyIsEnumerable;
    var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
    var __spreadValues2 = (a, b) => {
      for (var prop in b || (b = {}))
        if (__hasOwnProp2.call(b, prop))
          __defNormalProp2(a, prop, b[prop]);
      if (__getOwnPropSymbols2)
        for (var prop of __getOwnPropSymbols2(b)) {
          if (__propIsEnum2.call(b, prop))
            __defNormalProp2(a, prop, b[prop]);
        }
      return a;
    };
    var __async2 = (__this, __arguments, generator) => {
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
    var TMDB_API_KEY2 = "439c478a771f35c05022f9feabcca01c";
    var DOMAIN_CONFIG = require_domains();
    var TMDB_BASE_URL = DOMAIN_CONFIG.TMDB_API;
    var CASTLE_BASE = DOMAIN_CONFIG.CASTLE_API;
    var PKG = "com.external.castle";
    var CHANNEL = "IndiaA";
    var CLIENT = "1";
    var LANG = "en-US";
    var API_HEADERS = {
      "User-Agent": "okhttp/4.9.3",
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "Connection": "Keep-Alive",
      "Referer": CASTLE_BASE
    };
    var PLAYBACK_HEADERS = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      "Accept": "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity",
      "Connection": "keep-alive",
      "Sec-Fetch-Dest": "video",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "cross-site",
      "DNT": "1"
    };
    function makeRequest(_0) {
      return __async2(this, arguments, function* (url, options = {}) {
        try {
          const response = yield fetch(url, {
            method: options.method || "GET",
            headers: __spreadValues2(__spreadValues2({}, API_HEADERS), options.headers),
            body: options.body
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response;
        } catch (error) {
          console.error(`[Castle] Request failed for ${url}: ${error.message}`);
          throw error;
        }
      });
    }
    function extractCipherFromResponse(response) {
      return __async2(this, null, function* () {
        const text = yield response.text();
        const trimmed = text.trim();
        if (!trimmed) {
          throw new Error("Empty response");
        }
        try {
          const json = JSON.parse(trimmed);
          if (json && json.data && typeof json.data === "string") {
            return json.data.trim();
          }
        } catch (e) {
        }
        return trimmed;
      });
    }
    function extractDataBlock(obj) {
      if (obj && obj.data && typeof obj.data === "object") {
        return obj.data;
      }
      return obj || {};
    }
    function getTMDBDetails(tmdbId, mediaType) {
      return __async2(this, null, function* () {
        const endpoint = mediaType === "tv" ? "tv" : "movie";
        const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY2}&append_to_response=external_ids`;
        const response = yield makeRequest(url);
        const data = yield response.json();
        const title = mediaType === "tv" ? data.name : data.title;
        const releaseDate = mediaType === "tv" ? data.first_air_date : data.release_date;
        const year = releaseDate ? parseInt(releaseDate.split("-")[0]) : null;
        return {
          title,
          year,
          tmdbId
        };
      });
    }
    function decryptCastle(encryptedB64, securityKeyB64) {
      return __async2(this, null, function* () {
        console.log("[Castle] Starting local AES-CBC decryption...");
        try {
          const CryptoJS = require("crypto-js");
          if (typeof __crypto_aes_decrypt_raw !== "undefined") {
            const originalDecrypt = CryptoJS.AES.decrypt;
            CryptoJS.AES.decrypt = function(cipher, key, options) {
              try {
                const wordArrayToBytes = (wordArray) => {
                  const bytes = new Uint8Array(wordArray.sigBytes);
                  for (let i = 0; i < wordArray.sigBytes; i++) {
                    bytes[i] = wordArray.words[i >>> 2] >>> 24 - i % 4 * 8 & 255;
                  }
                  return bytes;
                };
                const toUint8Array = (data2) => {
                  if (data2 instanceof Uint8Array)
                    return data2;
                  if (data2 instanceof ArrayBuffer)
                    return new Uint8Array(data2);
                  if (data2 && typeof data2.length === "number")
                    return new Uint8Array(Array.prototype.slice.call(data2));
                  return new Uint8Array(0);
                };
                const data = typeof cipher === "string" ? new Uint8Array(Array.from(atob(cipher), (c) => c.charCodeAt(0))) : cipher.ciphertext ? wordArrayToBytes(cipher.ciphertext) : toUint8Array(cipher);
                const kBytes = wordArrayToBytes(key);
                const ivBytes = options && options.iv ? wordArrayToBytes(options.iv) : new Uint8Array(0);
                const mode = options && options.mode || "AES-CBC";
                const keyArg = typeof Int8Array !== "undefined" ? new Int8Array(kBytes.buffer) : kBytes;
                const ivArg = typeof Int8Array !== "undefined" ? new Int8Array(ivBytes.buffer) : ivBytes;
                const dataArg = typeof Int8Array !== "undefined" ? new Int8Array(data.buffer) : data;
                const resBytes = __crypto_aes_decrypt_raw(mode, keyArg, ivArg, dataArg);
                const plain = new TextDecoder().decode(resBytes);
                return { toString: function() {
                  return plain;
                } };
              } catch (err) {
                console.error("[Castle JNI Patch] Decrypt failed, falling back:", err);
                return originalDecrypt.call(CryptoJS.AES, cipher, key, options);
              }
            };
          }
          const CASTLE_SUFFIX = "T!BgJB";
          const securityKeyWords = CryptoJS.enc.Base64.parse(securityKeyB64);
          const suffixWords = CryptoJS.enc.Utf8.parse(CASTLE_SUFFIX);
          const keyMaterial = securityKeyWords.concat(suffixWords);
          let finalKey;
          if (keyMaterial.sigBytes < 16) {
            const padding = CryptoJS.lib.WordArray.create(new Array(16 - keyMaterial.sigBytes).fill(0));
            finalKey = keyMaterial.concat(padding);
          } else if (keyMaterial.sigBytes > 16) {
            finalKey = CryptoJS.lib.WordArray.create(keyMaterial.words.slice(0, 4), 16);
          } else {
            finalKey = keyMaterial;
          }
          const iv = finalKey;
          const decrypted = CryptoJS.AES.decrypt(encryptedB64, finalKey, {
            iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          });
          const result = decrypted.toString(CryptoJS.enc.Utf8);
          if (!result) {
            throw new Error("Decryption resulted in empty string (possible key/IV mismatch)");
          }
          console.log("[Castle] Local decryption successful");
          return result;
        } catch (error) {
          console.error(`[Castle] Local decryption failed: ${error.message}`);
          throw error;
        }
      });
    }
    function getSecurityKey() {
      return __async2(this, null, function* () {
        console.log("[Castle] Fetching security key...");
        const url = `${CASTLE_BASE}/v0.1/system/getSecurityKey/1?channel=${CHANNEL}&clientType=${CLIENT}&lang=${LANG}`;
        const response = yield makeRequest(url);
        const data = yield response.json();
        if (data.code !== 200 || !data.data) {
          throw new Error(`Security key API error: ${JSON.stringify(data)}`);
        }
        console.log("[Castle] Security key obtained");
        return data.data;
      });
    }
    function searchCastle(securityKey, keyword, page = 1, size = 30) {
      return __async2(this, null, function* () {
        console.log(`[Castle] Searching for: ${keyword}`);
        const params = new URLSearchParams({
          channel: CHANNEL,
          clientType: CLIENT,
          keyword,
          lang: LANG,
          mode: "1",
          packageName: PKG,
          page: page.toString(),
          size: size.toString()
        });
        const url = `${CASTLE_BASE}/film-api/v1.1.0/movie/searchByKeyword?${params.toString()}`;
        const response = yield makeRequest(url);
        const cipher = yield extractCipherFromResponse(response);
        const decrypted = yield decryptCastle(cipher, securityKey);
        return JSON.parse(decrypted);
      });
    }
    function getDetails(securityKey, movieId) {
      return __async2(this, null, function* () {
        console.log(`[Castle] Fetching details for movieId: ${movieId}`);
        const url = `${CASTLE_BASE}/film-api/v1.9.9/movie?channel=${CHANNEL}&clientType=${CLIENT}&lang=${LANG}&movieId=${movieId}&packageName=${PKG}`;
        const response = yield makeRequest(url);
        const cipher = yield extractCipherFromResponse(response);
        const decrypted = yield decryptCastle(cipher, securityKey);
        return JSON.parse(decrypted);
      });
    }
    function getVideoV1(securityKey, movieId, episodeId, languageId, resolution = 2) {
      return __async2(this, null, function* () {
        console.log(`[Castle] Fetching video (v1) for movieId: ${movieId}, languageId: ${languageId}`);
        const url = `${CASTLE_BASE}/film-api/v2.0.1/movie/getVideo2?clientType=${CLIENT}&packageName=${PKG}&channel=${CHANNEL}&lang=${LANG}`;
        const body = {
          mode: "1",
          appMarket: "GuanWang",
          clientType: CLIENT,
          woolUser: "false",
          apkSignKey: "ED0955EB04E67A1D9F3305B95454FED485261475",
          androidVersion: "13",
          movieId: movieId.toString(),
          episodeId: episodeId.toString(),
          languageId: languageId.toString(),
          isNewUser: "true",
          resolution: resolution.toString(),
          packageName: PKG
        };
        const response = yield makeRequest(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const cipher = yield extractCipherFromResponse(response);
        const decrypted = yield decryptCastle(cipher, securityKey);
        return JSON.parse(decrypted);
      });
    }
    function getVideo2(securityKey, movieId, episodeId, resolution = 2) {
      return __async2(this, null, function* () {
        console.log(`[Castle] Fetching video (v2) for movieId: ${movieId}, episodeId: ${episodeId}`);
        const url = `${CASTLE_BASE}/film-api/v2.0.1/movie/getVideo2?clientType=${CLIENT}&packageName=${PKG}&channel=${CHANNEL}&lang=${LANG}`;
        const body = {
          mode: "1",
          appMarket: "GuanWang",
          clientType: CLIENT,
          woolUser: "false",
          apkSignKey: "ED0955EB04E67A1D9F3305B95454FED485261475",
          androidVersion: "13",
          movieId: movieId.toString(),
          episodeId: episodeId.toString(),
          isNewUser: "true",
          resolution: resolution.toString(),
          packageName: PKG
        };
        const response = yield makeRequest(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const cipher = yield extractCipherFromResponse(response);
        const decrypted = yield decryptCastle(cipher, securityKey);
        return JSON.parse(decrypted);
      });
    }
    function findCastleMovieId(securityKey, tmdbInfo) {
      return __async2(this, null, function* () {
        const searchTerm = tmdbInfo.year ? `${tmdbInfo.title} ${tmdbInfo.year}` : tmdbInfo.title;
        const searchResult = yield searchCastle(securityKey, searchTerm);
        const data = extractDataBlock(searchResult);
        const rows = data.rows || [];
        if (rows.length === 0) {
          throw new Error("No search results found");
        }
        for (const item of rows) {
          const itemTitle = (item.title || item.name || "").toLowerCase();
          const searchTitle = tmdbInfo.title.toLowerCase();
          if (itemTitle.includes(searchTitle) || searchTitle.includes(itemTitle)) {
            const movieId2 = item.id || item.redirectId || item.redirectIdStr;
            if (movieId2) {
              console.log(`[Castle] Found match: ${item.title || item.name} (id: ${movieId2})`);
              return movieId2.toString();
            }
          }
        }
        const firstItem = rows[0];
        const movieId = firstItem.id || firstItem.redirectId || firstItem.redirectIdStr;
        if (movieId) {
          console.log(`[Castle] Using first result: ${firstItem.title || firstItem.name} (id: ${movieId})`);
          return movieId.toString();
        }
        throw new Error("Could not extract movie ID from search results");
      });
    }
    function getQualityValue(quality) {
      if (!quality)
        return 0;
      const cleanQuality = quality.toString().toLowerCase().replace(/^(sd|hd|fhd|uhd|4k)\s*/i, "").replace(/p$/, "").trim();
      const qualityMap = {
        "4k": 2160,
        "2160": 2160,
        "1440": 1440,
        "1080": 1080,
        "720": 720,
        "480": 480,
        "360": 360,
        "240": 240
      };
      if (qualityMap[cleanQuality]) {
        return qualityMap[cleanQuality];
      }
      const numQuality = parseInt(cleanQuality);
      if (!isNaN(numQuality) && numQuality > 0) {
        return numQuality;
      }
      return 0;
    }
    function formatSize(sizeValue) {
      if (typeof sizeValue !== "number" || sizeValue <= 0) {
        return "Unknown";
      }
      if (sizeValue > 1e9) {
        return `${(sizeValue / 1e9).toFixed(2)} GB`;
      }
      return `${(sizeValue / 1e6).toFixed(0)} MB`;
    }
    function resolutionToQuality(resolution) {
      const qualityMap = {
        1: "480p",
        2: "720p",
        3: "1080p"
      };
      return qualityMap[resolution] || `${resolution}p`;
    }
    function processVideoResponse(videoData, mediaInfo, seasonNum, episodeNum, resolution, languageInfo) {
      const streams = [];
      const data = extractDataBlock(videoData);
      const videoUrl = data.videoUrl;
      if (!videoUrl) {
        console.log("[Castle] No videoUrl found in response");
        return streams;
      }
      const subtitles = [];
      if (data.subtitles && Array.isArray(data.subtitles)) {
        data.subtitles.forEach((sub) => {
          if (sub.url) {
            subtitles.push({
              url: sub.url,
              language: sub.abbreviate || "Unknown",
              name: sub.title || sub.abbreviate || "Unknown",
              headers: PLAYBACK_HEADERS
            });
          }
        });
      }
      let mediaTitle = mediaInfo.title || "Unknown";
      if (mediaInfo.year) {
        mediaTitle += ` (${mediaInfo.year})`;
      }
      if (seasonNum && episodeNum) {
        mediaTitle = `${mediaInfo.title} S${String(seasonNum).padStart(2, "0")}E${String(episodeNum).padStart(2, "0")}`;
      }
      const quality = resolutionToQuality(resolution);
      if (data.videos && Array.isArray(data.videos)) {
        for (const video of data.videos) {
          let videoQuality = video.resolutionDescription || video.resolution || quality;
          videoQuality = videoQuality.replace(/^(SD|HD|FHD)\s+/i, "");
          const streamName = languageInfo ? `Castle ${languageInfo} - ${videoQuality}` : `Castle - ${videoQuality}`;
          streams.push({
            name: streamName,
            title: mediaTitle,
            url: video.url || videoUrl,
            quality: videoQuality,
            size: formatSize(video.size),
            headers: PLAYBACK_HEADERS,
            provider: "castle",
            subtitles
          });
        }
      } else {
        const streamName = languageInfo ? `Castle ${languageInfo} - ${quality}` : `Castle - ${quality}`;
        streams.push({
          name: streamName,
          title: mediaTitle,
          url: videoUrl,
          quality,
          size: formatSize(data.size),
          headers: PLAYBACK_HEADERS,
          provider: "castle",
          subtitles
        });
      }
      return streams;
    }
    function getStreams3(tmdbId, mediaType, seasonNum, episodeNum) {
      return __async2(this, null, function* () {
        console.log(`[Castle] Starting extraction for TMDB ID: ${tmdbId}, Type: ${mediaType}${mediaType === "tv" ? `, S:${seasonNum}E:${episodeNum}` : ""}`);
        try {
          const tmdbInfo = yield getTMDBDetails(tmdbId, mediaType);
          console.log(`[Castle] TMDB Info: "${tmdbInfo.title}" (${tmdbInfo.year || "N/A"})`);
          const securityKey = yield getSecurityKey();
          const movieId = yield findCastleMovieId(securityKey, tmdbInfo);
          let details = yield getDetails(securityKey, movieId);
          let currentMovieId = movieId;
          if (mediaType === "tv" && seasonNum && episodeNum) {
            const data = extractDataBlock(details);
            const seasons = data.seasons || [];
            const season = seasons.find((s) => s.number === seasonNum);
            if (season && season.movieId && season.movieId !== movieId) {
              console.log(`[Castle] Fetching season ${seasonNum} details...`);
              details = yield getDetails(securityKey, season.movieId.toString());
              currentMovieId = season.movieId.toString();
            }
          }
          const detailsData = extractDataBlock(details);
          const episodes = detailsData.episodes || [];
          let episodeId = null;
          if (mediaType === "tv" && seasonNum && episodeNum) {
            const episode2 = episodes.find((e) => e.number === episodeNum);
            if (episode2 && episode2.id) {
              episodeId = episode2.id.toString();
            }
          } else if (episodes.length > 0) {
            episodeId = episodes[0].id.toString();
          }
          if (!episodeId) {
            throw new Error("Could not find episode ID");
          }
          const episode = episodes.find((e) => e.id.toString() === episodeId);
          const tracks = episode && episode.tracks || [];
          const resolution = 2;
          const allStreams = [];
          for (const track of tracks) {
            const langName = track.languageName || track.abbreviate || "Unknown";
            if (track.existIndividualVideo && track.languageId) {
              try {
                console.log(`[Castle] Fetching ${langName} (languageId: ${track.languageId})`);
                const videoData = yield getVideoV1(securityKey, currentMovieId, episodeId, track.languageId, resolution);
                const langStreams = processVideoResponse(videoData, tmdbInfo, seasonNum, episodeNum, resolution, `[${langName}]`);
                if (langStreams.length > 0) {
                  console.log(`[Castle] \u2705 ${langName}: Found ${langStreams.length} streams`);
                  allStreams.push(...langStreams);
                }
              } catch (error) {
                console.log(`[Castle] \u26A0\uFE0F ${langName}: Failed - ${error.message}`);
              }
            }
          }
          if (allStreams.length === 0) {
            console.log("[Castle] Falling back to shared stream (v2)");
            const videoData = yield getVideo2(securityKey, currentMovieId, episodeId, resolution);
            const sharedStreams = processVideoResponse(videoData, tmdbInfo, seasonNum, episodeNum, resolution, "[Shared]");
            allStreams.push(...sharedStreams);
          }
          allStreams.sort((a, b) => getQualityValue(b.quality) - getQualityValue(a.quality));
          console.log(`[Castle] Total streams found: ${allStreams.length}`);
          return allStreams;
        } catch (error) {
          console.error(`[Castle] Error: ${error.message}`);
          return [];
        }
      });
    }
    module2.exports = { getStreams: getStreams3 };
  }
});

// src/providers/vcloud.js
var require_vcloud = __commonJS({
  "src/providers/vcloud.js"(exports2, module2) {
    var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
    function clean(value) {
      return String(value || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
    }
    function origin(url) {
      const match = String(url).match(/^(https?:\/\/[^/]+)/i);
      return match ? match[1] : "";
    }
    function absolute(value, base) {
      if (!value)
        return null;
      const url = String(value).replace(/&amp;/gi, "&").trim();
      if (/^https?:\/\//i.test(url))
        return url;
      if (url.startsWith("/"))
        return origin(base) + url;
      return String(base).replace(/\/[^/]*$/, "/") + url.replace(/^\.\//, "");
    }
    function anchors(html, base) {
      const output = [];
      const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while (match = regex.exec(html)) {
        const url = absolute(match[1], base);
        if (url)
          output.push({ url, text: clean(match[2]) });
      }
      return output;
    }
    function getResponse(url, referer, redirect) {
      return __async(this, null, function* () {
        return fetch(url, {
          redirect: redirect || "follow",
          headers: __spreadValues({ "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" }, referer ? { Referer: referer } : {})
        });
      });
    }
    function decodeTwice(value) {
      try {
        return atob(atob(value));
      } catch (_) {
        return "";
      }
    }
    function extractIntermediate(html) {
      const script = String(html);
      const encoded = script.match(/atob\(atob\(['"]([^'"]+)['"]\)\)/i);
      if (encoded)
        return decodeTwice(encoded[1]);
      const plain = script.match(/var\s+url\s*=\s*['"]([^'"]+)['"]/i);
      return plain ? plain[1] : "";
    }
    function qualityFrom(value) {
      const match = String(value).match(/(2160|1080|720|480|360)p?/i);
      if (!match)
        return "Unknown";
      return match[1] === "2160" ? "4K" : `${match[1]}p`;
    }
    function resolveServer(server, label, referer) {
      return __async(this, null, function* () {
        let url = server.url;
        const text = server.text;
        let name = text || "V-Cloud";
        if (/buzzserver/i.test(text)) {
          const response = yield getResponse(url.replace(/\/$/, "") + "/download", url, "manual");
          const target = response.headers.get("hx-redirect");
          if (!target)
            return null;
          url = absolute(target, url);
          name = "BuzzServer";
        } else if (/pixeldra|pixelserver|\bpixel\b/i.test(text)) {
          if (!/download/i.test(url))
            url = origin(url) + "/api/file/" + url.split("/").filter(Boolean).pop() + "?download";
          name = "Pixeldrain";
        } else if (/10\s*gbps/i.test(text)) {
          const response = yield getResponse(url, referer, "follow");
          url = response.url || url;
          if (url.includes("link="))
            url = decodeURIComponent(url.split("link=").pop());
          name = "10Gbps";
          if (response.body && response.body.cancel)
            yield response.body.cancel();
        } else if (/fslv2/i.test(text))
          name = "FSLv2";
        else if (/\bfsl\b/i.test(text))
          name = "FSL";
        else if (/pdl server/i.test(text))
          name = "PDL";
        else if (/s3 server/i.test(text))
          name = "S3";
        else if (/mega server/i.test(text))
          name = "Mega";
        return { name, url, quality: qualityFrom(label), headers: { "User-Agent": USER_AGENT, Referer: referer } };
      });
    }
    function resolveVCloud(url, referer, label) {
      return __async(this, null, function* () {
        try {
          let response = yield getResponse(url, referer);
          if (!response.ok)
            return { streams: [], blocked: `HTTP ${response.status}` };
          let html = yield response.text();
          let pageUrl = response.url || url;
          if (/api\/index\.php/i.test(pageUrl)) {
            const next = anchors(html, pageUrl).find((item) => /download|v-?cloud|continue/i.test(item.text + " " + item.url));
            if (!next)
              return { streams: [], blocked: "api/index.php target missing" };
            response = yield getResponse(next.url, pageUrl);
            if (!response.ok)
              return { streams: [], blocked: `HTTP ${response.status}` };
            html = yield response.text();
            pageUrl = response.url || next.url;
          }
          const intermediate = absolute(extractIntermediate(html), pageUrl);
          if (!intermediate)
            return { streams: [], blocked: "encoded intermediate URL missing" };
          response = yield getResponse(intermediate, pageUrl);
          if (!response.ok)
            return { streams: [], blocked: `intermediate HTTP ${response.status}` };
          const serverHtml = yield response.text();
          const serverPage = response.url || intermediate;
          const candidates = anchors(serverHtml, serverPage).filter((item) => /fsl|buzz|pixel|pdl|10\s*gbps|s3 server|mega server/i.test(item.text));
          const results = yield Promise.all(candidates.map((item) => resolveServer(item, label, serverPage).catch(() => null)));
          return { streams: results.filter(Boolean), blocked: null };
        } catch (error) {
          return { streams: [], blocked: error && error.message ? error.message : String(error) };
        }
      });
    }
    module2.exports = { resolveVCloud };
  }
});

// src/shared/html.js
var require_html = __commonJS({
  "src/shared/html.js"(exports2, module2) {
    var cheerio3 = require("cheerio-without-node-native");
    function parseHtml(html) {
      return cheerio3.load(typeof html === "string" ? html : "");
    }
    function decodeBase64(value) {
      if (!value)
        return "";
      if (typeof globalThis.atob === "function")
        return globalThis.atob(value);
      if (typeof Buffer !== "undefined")
        return Buffer.from(value, "base64").toString("utf8");
      throw new Error("No base64 decoder is available in this runtime");
    }
    function absoluteUrl2(value, baseUrl) {
      if (!value)
        return "";
      try {
        return new URL(value, baseUrl).href;
      } catch (_) {
        return "";
      }
    }
    module2.exports = { absoluteUrl: absoluteUrl2, decodeBase64, parseHtml };
  }
});

// src/shared/http.js
var require_http = __commonJS({
  "src/shared/http.js"(exports2, module2) {
    var DEFAULT_TIMEOUT_MS = 3e4;
    var RETRYABLE_STATUS = /* @__PURE__ */ new Set([408, 425, 429, 500, 502, 503, 504]);
    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    function mergeHeaders(...sets) {
      const result = {};
      for (const set of sets) {
        if (!set)
          continue;
        for (const key of Object.keys(set)) {
          if (set[key] !== void 0 && set[key] !== null && set[key] !== "")
            result[key] = String(set[key]);
        }
      }
      return result;
    }
    function withReferer(headers, referer) {
      if (!referer)
        return mergeHeaders(headers);
      let origin;
      try {
        origin = new URL(referer).origin;
      } catch (_) {
      }
      return mergeHeaders(headers, { Referer: referer, Origin: origin });
    }
    function request(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        const _a = options, {
          timeoutMs = DEFAULT_TIMEOUT_MS,
          retries = 1,
          retryDelayMs = 300
        } = _a, fetchOptions = __objRest(_a, [
          "timeoutMs",
          "retries",
          "retryDelayMs"
        ]);
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
          const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
          try {
            const response = yield fetch(url, __spreadProps(__spreadValues({
              skipSizeCheck: true
            }, fetchOptions), {
              signal: controller ? controller.signal : fetchOptions.signal
            }));
            if (!response.ok && RETRYABLE_STATUS.has(response.status) && attempt < retries) {
              yield sleep(retryDelayMs * (attempt + 1));
              continue;
            }
            return response;
          } catch (error) {
            lastError = error;
            if (attempt >= retries)
              throw error;
            yield sleep(retryDelayMs * (attempt + 1));
          } finally {
            if (timer)
              clearTimeout(timer);
          }
        }
        throw lastError || new Error(`Request failed: ${url}`);
      });
    }
    function getText(url, options) {
      return __async(this, null, function* () {
        const response = yield request(url, options);
        if (!response.ok)
          throw new Error(`HTTP ${response.status} for ${url}`);
        return response.text();
      });
    }
    function getJson(url, options) {
      return __async(this, null, function* () {
        const response = yield request(url, options);
        if (!response.ok)
          throw new Error(`HTTP ${response.status} for ${url}`);
        return response.json();
      });
    }
    module2.exports = { DEFAULT_TIMEOUT_MS, getJson, getText, mergeHeaders, request, withReferer };
  }
});

// src/shared/streams.js
var require_streams = __commonJS({
  "src/shared/streams.js"(exports2, module2) {
    var { absoluteUrl: absoluteUrl2, parseHtml } = require_html();
    var { mergeHeaders, request } = require_http();
    var MEDIA_EXTENSION = /\.(?:m3u8|mp4|m4v|webm|mkv|mpd)(?:$|[?#])/i;
    var EMBED_HINT = /(?:embed|player|watch|streamtape|dood|vidhide|filemoon|streamwish|vidwish|megacloud)/i;
    var PLACEHOLDER_MEDIA = /(?:one\.one\.one\.one\/media\/open-graph\.mp4|\/favicon\.|\/logo\.(?:mp4|m3u8)|\b(?:trailer|sample|placeholder|preview)[-_./])/i;
    function parseQuality2(...values) {
      const text = values.filter(Boolean).join(" ").toLowerCase();
      if (/\b(?:2160p?|4k|uhd)\b/.test(text))
        return "4K";
      for (const quality of [1440, 1080, 720, 576, 480, 360, 240]) {
        if (new RegExp(`\\b${quality}p?\\b`).test(text))
          return `${quality}p`;
      }
      return "Unknown";
    }
    function parseMediaAttributes(...values) {
      var _a;
      const text = values.filter(Boolean).join(" ");
      const lower = text.toLowerCase();
      const languages = [];
      const languagePatterns = [
        ["Hindi", /\b(?:hindi|hin)\b/i],
        ["English", /\b(?:english|eng)\b/i],
        ["Tamil", /\b(?:tamil|tam)\b/i],
        ["Telugu", /\b(?:telugu|tel)\b/i],
        ["Malayalam", /\b(?:malayalam|mal)\b/i],
        ["Kannada", /\b(?:kannada|kan)\b/i],
        ["Portuguese", /\b(?:portuguese|portugu[eê]s|pt-br)\b/i],
        ["French", /\b(?:french|fran[cç]ais)\b/i]
      ];
      for (const [name, pattern] of languagePatterns)
        if (pattern.test(text))
          languages.push(name);
      return {
        quality: parseQuality2(text),
        hdr: /\b(?:hdr10\+?|dolby\s*vision|dv)\b/i.test(text),
        codec: /\b(?:hevc|h\.?265|x265)\b/i.test(text) ? "HEVC" : /\b(?:avc|h\.?264|x264)\b/i.test(text) ? "AVC" : void 0,
        audio: /\b(?:dual[ -]?audio|multi[ -]?audio|dual)\b/i.test(text) ? "Dual/Multi Audio" : void 0,
        languages,
        size: (_a = text.match(/\b\d+(?:\.\d+)?\s*(?:GB|MB)\b/i)) == null ? void 0 : _a[0]
      };
    }
    function normalizeSubtitles(subtitles) {
      if (!Array.isArray(subtitles))
        return [];
      const seen = /* @__PURE__ */ new Set();
      return subtitles.flatMap((subtitle) => {
        const url = typeof subtitle === "string" ? subtitle : subtitle && (subtitle.url || subtitle.file);
        if (!/^https?:\/\//i.test(url || "") || seen.has(url))
          return [];
        seen.add(url);
        return [{
          url,
          language: subtitle && (subtitle.language || subtitle.lang || subtitle.label) || "Unknown"
        }];
      });
    }
    function normalizeStream(stream, defaults = {}) {
      if (!stream || !/^https?:\/\//i.test(stream.url || ""))
        return null;
      const attributes = parseMediaAttributes(stream.url, stream.title, stream.name, stream.label, stream.fileName);
      return __spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues({
        url: stream.url,
        quality: stream.quality || parseQuality2(stream.url, stream.title, stream.name),
        title: stream.title || stream.name || defaults.title || "Stream",
        headers: mergeHeaders(defaults.headers, stream.headers),
        subtitles: normalizeSubtitles(stream.subtitles)
      }, stream.size || attributes.size ? { size: stream.size || attributes.size } : {}), stream.hdr !== void 0 || attributes.hdr ? { hdr: stream.hdr !== void 0 ? stream.hdr : attributes.hdr } : {}), stream.codec || attributes.codec ? { codec: stream.codec || attributes.codec } : {}), stream.audio || attributes.audio ? { audio: stream.audio || attributes.audio } : {}), stream.languages || attributes.languages.length ? { languages: stream.languages || attributes.languages } : {});
    }
    function uniqueStreams(streams, defaults) {
      const seen = /* @__PURE__ */ new Set();
      return (streams || []).flatMap((stream) => {
        const normalized = normalizeStream(stream, defaults);
        if (!normalized || seen.has(normalized.url))
          return [];
        seen.add(normalized.url);
        return [normalized];
      });
    }
    function extractMediaCandidates(html, baseUrl) {
      const values = [];
      const patterns = [
        /(?:file|source|src)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4|webm|mkv|mpd)[^"']*)["']/gi,
        /https?:\\?\/\\?\/[^"'\s<>]+\.(?:m3u8|mp4|webm|mkv|mpd)(?:[^"'\s<>]*)/gi
      ];
      for (const pattern of patterns) {
        let match;
        while (match = pattern.exec(html || ""))
          values.push((match[1] || match[0]).replace(/\\\//g, "/"));
      }
      return values.map((value) => absoluteUrl2(value, baseUrl)).filter(Boolean);
    }
    function resolveFinalUrl(_0) {
      return __async(this, arguments, function* (url, options = {}, depth = 0) {
        if (!/^https?:\/\//i.test(url || "") || PLACEHOLDER_MEDIA.test(url) || depth > 2)
          return null;
        const response = yield request(url, __spreadProps(__spreadValues({}, options), { redirect: "follow", retries: 0 }));
        if (!response.ok)
          return null;
        const finalUrl = response.url || url;
        if (PLACEHOLDER_MEDIA.test(finalUrl))
          return null;
        const contentType = response.headers && response.headers.get && response.headers.get("content-type") || "";
        const isHtml = /html|text\/html/i.test(contentType);
        if (/^(?:video|audio)\//i.test(contentType) || /mpegurl|dash\+xml/i.test(contentType) || MEDIA_EXTENSION.test(finalUrl) && !isHtml)
          return finalUrl;
        if (!/html|text\//i.test(contentType))
          return EMBED_HINT.test(finalUrl) ? null : finalUrl;
        const html = yield response.text();
        const candidates = extractMediaCandidates(html, finalUrl);
        for (const candidate of candidates) {
          const resolved = yield resolveFinalUrl(candidate, options, depth + 1).catch(() => null);
          if (resolved)
            return resolved;
        }
        const $ = parseHtml(html);
        const iframe = absoluteUrl2($("iframe").first().attr("src") || $("iframe").first().attr("data-src"), finalUrl);
        if (iframe && iframe !== url)
          return resolveFinalUrl(iframe, options, depth + 1).catch(() => null);
        return null;
      });
    }
    function qualityRank(quality) {
      const text = String(quality || "").toUpperCase();
      if (text === "4K" || text.includes("2160"))
        return 2160;
      const match = text.match(/(1440|1080|720|576|480|360|240)/);
      return match ? Number(match[1]) : 0;
    }
    function normalizeDisplayQuality(value) {
      const rank = qualityRank(value);
      return rank === 2160 ? "4K" : rank > 0 ? `${rank}p` : "Unknown";
    }
    function qualityOrderPrefix(quality) {
      const rank = { "4K": 1, "1080p": 2, "720p": 3, "480p": 4, "360p": 5, "240p": 6 }[quality] || 9;
      return "\u200B".repeat(rank);
    }
    function streamOrderPrefix(quality, seekable) {
      var _a;
      const qualityPosition = (_a = { "4K": 0, "1080p": 1, "720p": 2, "480p": 3, "360p": 4, "240p": 5 }[quality]) != null ? _a : 8;
      const seekPosition = seekable === true ? 1 : seekable === false ? 3 : 2;
      return "\u200B".repeat(qualityPosition * 3 + seekPosition);
    }
    function getSeekableHint(stream) {
      if (stream && (stream.seekable === true || stream.seekable === false)) {
        return stream.seekable;
      }
      const url = String((stream == null ? void 0 : stream.url) || "").toLowerCase();
      const source = String((stream == null ? void 0 : stream.source) || (stream == null ? void 0 : stream.name) || "").toLowerCase();
      if (/hubcloud\s*fsl|\bfsl\b/i.test(source) || /cloudflarestorage\.com\/hub\//i.test(url)) {
        return true;
      }
      if (/\.m3u8(?:$|[?#])/i.test(url) || /castle/i.test(source) && /hls|m3u8/i.test(`${source} ${url}`)) {
        return true;
      }
      if (/hubcloud\s*pixel\s*10gbps|10gbps/i.test(source)) {
        return false;
      }
      return "unknown";
    }
    function seekableOrderRank(hint) {
      if (hint === true)
        return 2;
      if (hint === "unknown")
        return 1;
      if (hint === false)
        return 0;
      return 1;
    }
    function uniqueExactStreams3(streams) {
      const seen = /* @__PURE__ */ new Set();
      const valid = [];
      for (const stream of streams || []) {
        if (!stream || !stream.url)
          continue;
        const quality = normalizeDisplayQuality(stream.quality || stream.name || stream.title);
        const rawSource = stream.source || stream.provider || "Direct";
        const canonicalSource = rawSource.replace(/\s*\([^)]*no\s*seek[^)]*\)/gi, "").trim();
        const key = `${quality}|${canonicalSource}|${stream.url}`;
        if (seen.has(key))
          continue;
        seen.add(key);
        const provider = stream.provider || "StreamPlay";
        const seekable = getSeekableHint(__spreadProps(__spreadValues({}, stream), { source: canonicalSource }));
        let displaySource = canonicalSource;
        if (seekable === false && !/\(no\s*seek\)/i.test(displaySource)) {
          displaySource = `${displaySource} (No Seek)`;
        }
        const prefix = streamOrderPrefix(quality, seekable);
        const name = `${prefix}${provider} \u2022 ${quality} \u2022 ${displaySource}`;
        valid.push(__spreadProps(__spreadValues({}, stream), {
          name,
          quality,
          source: canonicalSource,
          provider,
          seekable
        }));
      }
      return valid.sort((a, b) => {
        const qDiff = qualityRank(b.quality) - qualityRank(a.quality);
        if (qDiff !== 0)
          return qDiff;
        return seekableOrderRank(b.seekable) - seekableOrderRank(a.seekable);
      });
    }
    function mapConcurrent3(items, concurrency, fn) {
      return __async(this, null, function* () {
        if (!Array.isArray(items) || !items.length)
          return [];
        const limit = Math.max(1, Number(concurrency) || 4);
        const results = new Array(items.length);
        let index = 0;
        function worker() {
          return __async(this, null, function* () {
            while (index < items.length) {
              const i = index++;
              try {
                results[i] = yield fn(items[i], i);
              } catch (err) {
                results[i] = null;
              }
            }
          });
        }
        const workers = [];
        for (let w = 0; w < Math.min(limit, items.length); w++) {
          workers.push(worker());
        }
        yield Promise.all(workers);
        return results;
      });
    }
    function checkStreamRange(_0) {
      return __async(this, arguments, function* (url, headers = {}, timeoutMs = 3e3) {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
          const res = yield fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: controller ? controller.signal : void 0,
            headers: __spreadValues({
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36",
              Range: "bytes=1000000-1001023"
            }, headers)
          });
          if (timer)
            clearTimeout(timer);
          const contentRange = res.headers ? res.headers.get("content-range") : null;
          const acceptRanges = res.headers ? res.headers.get("accept-ranges") : null;
          const contentType = res.headers ? res.headers.get("content-type") : null;
          const status = res.status;
          const seekable = status === 206 || !!contentRange || acceptRanges === "bytes";
          if (res.body && typeof res.body.cancel === "function") {
            try {
              yield res.body.cancel();
            } catch (_) {
            }
          }
          return {
            ok: res.ok || status === 206,
            status,
            finalUrl: res.url || url,
            contentType,
            contentRange,
            acceptRanges,
            seekable
          };
        } catch (error) {
          if (timer)
            clearTimeout(timer);
          return { ok: false, status: 0, seekable: false, error: error.message };
        }
      });
    }
    module2.exports = {
      MEDIA_EXTENSION,
      PLACEHOLDER_MEDIA,
      extractMediaCandidates,
      normalizeStream,
      normalizeSubtitles,
      parseMediaAttributes,
      parseQuality: parseQuality2,
      qualityRank,
      normalizeDisplayQuality,
      qualityOrderPrefix,
      streamOrderPrefix,
      getSeekableHint,
      resolveFinalUrl,
      uniqueStreams,
      uniqueExactStreams: uniqueExactStreams3,
      mapConcurrent: mapConcurrent3,
      checkStreamRange
    };
  }
});

// src/providers/vegamovies.js
var require_vegamovies = __commonJS({
  "src/providers/vegamovies.js"(exports2, module2) {
    var DOMAINS5 = require_domains();
    var TMDB_API = DOMAINS5.TMDB_API;
    var { resolveVCloud } = require_vcloud();
    var { mapConcurrent: mapConcurrent3, uniqueExactStreams: uniqueExactStreams3 } = require_streams();
    var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
    var DOMAINS_URL2 = DOMAINS5.PHISHER_DOMAINS;
    var VEGA_FALLBACK = DOMAINS5.VEGAMOVIES_FALLBACK;
    var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
    function requestText(url, referer) {
      return __async(this, null, function* () {
        let lastError;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = yield fetch(url, {
              redirect: "follow",
              headers: __spreadValues({
                "User-Agent": USER_AGENT,
                Accept: "text/html,application/json;q=0.9,*/*;q=0.8"
              }, referer ? { Referer: referer } : {})
            });
            if (!response.ok)
              throw new Error(`HTTP ${response.status} for ${url}`);
            return response.text();
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      });
    }
    function getMediaInfo(tmdbId, mediaType) {
      return __async(this, null, function* () {
        const endpoint = mediaType === "tv" ? "tv" : "movie";
        const url = `${TMDB_API}/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=external_ids`;
        const data = JSON.parse(yield requestText(url));
        return {
          title: mediaType === "tv" ? data.name : data.title,
          year: Number(String(mediaType === "tv" ? data.first_air_date : data.release_date).slice(0, 4)) || null,
          imdbId: data.imdb_id || data.external_ids && data.external_ids.imdb_id || null
        };
      });
    }
    function getVegaBase() {
      return __async(this, null, function* () {
        try {
          const domains = JSON.parse(yield requestText(DOMAINS_URL2));
          if (domains.vegamovies)
            return String(domains.vegamovies).replace(/\/$/, "");
        } catch (_) {
        }
        return VEGA_FALLBACK;
      });
    }
    function searchVega(base, query) {
      return __async(this, null, function* () {
        const data = JSON.parse(yield requestText(`${base}/search.php?q=${encodeURIComponent(query)}`, base));
        return (data.hits || []).map((hit) => hit && hit.document).filter(Boolean);
      });
    }
    function chooseResult(results, media, mediaType) {
      const imdbMatch = results.find((item) => media.imdbId && item.imdb_id === media.imdbId);
      if (imdbMatch)
        return imdbMatch;
      const title = String(media.title || "").toLowerCase();
      const year = String(media.year || "");
      return results.find((item) => {
        const value = String(item.post_title || "").toLowerCase();
        return value.includes(title) && (!year || value.includes(year)) && (mediaType !== "tv" || /season|series|episode/i.test(value));
      }) || results[0];
    }
    function absoluteUrl2(value, base) {
      if (!value)
        return null;
      const url = String(value).trim();
      if (/^https?:\/\//i.test(url))
        return url;
      const origin = String(base || "").match(/^(https?:\/\/[^/]+)/i);
      if (!origin)
        return null;
      if (url.startsWith("/"))
        return origin[1] + url;
      return String(base).replace(/\/[^/]*$/, "/").replace(/\/$/, "/") + url.replace(/^\.\//, "");
    }
    function cleanText(value) {
      return String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
    }
    function headingBlocks(html) {
      const blocks = [];
      const regex = /<(h[3-5])\b[^>]*>([\s\S]*?)<\/\1>([\s\S]*?)(?=<h[3-5]\b|$)/gi;
      let match;
      while (match = regex.exec(html))
        blocks.push({ heading: cleanText(match[2]), body: match[3] });
      return blocks;
    }
    function anchors(html, base) {
      const values = [];
      const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while (match = regex.exec(html)) {
        const url = absoluteUrl2(match[1].replace(/&amp;/gi, "&"), base);
        if (url)
          values.push({ url, text: cleanText(match[2]) });
      }
      return values;
    }
    function movieReleaseLinks(html, base) {
      const links = [];
      for (const block of headingBlocks(html)) {
        for (const anchor of anchors(block.body, base)) {
          if (/nexdrive|dwd-button|download now/i.test(anchor.url + " " + anchor.text + " " + block.body)) {
            links.push({ url: anchor.url, label: block.heading });
          }
        }
      }
      return links;
    }
    function episodeReleaseLinks(html, base, season, episode) {
      const links = [];
      const seasonRegex = new RegExp(`season\\s*0?${season}(?:\\D|$)`, "i");
      for (const block of headingBlocks(html)) {
        if (!seasonRegex.test(block.heading))
          continue;
        for (const anchor of anchors(block.body, base)) {
          if (/(g-?direct|v-?cloud|single|download|nexdrive)/i.test(anchor.text + " " + anchor.url)) {
            links.push({ url: anchor.url, label: block.heading });
          }
        }
      }
      return links;
    }
    function resolveFastdl(directPage, pageUrl) {
      return __async(this, null, function* () {
        try {
          const embed = yield requestText(directPage, pageUrl);
          const match = embed.match(/(?:var\s+reurl\s*=\s*|['"])(?:https:\/\/fastdl\.[^/]+\/dl\.php\?link=)(https:\/\/video-downloads\.googleusercontent\.com\/[^'"\s<]+)/i);
          if (!match)
            return null;
          return { name: "G-Direct (VLC)", url: match[1].replace(/&amp;/g, "&"), referer: directPage, compatibility: "external" };
        } catch (_) {
          return null;
        }
      });
    }
    function qualityFrom(label) {
      const match = String(label).match(/(2160|1080|720|480|360)p?/i);
      if (!match)
        return "Unknown";
      return match[1] === "2160" ? "4K" : `${match[1]}p`;
    }
    function discoverCandidates2(tmdbId, mediaType, season, episode) {
      return __async(this, null, function* () {
        if (!tmdbId || !["movie", "tv"].includes(mediaType))
          return [];
        if (mediaType === "tv" && (!season || !episode))
          return [];
        try {
          const [base, media] = yield Promise.all([getVegaBase(), getMediaInfo(tmdbId, mediaType)]);
          let results = media.imdbId ? yield searchVega(base, media.imdbId) : [];
          if (!results.length)
            results = yield searchVega(base, media.title);
          const result = chooseResult(results, media, mediaType);
          if (!result || !result.permalink)
            return [];
          const detailUrl = absoluteUrl2(result.permalink, base);
          const detail = yield requestText(detailUrl, base);
          const releases = mediaType === "movie" ? movieReleaseLinks(detail, base) : episodeReleaseLinks(detail, base, Number(season), Number(episode));
          const candidateJobs = releases.map((release) => __async(this, null, function* () {
            try {
              const page = yield requestText(release.url, base);
              let routes = [];
              if (mediaType === "tv" && episode) {
                const episodeRegex = new RegExp(`episodes?\\s*:\\s*0?${episode}(?:\\D|$)`, "i");
                for (const block of headingBlocks(page)) {
                  if (!episodeRegex.test(block.heading))
                    continue;
                  routes = anchors(block.body, release.url);
                  break;
                }
              } else {
                routes = anchors(page, release.url);
              }
              const useful = routes.filter((item) => /g-?direct|instant|fastdl|v-?cloud|resumable|vcloud\.zip/i.test(item.text + " " + item.url));
              const quality = qualityFrom(release.label);
              return useful.map((route) => ({
                provider: "vegamovies",
                source: /vcloud\.zip|v-?cloud|resumable/i.test(route.text + " " + route.url) ? "VCloud" : "FastDL",
                quality,
                url: route.url,
                label: release.label,
                referer: release.url,
                headers: { "User-Agent": USER_AGENT, Referer: release.url },
                resolverType: /vcloud\.zip|v-?cloud|resumable/i.test(route.text + " " + route.url) ? "vcloud" : "fastdl"
              }));
            } catch (_) {
              return [];
            }
          }));
          const candidatesList = yield Promise.all(candidateJobs);
          return candidatesList.flat();
        } catch (error) {
          console.log(`[VegaMovies Candidates] ${error && error.message ? error.message : error}`);
          return [];
        }
      });
    }
    function resolveCandidate2(candidate) {
      return __async(this, null, function* () {
        if (!candidate || !candidate.url)
          return [];
        try {
          if (candidate.resolverType === "vcloud") {
            const resolved = yield resolveVCloud(candidate.url, candidate.referer, candidate.label || candidate.quality);
            return (resolved.streams || []).map((stream) => __spreadProps(__spreadValues({}, stream), {
              quality: candidate.quality || stream.quality,
              provider: "vegamovies",
              source: stream.name || "VCloud",
              subtitles: []
            }));
          } else if (candidate.resolverType === "fastdl") {
            const direct = yield resolveFastdl(candidate.url, candidate.referer);
            if (!direct)
              return [];
            return [{
              name: `VegaMovies G-Direct - ${candidate.quality || "Unknown"}`,
              title: candidate.label || "VegaMovies Stream",
              url: direct.url,
              quality: candidate.quality || "Unknown",
              headers: { "User-Agent": USER_AGENT, Referer: candidate.referer },
              provider: "vegamovies",
              source: "FastDL",
              subtitles: []
            }];
          } else if (candidate.resolverType === "direct") {
            return [{
              name: `VegaMovies Direct - ${candidate.quality || "Unknown"}`,
              url: candidate.url,
              quality: candidate.quality || "Unknown",
              headers: candidate.headers,
              provider: "vegamovies",
              source: candidate.source || "Direct",
              subtitles: []
            }];
          }
          return [];
        } catch (_) {
          return [];
        }
      });
    }
    function getStreams3(_0, _1, _2, _3) {
      return __async(this, arguments, function* (tmdbId, mediaType, season, episode, options = {}) {
        try {
          const candidates = yield discoverCandidates2(tmdbId, mediaType, season, episode);
          const resolvedResults = yield mapConcurrent3(candidates, 4, resolveCandidate2);
          const flat = resolvedResults.flat().filter(Boolean);
          return uniqueExactStreams3(flat);
        } catch (error) {
          console.log(`[VegaMovies] ${error && error.message ? error.message : error}`);
          return [];
        }
      });
    }
    module2.exports = { discoverCandidates: discoverCandidates2, resolveCandidate: resolveCandidate2, getStreams: getStreams3 };
  }
});

// src/moviesdrive/constants.js
var import_domains, MAIN_URL, HEADERS, TMDB_API_KEY;
var init_constants = __esm({
  "src/moviesdrive/constants.js"() {
    import_domains = __toESM(require_domains());
    MAIN_URL = import_domains.default.MOVIESDRIVE_FALLBACK;
    HEADERS = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "Referer": `${MAIN_URL}/`
    };
    TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
  }
});

// src/moviesdrive/extractor.js
function absoluteUrl(value, base) {
  if (!value || typeof value !== "string")
    return null;
  try {
    return new URL(value, base).toString();
  } catch (_) {
    return null;
  }
}
function parseSize(value) {
  const match = String(value || "").match(/([\d.]+)\s*(GB|MB)/i);
  return match ? `${Number(match[1]).toFixed(match[1].includes(".") ? 1 : 0)} ${match[2].toUpperCase()}` : void 0;
}
function parseQuality(value) {
  const text = String(value || "");
  if (/\b(?:2160p?|4k)\b/i.test(text))
    return "4K";
  const match = text.match(/\b(1080|720|480|360|240)p?\b/i);
  return match ? `${match[1]}p` : "Unknown";
}
function safeUrl(value) {
  if (!value)
    return null;
  const parsed = new URL(value);
  parsed.pathname = parsed.pathname.split("/").map((segment) => {
    try {
      return encodeURIComponent(decodeURIComponent(segment));
    } catch (_) {
      return encodeURIComponent(segment);
    }
  }).join("/");
  return parsed.toString();
}
function hubCloudServer(text, link) {
  const value = `${text || ""} ${link || ""}`.toLowerCase();
  if (/gpdl\.|server\s*:\s*10gbps/.test(value))
    return "HubCloud Pixel 10Gbps";
  if (/fslv2/.test(value))
    return "HubCloud FSLv2";
  if (/fsl/.test(value))
    return "HubCloud FSL";
  if (/s3 server/.test(value))
    return "HubCloud S3";
  if (/mega server/.test(value))
    return "HubCloud Mega";
  if (/pdl server/.test(value))
    return "HubCloud PDL";
  if (/buzzserver/.test(value))
    return "HubCloud BuzzServer";
  if (/pixeldrain/.test(value))
    return "HubCloud Pixeldrain";
  if (/pixel\.|pixelserver/.test(value))
    return "HubCloud Pixel";
  if (/workers\.dev|download file/.test(value))
    return "HubCloud Direct";
  return "HubCloud";
}
function wrapFslMkvUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!(host === "r2.cloudflarestorage.com" || host.endsWith(".r2.cloudflarestorage.com")))
      return url;
    return `${import_domains2.default.WORKER}/media/file.mkv?url=${encodeURIComponent(url)}`;
  } catch (_) {
    return url;
  }
}
function expandMovieButton(_0) {
  return __async(this, arguments, function* (url, hint = {}) {
    var _a, _b;
    try {
      const response = yield fetch(url, { headers: HEADERS });
      const html = yield response.text();
      if (/search-recover\.php/i.test(response.url || url)) {
        const query = (_a = html.match(/Q_INITIAL\s*=\s*"([^"]+)"/)) == null ? void 0 : _a[1];
        const token = (_b = html.match(/FROM_AC_TOKEN\s*=\s*"([^"]+)"/)) == null ? void 0 : _b[1];
        if (!query || !token)
          return [];
        const endpoint = (response.url || url).split("?")[0];
        const pageNumbers = hint.season && hint.episode ? [1, 2, 3, 4, 5] : [1];
        const payloads = yield Promise.all(pageNumbers.map((page) => {
          const params = new URLSearchParams({ api: "search", q: query, page: String(page), from_ac: token });
          return fetch(`${endpoint}?${params}`, { headers: __spreadProps(__spreadValues({}, HEADERS), { Accept: "application/json" }) }).then((r) => r.json()).catch(() => ({ hits: [] }));
        }));
        const hits = payloads.flatMap((data) => data.hits || []);
        const words = query.toLowerCase().replace(/\b(download|19\d{2}|20\d{2}|2160p|1080p|720p|480p)\b/g, "").split(/\W+/).filter((w) => w.length > 2);
        return hits.filter((hit) => {
          const name = String(hit.file_name || "");
          const normalized = name.toLowerCase();
          if (!words.every((word) => normalized.includes(word)) || /\.zip(?:$|\?)/i.test(name))
            return false;
          if (!hint.season || !hint.episode)
            return true;
          const season = Number(hint.season);
          const episode = Number(hint.episode);
          const seasonMatch = new RegExp(`(?:s|season[ ._-]*)0?${season}(?:\\D|$)`, "i").test(name);
          const episodeMatch = new RegExp(`(?:e|ep|episode[ ._-]*)0?${episode}(?:\\D|$)`, "i").test(name);
          const compactMatch = new RegExp(`(?:^|\\D)${season}x0?${episode}(?:\\D|$)`, "i").test(name);
          return seasonMatch && episodeMatch || compactMatch;
        }).map((hit) => hit.url).filter((link, index, all) => link && all.indexOf(link) === index);
      }
      const $ = import_cheerio_without_node_native.default.load(html);
      const hosts = $("a[href]").map((_, anchor) => $(anchor).attr("href")).get().filter((href) => /hubcloud/i.test(href || ""));
      return hosts.length ? hosts : [response.url || url];
    } catch (_) {
      return [];
    }
  });
}
function extractHubCloud(url, referer) {
  return __async(this, null, function* () {
    var _a;
    try {
      let currentUrl = url.replace("hubcloud.foo", "hubcloud.cx").replace("hubcloud.ink", "hubcloud.dad");
      let response = yield fetch(currentUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }) });
      let html = yield response.text();
      let pageUrl = response.url || currentUrl;
      let $ = import_cheerio_without_node_native.default.load(html);
      const generate = $('a[href*="hubcloud.php"]').first().attr("href") || $("#download").attr("href") || ((_a = html.match(/var url = '([^']+)'/)) == null ? void 0 : _a[1]);
      if (generate) {
        const next = absoluteUrl(generate, pageUrl);
        if (next) {
          response = yield fetch(next, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: pageUrl }) });
          html = yield response.text();
          pageUrl = response.url || next;
          $ = import_cheerio_without_node_native.default.load(html);
        }
      }
      const header = $("div.card-header").text().trim() || $("title").text().trim();
      const size = parseSize($("i#size").text());
      const quality = parseQuality(header);
      const buttons = $("a.btn[href]").map((_, element) => {
        const link = $(element).attr("href");
        const text = $(element).text().toLowerCase();
        if (!link || !/(download file|download\s*\[server|fsl|buzzserver|pixeldra|pixelserver|pixel server|s3 server|mega server|pdl server)/i.test(text))
          return null;
        if (/workers\.dev/i.test(link) && /download file/i.test(text))
          return null;
        return { link: absoluteUrl(link, pageUrl), text };
      }).get().filter(Boolean);
      const streams = yield Promise.all(buttons.map((button) => __async(this, null, function* () {
        var _a2, _b, _c, _d, _e, _f, _g, _h;
        let link = button.link;
        if (/pixeldra|pixelserver|pixel server/i.test(button.text)) {
          return null;
        } else if (/gpdl\.|download\s*\[server\s*:\s*10gbps/i.test(`${button.link} ${button.text}`)) {
          try {
            const gateway = yield fetch(link, { redirect: "manual", headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: pageUrl }) });
            const worker = absoluteUrl((_b = (_a2 = gateway.headers) == null ? void 0 : _a2.get) == null ? void 0 : _b.call(_a2, "location"), link);
            if (!worker)
              return null;
            const generated = yield fetch(worker, { redirect: "manual", headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: link }) });
            const wrapper = absoluteUrl((_d = (_c = generated.headers) == null ? void 0 : _c.get) == null ? void 0 : _d.call(_c, "location"), worker);
            if (!wrapper)
              return null;
            link = new URL(wrapper).searchParams.get("link");
            if (!link)
              return null;
          } catch (_) {
            return null;
          }
        } else if (/buzzserver/i.test(button.text)) {
          try {
            const response2 = yield fetch(link, { redirect: "manual", headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: pageUrl }) });
            link = absoluteUrl(((_f = (_e = response2.headers) == null ? void 0 : _e.get) == null ? void 0 : _f.call(_e, "hx-redirect")) || ((_h = (_g = response2.headers) == null ? void 0 : _g.get) == null ? void 0 : _h.call(_g, "location")), link);
            if (!link)
              return null;
          } catch (_) {
            return null;
          }
        }
        const source = hubCloudServer(button.text, button.link);
        if (/HubCloud FSL/i.test(source))
          link = wrapFslMkvUrl(link);
        return {
          source,
          title: [quality, size].filter(Boolean).join(" \u2022 "),
          url: safeUrl(link),
          quality,
          size,
          headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: pageUrl }),
          subtitles: []
        };
      })));
      return streams.filter(Boolean);
    } catch (_) {
      return [];
    }
  });
}
function extractGdflix(_0, _1) {
  return __async(this, arguments, function* (url, referer, hint = {}) {
    var _a, _b, _c, _d, _e, _f;
    const makeStream = (source, link, quality, size, pageUrl, headers = {}) => ({
      source,
      title: [quality, size].filter(Boolean).join(" \u2022 "),
      url: safeUrl(link),
      quality,
      size,
      headers: __spreadValues(__spreadProps(__spreadValues({}, HEADERS), { Referer: pageUrl }), headers),
      subtitles: []
    });
    const metaRefreshUrl = (html, base) => {
      var _a2, _b2;
      const $ = import_cheerio_without_node_native.default.load(html || "");
      const content = $('meta[http-equiv="refresh"]').first().attr("content") || "";
      const target = (_b2 = (_a2 = content.match(/url\s*=\s*["']?([^"';]+)/i)) == null ? void 0 : _a2[1]) == null ? void 0 : _b2.trim();
      return target ? absoluteUrl(target, base) : null;
    };
    const extractGofile = (link, quality, size, pageUrl) => __async(this, null, function* () {
      var _a2, _b2, _c2, _d2;
      try {
        const id = (_a2 = link.match(/(?:[?&]c=|\/d\/)([a-zA-Z0-9-]+)/)) == null ? void 0 : _a2[1];
        if (!id)
          return [];
        const account = yield fetch("https://api.gofile.io/accounts", {
          method: "POST",
          headers: __spreadProps(__spreadValues({}, HEADERS), { Accept: "application/json" })
        }).then((response) => response.json());
        const token = (_b2 = account == null ? void 0 : account.data) == null ? void 0 : _b2.token;
        if (!token)
          return [];
        const globalJs = yield fetch("https://gofile.io/dist/js/global.js", { headers: HEADERS }).then((response) => response.text());
        const wt = (_c2 = globalJs.match(/appdata\.wt\s*=\s*["']([^"']+)/)) == null ? void 0 : _c2[1];
        if (!wt)
          return [];
        const data = yield fetch(`https://api.gofile.io/contents/${id}?wt=${encodeURIComponent(wt)}`, {
          headers: __spreadProps(__spreadValues({}, HEADERS), { Accept: "application/json", Authorization: `Bearer ${token}` })
        }).then((response) => response.json());
        const children = Object.values(((_d2 = data == null ? void 0 : data.data) == null ? void 0 : _d2.children) || {});
        return children.filter((file) => file == null ? void 0 : file.link).map((file) => makeStream(
          "GDFlix GoFile",
          file.link,
          parseQuality(file.name) === "Unknown" ? quality : parseQuality(file.name),
          parseSize(file.name) || size,
          pageUrl,
          { Cookie: `accountToken=${token}` }
        ));
      } catch (_) {
        return [];
      }
    });
    try {
      const first = yield fetch(url, { redirect: "manual", headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }) });
      const firstHtml = yield first.text();
      const redirected = absoluteUrl((_b = (_a = first.headers) == null ? void 0 : _a.get) == null ? void 0 : _b.call(_a, "location"), url) || metaRefreshUrl(firstHtml, url);
      const id = (_c = url.match(/\/(?:w?file)\/([^/?#]+)/i)) == null ? void 0 : _c[1];
      const pageCandidates = [...new Set([
        redirected,
        first.ok && !redirected ? first.url || url : null,
        ...import_domains2.default.GDFLIX_MIRRORS.map((base) => id ? `${base}/file/${id}` : null)
      ].filter(Boolean))];
      const isCloudflareChallenge = (status, html) => status === 403 || /just a moment|cf-chl|turnstile|challenge-running/i.test(String(html || ""));
      const pages = yield Promise.all(pageCandidates.map((pageUrl) => __async(this, null, function* () {
        try {
          if (pageUrl === (first.url || url) && first.ok && !redirected) {
            if (isCloudflareChallenge(first.status, firstHtml))
              return null;
            return { html: firstHtml, pageUrl };
          }
          const response = yield fetch(pageUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: url }) });
          if (!response.ok)
            return null;
          const html = yield response.text();
          if (isCloudflareChallenge(response.status, html))
            return null;
          return { html, pageUrl: response.url || pageUrl };
        } catch (_) {
          return null;
        }
      })));
      const results = [];
      for (const page of pages.filter(Boolean)) {
        const $ = import_cheerio_without_node_native.default.load(page.html);
        const details = $("ul > li.list-group-item").text() || $("li").text() || $("title").text();
        const detectedQuality = parseQuality(details);
        const quality = detectedQuality === "Unknown" ? hint.quality || "1080p" : detectedQuality;
        const size = parseSize(details) || hint.size;
        const buttons = [];
        $("div.text-center a[href], a.btn[href]").each((_, element) => {
          buttons.push({ text: $(element).text().trim(), link: absoluteUrl($(element).attr("href"), page.pageUrl) });
        });
        if (!/list-group-item|direct\s*dl|instant\s*dl|gofile|pixeldra|pixelserver/i.test(page.html))
          continue;
        for (const button of buttons) {
          if (!button.link)
            continue;
          if (/direct\s*dl/i.test(button.text)) {
            results.push(makeStream("GDFlix Direct", button.link, quality, size, page.pageUrl));
          } else if (/instant\s*dl/i.test(button.text)) {
            try {
              const instant = yield fetch(button.link, { redirect: "manual", headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: page.pageUrl }) });
              const location = ((_e = (_d = instant.headers) == null ? void 0 : _d.get) == null ? void 0 : _e.call(_d, "location")) || instant.url;
              const direct = (_f = location == null ? void 0 : location.match(/[?&]url=([^&]+)/i)) == null ? void 0 : _f[1];
              const resolved = direct ? decodeURIComponent(direct) : location;
              if (resolved && resolved !== button.link)
                results.push(makeStream("GDFlix Instant Download", resolved, quality, size, page.pageUrl));
            } catch (_) {
            }
          } else if (/gofile/i.test(button.text)) {
            results.push(...yield extractGofile(button.link, quality, size, page.pageUrl));
          } else if (/pixeldra|pixelserver|\bpixel\b/i.test(button.text)) {
            continue;
          }
        }
        const cfBase = page.pageUrl.replace("/file/", "/wfile/").replace(/\?.*$/, "");
        const cfPages = yield Promise.all(["type=1", "type=2"].map((query) => __async(this, null, function* () {
          try {
            const cfUrl = `${cfBase}?${query}`;
            const response = yield fetch(cfUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: page.pageUrl }) });
            return response.ok ? { html: yield response.text(), url: response.url || cfUrl } : null;
          } catch (_) {
            return null;
          }
        })));
        for (const cfPage of cfPages.filter(Boolean)) {
          const $$ = import_cheerio_without_node_native.default.load(cfPage.html);
          const link = absoluteUrl($$("a.btn-success[href]").first().attr("href"), cfPage.url);
          if (link)
            results.push(makeStream("GDFlix CF", link, quality, size, cfPage.url));
        }
      }
      if (results.length)
        return results;
    } catch (_) {
    }
    return [];
  });
}
function extractHost(url, referer, hint = {}) {
  return /gdflix|gdlink/i.test(url) ? extractGdflix(url, referer, hint) : extractHubCloud(url, referer);
}
var import_cheerio_without_node_native, import_domains2;
var init_extractor = __esm({
  "src/moviesdrive/extractor.js"() {
    import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
    init_constants();
    import_domains2 = __toESM(require_domains());
  }
});

// src/moviesdrive/index.js
var moviesdrive_exports = {};
__export(moviesdrive_exports, {
  default: () => moviesdrive_default,
  discoverCandidates: () => discoverCandidates,
  getStreams: () => getStreams,
  resolveCandidate: () => resolveCandidate
});
function normalizeType(value) {
  return /^(tv|series|show)$/i.test(String(value || "")) ? "tv" : "movie";
}
function getMetadata(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var _a;
    const response = yield fetch(`${import_domains3.default.TMDB_API}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`, { headers: HEADERS });
    if (!response.ok)
      return null;
    const data = yield response.json();
    return { title: mediaType === "tv" ? data.name : data.title, imdbId: (_a = data.external_ids) == null ? void 0 : _a.imdb_id };
  });
}
function coversSeason(document, season) {
  if (!season)
    return true;
  const text = `${document.post_title || ""} ${document.permalink || ""}`;
  const range = text.match(/season\s*0?(\d+)\s*[-–—]\s*0?(\d+)/i);
  if (range && season >= Number(range[1]) && season <= Number(range[2]))
    return true;
  return new RegExp(`(?:season[ ._/-]*|\\bs)0?${season}(?:\\D|$)`, "i").test(text);
}
function getMainUrls() {
  return __async(this, null, function* () {
    const candidates = [];
    try {
      const response = yield fetch(DOMAINS_URL, { headers: HEADERS });
      if (response.ok) {
        const configured = String((yield response.json()).moviesdrive || "").replace(/\/$/, "");
        if (/^https?:\/\//i.test(configured))
          candidates.push(configured);
      }
    } catch (_) {
    }
    candidates.push(MAIN_URL);
    return [...new Set(candidates)];
  });
}
function search(metadata, season, mainUrls) {
  return __async(this, null, function* () {
    const queries = [metadata.imdbId, metadata.title].filter(Boolean);
    const attempts = mainUrls.flatMap((mainUrl) => queries.map((query) => __async(this, null, function* () {
      const data = yield fetch(`${mainUrl}/search.php?q=${encodeURIComponent(query)}&page=1`, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: `${mainUrl}/` }) }).then((r) => r.json());
      const documents = (data.hits || []).map((hit) => hit.document).filter(Boolean);
      const exact = metadata.imdbId ? documents.filter((doc) => doc.imdb_id === metadata.imdbId) : [];
      const titled = documents.filter((doc) => String(doc.post_title || "").toLowerCase().includes(String(metadata.title || "").toLowerCase()));
      const candidates = exact.length ? exact : titled;
      const match = candidates.find((doc) => coversSeason(doc, season));
      if (match)
        return `${mainUrl}${String(match.permalink).startsWith("/") ? "" : "/"}${match.permalink}`;
      throw new Error("No matching result");
    })));
    try {
      return yield Promise.any(attempts);
    } catch (_) {
      return null;
    }
  });
}
function seasonPages($, season) {
  const result = [];
  const pattern = new RegExp(`Season\\s*0?${season}(?:\\D|$)`, "i");
  $("h5").each((_, heading) => {
    if (!pattern.test($(heading).text()))
      return;
    let node = $(heading).next();
    let traversed = 0;
    while (node.length && traversed++ < 100) {
      const nodeText = node.text();
      const anchors = node.attr("href") ? [node] : node.find("a[href]").get();
      anchors.forEach((anchor) => {
        const text = $(anchor).text();
        const href = $(anchor).attr("href");
        if (href && /single\s*episode/i.test(text) && !/zip/i.test(text) && !result.some((item) => item.url === href)) {
          const qualityMatch = text.match(/\b(1080|720|480|360|240)p?\b/i);
          const quality = /(?:2160p?|4k)/i.test(text) ? "4K" : qualityMatch ? `${qualityMatch[1]}p` : "Unknown";
          result.push({ url: href, quality });
        }
      });
      if (/Season\s*\d+/i.test(nodeText))
        break;
      node = node.next();
    }
  });
  return result;
}
function episodeLinks($, episode) {
  const result = [];
  const pattern = new RegExp(`(?:Ep|Episode)\\s*0?${episode}(?:\\D|$)`, "i");
  $("h5").each((_, heading) => {
    var _a;
    const headingText = $(heading).text();
    if (!pattern.test(headingText))
      return;
    const qualityMatch = headingText.match(/\b(1080|720|480|360|240)p?\b/i);
    const quality = /(?:2160p?|4k)/i.test(headingText) ? "4K" : qualityMatch ? `${qualityMatch[1]}p` : "Unknown";
    const size = (_a = headingText.match(/([\d.]+)\s*(GB|MB)/i)) == null ? void 0 : _a[0];
    let node = $(heading).next();
    let traversed = 0;
    while (node.length && traversed++ < 100) {
      const nodeText = node.text();
      const anchors = node.attr("href") ? [node] : node.find("a[href]").get();
      anchors.forEach((anchor) => {
        const href = $(anchor).attr("href");
        if (href && /(hubcloud|gdflix|gdlink)/i.test(href) && !result.some((item) => item.url === href)) {
          result.push({ url: href, quality, size });
        }
      });
      if (/(?:Ep|Episode)\s*\d+/i.test(nodeText))
        break;
      node = node.next();
    }
  });
  return result;
}
function discoverCandidates(tmdbId, mediaType, season = 1, episode = 1) {
  return __async(this, null, function* () {
    try {
      const type = normalizeType(mediaType);
      const seasonNumber = Number(season) || 1;
      const episodeNumber = Number(episode) || 1;
      const [metadata, mainUrls] = yield Promise.all([
        getMetadata(String(tmdbId).replace(/^tmdb:/i, ""), type),
        getMainUrls()
      ]);
      if (!(metadata == null ? void 0 : metadata.title))
        return [];
      const mediaUrl = yield search(metadata, type === "tv" ? seasonNumber : null, mainUrls);
      if (!mediaUrl)
        return [];
      const html = yield fetch(mediaUrl, { headers: HEADERS }).then((r) => r.text());
      const $ = import_cheerio_without_node_native2.default.load(html);
      let hostPages = [];
      if (type === "movie") {
        const buttons = $("h5 > a[href]").map((_, anchor) => $(anchor).attr("href")).get().filter(Boolean);
        hostPages = (yield Promise.all([...new Set(buttons)].map(expandMovieButton))).flat();
      } else {
        const pages = seasonPages($, seasonNumber);
        const pageResults = yield Promise.all(pages.map((page) => __async(this, null, function* () {
          try {
            if (/search-recover\.php/i.test(page.url)) {
              return [__spreadProps(__spreadValues({}, page), { season: seasonNumber, episode: episodeNumber, referer: mediaUrl })];
            }
            const episodeHtml = yield fetch(page.url, { headers: HEADERS }).then((r) => r.text());
            return episodeLinks(import_cheerio_without_node_native2.default.load(episodeHtml), episodeNumber).map((item) => __spreadProps(__spreadValues({}, item), {
              season: seasonNumber,
              episode: episodeNumber,
              referer: page.url
            }));
          } catch (_) {
            return [];
          }
        })));
        hostPages = pageResults.flat();
      }
      const uniqueHosts = hostPages.filter((item, index, all) => {
        const url = typeof item === "string" ? item : item.url;
        return all.findIndex((other) => (typeof other === "string" ? other : other.url) === url) === index;
      });
      const expandedHosts = (yield Promise.all(uniqueHosts.map((item) => __async(this, null, function* () {
        const url = typeof item === "string" ? item : item.url;
        if (!/search-recover\.php/i.test(url))
          return [item];
        const expanded = yield expandMovieButton(url, typeof item === "string" ? {} : item);
        return expanded.map((expandedUrl) => typeof item === "string" ? expandedUrl : __spreadProps(__spreadValues({}, item), { url: expandedUrl }));
      })))).flat();
      return expandedHosts.map((item) => {
        const hint = typeof item === "string" ? {} : item;
        const url = typeof item === "string" ? item : item.url;
        const referer = hint.referer || mediaUrl;
        const isGdflix = /gdflix|gdlink/i.test(url);
        const isHubcloud = /hubcloud/i.test(url);
        return {
          provider: "MoviesDrive",
          source: isGdflix ? "GDFlix" : isHubcloud ? "HubCloud" : "MoviesDrive Host",
          quality: hint.quality || "Unknown",
          size: hint.size,
          url,
          referer,
          headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }),
          resolverType: isGdflix ? "gdflix" : isHubcloud ? "hubcloud" : "direct"
        };
      });
    } catch (error) {
      console.error("[MoviesDrive Candidate Discovery] Error:", error.message);
      return [];
    }
  });
}
function resolveCandidate(candidate) {
  return __async(this, null, function* () {
    if (!candidate || !candidate.url)
      return [];
    try {
      if (candidate.resolverType === "direct") {
        return [{
          name: candidate.name || `MoviesDrive \u2022 ${candidate.quality || "Unknown"} \u2022 ${candidate.source || "Direct"}`,
          title: candidate.title,
          url: candidate.url,
          quality: candidate.quality || "Unknown",
          size: candidate.size,
          headers: candidate.headers || HEADERS,
          provider: "MoviesDrive",
          source: candidate.source || "Direct",
          subtitles: []
        }];
      }
      const streams = yield extractHost(candidate.url, candidate.referer || MAIN_URL, {
        quality: candidate.quality,
        size: candidate.size
      });
      return (streams || []).map((stream) => __spreadProps(__spreadValues({}, stream), {
        provider: "MoviesDrive"
      }));
    } catch (error) {
      return [];
    }
  });
}
function getStreams(tmdbId, mediaType, season = 1, episode = 1) {
  return __async(this, null, function* () {
    try {
      const candidates = yield discoverCandidates(tmdbId, mediaType, season, episode);
      const resolvedResults = yield (0, import_streams.mapConcurrent)(candidates, 4, resolveCandidate);
      const flatStreams = resolvedResults.flat().filter(Boolean);
      return (0, import_streams.uniqueExactStreams)(flatStreams);
    } catch (error) {
      console.error("[MoviesDrive] Error:", error.message);
      return [];
    }
  });
}
var import_cheerio_without_node_native2, import_streams, import_domains3, DOMAINS_URL, moviesdrive_default;
var init_moviesdrive = __esm({
  "src/moviesdrive/index.js"() {
    import_cheerio_without_node_native2 = __toESM(require("cheerio-without-node-native"));
    init_constants();
    init_extractor();
    import_streams = __toESM(require_streams());
    import_domains3 = __toESM(require_domains());
    DOMAINS_URL = import_domains3.default.PHISHER_DOMAINS;
    moviesdrive_default = { discoverCandidates, resolveCandidate, getStreams };
  }
});

// src/providers/movies4u.js
var require_movies4u = __commonJS({
  "src/providers/movies4u.js"(exports2, module2) {
    var cheerio3 = require("cheerio-without-node-native");
    var DOMAINS5 = require_domains();
    var { mapConcurrent: mapConcurrent3, uniqueExactStreams: uniqueExactStreams3 } = require_streams();
    var moviesDrive = (init_moviesdrive(), __toCommonJS(moviesdrive_exports));
    var vegaMovies = require_vegamovies();
    var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
    var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
    var HEADERS2 = { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8", Cookie: "xla=s4t" };
    function text(url, referer) {
      return __async(this, null, function* () {
        const response = yield fetch(url, {
          redirect: "follow",
          headers: __spreadValues(__spreadValues({}, HEADERS2), referer ? { Referer: referer } : {})
        });
        if (!response.ok)
          throw new Error(`HTTP ${response.status} for ${url}`);
        return response.text();
      });
    }
    function getBaseUrl() {
      return __async(this, null, function* () {
        try {
          const domains = JSON.parse(yield text(DOMAINS5.PHISHER_DOMAINS));
          if (domains.movies4u)
            return String(domains.movies4u).replace(/\/$/, "");
        } catch (_) {
        }
        return DOMAINS5.MOVIES4U_FALLBACK;
      });
    }
    function getMetadata2(tmdbId, mediaType) {
      return __async(this, null, function* () {
        const endpoint = mediaType === "tv" ? "tv" : "movie";
        const data = JSON.parse(yield text(`${DOMAINS5.TMDB_API}/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}`));
        return {
          title: mediaType === "tv" ? data.name : data.title,
          year: Number(String(mediaType === "tv" ? data.first_air_date : data.release_date).slice(0, 4)) || null
        };
      });
    }
    function clean(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }
    function qualityFrom(value) {
      const match = clean(value).match(/(?:2160p?|4k|1080p?|720p?|480p?|360p?)/i);
      if (!match)
        return "Unknown";
      return /2160|4k/i.test(match[0]) ? "4K" : `${match[0].match(/\d+/)[0]}p`;
    }
    function sizeFrom(value) {
      var _a;
      return (_a = clean(value).match(/\b\d+(?:\.\d+)?\s*(?:GB|MB)(?:\/E)?\b/i)) == null ? void 0 : _a[0];
    }
    function normalizedTitle(value) {
      return clean(value).toLowerCase().replace(/\(\d{4}\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    }
    function chooseResult(results, metadata, mediaType) {
      const target = normalizedTitle(metadata.title);
      const exact = results.find((result) => {
        const name = normalizedTitle(result.name);
        const yearMatches = !metadata.year || String(result.name).includes(String(metadata.year));
        return (name === target || name.startsWith(`${target} `)) && yearMatches && (mediaType !== "tv" || /season|series/i.test(result.name));
      });
      return exact || results.find((result) => normalizedTitle(result.name).startsWith(`${target} `)) || null;
    }
    function routesFromBlock($, heading) {
      return $(heading).next().find("a[href]").map((_, anchor) => ({
        url: $(anchor).attr("href"),
        label: clean($(anchor).text())
      })).get().filter((route) => route.url && !/batch|zip/i.test(route.label));
    }
    function candidate(route, quality, size, referer, label) {
      const value = `${route.label} ${route.url}`;
      const resolverType = /vcloud/i.test(route.url) ? "vcloud" : /hubcloud/i.test(route.url) ? "hubcloud" : /gdflix|gdlink/i.test(route.url) ? "gdflix" : /hubcloud/i.test(value) ? "hubcloud" : /gdflix|gdlink/i.test(value) ? "gdflix" : null;
      if (!resolverType)
        return null;
      return {
        provider: "Movies4u",
        source: resolverType === "hubcloud" ? "HubCloud" : resolverType === "gdflix" ? "GDFlix" : "VCloud",
        quality,
        size,
        url: route.url,
        label,
        referer,
        headers: __spreadProps(__spreadValues({}, HEADERS2), { Referer: referer }),
        resolverType
      };
    }
    function discoverCandidates2(tmdbId, mediaType, season = 1, episode = 1) {
      return __async(this, null, function* () {
        if (!tmdbId || !["movie", "tv"].includes(mediaType))
          return [];
        if (mediaType === "tv" && (!season || !episode))
          return [];
        try {
          const [base, metadata] = yield Promise.all([getBaseUrl(), getMetadata2(tmdbId, mediaType)]);
          if (!metadata.title)
            return [];
          const $search = cheerio3.load(yield text(`${base}/?s=${encodeURIComponent(metadata.title)}`, base));
          const results = $search("article").map((_, article) => {
            const anchor = $search(article).find("h2 a, h3 a").first();
            return { name: clean(anchor.text()), url: anchor.attr("href") };
          }).get().filter((result) => result.url && result.name);
          const match = chooseResult(results, metadata, mediaType);
          if (!match)
            return [];
          const $detail = cheerio3.load(yield text(match.url, base));
          const releasePages = [];
          $detail("div.download-links-div h4, div.downloads-btns-div h4, h4").each((_, heading) => {
            const label = clean($detail(heading).text());
            if (mediaType === "tv" && !new RegExp(`season\\s*0?${Number(season)}(?:\\D|$)`, "i").test(label))
              return;
            const quality = qualityFrom(label);
            if (quality === "Unknown")
              return;
            for (const route of routesFromBlock($detail, heading)) {
              if (/m4ulinks\./i.test(route.url))
                releasePages.push(__spreadProps(__spreadValues({}, route), { quality, size: sizeFrom(label), label }));
            }
          });
          const pageCache = /* @__PURE__ */ new Map();
          const getReleasePage = (url) => {
            if (!pageCache.has(url))
              pageCache.set(url, text(url, match.url));
            return pageCache.get(url);
          };
          const discovered = yield mapConcurrent3(releasePages, 4, (release) => __async(this, null, function* () {
            try {
              const $page = cheerio3.load(yield getReleasePage(release.url));
              const routes = [];
              if (mediaType === "tv") {
                $page("h4, h5").each((_, heading) => {
                  const headingText = clean($page(heading).text());
                  const matchEpisode = headingText.match(/episodes?\s*:\s*0*(\d+)/i);
                  if (!matchEpisode || Number(matchEpisode[1]) !== Number(episode))
                    return;
                  routes.push(...routesFromBlock($page, heading));
                });
              } else {
                $page("h4, h5").each((_, heading) => {
                  const headingText = clean($page(heading).text());
                  if (qualityFrom(headingText) !== release.quality)
                    return;
                  routes.push(...routesFromBlock($page, heading));
                });
              }
              return routes.map((route) => candidate(route, release.quality, release.size, release.url, release.label)).filter(Boolean);
            } catch (_) {
              return [];
            }
          }));
          const seen = /* @__PURE__ */ new Set();
          return discovered.flat().filter((item) => {
            const key = `${item.quality}|${item.source}|${item.url}`;
            if (seen.has(key))
              return false;
            seen.add(key);
            return true;
          });
        } catch (error) {
          console.log(`[Movies4u Candidates] ${(error == null ? void 0 : error.message) || error}`);
          return [];
        }
      });
    }
    function resolveCandidate2(item) {
      return __async(this, null, function* () {
        var _a, _b;
        if (!(item == null ? void 0 : item.url))
          return [];
        try {
          const resolver = item.resolverType === "vcloud" ? vegaMovies.resolveCandidate || ((_a = vegaMovies.default) == null ? void 0 : _a.resolveCandidate) : moviesDrive.resolveCandidate || ((_b = moviesDrive.default) == null ? void 0 : _b.resolveCandidate);
          if (typeof resolver !== "function")
            return [];
          const streams = yield resolver(item);
          return (streams || []).map((stream) => __spreadProps(__spreadValues({}, stream), { provider: "Movies4u" }));
        } catch (_) {
          return [];
        }
      });
    }
    function getStreams3(tmdbId, mediaType, season = 1, episode = 1) {
      return __async(this, null, function* () {
        const candidates = yield discoverCandidates2(tmdbId, mediaType, season, episode);
        const resolved = yield mapConcurrent3(candidates, 4, resolveCandidate2);
        return uniqueExactStreams3(resolved.flat().filter(Boolean));
      });
    }
    module2.exports = { discoverCandidates: discoverCandidates2, resolveCandidate: resolveCandidate2, getStreams: getStreams3 };
  }
});

// src/providers/fourkHDhub.js
var require_fourkHDhub = __commonJS({
  "src/providers/fourkHDhub.js"(exports2, module2) {
    var cheerio3 = require("cheerio-without-node-native");
    var DOMAINS5 = require_domains();
    var { mapConcurrent: mapConcurrent3, uniqueExactStreams: uniqueExactStreams3 } = require_streams();
    var moviesDrive = (init_moviesdrive(), __toCommonJS(moviesdrive_exports));
    var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
    var HEADERS2 = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      Accept: "text/html,*/*;q=0.8"
    };
    function text(url, referer) {
      return __async(this, null, function* () {
        const response = yield fetch(url, { redirect: "follow", headers: __spreadValues(__spreadValues({}, HEADERS2), referer ? { Referer: referer } : {}) });
        if (!response.ok)
          throw new Error(`HTTP ${response.status} for ${url}`);
        return response.text();
      });
    }
    function getBaseUrl() {
      return __async(this, null, function* () {
        try {
          const domains = JSON.parse(yield text(DOMAINS5.PHISHER_DOMAINS));
          if (domains["4khdhub"])
            return String(domains["4khdhub"]).replace(/\/$/, "");
        } catch (_) {
        }
        return DOMAINS5.FOURKHDHUB_FALLBACK || "https://4khdhub.org";
      });
    }
    function metadata(tmdbId, mediaType) {
      return __async(this, null, function* () {
        const type = mediaType === "tv" ? "tv" : "movie";
        const data = JSON.parse(yield text(`${DOMAINS5.TMDB_API}/${type}/${tmdbId}?api_key=${TMDB_KEY}`));
        return {
          title: type === "tv" ? data.name : data.title,
          year: Number(String(type === "tv" ? data.first_air_date : data.release_date).slice(0, 4)) || null
        };
      });
    }
    var clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    var normalized = (value) => clean(value).toLowerCase().replace(/\(\d{4}\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    function absolute(url, base) {
      try {
        return new URL(url, base).toString();
      } catch (_) {
        return "";
      }
    }
    function qualityFrom(value) {
      const match = clean(value).match(/\b(?:2160p?|4k|1080p?|720p?|480p?|360p?)\b/i);
      if (!match)
        return "Unknown";
      return /2160|4k/i.test(match[0]) ? "4K" : `${match[0].match(/\d+/)[0]}p`;
    }
    function sizeFrom(value) {
      var _a;
      return (_a = clean(value).match(/\b\d+(?:\.\d+)?\s*(?:GB|MB)(?:\/E)?\b/i)) == null ? void 0 : _a[0];
    }
    function selectResult(results, info, mediaType) {
      const target = normalized(info.title);
      return results.find((item) => {
        const name = normalized(item.name);
        return (name === target || name.startsWith(`${target} `)) && (!info.year || item.name.includes(String(info.year)) || mediaType === "tv") && (mediaType !== "tv" || /series|season/i.test(`${item.name} ${item.url}`));
      }) || results.find((item) => {
        const name = normalized(item.name);
        return name === target || name.startsWith(`${target} `);
      }) || null;
    }
    function matchesEpisode(label, season, episode) {
      const exact = clean(label).match(/S(?:eason)?\s*0*(\d+)\s*E(?:pisode)?\s*0*(\d+)/i);
      if (exact)
        return Number(exact[1]) === Number(season) && Number(exact[2]) === Number(episode);
      const simple = clean(label).match(/Episode[-\s:]*(\d+)/i);
      return Boolean(simple && Number(simple[1]) === Number(episode));
    }
    function makeCandidate(url, anchorLabel, blockLabel, referer) {
      const hostname = (() => {
        try {
          return new URL(url).hostname.toLowerCase();
        } catch (_) {
          return "";
        }
      })();
      const resolverType = hostname.includes("hubcloud") ? "hubcloud" : hostname.includes("hubdrive") ? "hubdrive" : null;
      if (!resolverType)
        return null;
      return {
        provider: "4KHDHub",
        source: resolverType === "hubcloud" ? "HubCloud" : "HubDrive",
        quality: qualityFrom(blockLabel),
        size: sizeFrom(blockLabel),
        url,
        label: blockLabel,
        referer,
        headers: __spreadProps(__spreadValues({}, HEADERS2), { Referer: referer }),
        resolverType
      };
    }
    function discoverCandidates2(tmdbId, mediaType, season = 1, episode = 1) {
      return __async(this, null, function* () {
        if (!tmdbId || !["movie", "tv"].includes(mediaType))
          return [];
        try {
          const [base, info] = yield Promise.all([getBaseUrl(), metadata(tmdbId, mediaType)]);
          const $search = cheerio3.load(yield text(`${base}/?s=${encodeURIComponent(info.title)}`, base));
          const results = $search("div.card-grid a, article a").map((_, anchor) => ({
            name: clean($search(anchor).find("h2,h3").first().text() || $search(anchor).attr("title") || $search(anchor).text()),
            url: absolute($search(anchor).attr("href"), base)
          })).get().filter((item) => item.name && item.url);
          const selected = selectResult(results, info, mediaType);
          if (!selected)
            return [];
          const $ = cheerio3.load(yield text(selected.url, base));
          const selector = mediaType === "tv" ? "div.episode-download-item" : "div.download-item";
          const candidates = [];
          $(selector).each((_, block) => {
            const label = clean($(block).text());
            if (mediaType === "tv" && !matchesEpisode(label, season, episode))
              return;
            $(block).find("a[href]").each((__, anchor) => {
              const url = absolute($(anchor).attr("href"), selected.url);
              const item = makeCandidate(url, clean($(anchor).text()), label, selected.url);
              if (item)
                candidates.push(item);
            });
          });
          const seen = /* @__PURE__ */ new Set();
          return candidates.filter((item) => {
            const key = `${item.quality}|${item.source}|${item.url}`;
            if (seen.has(key))
              return false;
            seen.add(key);
            return true;
          });
        } catch (error) {
          console.log(`[4KHDHub Candidates] ${(error == null ? void 0 : error.message) || error}`);
          return [];
        }
      });
    }
    function resolveHubDrive(candidate) {
      return __async(this, null, function* () {
        var _a;
        try {
          const res = yield fetch(candidate.url, { headers: __spreadProps(__spreadValues({}, HEADERS2), { Referer: candidate.referer }) });
          if (!res.ok)
            return [];
          const html = yield res.text();
          if (/file not found|404 not found|deleted|login\.php\?action=logout/i.test(html))
            return [];
          if (res.status === 403 || /just a moment|cf-chl|turnstile/i.test(html))
            return [];
          const $ = cheerio3.load(html);
          const btnHref = $('a.btn[href], a#download[href], a[href*="hubcloud"]').first().attr("href");
          if (!btnHref)
            return [];
          const targetUrl = absolute(btnHref, res.url || candidate.url);
          if (targetUrl.includes("hubcloud")) {
            const resolver = moviesDrive.resolveCandidate || ((_a = moviesDrive.default) == null ? void 0 : _a.resolveCandidate);
            if (typeof resolver !== "function")
              return [];
            const streams = yield resolver(__spreadProps(__spreadValues({}, candidate), {
              url: targetUrl,
              source: "HubDrive HubCloud",
              resolverType: "hubcloud"
            }));
            return (streams || []).map((stream) => __spreadProps(__spreadValues({}, stream), { provider: "4KHDHub" }));
          }
          if (/^https?:\/\//i.test(targetUrl) && !/html/i.test(targetUrl)) {
            return [__spreadValues({
              name: `4KHDHub \u2022 ${candidate.quality} \u2022 HubDrive Direct`,
              url: targetUrl,
              quality: candidate.quality,
              source: "HubDrive Direct",
              provider: "4KHDHub"
            }, candidate.size ? { size: candidate.size } : {})];
          }
        } catch (_) {
        }
        return [];
      });
    }
    function resolveCandidate2(candidate) {
      return __async(this, null, function* () {
        var _a;
        if (!(candidate == null ? void 0 : candidate.url))
          return [];
        if (candidate.resolverType === "hubdrive") {
          return resolveHubDrive(candidate);
        }
        if (candidate.resolverType !== "hubcloud")
          return [];
        try {
          const resolver = moviesDrive.resolveCandidate || ((_a = moviesDrive.default) == null ? void 0 : _a.resolveCandidate);
          if (typeof resolver !== "function")
            return [];
          const streams = yield resolver(__spreadProps(__spreadValues({}, candidate), { resolverType: "hubcloud" }));
          return (streams || []).map((stream) => __spreadProps(__spreadValues({}, stream), { provider: "4KHDHub" }));
        } catch (_) {
          return [];
        }
      });
    }
    function getStreams3(tmdbId, mediaType, season = 1, episode = 1) {
      return __async(this, null, function* () {
        const candidates = yield discoverCandidates2(tmdbId, mediaType, season, episode);
        const resolved = yield mapConcurrent3(candidates, 4, resolveCandidate2);
        return uniqueExactStreams3(resolved.flat().filter(Boolean));
      });
    }
    module2.exports = { discoverCandidates: discoverCandidates2, resolveCandidate: resolveCandidate2, getStreams: getStreams3 };
  }
});

// src/providers/multimovies.js
var require_multimovies = __commonJS({
  "src/providers/multimovies.js"(exports2, module2) {
    var cheerio3 = require("cheerio-without-node-native");
    var CryptoJS = require("crypto-js");
    var DOMAINS5 = require_domains();
    var { mapConcurrent: mapConcurrent3, parseMediaAttributes, uniqueExactStreams: uniqueExactStreams3 } = require_streams();
    var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36";
    var HEADERS2 = { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" };
    var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
    var API_KEY = CryptoJS.enc.Utf8.parse("kiemtienmua911ca");
    var API_IV = CryptoJS.enc.Utf8.parse("1234567890oiuytr");
    function text(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        const response = yield fetch(url, __spreadProps(__spreadValues({ redirect: "follow" }, options), { headers: __spreadValues(__spreadValues({}, HEADERS2), options.headers || {}) }));
        if (!response.ok)
          throw new Error(`HTTP ${response.status} for ${url}`);
        return response.text();
      });
    }
    function getBaseUrl() {
      return __async(this, null, function* () {
        try {
          const domains = JSON.parse(yield text(DOMAINS5.PHISHER_DOMAINS));
          if (domains.MultiMovies)
            return String(domains.MultiMovies).replace(/\/$/, "");
        } catch (_) {
        }
        return DOMAINS5.MULTIMOVIES_FALLBACK;
      });
    }
    function metadata(tmdbId, mediaType) {
      return __async(this, null, function* () {
        const type = mediaType === "tv" ? "tv" : "movie";
        const data = JSON.parse(yield text(`${DOMAINS5.TMDB_API}/${type}/${tmdbId}?api_key=${TMDB_KEY}`));
        return { title: type === "tv" ? data.name : data.title, year: Number(String(type === "tv" ? data.first_air_date : data.release_date).slice(0, 4)) || null };
      });
    }
    var clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    var normalized = (value) => clean(value).toLowerCase().replace(/\(\d{4}\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    var absolute = (url, base) => {
      try {
        return new URL(url, base).toString();
      } catch (_) {
        return "";
      }
    };
    function selectResult(results, info, mediaType) {
      const target = normalized(info.title);
      return results.find((item) => {
        const name = normalized(item.title);
        const correctType = mediaType === "tv" ? /\/tvshows\//i.test(item.url) : /\/movies\//i.test(item.url);
        return correctType && (name === target || name.startsWith(`${target} `)) && (!info.year || item.text.includes(String(info.year)) || name === target);
      }) || results.find((item) => normalized(item.title) === target) || null;
    }
    function playerEmbeds(pageUrl) {
      return __async(this, null, function* () {
        const html = yield text(pageUrl, { headers: { Referer: new URL(pageUrl).origin } });
        const $ = cheerio3.load(html);
        const options = $("#playeroptionsul li").toArray().map((item) => ({
          post: $(item).attr("data-post"),
          nume: $(item).attr("data-nume"),
          type: $(item).attr("data-type"),
          label: clean($(item).text())
        })).filter((item) => item.post && item.nume && !/trailer/i.test(`${item.nume} ${item.label}`));
        return mapConcurrent3(options, 4, (item) => __async(this, null, function* () {
          try {
            const origin = new URL(pageUrl).origin;
            const response = yield fetch(`${origin}/wp-admin/admin-ajax.php`, {
              method: "POST",
              headers: __spreadProps(__spreadValues({}, HEADERS2), { Referer: pageUrl, "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" }),
              body: new URLSearchParams({ action: "doo_player_ajax", post: item.post, nume: item.nume, type: item.type || "" }).toString()
            });
            const data = yield response.json();
            const $embed = cheerio3.load((data == null ? void 0 : data.embed_url) || "");
            return { url: absolute($embed("iframe").attr("src") || (data == null ? void 0 : data.embed_url), pageUrl), label: item.label };
          } catch (_) {
            return null;
          }
        })).then((items) => items.filter((item) => (item == null ? void 0 : item.url) && !/youtube/i.test(item.url)));
      });
    }
    function mirrorCandidates(embed, pageUrl) {
      return __async(this, null, function* () {
        try {
          const response = yield fetch(embed.url, { redirect: "follow", headers: __spreadProps(__spreadValues({}, HEADERS2), { Referer: pageUrl }) });
          const finalUrl = response.url || embed.url;
          const slug = new URL(embed.url).pathname.split("/").filter(Boolean).pop();
          if (!slug)
            return [];
          const helper = yield fetch(`${new URL(finalUrl).origin}/embedhelper2.php`, {
            method: "POST",
            headers: __spreadProps(__spreadValues({}, HEADERS2), { Referer: finalUrl, "Content-Type": "application/x-www-form-urlencoded" }),
            body: new URLSearchParams({ sid: slug, UserFavSite: "", currentDomain: new URL(pageUrl).hostname }).toString()
          });
          const data = yield helper.json();
          const ids = JSON.parse(atob(data.mresult || ""));
          return Object.entries(data.sources || {}).flatMap(([key, source]) => {
            const id = ids[key];
            if (!id || !source.siteUrl)
              return [];
            const origin = new URL(source.siteUrl).origin;
            if (!/rpmhub\.site|p2pplay\.pro|uns\.bio/i.test(origin))
              return [];
            return [{
              provider: "MultiMovies",
              source: `MultiMovies ${source.friendlyName || key}`,
              quality: "Unknown",
              url: `${origin}/#${id}`,
              referer: finalUrl,
              pageUrl,
              headers: __spreadProps(__spreadValues({}, HEADERS2), { Referer: `${origin}/#${id}` }),
              resolverType: "multimovies_api"
            }];
          });
        } catch (_) {
          return [];
        }
      });
    }
    function discoverCandidates2(tmdbId, mediaType, season = 1, episode = 1) {
      return __async(this, null, function* () {
        if (!tmdbId || !["movie", "tv"].includes(mediaType))
          return [];
        try {
          const [base, info] = yield Promise.all([getBaseUrl(), metadata(tmdbId, mediaType)]);
          const searchHtml = yield text(`${base}/?s=${encodeURIComponent(info.title)}`, { headers: { Referer: base } });
          const $ = cheerio3.load(searchHtml);
          const results = $("div.result-item, article").toArray().map((item) => ({
            title: clean($(item).find(".title,h2,h3").first().text()),
            text: clean($(item).text()),
            url: absolute($(item).find("a").first().attr("href"), base)
          })).filter((item) => item.title && item.url);
          const selected = selectResult(results, info, mediaType);
          if (!selected)
            return [];
          let pageUrl = selected.url;
          if (mediaType === "tv") {
            const detail = cheerio3.load(yield text(pageUrl, { headers: { Referer: base } }));
            const target = detail("#seasons ul.episodios li").toArray().find((item) => {
              const href = detail(item).find("a").attr("href") || "";
              const marker = href.match(/-(\d+)x(\d+)\/?$/i);
              return marker && Number(marker[1]) === Number(season) && Number(marker[2]) === Number(episode);
            });
            pageUrl = absolute(target && detail(target).find("a").attr("href"), selected.url);
            if (!pageUrl)
              return [];
          }
          const embeds = yield playerEmbeds(pageUrl);
          const groups = yield mapConcurrent3(embeds, 3, (embed) => mirrorCandidates(embed, pageUrl));
          const seen = /* @__PURE__ */ new Set();
          return groups.flat().filter((item) => !seen.has(item.url) && seen.add(item.url));
        } catch (error) {
          console.log(`[MultiMovies Candidates] ${(error == null ? void 0 : error.message) || error}`);
          return [];
        }
      });
    }
    function decryptApi(hex) {
      const bytes = CryptoJS.AES.decrypt({ ciphertext: CryptoJS.enc.Hex.parse(String(hex).trim()) }, API_KEY, { iv: API_IV, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8).replace(/[\u0000-\u001f]+$/g, ""));
    }
    function resolveCandidate2(candidate) {
      return __async(this, null, function* () {
        if (!(candidate == null ? void 0 : candidate.url) || candidate.resolverType !== "multimovies_api")
          return [];
        try {
          const parsed = new URL(candidate.url);
          const id = parsed.hash.slice(1).split("&")[0];
          if (!id)
            return [];
          const apiUrl = `${parsed.origin}/api/v1/video?id=${encodeURIComponent(id)}&w=1920&h=1080&r=${encodeURIComponent(new URL(candidate.pageUrl).hostname)}`;
          const payload = decryptApi(yield text(apiUrl, { headers: { Referer: candidate.url } }));
          const mediaUrl = payload.cfNative || payload.source;
          if (!/^https?:\/\//i.test(mediaUrl || ""))
            return [];
          const attributes = parseMediaAttributes(payload.title, mediaUrl);
          const subtitles = Object.entries(payload.subtitle || {}).map(([language, url]) => ({ language, url: absolute(String(url).split("#")[0], parsed.origin) })).filter((item) => item.url);
          return [{
            provider: "MultiMovies",
            source: candidate.source,
            name: `MultiMovies \u2022 ${attributes.quality} \u2022 ${candidate.source.replace(/^MultiMovies\s*/i, "")}`,
            url: mediaUrl,
            quality: attributes.quality,
            headers: __spreadProps(__spreadValues({}, HEADERS2), { Referer: parsed.origin }),
            subtitles,
            seekable: true
          }];
        } catch (_) {
          return [];
        }
      });
    }
    function getStreams3(tmdbId, mediaType, season = 1, episode = 1) {
      return __async(this, null, function* () {
        const candidates = yield discoverCandidates2(tmdbId, mediaType, season, episode);
        const streams = yield mapConcurrent3(candidates, 4, resolveCandidate2);
        return uniqueExactStreams3(streams.flat().filter(Boolean));
      });
    }
    module2.exports = { discoverCandidates: discoverCandidates2, resolveCandidate: resolveCandidate2, getStreams: getStreams3 };
  }
});

// src/providers/streamplay.js
var { getStreams: getCastleStreams } = require_castle();
var vegaModule = require_vegamovies();
var movies4uModule = require_movies4u();
var fourkHDHubModule = require_fourkHDhub();
var multiMoviesModule = require_multimovies();
var mdModule = (init_moviesdrive(), __toCommonJS(moviesdrive_exports));
var { mapConcurrent: mapConcurrent2, uniqueExactStreams: uniqueExactStreams2 } = require_streams();
var DOMAINS4 = require_domains();
var WORKER_BASE = DOMAINS4.WORKER;
function fetchWorkerData(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const url = `${WORKER_BASE}/streams?tmdbId=${encodeURIComponent(tmdbId)}&type=${encodeURIComponent(mediaType)}&season=${encodeURIComponent(season || 1)}&episode=${encodeURIComponent(episode || 1)}`;
      const response = yield fetch(url, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok)
        return null;
      const data = yield response.json();
      if (!data || !Array.isArray(data.directStreams) || !Array.isArray(data.candidates)) {
        return null;
      }
      return data;
    } catch (_) {
      return null;
    }
  });
}
function resolveDeviceCandidate(candidate) {
  return __async(this, null, function* () {
    var _a, _b, _c, _d, _e;
    if (!candidate || !candidate.url)
      return [];
    const mdResolver = mdModule.resolveCandidate || ((_a = mdModule.default) == null ? void 0 : _a.resolveCandidate);
    const vegaResolver = vegaModule.resolveCandidate || ((_b = vegaModule.default) == null ? void 0 : _b.resolveCandidate);
    const movies4uResolver = movies4uModule.resolveCandidate || ((_c = movies4uModule.default) == null ? void 0 : _c.resolveCandidate);
    const fourkHDHubResolver = fourkHDHubModule.resolveCandidate || ((_d = fourkHDHubModule.default) == null ? void 0 : _d.resolveCandidate);
    const multiMoviesResolver = multiMoviesModule.resolveCandidate || ((_e = multiMoviesModule.default) == null ? void 0 : _e.resolveCandidate);
    try {
      if (candidate.provider === "Movies4u") {
        if (typeof movies4uResolver === "function") {
          const res = yield movies4uResolver(candidate);
          return Array.isArray(res) ? res : [];
        }
        return [];
      }
      if (candidate.provider === "4KHDHub") {
        if (typeof fourkHDHubResolver === "function") {
          const res = yield fourkHDHubResolver(candidate);
          return Array.isArray(res) ? res : [];
        }
        return [];
      }
      if (candidate.provider === "MultiMovies") {
        if (typeof multiMoviesResolver === "function") {
          const res = yield multiMoviesResolver(candidate);
          return Array.isArray(res) ? res : [];
        }
        return [];
      }
      const isMoviesDriveTarget = candidate.provider === "MoviesDrive" || /hubcloud|gdflix|gdlink/i.test(candidate.url) || candidate.resolverType === "hubcloud" || candidate.resolverType === "gdflix";
      if (isMoviesDriveTarget) {
        if (typeof mdResolver === "function") {
          const res = yield mdResolver(candidate);
          return Array.isArray(res) ? res : [];
        }
        return [];
      }
      const isVegaTarget = candidate.provider === "vegamovies" || /vcloud|fastdl/i.test(candidate.url) || candidate.resolverType === "vcloud" || candidate.resolverType === "fastdl";
      if (isVegaTarget) {
        if (typeof vegaResolver === "function") {
          const res = yield vegaResolver(candidate);
          return Array.isArray(res) ? res : [];
        }
        return [];
      }
      if (candidate.resolverType === "direct") {
        return [{
          name: candidate.name || `${candidate.provider || "StreamPlay"} \u2022 ${candidate.quality || "Unknown"} \u2022 ${candidate.source || "Direct"}`,
          url: candidate.url,
          quality: candidate.quality || "Unknown",
          headers: candidate.headers || {},
          provider: candidate.provider || "StreamPlay",
          source: candidate.source || "Direct",
          subtitles: []
        }];
      }
      return [];
    } catch (_) {
      return [];
    }
  });
}
function runLocalDiscoveryFallback(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const discoverVega = vegaModule.discoverCandidates || ((_a = vegaModule.default) == null ? void 0 : _a.discoverCandidates);
    const getVega = vegaModule.getStreams || ((_b = vegaModule.default) == null ? void 0 : _b.getStreams);
    const discoverMovies4u = movies4uModule.discoverCandidates || ((_c = movies4uModule.default) == null ? void 0 : _c.discoverCandidates);
    const getMovies4u = movies4uModule.getStreams || ((_d = movies4uModule.default) == null ? void 0 : _d.getStreams);
    const discover4KHDHub = fourkHDHubModule.discoverCandidates || ((_e = fourkHDHubModule.default) == null ? void 0 : _e.discoverCandidates);
    const get4KHDHub = fourkHDHubModule.getStreams || ((_f = fourkHDHubModule.default) == null ? void 0 : _f.getStreams);
    const discoverMultiMovies = multiMoviesModule.discoverCandidates || ((_g = multiMoviesModule.default) == null ? void 0 : _g.discoverCandidates);
    const getMultiMovies = multiMoviesModule.getStreams || ((_h = multiMoviesModule.default) == null ? void 0 : _h.getStreams);
    const discoverMD = mdModule.discoverCandidates || ((_i = mdModule.default) == null ? void 0 : _i.discoverCandidates);
    const getMD = mdModule.getStreams || ((_j = mdModule.default) == null ? void 0 : _j.getStreams);
    const [castleResult, vegaResult, mdResult, movies4uResult, fourkHDHubResult, multiMoviesResult] = yield Promise.allSettled([
      typeof getCastleStreams === "function" ? getCastleStreams(tmdbId, mediaType, season, episode) : Promise.resolve([]),
      typeof discoverVega === "function" ? discoverVega(tmdbId, mediaType, season, episode) : typeof getVega === "function" ? getVega(tmdbId, mediaType, season, episode) : Promise.resolve([]),
      typeof discoverMD === "function" ? discoverMD(tmdbId, mediaType, season, episode) : typeof getMD === "function" ? getMD(tmdbId, mediaType, season, episode) : Promise.resolve([]),
      typeof discoverMovies4u === "function" ? discoverMovies4u(tmdbId, mediaType, season, episode) : typeof getMovies4u === "function" ? getMovies4u(tmdbId, mediaType, season, episode) : Promise.resolve([]),
      typeof discover4KHDHub === "function" ? discover4KHDHub(tmdbId, mediaType, season, episode) : typeof get4KHDHub === "function" ? get4KHDHub(tmdbId, mediaType, season, episode) : Promise.resolve([]),
      typeof discoverMultiMovies === "function" ? discoverMultiMovies(tmdbId, mediaType, season, episode) : typeof getMultiMovies === "function" ? getMultiMovies(tmdbId, mediaType, season, episode) : Promise.resolve([])
    ]);
    const castleStreams = castleResult.status === "fulfilled" && Array.isArray(castleResult.value) ? castleResult.value.map((s) => __spreadProps(__spreadValues({}, s), { provider: "castle", source: s.source || s.name || "Castle" })) : [];
    let vegaStreams = [];
    if (vegaResult.status === "fulfilled" && Array.isArray(vegaResult.value)) {
      if (typeof discoverVega === "function") {
        const resolved = yield mapConcurrent2(vegaResult.value, 4, resolveDeviceCandidate);
        vegaStreams = resolved.flat().filter(Boolean);
      } else {
        vegaStreams = vegaResult.value.map((s) => __spreadProps(__spreadValues({}, s), { provider: "vegamovies" }));
      }
    }
    let mdStreams = [];
    if (mdResult.status === "fulfilled" && Array.isArray(mdResult.value)) {
      if (typeof discoverMD === "function") {
        const resolved = yield mapConcurrent2(mdResult.value, 4, resolveDeviceCandidate);
        mdStreams = resolved.flat().filter(Boolean);
      } else {
        mdStreams = mdResult.value.map((s) => __spreadProps(__spreadValues({}, s), { provider: "MoviesDrive" }));
      }
    }
    let movies4uStreams = [];
    if (movies4uResult.status === "fulfilled" && Array.isArray(movies4uResult.value)) {
      if (typeof discoverMovies4u === "function") {
        const resolved = yield mapConcurrent2(movies4uResult.value, 4, resolveDeviceCandidate);
        movies4uStreams = resolved.flat().filter(Boolean);
      } else {
        movies4uStreams = movies4uResult.value.map((s) => __spreadProps(__spreadValues({}, s), { provider: "Movies4u" }));
      }
    }
    let fourkHDHubStreams = [];
    if (fourkHDHubResult.status === "fulfilled" && Array.isArray(fourkHDHubResult.value)) {
      if (typeof discover4KHDHub === "function") {
        const resolved = yield mapConcurrent2(fourkHDHubResult.value, 4, resolveDeviceCandidate);
        fourkHDHubStreams = resolved.flat().filter(Boolean);
      } else {
        fourkHDHubStreams = fourkHDHubResult.value.map((s) => __spreadProps(__spreadValues({}, s), { provider: "4KHDHub" }));
      }
    }
    let multiMoviesStreams = [];
    if (multiMoviesResult.status === "fulfilled" && Array.isArray(multiMoviesResult.value)) {
      if (typeof discoverMultiMovies === "function") {
        const resolved = yield mapConcurrent2(multiMoviesResult.value, 4, resolveDeviceCandidate);
        multiMoviesStreams = resolved.flat().filter(Boolean);
      } else {
        multiMoviesStreams = multiMoviesResult.value.map((s) => __spreadProps(__spreadValues({}, s), { provider: "MultiMovies" }));
      }
    }
    return [...castleStreams, ...vegaStreams, ...mdStreams, ...movies4uStreams, ...fourkHDHubStreams, ...multiMoviesStreams];
  });
}
function getStreams2(tmdbId, mediaType, season = 1, episode = 1) {
  return __async(this, null, function* () {
    var _a, _b, _c;
    if (!tmdbId || mediaType !== "movie" && mediaType !== "tv")
      return [];
    if (mediaType === "tv" && (!season || !episode))
      return [];
    const workerData = yield fetchWorkerData(tmdbId, mediaType, season, episode);
    let rawStreams = [];
    if (workerData) {
      const directStreams = (workerData.directStreams || []).map((s) => __spreadProps(__spreadValues({}, s), {
        provider: s.provider || "castle",
        source: s.source || s.name || "Castle"
      }));
      const resolutionJob = mapConcurrent2(workerData.candidates || [], 16, resolveDeviceCandidate);
      const providerFallbackJobs = [];
      const workerReported4KHDHub = workerData.providers && Object.prototype.hasOwnProperty.call(workerData.providers, "4khdhub");
      const worker4KCount = Number(((_b = (_a = workerData.providers) == null ? void 0 : _a["4khdhub"]) == null ? void 0 : _b.count) || 0);
      if (workerReported4KHDHub && worker4KCount === 0) {
        const discover4KHDHub = fourkHDHubModule.discoverCandidates || ((_c = fourkHDHubModule.default) == null ? void 0 : _c.discoverCandidates);
        if (typeof discover4KHDHub === "function") {
          try {
            providerFallbackJobs.push((() => __async(this, null, function* () {
              const localCandidates = yield discover4KHDHub(tmdbId, mediaType, season, episode);
              const localResolved = yield mapConcurrent2(localCandidates, 4, resolveDeviceCandidate);
              return localResolved.flat().filter(Boolean);
            }))().catch(() => []));
          } catch (_) {
          }
        }
      }
      const [resolvedCandidates, fallbackGroups] = yield Promise.all([
        resolutionJob,
        Promise.all(providerFallbackJobs)
      ]);
      rawStreams = [
        ...directStreams,
        ...resolvedCandidates.flat().filter(Boolean),
        ...fallbackGroups.flat().filter(Boolean)
      ];
    } else {
      rawStreams = yield runLocalDiscoveryFallback(tmdbId, mediaType, season, episode);
    }
    return uniqueExactStreams2(rawStreams);
  });
}
module.exports = { getStreams: getStreams2, WORKER_BASE, fetchWorkerData, resolveDeviceCandidate, runLocalDiscoveryFallback };
