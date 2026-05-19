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
      // Intentionally bypassed to respect our newly constructed multi-line UI layouts
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

// --- NEW STRUCTURAL METADATA ENGINE & MULTI-LINE UI BUILDERS ---
function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

function buildTitle(meta, res, lang, format, size, extra, season, episode) {
  const qIcon =
    res.includes("4K") || res.includes("2160")
      ? "🌟"
      : res.includes("1080")
      ? "📺"
      : "💎";

  const lIcon = "🌍";

  let cleanLang = "English";

  // Auto detect multi-audio
  if (
    typeof lang === "string" &&
    (
      lang.includes(",") ||
      lang.includes("|") ||
      lang.includes("/") ||
      lang.toLowerCase().includes("multi")
    )
  ) {
    cleanLang = "Multi-Audio";
  } else if (lang && typeof lang === "string") {
  cleanLang = lang;
  }

  // Auto detect proper stream format
  let cleanFormat = "STREAM";

  if (format) {
    const lower = format.toLowerCase();

    if (lower.includes("mp4")) cleanFormat = "MP4";
else if (lower.includes("mkv")) cleanFormat = "MKV";
else if (
  lower.includes("m3u8") ||
  lower.includes("hls")
) cleanFormat = "HLS";
else if (
  lower.includes("dash") ||
  lower.includes("mpd")
) cleanFormat = "DASH";
  }

  let line1 = "🎬 ";

  if (season && episode) {
    line1 += `S${season} E${episode} | ${meta.name}`;
  } else {
    line1 += `${meta.name}${meta.year ? " (" + meta.year + ")" : ""}`;
  }

  const columns = [
    `${qIcon} ${res}`,
    `${lIcon} ${cleanLang}`,
    `💾 ${size || "Variable Size"}`
  ];

  const line3 =
    `🎞️ ${cleanFormat} | ⏱️ ${meta.duration} | ⚡ ${extra || "Direct"}`;

  return `${line1}\n${columns.join(" | ")}\n${line3}`;
}

function getM3U8Size(m3u8Url, durationText, headers = {}) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(m3u8Url, { headers });
      
      if (!res.ok) return "Variable Size";

      const masterText = yield res.text();
     
      let playlistUrl = m3u8Url;
      
      if (masterText.includes("#EXT-X-STREAM-INF")) {
  const variantLines = masterText
    .split("\n")
    .filter(line =>
      line &&
      !line.startsWith("#") &&
      line.includes(".m3u8")
    );

  if (variantLines.length > 0) {
    playlistUrl = new URL(
      variantLines[variantLines.length - 1],
      m3u8Url
    ).href;
  }
      }

      // Find variant playlist
      const variantMatch = masterText.match(
        /^(.+\.m3u8.*)$/m
      );

      if (variantMatch) {
        playlistUrl = new URL(
          variantMatch[1],
          m3u8Url
        ).href;
      }

      const playlistRes = yield fetch(
        playlistUrl,
        { headers }
      );

      if (!playlistRes.ok)
        return "Variable Size";

      const playlistText =
        yield playlistRes.text();

      const segments = playlistText
        .split("\n")
        .filter(
          line =>
            line &&
            !line.startsWith("#") &&
            (
              line.includes(".ts") ||
              line.includes(".m4s")
            )
        );

      if (!segments.length)
        return "Variable Size";

      const sampleSegments = segments.slice(0, 5);

let totalSampleSize = 0;

