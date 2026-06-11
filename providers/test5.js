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

// Highly customized extraction layout tags to strictly fit Nuvio header matching
function extractQuality(item, overrideQuality) {
  if (overrideQuality) {
     const q = String(overrideQuality).toLowerCase();
     if (q.includes("2160") || q.includes("4k")) return "4K UHD";
     if (q.includes("1080")) return "1080p FHD";
     if (q.includes("720")) return "720p HD";
     if (q.includes("480")) return "480p SD";
     return overrideQuality;
  }
  
  const checkString = (
    (item.name || "") + " " + 
    (item.title || "") + " " + 
    (item.url || "")
  ).toLowerCase();
  
  if (checkString.includes("2160p") || checkString.includes("4k") || checkString.includes("uhd")) return "4K UHD";
  if (checkString.includes("1080p") || checkString.includes("fhd")) return "1080p FHD";
  if (checkString.includes("720p") || checkString.includes("hd")) return "720p HD";
  if (checkString.includes("480p") || checkString.includes("sd")) return "480p SD";
  
  const match = checkString.match(/(\d{3,4}p)/);
  if (match) {
     if (match[0] === "2160p") return "4K UHD";
     if (match[0] === "1080p") return "1080p FHD";
     if (match[0] === "720p") return "720p HD";
     if (match[0] === "480p") return "480p SD";
     return match[0];
  }
  
  return "1080p FHD";
}

function extractLanguage(titleText, urlText) {
  const checkString = ((titleText || "") + " " + (urlText || "")).toLowerCase();
  
  if (checkString.includes("latino") || checkString.includes("/lat/") || checkString.includes(".lat.")) return "Latino";
  if (checkString.includes("castellano") || checkString.includes("/cast/") || checkString.includes(".cast.")) return "Castellano";
  if (checkString.includes("spanish") || checkString.includes("esp")) return "Spanish";
  if (checkString.includes("english") || checkString.includes("eng")) return "English";
  if (checkString.includes("multi") || checkString.includes("dual")) return "Multi Audio";
  
  const parenMatch = checkString.match(/\(([^)]+)\)/);
  if (parenMatch) {
    return parenMatch[1].charAt(0).toUpperCase() + parenMatch[1].slice(1);
  }
  
  return "Original";
}

// Converts direct raw byte properties when direct MP4 video data blocks miss string descriptions
function extractFileSize(item) {
  const rawTitle = item.title || "";
  const sizeMatch = rawTitle.match(/(\d+(?:\.\d+)?\s*[GgMm][Bb])/);
  if (sizeMatch) {
     return sizeMatch[1].toUpperCase();
  }
  
  // Checking direct native payload size values passed from direct http responses
  const bytes = item.fileSize || (item.behaviorHints && item.behaviorHints.fileSize);
  if (bytes && !isNaN(bytes)) {
     const gb = bytes / (1024 * 1024 * 1024);
     if (gb >= 0.1) return `${gb.toFixed(1)} GB`;
     const mb = bytes / (1024 * 1024);
     return `${mb.toFixed(0)} MB`;
  }
  
  return "Dynamic Size";
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

      const pushFormattedStream = (rawItem, overrideQuality, streamUrl, variantHeaders, isM3u8) => {
         const rawTitle = rawItem.title || "";
         const cleanTitleString = cleanText(rawTitle);
         
         const finalQuality = extractQuality(rawItem, overrideQuality);
         const cleanQualityLabel = finalQuality.replace(" FHD", "").replace(" UHD", "").replace(" HD", "").replace(" SD", "").toUpperCase();
         
         const detectedLanguage = extractLanguage(cleanTitleString, streamUrl);
         const parsedSize = extractFileSize(rawItem);
         
         const mediaLabel = meta.name + (mediaType === "tv" ? " S" + season + "E" + episode : "");
         const containerFormat = isM3u8 ? "M3U8" : streamUrl.includes(".mp4") ? "MP4" : "MKV";

         // UPDATED HEADER CONFIGURATION: NoTorrent | Quality | Language
         const headerName = `NoTorrent | ${finalQuality} | ${detectedLanguage}`;
         
         const dropdownTitle = 
             "🎬 " + mediaLabel + " - " + meta.year + "\n" +
             "⚡ " + cleanQualityLabel + " | 🌍 " + detectedLanguage + " | 💾 " + parsedSize + "\n" +
             "🎞️ " + containerFormat + " | ⏱️ " + meta.duration + " | 📌 Mirror Link";

         streams.push({
            name: headerName,
            title: dropdownTitle,
            url: streamUrl,
            quality: finalQuality, // Synced completely to avoid layout leakage
            type: isM3u8 ? "m3u8" : containerFormat === "MP4" || containerFormat === "MKV" ? "video" : null,
            headers: Object.keys(variantHeaders).length > 0 ? variantHeaders : void 0,
            provider: "notorrent"
         });
      };

      for (const item of rawList) {
        if (item.externalUrl || !item.url)
          continue;
        if (item.url.includes("github.com") || item.url.includes("googleusercontent"))
          continue;
          
        const proxyHeaders = ((_b = (_a = item.behaviorHints) == null ? void 0 : _a.proxyHeaders) == null ? void 0 : _b.request) || {};
        const headers = Object.assign({}, ((_c = item.behaviorHints) == null ? void 0 : _c.headers) || {}, proxyHeaders);
        const isM3u8 = item.url.includes(".m3u8");
        
        const quality = extractQuality(item, null);
        
        pushFormattedStream(item, isM3u8 ? "Auto" : quality, item.url, headers, isM3u8);
        
        if (isM3u8) {
          try {
            const extraStreams = yield generateM3u8(item.url, headers);
            extraStreams.forEach((s) => {
               pushFormattedStream(item, s.quality, s.url, headers, true);
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
