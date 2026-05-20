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
      if (text.includes("mixdrop") || text.includes("m1xdrop") || text.includes("mxcontent")) {
        return true;
      }
      if (text.includes("loadm") || text.includes("loadm.cam")) {
        return true;
      }
      return false;
    }
    function formatStream2(stream, providerName) {
      return stream;
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
          if (!url.includes(".m3u8")) return null;
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
    module2.exports = { checkQualityFromPlaylist, getQualityFromUrl, checkQualityFromText: checkQualityFromText2 };
  }
});

// src/streamingcommunity/index.js
function getStreamingCommunityBaseUrl() {
  return "https://vixsrc.to";
}
var { formatStream } = require_formatter();
var { fetchWithTimeout } = require_fetch_helper();
var { checkQualityFromText, getQualityFromUrl } = require_quality_helper();
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
    "Referer": `${getStreamingCommunityBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
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
    "Referer": `${getStreamingCommunityBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
  };
}
function getPlaylistHeaders(embedUrl) {
  return {
    "User-Agent": USER_AGENT,
    "Referer": embedUrl,
    "Origin": getStreamingCommunityBaseUrl(),
    "Accept": "*/*",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin"
  };
}
function extractEmbedSrcFromApiPayload(payload) {
  const rawSrc = payload && typeof payload === "object" ? payload.src : null;
  if (!rawSrc) return null;
  try {
    return new URL(rawSrc, getStreamingCommunityBaseUrl()).toString();
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

function buildTitle(meta, res, lang, format, size, season, episode) {
  const qIcon = res.includes("4K") || res.includes("2160") ? "🌟" : "💎";
  
  let line1 = "🎬 ";
  if (season && episode) {
    // Standard layout check: S1 E1 | Series Title
    line1 += `S${season} E${episode} | ${meta.name}`;
    // Inject the specific episode title variant if populated cleanly
    if (meta.episodeTitle && meta.episodeTitle !== "") {
      line1 += ` | ${meta.episodeTitle}`;
    }
  } else {
    line1 += `${meta.name}${meta.year ? " (" + meta.year + ")" : ""}`;
  }

  const line2 = `${qIcon} ${res} | 🌍 ${lang} | 💾 ${size}`;
  const line3 = `🎞️ ${format.toUpperCase()} | ⏱️ ${meta.duration} | 📼 AVC • 🔊 AAC`;

  return `${line1}\n${line2}\n${line3}`;
}

function calculateCalculatedFallbackSize(quality, durationText) {
  const mins = parseInt(durationText) || 90;
  const norm = String(quality || "").toLowerCase();
  let bitrateKbps = 5200;
  
  if (norm.includes("4k") || norm.includes("2160")) bitrateKbps = 16000;
  else if (norm.includes("1440") || norm.includes("2k")) bitrateKbps = 9000;
  else if (norm.includes("1080") || norm.includes("fhd")) bitrateKbps = 5200;
  else if (norm.includes("720") || norm.includes("hd")) bitrateKbps = 2500;
  else if (norm.includes("480") || norm.includes("sd")) bitrateKbps = 1200;

  const dynamicVariance = 0.94 + ((mins % 9) / 100);
  const calculatedBytes = ((bitrateKbps * dynamicVariance) * 1000 / 8) * (mins * 60);
  return formatBytes(calculatedBytes);
}

function getM3U8Size(m3u8Url, durationText, quality, headers = {}) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(m3u8Url, { headers });
      if (!res.ok) return calculateCalculatedFallbackSize(quality, durationText);
      
      const text = yield res.text();
      const matches = [...text.matchAll(/BANDWIDTH=(\d+)/gi)];
      if (matches.length > 0) {
        const bandwidths = matches.map(m => parseInt(m[1])).sort((a, b) => b - a);
        const bps = bandwidths[0]; 
        const mins = parseInt(durationText) || 90;
        const totalBytes = (bps / 8) * (mins * 60);
        return formatBytes(totalBytes);
      }
      return calculateCalculatedFallbackSize(quality, durationText);
    } catch (e) {
      return calculateCalculatedFallbackSize(quality, durationText);
    }
  });
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

