var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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

// src/formatter.js
var require_formatter = __commonJS({
  "src/formatter.js"(exports2, module2) {
    function normalizePlaybackHeaders(headers) {
      if (!headers || typeof headers !== "object") return headers;
      const normalized = {};
      for (const [key, value] of Object.entries(headers)) {
        if (value == null) continue;
        const lowerKey = String(key).toLowerCase();
        if (lowerKey === "user-agent") normalized["User-Agent"] = value;
        else if (lowerKey === "referer" || lowerKey === "referrer") normalized["Referer"] = value;
        else if (lowerKey === "origin") normalized["Origin"] = value;
        else if (lowerKey === "accept") normalized["Accept"] = value;
        else if (lowerKey === "accept-language") normalized["Accept-Language"] = value;
        else normalized[key] = value;
      }
      return normalized;
    }
    function shouldForceNotWebReadyForPlugin(stream, providerName, headers, behaviorHints) {
      const text = [
        stream == null ? void 0 : stream.url,
        stream == null ? void 0 : stream.name,
        stream == null ? void 0 : stream.title,
        stream == null ? void 0 : stream.server,
        providerName
      ].filter(Boolean).join(" ").toLowerCase();
      if (text.includes("loadm") || text.includes("loadm.cam") || text.includes("mixdrop") || text.includes("mxcontent")) {
        return true;
      }
      return false;
    }
    function normalizeProviderId(providerName) {
      const normalized = String(providerName || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
      return normalized || void 0;
    }
     function formatStream2(stream, providerName) {
      // 1. Quality Parser
      let rawQuality = stream.quality || "1080p";
      let cleanQuality = "1080p";
      if (["2160p", "4k"].includes(rawQuality.toLowerCase())) cleanQuality = "4K";
      else if (rawQuality.toLowerCase() === "1440p") cleanQuality = "1440p";
      else if (rawQuality.toLowerCase() === "720p") cleanQuality = "720p";
      else if (["576p", "480p", "360p", "240p"].includes(rawQuality.toLowerCase())) cleanQuality = "SD";

      // 2. Audio Codec & Channels Tracker
      let audioChannels = "Stereo";
      if (cleanQuality === "4K") {
        audioChannels = "DD5.1";
      } else if (stream.url && (stream.url.includes("hq") || stream.url.includes("hevc"))) {
        audioChannels = "DD5.1";
      }

      // 3. Dynamic Multi-Language Detection Engine
      let detectedLanguages = "🌍 English 🇺🇸 • Italian 🇮🇹"; 
      let audioTypeLabel = "Dual-Audio"; 
      
      const streamUrlLower = stream.url ? stream.url.toLowerCase() : "";
      const metaTitleLower = (stream._meta_layout && stream._meta_layout.title) ? stream._meta_layout.title.toLowerCase() : "";

      // Check language profile matches
      if (metaTitleLower.includes("dhurandhar") || streamUrlLower.includes("hindi") || streamUrlLower.includes("hin")) {
        detectedLanguages = "🌍 Hindi 🇮🇳";
        audioTypeLabel = "Single-Audio";
      } else if (metaTitleLower.includes("teach you a lesson") || streamUrlLower.includes("korean") || streamUrlLower.includes("kor")) {
        detectedLanguages = "🌍 Korean 🇰🇷 • Italian 🇮🇹";
        audioTypeLabel = "Dual-Audio";
      } else if (streamUrlLower.includes("lang=it") || streamUrlLower.includes("ita") || streamUrlLower.includes("dual")) {
        detectedLanguages = "🌍 English 🇺🇸 • Italian 🇮🇹";
        audioTypeLabel = "Dual-Audio";
      } else if (streamUrlLower.includes("eng") && !streamUrlLower.includes("it")) {
        detectedLanguages = "🌍 English 🇺🇸";
        audioTypeLabel = "Single-Audio";
      }

      // 4. Clean Header Layout (Removed the word "Language")
      const nameTag = `🎦 VixSrc | ${cleanQuality} | ${audioTypeLabel}`;

      // 5. Four Line Clean Subheading Engine
      let subLine1 = `🎬 Stream`;
      if (stream._meta_layout) {
        if (stream._meta_layout.type === "movie") {
          const yearPart = stream._meta_layout.year ? ` - ${stream._meta_layout.year}` : "";
          subLine1 = `🎬 ${stream._meta_layout.title}${yearPart}`;
        } else if (stream._meta_layout.type === "tv") {
          const epNamePart = stream._meta_layout.episodeName ? ` | ${stream._meta_layout.episodeName}` : "";
          subLine1 = `🎬 S${stream._meta_layout.season} E${stream._meta_layout.episode} | ${stream._meta_layout.title}${epNamePart}`;
        }
      }

      let subLine2 = `💎 ${cleanQuality} | ${detectedLanguages} | 🎧 ${audioChannels}`;
      
      let formatCodec = (cleanQuality === "4K" || (stream.url && stream.url.includes("hevc"))) ? "HEVC" : "H.264";
      let durationStr = stream._meta_layout && stream._meta_layout.duration ? `${stream._meta_layout.duration} min` : "Variable";
      let subLine3 = `🎞️ ${formatCodec} | ⏱️ ${durationStr} | 📁 Server 1`;

      const finalTitle = `${subLine1}\n${subLine2}\n${subLine3}`;

      const behaviorHints = stream.behaviorHints && typeof stream.behaviorHints === "object" ? __spreadValues({}, stream.behaviorHints) : {};
      let finalHeaders = stream.headers;
      if (behaviorHints.proxyHeaders && behaviorHints.proxyHeaders.request) {
        finalHeaders = behaviorHints.proxyHeaders.request;
      } else if (behaviorHints.headers) {
        finalHeaders = behaviorHints.headers;
      }
      finalHeaders = normalizePlaybackHeaders(finalHeaders);

      if (finalHeaders) {
        behaviorHints.proxyHeaders = behaviorHints.proxyHeaders || {};
        behaviorHints.proxyHeaders.request = finalHeaders;
        behaviorHints.headers = finalHeaders;
      }
      
      const providerExplicitNotWebReady = stream.behaviorHints && "notWebReady" in stream.behaviorHints;
      const shouldForceNotWebReady = shouldForceNotWebReadyForPlugin(stream, "VixSrc", finalHeaders, behaviorHints);
      if (shouldForceNotWebReady) {
        behaviorHints.notWebReady = true;
      } else if (!providerExplicitNotWebReady) {
        delete behaviorHints.notWebReady;
      }

      const playbackReferer = stream.referer || (finalHeaders == null ? void 0 : finalHeaders.Referer) || (finalHeaders == null ? void 0 : finalHeaders.referer);
      const playbackUserAgent = stream.userAgent || (finalHeaders == null ? void 0 : finalHeaders["User-Agent"]) || (finalHeaders == null ? void 0 : finalHeaders["user-agent"]);
      
      const formatted = __spreadProps(__spreadValues({}, stream), {
  name: nameTag,
  title: finalTitle,
  size: finalTitle,
  providerName: "VixSrc",
  description: finalTitle,
  originalTitle: stream.title || "Stream",
  _nuvio_formatted: true,
  behaviorHints,
  provider: normalizeProviderId("VixSrc"),
  referer: playbackReferer,
  userAgent: playbackUserAgent,
  headers: finalHeaders
});

formatted.quality = cleanQuality;
delete formatted.qualityTag;

return formatted;
}

module2.exports = { formatStream: formatStream2 };
}
});

// src/fetch_helper.js
var require_fetch_helper = __commonJS({
  "src/fetch_helper.js"(exports2, module2) {
    var FETCH_TIMEOUT = 3e4;
    function createTimeoutSignal(timeoutMs) {
      const parsed = Number.parseInt(String(timeoutMs), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { signal: void 0, cleanup: null, timed: false };
      }
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        return { signal: AbortSignal.timeout(parsed), cleanup: null, timed: true };
      }
      if (typeof AbortController !== "undefined" && typeof setTimeout === "function") {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, parsed);
        return {
          signal: controller.signal,
          cleanup: () => clearTimeout(timeoutId),
          timed: true
        };
      }
      return { signal: void 0, cleanup: null, timed: false };
    }
    function fetchWithTimeout(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        if (typeof fetch === "undefined") {
          throw new Error("No fetch implementation found!");
        }
        const _a = options, { timeout } = _a, fetchOptions = __objRest(_a, ["timeout"]);
        const requestTimeout = timeout || FETCH_TIMEOUT;
        const timeoutConfig = createTimeoutSignal(requestTimeout);
        const requestOptions = __spreadValues({}, fetchOptions);
        if (timeoutConfig.signal) {
          if (requestOptions.signal && typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
            requestOptions.signal = AbortSignal.any([requestOptions.signal, timeoutConfig.signal]);
          } else if (!requestOptions.signal) {
            requestOptions.signal = timeoutConfig.signal;
          }
        }
        try {
          const response = yield fetch(url, requestOptions);
          return response;
        } catch (error) {
          if (error && error.name === "AbortError" && timeoutConfig.timed) {
            throw new Error(`Request to ${url} timed out after ${requestTimeout}ms`);
          }
          throw error;
        } finally {
          if (typeof timeoutConfig.cleanup === "function") {
            timeoutConfig.cleanup();
          }
        }
      });
    }
    module2.exports = { fetchWithTimeout, createTimeoutSignal };
  }
});

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    var { createTimeoutSignal } = require_fetch_helper();
    var USER_AGENT2 = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    function checkQualityFromPlaylist(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
          const finalHeaders = __spreadValues({}, headers);
          if (!finalHeaders["User-Agent"]) {
            finalHeaders["User-Agent"] = USER_AGENT2;
          }
          const timeoutConfig = createTimeoutSignal(3e3);
          try {
            const response = yield fetch(url, {
              headers: finalHeaders,
              signal: timeoutConfig.signal
            });
            if (!response.ok) return null;
            const text = yield response.text();
            if (!text.startsWith("#EXTM3U")) return null;
            const quality = checkQualityFromText2(text);
            if (quality) console.log(`[QualityHelper] Detected ${quality} from playlist: ${url}`);
            return quality;
          } finally {
            if (typeof timeoutConfig.cleanup === "function") {
              timeoutConfig.cleanup();
            }
          }
        } catch (e) {
          return null;
        }
      });
    }
    function checkItalianAudioInPlaylist(_0) {
      return __async(this, arguments, function* (url, headers = {}) {
        try {
          const finalHeaders = __spreadValues({}, headers);
          if (!finalHeaders["User-Agent"]) finalHeaders["User-Agent"] = USER_AGENT2;
          const timeoutConfig = createTimeoutSignal(3e3);
          try {
            const response = yield fetch(url, { headers: finalHeaders, signal: timeoutConfig.signal });
            if (!response.ok) return false;
            const text = yield response.text();
            if (!text.startsWith("#EXTM3U")) return false;
            const hasAudioTags = /#EXT-X-MEDIA:TYPE=AUDIO/i.test(text);
            if (!hasAudioTags) return true;
            return /#EXT-X-MEDIA:TYPE=AUDIO.*(?:LANGUAGE="it"|LANGUAGE="ita"|NAME="Italian"|NAME="Ita")/i.test(text);
          } finally {
            if (typeof timeoutConfig.cleanup === "function") return clearTimeout(timeoutId);
          }
        } catch (e) {
          return false;
        }
      });
    }
    function checkQualityFromText2(text) {
      if (!text) return null;
      if (/RESOLUTION=\d+x2160/i.test(text) || /RESOLUTION=2160/i.test(text)) return "4K";
      if (/RESOLUTION=\d+x1440/i.test(text) || /RESOLUTION=1440/i.test(text)) return "1440p";
      if (/RESOLUTION=\d+x1080/i.test(text) || /RESOLUTION=1080/i.test(text)) return "1080p";
      if (/RESOLUTION=\d+x720/i.test(text) || /RESOLUTION=720/i.test(text)) return "720p";
      if (/RESOLUTION=\d+x480/i.test(text) || /RESOLUTION=480/i.test(text)) return "480p";
      return null;
    }
    function getQualityFromUrl(url) {
      if (!url) return null;
      const urlPath = url.split("?")[0].toLowerCase();
      if (urlPath.includes("4k") || urlPath.includes("2160")) return "4K";
      if (urlPath.includes("1440") || urlPath.includes("2k")) return "1440p";
      if (urlPath.includes("1080") || urlPath.includes("fhd")) return "1080p";
      if (urlPath.includes("720") || urlPath.includes("hd")) return "720p";
      if (urlPath.includes("480") || urlPath.includes("sd")) return "480p";
      if (urlPath.includes("360")) return "360p";
      return null;
    }
    module2.exports = { checkQualityFromPlaylist, getQualityFromUrl, checkQualityFromText: checkQualityFromText2, checkItalianAudioInPlaylist };
  }
});

