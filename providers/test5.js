/**
 * notorrent - Built from src/notorrent/
 * Generated: 2026-05-24T13:07:23.105Z
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

// src/notorrent/constants.js
var NOTORRENT_API = "https://addon-osvh.onrender.com";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

// Helper size calculating layout engines
function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "Variable Size";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

function calculateCalculatedFallbackSize(quality, durationText) {
  const mins = parseInt(durationText) || 90;
  const norm = String(quality || "").toLowerCase();
  let bitrateKbps = 5200;
  
  if (norm.includes("4k") || norm.includes("2160")) bitrateKbps = 16000;
  else if (norm.includes("1080") || norm.includes("fhd")) bitrateKbps = 5200;
  else if (norm.includes("720") || norm.includes("hd")) bitrateKbps = 2500;
  else if (norm.includes("480") || norm.includes("sd")) bitrateKbps = 1200;

  const dynamicVariance = 0.94 + ((mins % 9) / 100);
  const calculatedBytes = ((bitrateKbps * dynamicVariance) * 1000 / 8) * (mins * 60);
  return formatBytes(calculatedBytes);
}

// src/notorrent/utils.js
function getImdbIdAndMetadata(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var _a;
    let fallbackDuration = mediaType === "tv" ? "45 min" : "90 min";
    let result = {
      imdbId: null,
      name: "Unknown Title",
      year: "N/A",
      duration: fallbackDuration
    };
    try {
      const type = mediaType === "tv" ? "tv" : "movie";
      const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
      const response = yield fetch(url);
      if (!response.ok) return result;
      const data = yield response.json();
      
      result.imdbId = ((_a = data.external_ids) == null ? void 0 : _a.imdb_id) || null;
      result.name = data.title || data.name || "Unknown Title";
      result.year = (data.release_date || data.first_air_date || "").split("-")[0] || "N/A";
      
      let duration = fallbackDuration;
      if (mediaType === "movie" && data.runtime) {
        duration = `${data.runtime} min`;
      } else if (mediaType === "tv" && season != null && episode != null) {
        const epUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
        const epRes = yield fetch(epUrl);
        if (epRes.ok) {
          const epData = yield epRes.json();
          if (epData.runtime) duration = `${epData.runtime} min`;
          else if (data.episode_run_time && data.episode_run_time.length > 0) {
             duration = `${data.episode_run_time[0]} min`;
          }
        }
      }
      result.duration = duration;
      return result;
    } catch (e) {
      console.error(`[NoTorrent] Failed obtaining IMDB mapping and metadata:`, e.message);
      return result;
    }
  });
}

function cleanText(str) {
  if (!str)
    return "";
  return str.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, "").trim();
}

function extractQuality(titleText) {
  const raw = titleText || "";
  const match = raw.match(/(\d{3,4}p)/);
  if (match)
    return match[0];
  if (raw.toUpperCase().includes("FREE"))
    return "Auto";
  return "Unknown";
}

function generateM3u8(_0) {
  return __async(this, arguments, function* (masterUrl, headers = {}) {
    try {
      console.log(`[NoTorrent] Parsing master m3u8: ${masterUrl}`);
      const resp = yield fetch(masterUrl, { headers });
      const text = yield resp.text();
      const baseUri = masterUrl.substring(0, masterUrl.lastIndexOf("/")) + "/";
      const results = [];
      const regex = /#EXT-X-STREAM-INF:.*?RESOLUTION=(\d+x\d+).*?\n([^\n]+)/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const height = parseInt(match[1].split("x")[1]);
        if (height < 720)
          continue;
        const res = height + "p";
        let url = match[2].trim();
        if (!url.startsWith("http")) {
          if (url.startsWith("/")) {
            const root = new URL(masterUrl).origin;
            url = root + url;
          } else {
            url = baseUri + url;
          }
        }
        results.push({
          quality: res,
          url
        });
      }
      return results;
    } catch (err) {
      console.warn(`[NoTorrent] Error parsing M3U8, returning empty.`, err);
      return [];
    }
  });
}

// src/notorrent/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var _a, _b, _c;
    console.log(`[NoTorrent] Searching for ${mediaType} ${tmdbId}`);
    const streams = [];
    try {
      // 1. Fetch Dynamic Context Metadata via Unified Lookup Agent
      const meta = yield getImdbIdAndMetadata(tmdbId, mediaType, season, episode);
      if (!meta.imdbId) {
        console.warn(`[NoTorrent] Failed to map IMDB ID.`);
        return [];
      }
      
      let apiUrl = `${NOTORRENT_API}/stream/movie/${meta.imdbId}.json`;
      if (mediaType === "tv" || season != null) {
        apiUrl = `${NOTORRENT_API}/stream/series/${meta.imdbId}:${season}:${episode}.json`;
      }
      
      const response = yield fetch(apiUrl);
      if (!response.ok) {
        console.warn(`[NoTorrent] API down or unreachable.`);
        return [];
      }
      const data = yield response.json();
      const rawList = data.streams || [];
      
      // Inline Stream Injector Function
      const pushFormattedStream = (rawQuality, streamUrl, headers, isM3u8) => {
         let displayQuality = "1080p FHD";
         let cleanQuality = "1080P";
         
         const qLower = String(rawQuality).toLowerCase();
         if (qLower.includes("2160") || qLower.includes("4k")) {
             displayQuality = "4K UHD";
             cleanQuality = "2160P";
         } else if (qLower.includes("1080")) {
             displayQuality = "1080p FHD";
             cleanQuality = "1080P";
         } else if (qLower.includes("720")) {
             displayQuality = "720p HD";
             cleanQuality = "720P";
         } else if (qLower.includes("auto")) {
             displayQuality = "Auto Dynamic";
             cleanQuality = "Auto";
         }

         const calculatedSize = calculateCalculatedFallbackSize(cleanQuality, meta.duration);
         const mediaLabel = meta.name + (mediaType === "tv" ? " S" + season + "E" + episode : "");
         const containerFormat = isM3u8 ? "M3U8" : streamUrl.includes(".mp4") ? "MP4" : "MKV";

         // RESOLVE DUPLICATION MATRIX: Split heading from description blocks
         const headerName = `NoTorrent | ${displayQuality} | Main Mirror`;
         
         const dropdownTitle = 
             "🎬 " + mediaLabel + " - " + meta.year + "\n" +
             "⚡ " + cleanQuality + " | 🌍 Original | 💾 " + calculatedSize + "\n" +
             "🎞️ " + containerFormat + " | ⏱️ " + meta.duration + " | 📌 Main Mirror";

         streams.push({
            name: headerName,
            title: dropdownTitle,
            url: streamUrl,
            quality: rawQuality,
            type: isM3u8 ? "m3u8" : containerFormat === "MP4" || containerFormat === "MKV" ? "video" : null,
            headers: Object.keys(headers).length > 0 ? headers : void 0,
            provider: "notorrent"
         });
      };

      for (const item of rawList) {
        if (item.externalUrl || !item.url)
          continue;
        if (item.url.includes("github.com") || item.url.includes("googleusercontent"))
          continue;
          
        const rawTitle = item.title || "";
        const cleanTitleString = cleanText(rawTitle);
        const quality = extractQuality(cleanTitleString);
        
        if (quality.toLowerCase().includes("p")) {
          const h = parseInt(quality);
          if (!isNaN(h) && h < 720)
            continue;
        }
        
        const proxyHeaders = ((_b = (_a = item.behaviorHints) == null ? void 0 : _a.proxyHeaders) == null ? void 0 : _b.request) || {};
        const headers = Object.assign({}, ((_c = item.behaviorHints) == null ? void 0 : _c.headers) || {}, proxyHeaders);
        const isM3u8 = item.url.includes(".m3u8");
        
        // 2. Add Base Profile Stream
        pushFormattedStream(isM3u8 ? "Auto" : quality, item.url, headers, isM3u8);
        
        // 3. Fallback Parse Sub-Qualities for Multi-Variant adaptive streams
        if (isM3u8) {
          try {
            const extraStreams = yield generateM3u8(item.url, headers);
            extraStreams.forEach((s) => {
               pushFormattedStream(s.quality, s.url, headers, true);
            });
          } catch (e) {
          }
        }
      }
    } catch (e) {
      console.error(`[NoTorrent] Fetch failed:`, e.message);
    }
    console.log(`[NoTorrent] Total results found: ${streams.length}`);
    return streams.map((s) => __spreadProps(__spreadValues({}, s), { quality: getSortedQuality(s.quality) }));
  });
}

function getSortedQuality(quality) {
  if (!quality)
    return "Auto";
  const q = quality.toLowerCase();
  if (q.includes("auto")) {
    return "Auto";
  }
  if (q.includes("2160") || q.includes("4k") || q.includes("uhd")) {
    return "\u200B" + quality;
  }
  if (q.includes("1080") || q.includes("fhd")) {
    return "\u200B\u200B" + quality;
  }
  if (q.includes("720") || q.includes("hd")) {
    return "\u200B\u200B\u200B" + quality;
  }
  if (q.includes("480") || q.includes("sd")) {
    return "\u200B\u200B\u200B\u200B" + quality;
  }
  if (q.includes("360")) {
    return "\u200B\u200B\u200B\u200B\u200B" + quality;
  }
  return "\u200B\u200B\u200B\u200B" + quality;
}

module.exports = { getStreams };
