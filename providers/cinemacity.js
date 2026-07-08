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
  } else if (lowQuality === "auto" || lowQuality === "multi") {
    qualityBadge = "🛸 Multi-Res";
  }

  const durationStr = mediaInfo.runtime || "90 min";
  const containerFormat = streamUrl.includes(".m3u8") ? "📡 M3U8" : "🎞️ MP4";
  const providerEmoji = getProviderEmoji(cleanServer);
  const yearStr = mediaInfo.year ? `(${mediaInfo.year})` : "N/A";

  let line1 = `🎬 ${mediaInfo.title || "Unknown"} - ${yearStr}`;
  if (seasonNum && episodeNum) {
    line1 += ` | S${seasonNum}E${episodeNum}`;
  }

  return line1 + "\n" +
         qualityBadge + " | 🌍 Original Audio | 🎧 AAC\n" +
         containerFormat + " | ⚡ Adaptive HLS | ⏱️ " + durationStr + "\n" +
         providerEmoji + " " + cleanServer + " | 🔗 Provider: VidRock";
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
      
      let itemId = (mediaType === "tv" && seasonNum && episodeNum) ? `${tmdbId}_${seasonNum}_${episodeNum}` : tmdbId.toString();
      const apiUrl = `${VIDROCK_BASE_URL}/api/${mediaType}/${itemId}`;

      console.log(`[Vidrock] Querying URL: ${apiUrl}`);
      const response = yield fetch(apiUrl, { headers: WORKING_HEADERS });
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

      const streams = [];
      if (data && typeof data === "object") {
        if (data.error) {
          console.error(`[Vidrock] API error returned: ${data.error}`);
          return [];
        }
        
        for (const serverName of Object.keys(data)) {
          const source = data[serverName];
          if (!source || !source.url) continue;

          let rawToken = source.url;
          if (rawToken.includes("%")) {
            try { rawToken = decodeURIComponent(rawToken); } catch (e) {}
          }

          // Dynamically map the raw server token to the active Cloudflare Multi-Quality Edge proxy worker
          let finalStreamUrl;
          if (serverName.toLowerCase().includes("astra")) {
            finalStreamUrl = `https://shy-smoke-85df.xxw8bjzldt.workers.dev/file1/${rawToken}/master.m3u8`;
          } else if (serverName.toLowerCase().includes("atlas")) {
            finalStreamUrl = `https://white-sun-5f88.3-97e.workers.dev/movie/${rawToken}/index.m3u8`;
          } else {
            // Generic Fallback structure observed in the routing table
            finalStreamUrl = `https://shy-smoke-85df.xxw8bjzldt.workers.dev/file1/${rawToken}/master.m3u8`;
          }

          const dropdownTitle = buildDropdownMetadata(serverName, "Multi", mediaInfo, seasonNum, episodeNum, finalStreamUrl);
          let cleanServer = String(serverName).replace(/\s*(1080p\s+)?server\s*2\s*$/gi, "").trim();
          const pEmoji = getProviderEmoji(cleanServer);

          streams.push({
            name: `🪨 VidRock | Adaptive | ${pEmoji} [${cleanServer}]`,
            title: dropdownTitle,
            size: dropdownTitle,
            description: dropdownTitle,
            url: finalStreamUrl,
            quality: "1080p", // Sets the highest fallback display property for application views
            language: "English",
            headers: PLAYBACK_HEADERS,
            provider: "vidrock",
            _serverKey: serverName,
            _rawQuality: "Adaptive"
          });
        }
      }

      // De-duplicate URLs if multiple identical providers map to the same backend path
      const uniqueStreams = [];
      const seenUrls = new Set();
      streams.forEach((stream) => {
        if (!seenUrls.has(stream.url)) {
          seenUrls.add(stream.url);
          uniqueStreams.push(stream);
        }
      });

      console.log(`[Vidrock] Total stream sources compiled: ${uniqueStreams.length}`);
      return uniqueStreams;
    } catch (error) {
      console.error(`[Vidrock] Error in getStreams execution: ${error.message}`);
      return [];
    }
  });
}

module.exports = { getStreams };