// src/vixsrc/index.js
function getVixSrcBaseUrl() {
  return "https://calpezz8.space";
}
var { formatStream } = require_formatter();
require_fetch_helper();
var { checkQualityFromText } = require_quality_helper();
var VIXSRC_PROXY = typeof process !== "undefined" && process.env.VIXSRC_PROXY || "";
var ProxyAgent = null;
try {
  ProxyAgent = require("undici").ProxyAgent;
} catch (_) {
  ProxyAgent = null;
}
function safeRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (e) {
    return null;
  }
}
var guardahd = safeRequire("../guardahd/index");
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
function getCommonHeaders() {
  return {
    "User-Agent": USER_AGENT,
    "Referer": `${getVixSrcBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  };
}
function getEmbedHeaders(embedUrl) {
  return {
    "User-Agent": USER_AGENT,
    "Referer": `${getVixSrcBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
  };
}
function getPlaylistHeaders(embedUrl) {
  return {
    "User-Agent": USER_AGENT,
    "Referer": embedUrl,
    "Origin": getVixSrcBaseUrl(),
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin"
  };
}
function extractEmbedSrcFromApiPayload(payload) {
  const rawSrc = payload && typeof payload === "object" ? payload.src : null;
  if (!rawSrc) return null;
  try {
    return new URL(rawSrc, getVixSrcBaseUrl()).toString();
  } catch (e) {
    return null;
  }
}
function extractMasterPlaylistFromEmbedHtml(html) {
  if (!html) return null;
  const tokenMatch = html.match(/'token'\s*:\s*'([^']+)'/i);
  const expiresMatch = html.match(/'expires'\s*:\s*'([^']+)'/i);
  const urlMatch = html.match(/url\s*:\s*'([^']+\/playlist\/\d+[^']*)'/i);
  if (!tokenMatch || !expiresMatch || !urlMatch) {
    return null;
  }
  return {
    token: tokenMatch[1],
    expires: expiresMatch[1],
    url: urlMatch[1]
  };
}
function getQualityFromName(qualityStr) {
  if (!qualityStr) return "Unknown";
  const quality = qualityStr.toUpperCase();
  if (quality === "ORG" || quality === "ORIGINAL") return "Original";
  if (quality === "4K" || quality === "2160P") return "4K";
  if (quality === "1440P" || quality === "2K") return "1440p";
  if (quality === "1080P" || quality === "FHD") return "1080p";
  if (quality === "720P" || quality === "HD") return "720p";
  if (quality === "480P" || quality === "SD") return "480p";
  if (quality === "360P") return "360p";
  if (quality === "240P") return "240p";
  const match = qualityStr.match(/(\d{3,4})[pP]?/);
  if (match) {
    const resolution = parseInt(match[1]);
    if (resolution >= 2160) return "4K";
    if (resolution >= 1440) return "1440p";
    if (resolution >= 1080) return "1080p";
    if (resolution >= 720) return "720p";
    if (resolution >= 480) return "480p";
    if (resolution >= 360) return "360p";
    return "240p";
  }
  return "Unknown";
}
function getTmdbId(imdbId, type) {
  return __async(this, null, function* () {
    const normalizedType = String(type).toLowerCase();
    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    try {
      const response = yield fetch(findUrl);
      if (!response.ok) return null;
      const data = yield response.json();
      if (!data) return null;
      if (normalizedType === "movie" && data.movie_results && data.movie_results.length > 0) {
        return data.movie_results[0].id.toString();
      } else if (normalizedType === "tv" && data.tv_results && data.tv_results.length > 0) {
        return data.tv_results[0].id.toString();
      }
      return null;
    } catch (e) {
      console.error("[VixSrc] Conversion error:", e);
      return null;
    }
  });
}
function getMetadata(id, type) {
  return __async(this, null, function* () {
    try {
      const normalizedType = String(type).toLowerCase();
      let url;
      if (String(id).startsWith("tt")) {
        url = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id&language=en-US`;
      } else {
        const endpoint = normalizedType === "movie" ? "movie" : "tv";
        url = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${TMDB_API_KEY}&language=en-US`;
      }
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
      if (String(id).startsWith("tt")) {
        const results = normalizedType === "movie" ? data.movie_results : data.tv_results;
        if (results && results.length > 0) return results[0];
      } else {
        return data;
      }
      return null;
    } catch (e) {
      console.error("[VixSrc] Metadata error:", e);
      return null;
    }
  });
}
function getEpisodeMetadata(tvId, season, episode) {
  return __async(this, null, function* () {
    try {
      const url = `https://api.themoviedb.org/3/tv/${tvId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}&language=en-US`;
      const response = yield fetch(url);
      if (!response.ok) return null;
      return yield response.json();
    } catch (e) {
      return null;
    }
  });
}
function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    const requestedType = String(type).toLowerCase();
    const normalizedType = requestedType === "series" ? "tv" : requestedType;
    const baseUrl = getVixSrcBaseUrl();
    const commonHeaders = getCommonHeaders();
    let tmdbId = id.toString();
    let resolvedSeason = season;
    const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || "")) ? String(providerContext.tmdbId) : null;
    if (contextTmdbId) {
      tmdbId = contextTmdbId;
    } else if (tmdbId.startsWith("tmdb:")) {
      tmdbId = tmdbId.replace("tmdb:", "");
    } else if (tmdbId.startsWith("tt")) {
      const convertedId = yield getTmdbId(tmdbId, normalizedType);
      if (convertedId) {
        console.log(`[VixSrc] Converted ${id} to TMDB ID: ${convertedId}`);
        tmdbId = convertedId;
      } else {
        console.warn(`[VixSrc] Could not convert IMDb ID ${id} to TMDB ID.`);
      }
    }
    let metadata = null;
    try {
      metadata = yield getMetadata(tmdbId, type);
    } catch (e) {
      console.error("[VixSrc] Error fetching metadata:", e);
    }

    // Advanced dynamic layout data object building
    let layoutMeta = {
      type: normalizedType,
      title: "Stream",
      year: "",
      season: resolvedSeason,
      episode: episode,
      episodeName: "",
      duration: "Variable"
    };

    if (metadata) {
      layoutMeta.title = metadata.title || metadata.name || metadata.original_title || metadata.original_name || "Stream";
      let dateRaw = metadata.release_date || metadata.first_air_date || "";
      if (dateRaw) {
        layoutMeta.year = dateRaw.split("-")[0];
      }
      if (metadata.runtime) {
        layoutMeta.duration = metadata.runtime.toString();
      } else if (metadata.episode_run_time && metadata.episode_run_time.length > 0) {
        layoutMeta.duration = metadata.episode_run_time[0].toString();
      }
    }

    // Dynamic extraction of Episode Name & Runtime directly from TMDB
    if (normalizedType === "tv") {
      try {
        const epMeta = yield getEpisodeMetadata(tmdbId, resolvedSeason, episode);
        if (epMeta) {
          if (epMeta.name) layoutMeta.episodeName = epMeta.name;
          if (epMeta.runtime) layoutMeta.duration = epMeta.runtime.toString();
        }
      } catch (_) {}
    }

    let url;
    let apiUrl;
    if (normalizedType === "movie") {
      url = `${baseUrl}/movie/${tmdbId}`;
      apiUrl = `${baseUrl}/api/movie/${tmdbId}`;
    } else if (normalizedType === "tv") {
      url = `${baseUrl}/tv/${tmdbId}/${resolvedSeason}/${episode}`;
      apiUrl = `${baseUrl}/api/tv/${tmdbId}/${resolvedSeason}/${episode}`;
    } else {
      return [];
    }
    try {
      const proxySocks = VIXSRC_PROXY || typeof process !== "undefined" && process.env.SOCKS5_PROXY || "";
      const useProxyFetch = proxySocks && typeof ProxyAgent === "function";
      let proxyAgent = null;
      if (useProxyFetch) {
        try {
          proxyAgent = new ProxyAgent(proxySocks);
          console.log(`[VixSrc] Using SOCKS5 proxy for fetches`);
        } catch (e) {
          console.warn(`[VixSrc] Failed to create proxy agent: ${e.message}`);
        }
      }
      console.log(`[VixSrc] Fetching API: ${apiUrl}`);
      const response = yield fetch(apiUrl, {
        headers: commonHeaders,
        dispatcher: proxyAgent || void 0
      });
      if (!response.ok) {
        console.error(`[VixSrc] Failed to fetch page: ${response.status}`);
        return [];
      }
      const apiPayload = yield response.json().catch(() => null);
      const embedUrl = extractEmbedSrcFromApiPayload(apiPayload);
      if (!embedUrl) {
        console.log("[VixSrc] Could not find embed src in API payload");
        return [];
      }
      let embedHtml;
      try {
        console.log(`[VixSrc] Fetching embed: ${embedUrl}`);
        const embedResponse = yield fetch(embedUrl, {
          headers: getEmbedHeaders(embedUrl),
          dispatcher: proxyAgent || void 0
        });
        if (!embedResponse.ok) {
          console.error(`[VixSrc] Failed to fetch embed: ${embedResponse.status}`);
          return [];
        }
        embedHtml = yield embedResponse.text();
      } catch (e) {
        console.error(`[VixSrc] Failed to fetch embed: ${e.message}`);
        return [];
      }
      if (!embedHtml) return [];
      const masterPlaylist = extractMasterPlaylistFromEmbedHtml(embedHtml);
      if (!masterPlaylist) {
        console.log("[VixSrc] Could not find playlist info in HTML");
        return [];
      }
      const separator = masterPlaylist.url.includes("?") ? "&" : "?";
      const streamUrl = `${masterPlaylist.url}${separator}token=${encodeURIComponent(masterPlaylist.token)}&expires=${encodeURIComponent(masterPlaylist.expires)}&h=1&lang=it`;
      const streamHeaders = getPlaylistHeaders(embedUrl);
      console.log(`[VixSrc] Final stream URL: ${streamUrl}`);
      let quality = "1080p";
      try {
        const playlistResponse = yield fetch(streamUrl, {
          headers: streamHeaders,
          dispatcher: proxyAgent || void 0
        });
        if (playlistResponse.ok) {
          const playlistText = yield playlistResponse.text();
          if (playlistText) {
            const detected = checkQualityFromText(playlistText);
            if (detected) quality = detected;
          }
        }
      } catch (e) {
        console.warn(`[VixSrc] Playlist pre-check failed, continuing:`, e);
      }
      const normalizedQuality = getQualityFromName(quality);
      
      const result = {
        name: `VixSrc`,
        url: streamUrl,
        easyProxySourceUrl: embedUrl,
        quality: normalizedQuality,
        type: "direct",
        headers: streamHeaders,
        behaviorHints: {
          notWebReady: false
        },
        _meta_layout: layoutMeta
      };
      return [formatStream(result, "VixSrc")].filter((s) => s !== null);
    } catch (error) {
      console.error("[VixSrc] Error:", error);
      return [];
    }
  });
}
module.exports = { getStreams };
