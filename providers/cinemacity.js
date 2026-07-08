/**
 * vidrock - Built from src/vidrock/
 * Generated: 2026-07-08
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

// Primary CORS gateway to bypass perimeter cloud blocks natively
var PROXY_URL = "https://corsproxy.io/?";

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
  "Origin": "https://vidrock.ru",
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site"
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

function parseM3U8Qualities(masterUrl, serverName, mediaInfo, seasonNum, episodeNum) {
  return __async(this, null, function* () {
    try {
      // Fetch through proxy handler to isolate authentication loops
      const targetUrl = masterUrl.startsWith("http") ? `${PROXY_URL}${encodeURIComponent(masterUrl)}` : masterUrl;
      const res = yield fetch(targetUrl, { headers: PLAYBACK_HEADERS });
      if (!res.ok) return [];
      
      const text = yield res.text();
      const streams = [];
      const lines = text.split("\n");
      const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("#EXT-X-STREAM-INF")) {
          let quality = "Adaptive";
          const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
          if (resMatch) quality = `${resMatch[1]}p`;

          const nextLine = lines[i + 1] ? lines[i + 1].trim() : "";
          if (nextLine && !nextLine.startsWith("#")) {
            const finalUrl = nextLine.startsWith("http") ? nextLine : `${baseUrl}${nextLine}`;
            const dropdownTitle = buildDropdownMetadata(serverName, quality, mediaInfo, seasonNum, episodeNum, finalUrl);
            let cleanServer = String(serverName).replace(/\s*(1080p\s+)?server\s*2\s*$/gi, "").trim();
            const pEmoji = getProviderEmoji(cleanServer);

            streams.push({
              name: `🪨 VidRock | ${quality} | ${pEmoji} [${cleanServer}]`,
              title: dropdownTitle,
              size: dropdownTitle,
              description: dropdownTitle,
              url: finalUrl,
              quality: quality,
              language: "English",
              headers: PLAYBACK_HEADERS,
              provider: "vidrock",
              _serverKey: serverName,
              _rawQuality: quality
            });
          }
        }
      }

      if (streams.length === 0) {
        const dropdownTitle = buildDropdownMetadata(serverName, "Multi", mediaInfo, seasonNum, episodeNum, masterUrl);
        let cleanServer = String(serverName).replace(/\s*(1080p\s+)?server\s*2\s*$/gi, "").trim();
        streams.push({
          name: `🪨 VidRock | Multi | ${getProviderEmoji(cleanServer)} [${cleanServer}]`,
          title: dropdownTitle,
          size: dropdownTitle,
          description: dropdownTitle,
          url: masterUrl,
          quality: "1080p",
          language: "English",
          headers: PLAYBACK_HEADERS,
          provider: "vidrock",
          _serverKey: serverName,
          _rawQuality: "Multi"
        });
      }
      return streams;
    } catch (e) {
      console.error(`[Vidrock] M3U8 parse failure: ${e.message}`);
      return [];
    }
  });
}

// src/vidrock/index.js
function getStreams(tmdbId, mediaType, seasonNum = null, episodeNum = null) {
  return __async(this, null, function* () {
    console.log(`[Vidrock] Starting proxy extraction for TMDB ID: ${tmdbId}, Type: ${mediaType}`);
    try {
      const mediaInfo = yield fetchTmdbDetails(tmdbId, mediaType);
      if (!mediaInfo) return [];
      
      let itemId = (mediaType === "tv" && seasonNum && episodeNum) ? `${tmdbId}_${seasonNum}_${episodeNum}` : tmdbId.toString();
      const rawApiUrl = `${VIDROCK_BASE_URL}/api/${mediaType}/${itemId}`;
      const proxiedApiUrl = `${PROXY_URL}${encodeURIComponent(rawApiUrl)}`;

      const response = yield fetch(proxiedApiUrl, { headers: WORKING_HEADERS });
      if (!response.ok) {
        console.error(`[Vidrock] API Proxy Request failed with status ${response.status}`);
        return [];
      }
      
      const data = yield response.json();
      const streams = [];
      const m3u8Promises = [];

      if (data && typeof data === "object") {
        for (const serverName of Object.keys(data)) {
          const source = data[serverName];
          if (!source || !source.url) continue;

          let rawPath = source.url;
          if (rawPath.includes("%")) {
            try { rawPath = decodeURIComponent(rawPath); } catch (e) {}
          }

          let finalStreamUrl = rawPath;
          if (!rawPath.startsWith("http")) {
            if (serverName.toLowerCase().includes("atlas")) {
              finalStreamUrl = `https://white-sun-5f88.3-97e.workers.dev/${mediaType === "tv" ? "tv" : "movie"}/${rawPath}/index.m3u8`;
            } else {
              finalStreamUrl = `https://shy-smoke-85df.xxw8bjzldt.workers.dev/file1/${rawPath}/master.m3u8`;
            }
          }

          m3u8Promises.push(parseM3U8Qualities(finalStreamUrl, serverName, mediaInfo, seasonNum, episodeNum));
        }
      }

      if (m3u8Promises.length > 0) {
        const resolutionResults = yield Promise.all(m3u8Promises);
        resolutionResults.forEach((subList) => {
          if (subList && Array.isArray(subList)) streams.push(...subList);
        });
      }

      const uniqueStreams = [];
      const seenUrls = new Set();
      streams.forEach((stream) => {
        if (!seenUrls.has(stream.url)) {
          seenUrls.add(stream.url);
          uniqueStreams.push(stream);
        }
      });

      const getQualityValue = (qLabel) => {
        const q = String(qLabel).toLowerCase().replace(/p$/, "");
        if (q === "4k" || q === "2160") return 2160;
        if (q === "1080") return 1080;
        if (q === "720") return 720;
        if (q === "480") return 480;
        if (q === "360") return 360;
        return 0;
      };

      uniqueStreams.sort((a, b) => {
        const providerA = String(a._serverKey || "").toLowerCase();
        const providerB = String(b._serverKey || "").toLowerCase();
        if (providerA !== providerB) return providerA.localeCompare(providerB);
        return getQualityValue(b._rawQuality) - getQualityValue(a._rawQuality);
      });

      console.log(`[Vidrock] Compilation complete. Streams loaded: ${uniqueStreams.length}`);
      return uniqueStreams;
    } catch (error) {
      console.error(`[Vidrock] Global thread execution error: ${error.message}`);
      return [];
    }
  });
}

module.exports = { getStreams };
