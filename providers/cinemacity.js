/**
 * vidrock - Built from src/vidrock/
 * Generated: 2026-06-09T09:59:10.427Z
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/vidrock/constants.js
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var VIDROCK_BASE_URL = "https://vidrock.ru";
var PASSPHRASE = "x7k9mPqT2rWvY8zA5bC3nF6hJ2lK4mN9";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
var WORKING_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://vidrock.ru/",
  "Origin": "https://vidrock.ru"
};
var PLAYBACK_HEADERS = {
  "User-Agent": USER_AGENT,
  "Referer": "https://vidrock.ru/",
  "Origin": "https://vidrock.ru"
};

// src/vidrock/utils.js
var import_crypto_js = __toESM(require("crypto-js"));
function encryptVidrock(text) {
  const key = import_crypto_js.default.enc.Utf8.parse(PASSPHRASE);
  const iv = import_crypto_js.default.enc.Utf8.parse(PASSPHRASE.substring(0, 16));
  const encrypted = import_crypto_js.default.AES.encrypt(text, key, {
    iv,
    mode: import_crypto_js.default.mode.CBC,
    padding: import_crypto_js.default.pad.Pkcs7
  });
  return encrypted.toString().replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fetchTmdbDetails(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var _a;
    try {
      const endpoint = mediaType === "tv" ? "tv" : "movie";
      const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
      const res = yield fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "application/json"
        }
      });
      if (!res.ok)
        throw new Error(`TMDB HTTP ${res.status}`);
      const data = yield res.json();
      return {
        title: mediaType === "tv" ? data.name : data.title,
        year: (mediaType === "tv" ? data.first_air_date : data.release_date || "").substring(0, 4),
        imdbId: ((_a = data.external_ids) == null ? void 0 : _a.imdb_id) || null,
        runtime: data.runtime ? `${data.runtime} min` : (mediaType === "tv" ? "45 min" : "90 min")
      };
    } catch (e) {
      console.error(`[Vidrock] TMDB Fetch Error: ${e.message}`);
      return null;
    }
  });
}
function extractQuality(url) {
  if (!url)
    return "Unknown";
  const qualityPatterns = [
    /(\d{3,4})p/i,
    /(\d{3,4})k/i,
    /quality[_-]?(\d{3,4})/i,
    /res[_-]?(\d{3,4})/i,
    /(\d{3,4})x\d{3,4}/i
  ];
  for (const pattern of qualityPatterns) {
    const match = url.match(pattern);
    if (match) {
      const qualityNum = parseInt(match[1]);
      if (qualityNum >= 240 && qualityNum <= 4320) {
        return `${qualityNum}p`;
      }
    }
  }
  if (url.includes("1080") || url.includes("1920"))
    return "1080p";
  if (url.includes("720") || url.includes("1280"))
    return "720p";
  if (url.includes("480") || url.includes("854"))
    return "480p";
  if (url.includes("360") || url.includes("640"))
    return "360p";
  if (url.includes("240") || url.includes("426"))
    return "240p";
  return "Unknown";
}

function getProviderEmoji(serverName) {
  const nameLower = String(serverName).toLowerCase();
  if (nameLower.includes("astra")) return "🪐";
  if (nameLower.includes("atlas")) return "🌀";
  if (nameLower.includes("orion")) return "🎯";
  return "🌍";
}

function buildDropdownMetadata(serverName, qualityLabel, mediaInfo, seasonNum, episodeNum, streamUrl) {
  let cleanServer = String(serverName).replace(/\s*(1080p\s+)?server\s*2\s*$/gi, "").trim();
  let normalizedQuality = qualityLabel.toLowerCase().trim() === "auto" ? "Auto" : qualityLabel;
  
  let qualityBadge = "💎 " + normalizedQuality;
  const lowQuality = normalizedQuality.toLowerCase();
  if (lowQuality.includes("2160") || lowQuality.includes("4k")) {
    qualityBadge = "🌟 2160p";
  } else if (lowQuality.includes("1080")) {
    qualityBadge = "🚀 1080p";
  } else if (lowQuality.includes("720")) {
    qualityBadge = "🛰️ 720p";
  } else if (lowQuality === "auto") {
    qualityBadge = "🛸 Auto";
  }

  const durationStr = mediaInfo.runtime || "90 min";
  const containerFormat = streamUrl.includes(".m3u8") ? "📡 M3U8" : "🎞️ MP4";
  const providerEmoji = getProviderEmoji(cleanServer);

  return qualityBadge + " | 🌍 Original Audio | 🎧 AAC\n" +
         containerFormat + " | ⚡ x2.64 | ⏱️ " + durationStr + "\n" +
         providerEmoji + " " + cleanServer + " | 🔗 Provider: VidRock";
}

function parseAstraPlaylist(playlistUrl, serverName, mediaInfo, seasonNum, episodeNum) {
  return __async(this, null, function* () {
    try {
      console.log(`[Vidrock] Fetching Astra playlist: ${playlistUrl}`);
      const res = yield fetch(playlistUrl, { headers: PLAYBACK_HEADERS });
      if (!res.ok)
        return [];
      const data = yield res.json();
      const streams = [];
      if (Array.isArray(data)) {
        data.forEach((item) => {
          if (item.url && item.resolution) {
            let quality = `${item.resolution}p`;
            
            if (serverName.toLowerCase().includes("orion") && quality.toLowerCase().includes("unknown")) {
              quality = "1080p";
            }

            const dropdownTitle = buildDropdownMetadata(serverName, quality, mediaInfo, seasonNum, episodeNum, item.url);
            let cleanServer = String(serverName).replace(/\s*(1080p\s+)?server\s*2\s*$/gi, "").trim();
            const pEmoji = getProviderEmoji(cleanServer);

            streams.push({
              name: `🪨 VidRock | ${quality} | ${pEmoji} [${cleanServer}]`,
              title: dropdownTitle,
              size: dropdownTitle,
              description: dropdownTitle,
              url: item.url,
              quality: "", 
              language: "",
              headers: PLAYBACK_HEADERS,
              provider: "vidrock",
              _serverKey: serverName,
              _rawQuality: quality
            });
          }
        });
      }
      return streams;
    } catch (e) {
      console.error(`[Vidrock] Astra playlist parse error: ${e.message}`);
      return [];
    }
  });
}

// src/vidrock/index.js
function getStreams(tmdbId, mediaType, seasonNum = null, episodeNum = null) {
  return __async(this, null, function* () {
    console.log(`[Vidrock] Starting extraction for TMDB ID: ${tmdbId}, Type: ${mediaType}${mediaType === "tv" ? `, S:${seasonNum}E:${episodeNum}` : ""}`);
    try {
      const mediaInfo = yield fetchTmdbDetails(tmdbId, mediaType);
      if (!mediaInfo) {
        console.error("[Vidrock] Failed to fetch TMDB details.");
        return [];
      }
      console.log(`[Vidrock] TMDB Info: "${mediaInfo.title}" (${mediaInfo.year || "N/A"})`);
      let itemId;
      if (mediaType === "tv" && seasonNum && episodeNum) {
        itemId = `${tmdbId}_${seasonNum}_${episodeNum}`;
      } else {
        itemId = tmdbId.toString();
      }
      const encryptedId = encryptVidrock(itemId);
      const apiUrl = `${VIDROCK_BASE_URL}/api/${mediaType}/${encryptedId}`;
      console.log(`[Vidrock] Querying URL: ${apiUrl}`);
      const response = yield fetch(apiUrl, {
        headers: WORKING_HEADERS
      });
      if (!response.ok) {
        console.error(`[Vidrock] Request failed with HTTP ${response.status}`);
        return [];
      }
      const responseText = yield response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error(`[Vidrock] Invalid JSON response: ${responseText.substring(0, 100)}`);
        return [];
      }
      console.log(`[Vidrock] Processing API response...`);
      const streams = [];
      const astraPromises = [];
      if (data && typeof data === "object") {
        if (data.error) {
          console.error(`[Vidrock] API error returned: ${data.error}`);
          return [];
        }
        for (const serverName of Object.keys(data)) {
          const source = data[serverName];
          if (!source || !source.url)
            continue;
          let videoUrl = source.url;
          if (videoUrl.includes("%")) {
            try {
              videoUrl = decodeURIComponent(videoUrl);
            } catch (e) {
            }
          }
          if (videoUrl.includes("/playlist/")) {
            astraPromises.push(parseAstraPlaylist(videoUrl, serverName, mediaInfo, seasonNum, episodeNum));
            continue;
          }
          
          let quality = extractQuality(videoUrl);
          
          if (serverName.toLowerCase().includes("orion") && quality.toLowerCase() === "unknown") {
            quality = "1080p";
          }

          const dropdownTitle = buildDropdownMetadata(serverName, quality, mediaInfo, seasonNum, episodeNum, videoUrl);
          let cleanServer = String(serverName).replace(/\s*(1080p\s+)?server\s*2\s*$/gi, "").trim();
          const pEmoji = getProviderEmoji(cleanServer);

          streams.push({
            name: `VidRock | ${quality} | ${pEmoji} [${cleanServer}]`,
            title: dropdownTitle,
            size: dropdownTitle,
            description: dropdownTitle,
            url: videoUrl,
            quality: "", 
            language: "",
            headers: PLAYBACK_HEADERS,
            provider: "vidrock",
            _serverKey: serverName,
            _rawQuality: quality
          });
        }
      }
      if (astraPromises.length > 0) {
        const astraResults = yield Promise.all(astraPromises);
        astraResults.forEach((subList) => {
          if (subList && Array.isArray(subList)) {
            streams.push(...subList);
          }
        });
      }
      const uniqueStreams = [];
      const seenUrls = /* @__PURE__ */ new Set();
      streams.forEach((stream) => {
        if (!seenUrls.has(stream.url)) {
          seenUrls.add(stream.url);
          uniqueStreams.push(stream);
        }
      });

      const getQualityValue = (qLabel) => {
        const q = String(qLabel).toLowerCase().replace(/p$/, "");
        if (q === "4k" || q === "2160") return 2160;
        if (q === "1440") return 1440;
        if (q === "1080") return 1080;
        if (q === "720") return 720;
        if (q === "480") return 480;
        if (q === "360") return 360;
        if (q === "240") return 240;
        if (q === "auto") return -1;
        return 0;
      };

      uniqueStreams.sort((a, b) => {
        const providerA = String(a._serverKey || "").toLowerCase();
        const providerB = String(b._serverKey || "").toLowerCase();
        
        if (providerA !== providerB) {
          return providerA.localeCompare(providerB);
        }
        return getQualityValue(b._rawQuality) - getQualityValue(a._rawQuality);
      });

      console.log(`[Vidrock] Total streams found: ${uniqueStreams.length}`);
      return uniqueStreams;
    } catch (error) {
      console.error(`[Vidrock] Error in getStreams: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
