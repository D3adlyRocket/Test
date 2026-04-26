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
      // Proper resolution detection mapping
      if (quality === "4K") quality = "\u{1F525}4K UHD";
      else if (quality === "1440p") quality = "\u2728 QHD";
      else if (quality === "1080p") quality = "\u{1F680} FHD";
      else if (quality === "720p") quality = "\u{1F4BF} HD";
      else if (["480p", "576p", "360p", "240p"].includes(quality)) quality = "\u{1F4A9} Low Quality";
      else if (!quality || ["auto", "unknown", "unknow"].includes(String(quality).toLowerCase())) quality = "Unknown";
      
      let language = stream.language || "Language: \u{1F1EC}\u{1F1E7} \u{1F1EE}\u{1F1F9}";
      let details = [];
      if (stream.size) details.push(`\u{1F4E6} ${stream.size}`);
      const desc = details.join(" | ");
      
      let pName = stream.name || stream.server || providerName;
      if (pName) {
         pName = `\u{1F4E1} ${pName.replace(/\s*\[?\(?\s*SUB\s*ITA\s*\)?\]?/i, "").replace(/\s*\[?\(?\s*ITA\s*\)?\]?/i, "").trim()}`;
      }

      const behaviorHints = stream.behaviorHints && typeof stream.behaviorHints === "object" ? __spreadValues({}, stream.behaviorHints) : {};
      let finalHeaders = normalizePlaybackHeaders(stream.headers);

      let finalTitle = `\u{1F4C1} ${stream.title || "Stream"}`;
      if (desc) finalTitle += ` | ${desc}`;
      finalTitle += ` | ${language}`;

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
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") return { signal: AbortSignal.timeout(parsed), cleanup: null };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), parsed);
      return { signal: controller.signal, cleanup: () => clearTimeout(timeoutId) };
    }
    module2.exports = { createTimeoutSignal };
  }
});

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    function checkQualityFromText2(text) {
      if (!text) return null;
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
var USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function getCommonHeaders() {
  return {
    "User-Agent": USER_AGENT,
    "Referer": `${getStreamingCommunityBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
  };
}

function getTmdbId(imdbId, type) {
  return __async(this, null, function* () {
    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    try {
      const response = yield fetch(findUrl);
      if (!response.ok) return null;
      const data = yield response.json();
      if (type === "movie" && data.movie_results[0]) return data.movie_results[0].id.toString();
      if (type === "tv" && data.tv_results[0]) return data.tv_results[0].id.toString();
      return null;
    } catch (e) { return null; }
  });
}

function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    const baseUrl = getStreamingCommunityBaseUrl();
    const normalizedType = type === "series" ? "tv" : type;
    let tmdbId = id.toString();

    if (tmdbId.startsWith("tt")) {
      const converted = yield getTmdbId(tmdbId, normalizedType);
      if (converted) tmdbId = converted;
    }

    const apiUrl = normalizedType === "movie" 
      ? `${baseUrl}/api/movie/${tmdbId}` 
      : `${baseUrl}/api/tv/${tmdbId}/${season}/${episode}`;

    try {
      const response = yield fetch(apiUrl, { headers: getCommonHeaders() });
      if (!response.ok) return [];
      const apiPayload = yield response.json();
      if (!apiPayload.src) return [];

      const embedResponse = yield fetch(apiPayload.src, { headers: getCommonHeaders() });
      if (!embedResponse.ok) return [];
      const embedHtml = yield embedResponse.text();
      
      const token = embedHtml.match(/'token'\s*:\s*'([^']+)'/i);
      const expires = embedHtml.match(/'expires'\s*:\s*'([^']+)'/i);
      const playlistUrlMatch = embedHtml.match(/url\s*:\s*'([^']+\/playlist\/\d+[^']*)'/i);

      if (token && expires && playlistUrlMatch) {
        const streamUrl = `${playlistUrlMatch[1]}?token=${encodeURIComponent(token[1])}&expires=${encodeURIComponent(expires[1])}&h=1&lang=all`;
        
        // FIX: Remove hardcoded "1080p". Default to Unknown.
        let detectedQuality = "Unknown";
        
        try {
          const playlistCheck = yield fetch(streamUrl, { 
            headers: { 
              "User-Agent": USER_AGENT, 
              "Referer": apiPayload.src 
            } 
          });
          if (playlistCheck.ok) {
            const playlistText = yield playlistCheck.text();
            detectedQuality = checkQualityFromText(playlistText) || "Unknown";
          }
        } catch (e) {
          console.warn("[Quality Check Failed]", e);
        }

        const result = {
          name: `VixSrc`,
          title: apiPayload.title || "Stream",
          url: streamUrl,
          quality: detectedQuality,
          type: "direct",
          headers: { "Referer": apiPayload.src, "User-Agent": USER_AGENT },
          behaviorHints: { notWebReady: false }
        };
        
        return [formatStream(result, "StreamingCommunity")];
      }
      return [];
    } catch (error) {
      return [];
    }
  });
}

module.exports = { getStreams };