for (const seg of sampleSegments) {
  try {

    const segUrl = seg.startsWith("http")
      ? seg
      : new URL(seg, playlistUrl).href;

    const segRes = yield fetch(segUrl, {
      method: "GET",
      headers: {
        ...headers,
        Range: "bytes=0-1"
      }
    });

    const contentRange =
      segRes.headers.get("content-range");

    const contentLength =
      Number(segRes.headers.get("content-length")) || 0;

    let estimatedSegmentSize = contentLength;

    if (
      contentRange &&
      contentRange.includes("/")
    ) {
      estimatedSegmentSize =
        Number(contentRange.split("/")[1]) ||
        contentLength;
    }

    totalSampleSize += estimatedSegmentSize;

  } catch (e) {}
}

      if (!totalSampleSize)
        return "Variable Size";

      const mins =
        parseInt(durationText) || 94;

      const estimatedTotal =
        (totalSampleSize /
          sampleSegments.length) *
        ((mins * 60) / 6);

      return formatBytes(
        estimatedTotal
      );
    } catch (e) {
      return "Variable Size";
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
      console.error("[StreamingCommunity] Conversion error:", e);
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
      
      let rawData = data;
      if (String(id).startsWith("tt")) {
        const results = normalizedType === "movie" ? data.movie_results : data.tv_results;
        if (results && results.length > 0) rawData = results[0];
      }

      const date = (rawData == null ? void 0 : rawData.release_date) || (rawData == null ? void 0 : rawData.first_air_date) || "";
      let duration = "94 min";
      if (normalizedType === "movie" && (rawData == null ? void 0 : rawData.runtime)) {
        duration = rawData.runtime + " min";
      } else if (normalizedType === "tv") {

  if (
    rawData?.episode_run_time &&
    rawData.episode_run_time.length > 0
  ) {
    duration =
      rawData.episode_run_time[0] + " min";

  } else if (
    rawData?.last_episode_to_air?.runtime
  ) {
    duration =
      rawData.last_episode_to_air.runtime + " min";

  } else {
    duration = "45 min";
  }
}

      return {
        name: (rawData == null ? void 0 : rawData.title) || (rawData == null ? void 0 : rawData.name) || (rawData == null ? void 0 : rawData.original_title) || "StreamingCommunity",
        year: date ? date.split("-")[0] : "",
        duration: duration,
        original_language: rawData == null ? void 0 : rawData.original_language
      };
    } catch (e) {
      console.error("[StreamingCommunity] Metadata error:", e);
      return { name: "StreamingCommunity", year: "", duration: "94 min" };
    }
  });
}

