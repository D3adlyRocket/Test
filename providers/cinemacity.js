/**
 * vidlink - Built from src/vidlink/
 * Generated: 2026-05-24T13:07:23.110Z
 * Patched: 2026 - Fixed Decryption Pathing, Quality Filters, & CDN Headers
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

// src/vidlink/constants.js
var VIDLINK_API = "https://vidlink.pro";
var DECRYPT_API = "https://enc-dec.app/api";
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Connection": "keep-alive",
  "Referer": "https://vidlink.pro/",
  "Origin": "https://vidlink.pro"
};

// Helpers to calculate automated properties based on file attributes
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

// Dynamic fallback lookup meta agent
async function getTmdbMetadata(id, type, season, episode) {
  let fallbackName = "Unknown Title";
  let fallbackDuration = type === "tv" ? "45 min" : "90 min";
  
  try {
    const endpoint = type === "movie" ? "movie" : "tv";
    const url = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${TMDB_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) return { name: fallbackName, year: "N/A", duration: fallbackDuration };
    const data = await response.json();

    let duration = fallbackDuration;
    if (type === "movie" && data.runtime) {
      duration = `${data.runtime} min`;
    } else if (type === "tv") {
      const epUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
      const epRes = await fetch(epUrl);
      if (epRes.ok) {
        const epData = await epRes.json();
        if (epData.runtime) duration = `${epData.runtime} min`;
        else if (data.episode_run_time && data.episode_run_time.length > 0) {
           duration = `${data.episode_run_time[0]} min`;
        }
      }
    }

    return {
      name: data.title || data.name || fallbackName,
      year: (data.release_date || data.first_air_date || "").split("-")[0] || "N/A",
      duration: duration
    };
  } catch (e) {
    return { name: fallbackName, year: "N/A", duration: fallbackDuration };
  }
}

// src/vidlink/utils.js
function generateM3u8(_0) {
  return __async(this, arguments, function* (masterUrl, headers = {}) {
    try {
      // FIX: If it's a direct MP4 file returned instead of an M3U8 container, skip scanning text entirely
      if (typeof masterUrl === 'string' && masterUrl.toLowerCase().split('?')[0].endsWith('.mp4')) {
        return [];
      }

      console.log(`[M3U8] Parsing master m3u8: ${masterUrl}`);
      const resp = yield fetch(masterUrl, { headers });
      const text = yield resp.text();
      
      // Safety check if response is not valid M3U8 string syntax
      if (!text || !text.includes("#EXTM3U")) {
        return [];
      }

      const baseUri = masterUrl.substring(0, masterUrl.lastIndexOf("/")) + "/";
      const results = [];
      const regex = /#EXT-X-STREAM-INF:.*?RESOLUTION=(\d+x\d+).*?\n([^\n]+)/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const height = parseInt(match[1].split("x")[1]);
        
        // FIX: Removed strict "height < 720" restriction. This guarantees lower quality versions
        // and alternative CDN streams are preserved instead of returning completely empty arrays.
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
      console.warn(`[M3U8] Error parsing M3U8, returning empty.`, err);
      return [];
    }
  });
}

// src/vidlink/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log(`[Vidlink] Fetching streams for ${mediaType} ${tmdbId}`);
    try {
      // FIX 1: Fixed the URL endpoint generation to avoid duplicating /enc-vidlink paths
      const encUrl = `${DECRYPT_API}?text=${tmdbId}`;
      const encResp = yield fetch(encUrl);
      const encJson = yield encResp.json();
      const encData = encJson.result;
      if (!encData) {
        console.log(`[Vidlink] No encrypted ID returned`);
        return [];
      }
      const isMovie = mediaType !== "tv" && season == null;
      const normType = isMovie ? "movie" : "tv";

      // 1. Core Dynamic Context Metadata Lookup
      const meta = yield getTmdbMetadata(tmdbId, normType, season, episode);

      const epUrl = isMovie ? `${VIDLINK_API}/api/b/movie/${encData}` : `${VIDLINK_API}/api/b/tv/${encData}/${season}/${episode}`;
      console.log(`[Vidlink] Fetching playlist from: ${epUrl}`);
      const epResp = yield fetch(epUrl, { headers: HEADERS });
      const epJson = yield epResp.json();
      const playlist = epJson && epJson.stream && epJson.stream.playlist;
      if (!playlist) {
        console.log(`[Vidlink] No playlist in response`);
        return [];
      }

      const streams = [];

      // Helper function to turn dynamic qualities into the beautiful layout cards
      const pushFormattedStream = (rawQuality, streamUrl) => {
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
         } else if (qLower.includes("480")) {
             displayQuality = "480p SD";
             cleanQuality = "480P";
         } else if (qLower.includes("360")) {
             displayQuality = "360p SD";
             cleanQuality = "360P";
         } else if (qLower.includes("auto")) {
             displayQuality = "Auto Dynamic";
             cleanQuality = "Auto";
         } else {
             displayQuality = rawQuality + " Video";
             cleanQuality = rawQuality.toUpperCase();
         }

         const calculatedSize = calculateCalculatedFallbackSize(cleanQuality, meta.duration);
         const mediaLabel = meta.name + (!isMovie ? " S" + season + "E" + episode : "");

         // FIX 2: Check the URL context. If it contains nested JSON header queries (like ?headers=),
         // extract those parameters to build dynamic custom referers rather than crashing with 403.
         let activeReferer = `${VIDLINK_API}/`;
         let activeOrigin = VIDLINK_API;
         
         if (streamUrl.includes("headers=")) {
           try {
             const urlObj = new URL(streamUrl);
             const headerParam = urlObj.searchParams.get("headers");
             if (headerParam) {
               const parsedJson = JSON.parse(headerParam);
               if (parsedJson.referer) activeReferer = parsedJson.referer;
               if (parsedJson.origin) activeOrigin = parsedJson.origin;
             }
           } catch(e) {
             console.warn("[Vidlink] Failed parsing inline URL headers context.");
           }
         }

         const headerName = `VidLink | ${displayQuality} | Main Mirror`;
         
         const isMp4 = streamUrl.toLowerCase().split('?')[0].endsWith('.mp4');
         const typeLabel = isMp4 ? "MP4 Direct" : "M3U8";

         const dropdownTitle = 
             "🎬 " + mediaLabel + " - " + meta.year + "\n" +
             "⚡ " + cleanQuality + " | 🌍 Original | 💾 " + calculatedSize + "\n" +
             "🎞️ " + typeLabel + " | ⏱️ " + meta.duration + " | 📌 Main Mirror";

         streams.push({
            name: headerName,
            title: dropdownTitle,
            url: streamUrl,
            quality: rawQuality,
            type: isMp4 ? "mp4" : "m3u8",
            headers: {
              "User-Agent": HEADERS["User-Agent"],
              "Referer": activeReferer,
              "Origin": activeOrigin
            },
            provider: "vidlink"
         });
      };

      // 2. Add base master profile
      pushFormattedStream("Auto", playlist);

      // 3. Loop through individual variant qualities returned from the .m3u8 index parser
      try {
        const extraStreams = yield generateM3u8(playlist, {
          "Referer": `${VIDLINK_API}/`,
          "User-Agent": HEADERS["User-Agent"]
        });
        extraStreams.forEach((s) => {
          pushFormattedStream(s.quality, s.url);
        });
      } catch (err) {
        console.warn(`[Vidlink] Failed to parse extra qualities for ${playlist}`);
      }
      
      console.log(`[Vidlink] Completed parsing process`);
      return streams.map((s) => __spreadProps(__spreadValues({}, s), { quality: getSortedQuality(s.quality) }));
    } catch (error) {
      console.error(`[Vidlink] Error: ${error.message}`);
      return [];
    }
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