async function getMetadata(id, type, season, episode, fallbackContext = null) {
  // Enforce scraping context structures so we never fallback on 'VixSrc' text strings
  let localFallbackName = "Unknown Title";
  let localFallbackDuration = type === "tv" ? "45 min" : "90 min";
  let localFallbackEpisodeTitle = "";

  if (fallbackContext && typeof fallbackContext === "object") {
    if (fallbackContext.name) localFallbackName = fallbackContext.name;
    else if (fallbackContext.title) localFallbackName = fallbackContext.title;
    
    if (fallbackContext.episodeName) localFallbackEpisodeTitle = fallbackContext.episodeName;
    else if (fallbackContext.episodeTitle) localFallbackEpisodeTitle = fallbackContext.episodeTitle;
    
    if (fallbackContext.duration) localFallbackDuration = fallbackContext.duration;
  }

  try {
    const normalizedType = String(type).toLowerCase();
    const endpoint = normalizedType === "movie" ? "movie" : "tv";
    const url = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${TMDB_API_KEY}&append_to_response=content_ratings`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("TMDB Fail");
    const data = await response.json();

    let duration = localFallbackDuration; 
    let episodeTitle = localFallbackEpisodeTitle;
    
    if (normalizedType === "movie" && data.runtime) {
      duration = `${data.runtime} min`;
    } else if (normalizedType === "tv") {
      const epUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
      const epRes = await fetch(epUrl);
      if (epRes.ok) {
        const epData = await epRes.json();
        if (epData.name) episodeTitle = epData.name;
        if (epData.runtime) duration = `${epData.runtime} min`;
        else if (data.episode_run_time && data.episode_run_time.length > 0) {
           duration = `${data.episode_run_time[0]} min`;
        }
      }
    }

    return {
      name: data.title || data.name || localFallbackName,
      year: (data.release_date || data.first_air_date || "").split("-")[0],
      duration: duration,
      episodeTitle: episodeTitle
    };
  } catch (e) {
    return { name: localFallbackName, year: "", duration: localFallbackDuration, episodeTitle: localFallbackEpisodeTitle };
  }
}

function hasGuardaFallbackResults(id, type, season, episode, providerContext) {
  return __async(this, null, function* () {
    const normalizedType = String(type).toLowerCase();
    const checks = [];
    if (normalizedType === "movie" && guardahd && typeof guardahd.getStreams === "function") {
      checks.push(
        guardahd.getStreams(id, normalizedType, season, episode).then((streams) => Array.isArray(streams) && streams.length > 0).catch((e) => {
          console.warn("[VixSrc] VixSrc fallback check failed:", e);
          return false;
        })
      );
    }
    if (checks.length === 0) return false;
    const results = yield Promise.all(checks);
    return results.some(Boolean);
  });
}

function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    const requestedType = String(type).toLowerCase();
    const normalizedType = requestedType === "series" ? "tv" : requestedType;
    const baseUrl = getStreamingCommunityBaseUrl();
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

    let metadata = { name: "Unknown Title", year: "", duration: "90 min", episodeTitle: "" };
    try {
      metadata = yield getMetadata(tmdbId, type, resolvedSeason, episode, providerContext); 
    } catch (e) {
      console.error("[VixSrc] Error fetching metadata:", e);
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
      console.log(`[VixSrc] Fetching API: ${apiUrl}`);
      const response = yield fetch(apiUrl, { headers: commonHeaders });
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

      if (providerContext == null ? void 0 : providerContext.proxyUrl) {
        const rawPageUrl = url.endsWith("/") ? url : `${url}/`;
        const calculatedSize = calculateCalculatedFallbackSize("1080p", metadata.duration);
        const generatedTitle = buildTitle(
          metadata, 
          "Auto", 
          "Multi-Audio", 
          "M3U8", 
          calculatedSize, 
          normalizedType === "tv" ? resolvedSeason : null, 
          normalizedType === "tv" ? episode : null
        );

        const finalHeaderName = "🎦 VixSrc | Auto | Multi-Audio";

        const result = {
          name: finalHeaderName,
          title: generatedTitle,
          url: rawPageUrl,
          easyProxySourceUrl: rawPageUrl,
          quality: "1080p",
          type: "direct",
          behaviorHints: { notWebReady: false }
        };
        return [formatStream(result, "StreamingCommunity")].filter((s) => s !== null);
      }

      console.log(`[VixSrc] Fetching embed: ${embedUrl}`);
      const embedResponse = yield fetch(embedUrl, { headers: getEmbedHeaders(embedUrl) });
      if (!embedResponse.ok) {
        console.error(`[VixSrc] Failed to fetch embed: ${embedResponse.status}`);
        return [];
      }
      const embedHtml = yield embedResponse.text();
      if (!embedHtml) return [];
      
      const masterPlaylist = extractMasterPlaylistFromEmbedHtml(embedHtml);
      if (masterPlaylist) {
        const streamUrl = `${masterPlaylist.url}?token=${encodeURIComponent(masterPlaylist.token)}&expires=${encodeURIComponent(masterPlaylist.expires)}&h=1&lang=it`;
        const streamHeaders = getPlaylistHeaders(embedUrl);
        console.log(`[VixSrc] Final stream URL: ${streamUrl}`);

        let streamLanguage = "Multi-Audio"; 
        let detectedQuality = "1080p";

        try {
          const playlistResponse = yield fetch(streamUrl, { headers: streamHeaders });

          if (playlistResponse.ok) {
            const playlistText = yield playlistResponse.text();

            const playlistQuality = checkQualityFromText(playlistText);
            detectedQuality = playlistQuality || getQualityFromUrl(streamUrl) || getQualityFromUrl(embedUrl) || "1080p";

            const languageMatches = [...playlistText.matchAll(/LANGUAGE="([^"]+)"/gi)];
            const uniqueLanguages = [...new Set(languageMatches.map(x => x[1].toLowerCase()))];

            if (uniqueLanguages.length > 1 || playlistText.includes("ita") || streamUrl.includes("lang=it")) {
              streamLanguage = "Multi-Audio";
            } else if (uniqueLanguages.length === 1) {
              const lang = uniqueLanguages[0];
              if (lang.includes("it")) streamLanguage = "Italian";
              else if (lang.includes("en")) streamLanguage = "English";
              else streamLanguage = lang.toUpperCase();
            }
          }
        } catch (e) {
          console.warn("[VixSrc] Quality detection failed:", e);
        }

        const computedSize = yield getM3U8Size(streamUrl, metadata.duration, detectedQuality, streamHeaders);

        let detectedFormat = "M3U8"; 
        const urlToCheck = streamUrl.split('?')[0].toLowerCase();
        if (urlToCheck.includes(".m3u8")) {
          detectedFormat = "M3U8";
        } else if (urlToCheck.includes("/hls/")) {
          detectedFormat = "HLS";
        } else if (urlToCheck.includes(".mpd")) {
          detectedFormat = "DASH";
        } else if (urlToCheck.includes(".mp4")) {
          detectedFormat = "MP4";
        }

        const generatedTitle = buildTitle(
          metadata,
          detectedQuality,
          streamLanguage,
          detectedFormat,
          computedSize,
          normalizedType === "tv" ? resolvedSeason : null,
          normalizedType === "tv" ? episode : null
        );
        
        const finalHeaderName = `🎦 VixSrc | ${detectedQuality} | ${streamLanguage}`;

        const result = {
          name: finalHeaderName,
          title: generatedTitle,
          url: streamUrl,
          easyProxySourceUrl: embedUrl,
          quality: detectedQuality.toLowerCase().includes("p") ? detectedQuality : "1080p", 
          type: "direct",
          headers: streamHeaders,
          behaviorHints: { notWebReady: false }
        };
        return [formatStream(result, "StreamingCommunity")].filter((s) => s !== null);
      } else {
        console.log("[VixSrc] Could not find playlist info in HTML");
        return [];
      }
    } catch (error) {
      console.error("[VixSrc] Error:", error);
      return [];
    }
  });
}

module.exports = { getStreams };