function hasGuardaFallbackResults(id, type, season, episode, providerContext) {
  return __async(this, null, function* () {
    const normalizedType = String(type).toLowerCase();
    const checks = [];
    if (normalizedType === "movie" && guardahd && typeof guardahd.getStreams === "function") {
      checks.push(
        guardahd.getStreams(id, normalizedType, season, episode).then((streams) => Array.isArray(streams) && streams.length > 0).catch((e) => {
          console.warn("[StreamingCommunity] GuardaHD fallback check failed:", e);
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
        console.log(`[StreamingCommunity] Converted ${id} to TMDB ID: ${convertedId}`);
        tmdbId = convertedId;
      } else {
        console.warn(`[StreamingCommunity] Could not convert IMDb ID ${id} to TMDB ID.`);
      }
    }

    let metadata = { name: "StreamingCommunity", year: "", duration: "94 min" };
    try {
      metadata = yield getMetadata(tmdbId, type);
    } catch (e) {
      console.error("[StreamingCommunity] Error fetching metadata:", e);
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
      console.log(`[StreamingCommunity] Fetching API: ${apiUrl}`);
      const response = yield fetch(apiUrl, { headers: commonHeaders });
      if (!response.ok) {
        console.error(`[StreamingCommunity] Failed to fetch page: ${response.status}`);
        return [];
      }
      const apiPayload = yield response.json().catch(() => null);
      const embedUrl = extractEmbedSrcFromApiPayload(apiPayload);
      if (!embedUrl) {
        console.log("[StreamingCommunity] Could not find embed src in API payload");
        return [];
      }

      if (providerContext == null ? void 0 : providerContext.proxyUrl) {
        const rawPageUrl = url.endsWith("/") ? url : `${url}/`;
        console.log(`[StreamingCommunity] Proxy enabled, returning raw page URL: ${rawPageUrl}`);
        
        const generatedTitle = buildTitle(
          metadata, 
          "Auto", 
          "Italian", 
          "Direct", 
          "Variable Size", 
          "Proxy Redirect", 
          normalizedType === "tv" ? resolvedSeason : null, 
          normalizedType === "tv" ? episode : null
        );

        const result = {
  name: "🎦",
  title: generatedTitle,
  url: streamUrl,
  easyProxySourceUrl: embedUrl,

  // Prevent duplicate injected metadata
  quality: "",

  type: "direct",
  headers: streamHeaders,
  behaviorHints: { notWebReady: false }
};
        return [formatStream(result, "StreamingCommunity")].filter((s) => s !== null);
      }

      console.log(`[StreamingCommunity] Fetching embed: ${embedUrl}`);
      const embedResponse = yield fetch(embedUrl, { headers: getEmbedHeaders(embedUrl) });
      if (!embedResponse.ok) {
        console.error(`[StreamingCommunity] Failed to fetch embed: ${embedResponse.status}`);
        return [];
      }
      const embedHtml = yield embedResponse.text();
      if (!embedHtml) return [];
      
      const masterPlaylist = extractMasterPlaylistFromEmbedHtml(embedHtml);
      if (masterPlaylist) {
        const streamUrl = `${masterPlaylist.url}?token=${encodeURIComponent(masterPlaylist.token)}&expires=${encodeURIComponent(masterPlaylist.expires)}&h=1&lang=it`;
        const streamHeaders = getPlaylistHeaders(embedUrl);
        console.log(`[StreamingCommunity] Final stream URL: ${streamUrl}`);

        let streamLanguage = "English";
let detectedQuality = "Auto";

try {
  const playlistResponse = yield fetch(streamUrl, {
    headers: streamHeaders
  });

  if (playlistResponse.ok) {
    const playlistText = yield playlistResponse.text();

    // Detect quality
    const playlistQuality =
      checkQualityFromText(playlistText);

    detectedQuality =
      playlistQuality ||
      getQualityFromUrl(streamUrl) ||
      getQualityFromUrl(embedUrl) ||
      "Auto";

    // Detect unique audio languages
const languageMatches = [
  ...playlistText.matchAll(/LANGUAGE="([^"]+)"/gi)
];

const uniqueLanguages = [
  ...new Set(
    languageMatches.map(x =>
      x[1].toLowerCase()
    )
  )
];

if (uniqueLanguages.length > 1) {
  streamLanguage = "Multi-Audio";
} else if (uniqueLanguages.length === 1) {
  const lang = uniqueLanguages[0];

  if (lang.includes("it")) streamLanguage = "Italian";
  else if (lang.includes("en")) streamLanguage = "English";
  else if (lang.includes("es")) streamLanguage = "Spanish";
  else if (lang.includes("fr")) streamLanguage = "French";
  else streamLanguage = lang.toUpperCase();
} else {
  streamLanguage = "English";
}

    console.log(
      `[StreamingCommunity] Quality: ${detectedQuality} | Lang: ${streamLanguage}`
    );
  }
} catch (e) {
  console.warn(
    "[StreamingCommunity] Quality detection failed:",
    e
  );
}

        // Calculate runtime manifest size boundaries dynamically
        const computedSize = yield getM3U8Size(streamUrl, metadata.duration, streamHeaders);

        const detectedFormat =
  streamUrl.includes(".mp4")
    ? "mp4"
    : streamUrl.includes(".mkv")
    ? "mkv"
    : streamUrl.includes(".mpd")
    ? "dash"
    : streamUrl.includes(".m3u8")
    ? "hls"
    : "HLS";

const generatedTitle = buildTitle(
  metadata,
  detectedQuality,
  streamLanguage,
  detectedFormat,
  computedSize,
  "VixSrc",
          normalizedType === "tv" ? resolvedSeason : null,
          normalizedType === "tv" ? episode : null
        );
        
        const result = {
  name: "🎦",
  title: generatedTitle,
  url: rawPageUrl,
  easyProxySourceUrl: embedUrl,

  quality: "",

  type: "direct",
  headers: commonHeaders,
  behaviorHints: {
    notWebReady: false
  }
};
        return [formatStream(result, "StreamingCommunity")].filter((s) => s !== null);
      } else {
        console.log("[StreamingCommunity] Could not find playlist info in HTML");
        return [];
      }
    } catch (error) {
      console.error("[StreamingCommunity] Error:", error);
      return [];
    }
  });
}

module.exports = { getStreams };
