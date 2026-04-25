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
    function formatStream2(stream, providerName) {
      let quality = stream.quality || "";
      if (quality === "2160p") quality = "\u{1F525}4K UHD";
      else if (quality === "1440p") quality = "\u2728 QHD";
      else if (quality === "1080p") quality = "\u{1F680} FHD";
      else if (quality === "720p") quality = "\u{1F4BF} HD";
      else if (quality === "576p" || quality === "480p" || quality === "360p" || quality === "240p") quality = "\u{1F4A9} Low Quality";
      else if (!quality || ["auto", "unknown", "unknow"].includes(String(quality).toLowerCase())) quality = "Unknown";
      
      let language = stream.language;
      if (!language) {
        // Updated to English Flag then Italian Flag
        language = "\u{1F1EC}\u{1F1E7} \u{1F1EE}\u{1F1F9}";
      }

      let details = [];
      if (stream.size) details.push(`\u{1F4E6} ${stream.size}`);
      const desc = details.join(" | ");
      
      let pName = stream.name || stream.server || providerName;
      if (pName) {
        pName = pName.replace(/\s*\[?\(?\s*SUB\s*ITA\s*\)?\]?/i, "").replace(/\s*\[?\(?\s*ITA\s*\)?\]?/i, "").replace(/\s*\[?\(?\s*SUB\s*\)?\]?/i, "").replace(/\(\s*\)/g, "").replace(/\[\s*\]/g, "").trim();
        pName = `\u{1F4E1} ${pName.charAt(0).toUpperCase() + pName.slice(1)}`;
      }

      const behaviorHints = stream.behaviorHints && typeof stream.behaviorHints === "object" ? __spreadValues({}, stream.behaviorHints) : {};
      let finalHeaders = normalizePlaybackHeaders(stream.headers || (behaviorHints.proxyHeaders ? behaviorHints.proxyHeaders.request : behaviorHints.headers));

      let finalTitle = `\u{1F4C1} ${stream.title || "Stream"}`;
      if (desc) finalTitle += ` | ${desc}`;
      // Added Language Header
      if (language) finalTitle += ` | Language: ${language}`;

      return __spreadProps(__spreadValues({}, stream), {
        name: pName,
        title: finalTitle,
        qualityTag: quality,
        language,
        _nuvio_formatted: true,
        behaviorHints: __spreadValues(behaviorHints, { headers: finalHeaders })
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
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        return { signal: AbortSignal.timeout(parsed), cleanup: null, timed: true };
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), parsed);
      return { signal: controller.signal, cleanup: () => clearTimeout(timeoutId), timed: true };
    }
    function fetchWithTimeout(url, options = {}) {
      return __async(this, null, function* () {
        const timeout = options.timeout || FETCH_TIMEOUT;
        const { signal, cleanup } = createTimeoutSignal(timeout);
        try {
          return yield fetch(url, __spreadValues(__spreadValues({}, options), { signal }));
        } finally {
          if (cleanup) cleanup();
        }
      });
    }
    module2.exports = { fetchWithTimeout, createTimeoutSignal };
  }
});

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    function checkQualityFromText(text) {
      if (!text) return null;
      if (/RESOLUTION=\d+x2160/i.test(text)) return "4K";
      if (/RESOLUTION=\d+x1080/i.test(text)) return "1080p";
      if (/RESOLUTION=\d+x720/i.test(text)) return "720p";
      return null;
    }
    function getQualityFromName(q) {
      return q || "1080p";
    }
    module2.exports = { checkQualityFromText, getQualityFromName };
  }
});

// src/streamingcommunity/index.js
const { formatStream } = require_formatter();
const { checkQualityFromText, getQualityFromName } = require_quality_helper();

function getStreamingCommunityBaseUrl() { return "https://vixsrc.to"; }

async function getStreams(id, type, season, episode, providerContext = null) {
  const baseUrl = getStreamingCommunityBaseUrl();
  const tmdbId = id.toString().replace("tmdb:", "");
  const apiUrl = type === "movie" ? `${baseUrl}/api/movie/${tmdbId}` : `${baseUrl}/api/tv/${tmdbId}/${season}/${episode}`;

  try {
    const res = await fetch(apiUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const apiPayload = await res.json();
    const embedUrl = apiPayload.src;
    if (!embedUrl) return [];

    const embedRes = await fetch(embedUrl);
    const html = await embedRes.text();
    
    const token = html.match(/'token'\s*:\s*'([^']+)'/)?.[1];
    const expires = html.match(/'expires'\s*:\s*'([^']+)'/)?.[1];
    const playlistUrl = html.match(/url\s*:\s*'([^']+)'/)?.[1];

    if (token && expires && playlistUrl) {
      // Use lang=all to ensure both audio tracks are available
      const streamUrl = `${playlistUrl}?token=${token}&expires=${expires}&h=1&lang=all`;
      
      return [formatStream({
        title: type === "movie" ? "Movie" : `Episode ${episode}`,
        url: streamUrl,
        quality: "1080p"
      }, "StreamingCommunity")];
    }
    return [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

module.exports = { getStreams };
