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
      if (text.includes("mixdrop") || text.includes("m1xdrop") || text.includes("mxcontent")) return true;
      if (text.includes("loadm") || text.includes("loadm.cam")) return true;
      return false;
    }
    function formatStream2(stream, providerName) {
      let quality = stream.quality || "";
      // Visual formatting for resolutions
      if (quality === "4K") quality = "\u{1F525}4K UHD";
      else if (quality === "1440p") quality = "\u2728 QHD";
      else if (quality === "1080p") quality = "\u{1F680} FHD";
      else if (quality === "720p") quality = "\u{1F4BF} HD";
      else if (quality === "480p" || quality === "576p" || quality === "360p") quality = "\u{1F4A9} Low Quality";
      else if (!quality || ["auto", "unknown", "unknow"].includes(String(quality).toLowerCase())) quality = "Unknown";
      
      let language = stream.language;
      if (!language) {
        if (stream.name && (stream.name.includes("SUB ITA") || stream.name.includes("SUB"))) language = "Language: \u{1F1EF}\u{1F1F5} \u{1F1EE}\u{1F1F9}";
        else if (stream.title && (stream.title.includes("SUB ITA") || stream.title.includes("SUB"))) language = "Language: \u{1F1EF}\u{1F1F5} \u{1F1EE}\u{1F1F9}";
        else language = "Language: \u{1F1EC}\u{1F1E7} \u{1F1EE}\u{1F1F9}";
      }
      let details = [];
      if (stream.size) details.push(`\u{1F4E6} ${stream.size}`);
      const desc = details.join(" | ");
      let pName = stream.name || stream.server || providerName;
      if (pName) {
        pName = pName.replace(/\s*\[?\(?\s*SUB\s*ITA\s*\)?\]?/i, "").replace(/\s*\[?\(?\s*ITA\s*\)?\]?/i, "").replace(/\s*\[?\(?\s*SUB\s*\)?\]?/i, "").replace(/\(\s*\)/g, "").replace(/\[\s*\]/g, "").trim();
      }
      if (pName === providerName) pName = pName.charAt(0).toUpperCase() + pName.slice(1);
      if (pName) pName = `\u{1F4E1} ${pName}`;
      
      const behaviorHints = stream.behaviorHints && typeof stream.behaviorHints === "object" ? __spreadValues({}, stream.behaviorHints) : {};
      let finalHeaders = stream.headers;
      finalHeaders = normalizePlaybackHeaders(finalHeaders);
      
      let finalTitle = `\u{1F4C1} ${stream.title || "Stream"}`;
      if (desc) finalTitle += ` | ${desc}`;
      if (language) finalTitle += ` | ${language}`;
      
      return __spreadProps(__spreadValues({}, stream), {
        name: pName,
        title: finalTitle,
        qualityTag: quality,
        language,
        _nuvio_formatted: true,
        behaviorHints,
        headers: finalHeaders
      });
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
      if (!Number.isFinite(parsed) || parsed <= 0) return { signal: void 0, cleanup: null, timed: false };
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") return { signal: AbortSignal.timeout(parsed), cleanup: null, timed: true };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), parsed);
      return { signal: controller.signal, cleanup: () => clearTimeout(timeoutId), timed: true };
    }
    function fetchWithTimeout(url, options = {}) {
      return __async(this, null, function* () {
        const _a = options, { timeout } = _a, fetchOptions = __objRest(_a, ["timeout"]);
        const requestTimeout = timeout || FETCH_TIMEOUT;
        const timeoutConfig = createTimeoutSignal(requestTimeout);
        try {
          return yield fetch(url, __spreadProps(__spreadValues({}, fetchOptions), { signal: timeoutConfig.signal }));
        } finally {
          if (timeoutConfig.cleanup) timeoutConfig.cleanup();
        }
      });
    }
    module2.exports = { fetchWithTimeout, createTimeoutSignal };
  }
});

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    function checkQualityFromText2(text) {
      if (!text) return null;
      // Added priority for 4K and 2160p detection
      if (/RESOLUTION=\d+x2160/i.test(text) || /RESOLUTION=2160/i.test(text)) return "4K";
      if (/RESOLUTION=\d+x1440/i.test(text) || /RESOLUTION=1440/i.test(text)) return "1440p";
      if (/RESOLUTION=\d+x1080/i.test(text) || /RESOLUTION=1080/i.test(text)) return "1080p";
      if (/RESOLUTION=\d+x720/i.test(text) || /RESOLUTION=720/i.test(text)) return "720p";
      if (/RESOLUTION=\d+x480/i.test(text) || /RESOLUTION=480/i.test(text)) return "480p";
      return null;
    }
    module2.exports = { checkQualityFromText: checkQualityFromText2 };
  }
});

// src/streamingcommunity/index.js
function getStreamingCommunityBaseUrl() { return "https://vixsrc.to"; }
var { formatStream } = require_formatter();
var { checkQualityFromText } = require_quality_helper();
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";

function getCommonHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Referer": `${getStreamingCommunityBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
  };
}

function getQualityFromName(qualityStr) {
  if (!qualityStr) return "Unknown";
  const q = qualityStr.toUpperCase();
  if (q.includes("4K") || q.includes("2160")) return "4K";
  if (q.includes("1440") || q.includes("2K")) return "1440p";
  if (q.includes("1080") || q.includes("FHD")) return "1080p";
  if (q.includes("720") || q.includes("HD")) return "720p";
  if (q.includes("480") || q.includes("SD")) return "480p";
  return "Unknown";
}

function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    const baseUrl = getStreamingCommunityBaseUrl();
    const normalizedType = type === "series" ? "tv" : type;
    
    let apiUrl = normalizedType === "movie" 
      ? `${baseUrl}/api/movie/${id}` 
      : `${baseUrl}/api/tv/${id}/${season}/${episode}`;

    try {
      const response = yield fetch(apiUrl, { headers: getCommonHeaders() });
      const apiPayload = yield response.json();
      const embedUrl = apiPayload.src;
      if (!embedUrl) return [];

      const embedRes = yield fetch(embedUrl, { headers: getCommonHeaders() });
      const embedHtml = yield embedRes.text();
      
      const tokenMatch = embedHtml.match(/'token'\s*:\s*'([^']+)'/i);
      const expiresMatch = embedHtml.match(/'expires'\s*:\s*'([^']+)'/i);
      const urlMatch = embedHtml.match(/url\s*:\s*'([^']+\/playlist\/\d+[^']*)'/i);

      if (tokenMatch && expiresMatch && urlMatch) {
        // We use lang=all to allow the user to select tracks, and h=1 for higher bitrate
        const streamUrl = `${urlMatch[1]}?token=${encodeURIComponent(tokenMatch[1])}&expires=${encodeURIComponent(expiresMatch[1])}&h=1&lang=all`;
        
        // DEFAULT TO UNKNOWN: Don't guess 1080p. Let the detector find it.
        let detectedQuality = "Unknown";
        
        try {
          const playlistRes = yield fetch(streamUrl, { headers: getCommonHeaders() });
          if (playlistRes.ok) {
            const playlistText = yield playlistRes.text();
            const found = checkQualityFromText(playlistText);
            if (found) detectedQuality = found;
          }
        } catch (e) {}

        const result = {
          name: `VixSrc`,
          title: apiPayload.title || "Stream",
          url: streamUrl,
          quality: getQualityFromName(detectedQuality),
          type: "direct",
          headers: { "Referer": embedUrl, "Origin": baseUrl }
        };
        return [formatStream(result, "StreamingCommunity")];
      }
      return [];
    } catch (error) { return []; }
  });
}

module.exports = { getStreams };
