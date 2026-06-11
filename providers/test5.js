/**
 * notorrent - Built from src/notorrent/
 * Generated: 2026-06-11T10:48:39.105Z
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

function extractQuality(item, overrideQuality) {
  if (overrideQuality) {
     const q = String(overrideQuality).toLowerCase();
     if (q.includes("2160") || q.includes("4k")) return "4K";
     if (q.includes("1080")) return "1080p";
     if (q.includes("720")) return "720p";
     if (q.includes("480")) return "480p";
     if (q.includes("360")) return "360p";
     return overrideQuality;
  }
  
  // Prioritize URL scan first to capture deeply nested structural resolution parameters
  const urlString = (item.url || "").toLowerCase();
  if (urlString.includes("2160p") || urlString.includes("/2160/") || urlString.includes("4k")) return "4K";
  if (urlString.includes("1080p") || urlString.includes("/1080/")) return "1080p";
  if (urlString.includes("720p") || urlString.includes("/720/")) return "720p";
  if (urlString.includes("480p") || urlString.includes("/480/")) return "480p";
  if (urlString.includes("360p") || urlString.includes("/360/")) return "360p";

  // Broad metadata fallback checking if URL is generic
  const checkString = ((item.name || "") + " " + (item.title || "")).toLowerCase();
  if (checkString.includes("2160p") || checkString.includes("4k") || checkString.includes("uhd")) return "4K";
  if (checkString.includes("1080p") || checkString.includes("fhd")) return "1080p";
  if (checkString.includes("720p") || checkString.includes("hd")) return "720p";
  if (checkString.includes("480p") || checkString.includes("sd")) return "480p";
  if (checkString.includes("360p")) return "360p";
  
  const match = urlString.match(/(\d{3,4}p)/) || checkString.match(/(\d{3,4}p)/);
  if (match) return match[0];
  
  return "Auto";
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
  
  return "Original Audio"; // Fixed: Capitalized "Audio"
}

function extractFileSize(item) {
  const checkString = ((item.url || "") + " " + (item.title || "") + " " + (item.name || ""));
  // Universal file size match regex covering both MB and GB sizes accurately inside paths
  const sizeMatch = checkString.match(/(\d+(?:\.\d+)?\s*[GgMm][Bb])/);
  if (sizeMatch) {
     return sizeMatch[1].toUpperCase();
  }
  return "Dynamic Size"; 
}

function extractReleaseInfo(item) {
  const checkString = ((item.title || "") + " " + (item.name || "") + " " + (item.url || ""));
  const tags = [];
  
  if (/web-?rip|web-?dl|bluray|hdrip/i.test(checkString)) {
    const m = checkString.match(/(web-?rip|web-?dl|bluray|hdrip)/i);
    if (m) tags.push(m[1].toUpperCase().replace('-', ''));
  }
  if (/x264|h264|x265|hevc/i.test(checkString)) {
    const m = checkString.match(/(x264|h264|x265|hevc)/i);
    if (m) tags.push(m[1].toLowerCase());
  }
  if (/5\.1|7\.1|aac|ddp/i.test(checkString)) {
    const m = checkString.match(/(5\.1|7\.1|aac|ddp)/i);
    if (m) tags.push(m[1]);
  }
  
  return tags.length > 0 ? tags.join(" • ") : "Mirror Link";
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
         const cleanQualityLabel = finalQuality.toUpperCase();
         
         const detectedLanguage = extractLanguage(cleanTitleString, streamUrl);
         const parsedSize = extractFileSize(rawItem);
         const releaseInfo = extractReleaseInfo(rawItem);
         
         const mediaLabel = meta.name + (mediaType === "tv" ? " S" + season + "E" + episode : "");
         const containerFormat = isM3u8 ? "M3U8" : streamUrl.includes(".mp4") ? "MP4" : "MKV";

         // Clean interface layout format
         const headerName = `NoTorrent | ${finalQuality} | ${detectedLanguage}`;
         
         const dropdownTitle = 
             "🎬 " + mediaLabel + " - " + meta.year + "\n" +
             "⚡ " + cleanQualityLabel + " | 🌍 " + detectedLanguage + " | 💾 " + parsedSize + "\n" +
             "🎞️ " + containerFormat + " | ⏱️ " + meta.duration + " | 📌 " + releaseInfo;

         streams.push({
            name: headerName,
            title: dropdownTitle,
            url: streamUrl,
            quality: finalQuality, 
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

// FIXED: Removed all zero-width spaces entirely to prevent header leakage anomalies
function getSortedQuality(quality) {
  if (!quality) return "Auto";
  return quality;
}

module.exports = { getStreams };
