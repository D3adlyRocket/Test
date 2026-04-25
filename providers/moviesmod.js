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
        else normalized[key] = value;
      }
      return normalized;
    }
    function formatStream2(stream, providerName) {
      let quality = stream.quality || "";
      if (quality === "4K") quality = "\u{1F525}4K UHD";
      else if (quality === "1440p") quality = "\u2728 QHD";
      else if (quality === "1080p") quality = "\u{1F680} FHD";
      else if (quality === "720p") quality = "\u{1F4BF} HD";
      else if (quality === "480p" || quality === "576p" || quality === "360p") quality = "\u{1F4A9} Low Quality";
      else quality = "Unknown";

      let language = stream.language || "Language: \u{1F1EC}\u{1F1E7} \u{1F1EE}\u{1F1F9}";
      let pName = `\u{1F4E1} ${stream.name || providerName}`;
      
      let finalTitle = `\u{1F4C1} ${stream.title || "Stream"}`;
      if (stream.size) finalTitle += ` | \u{1F4E6} ${stream.size}`;
      finalTitle += ` | ${language}`;

      return __spreadProps(__spreadValues({}, stream), {
        name: pName,
        title: finalTitle,
        qualityTag: quality,
        _nuvio_formatted: true,
        headers: normalizePlaybackHeaders(stream.headers)
      });
    }
    module2.exports = { formatStream: formatStream2 };
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
var { formatStream } = require_formatter();
var { checkQualityFromText } = require_quality_helper();
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";

function getCommonHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://vixsrc.to/",
    "Accept": "*/*"
  };
}

function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    const baseUrl = "https://vixsrc.to";
    let tmdbId = id.toString();

    // ID Conversion logic
    if (tmdbId.startsWith("tt")) {
      const findUrl = `https://api.themoviedb.org/3/find/${tmdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const res = yield fetch(findUrl);
      const data = yield res.json();
      const result = type === "movie" ? data.movie_results[0] : data.tv_results[0];
      if (result) tmdbId = result.id.toString();
    }

    const apiUrl = type === "movie" ? `${baseUrl}/api/movie/${tmdbId}` : `${baseUrl}/api/tv/${tmdbId}/${season}/${episode}`;

    try {
      const response = yield fetch(apiUrl, { headers: getCommonHeaders() });
      const apiPayload = yield response.json();
      if (!apiPayload.src) return [];

      const embedRes = yield fetch(apiPayload.src, { headers: getCommonHeaders() });
      const embedHtml = yield embedRes.text();
      
      const token = embedHtml.match(/'token'\s*:\s*'([^']+)'/i);
      const expires = embedHtml.match(/'expires'\s*:\s*'([^']+)'/i);
      const playlistUrl = embedHtml.match(/url\s*:\s*'([^']+\/playlist\/\d+[^']*)'/i);

      if (token && expires && playlistUrl) {
        const streamUrl = `${playlistUrl[1]}?token=${token[1]}&expires=${expires[1]}&h=1&lang=all`;
        
        // FIX: No more guessing 1080p. Start with Unknown.
        let detectedQuality = "Unknown";
        
        const playlistCheck = yield fetch(streamUrl, { headers: getCommonHeaders() });
        if (playlistCheck.ok) {
          const text = yield playlistCheck.text();
          detectedQuality = checkQualityFromText(text) || "Unknown";
        }

        return [formatStream({
          name: "VixSrc",
          title: apiPayload.title || "Stream",
          url: streamUrl,
          quality: detectedQuality,
          headers: { "Referer": apiPayload.src }
        }, "StreamingCommunity")];
      }
      return [];
    } catch (e) { return []; }
  });
}

module.exports = { getStreams };
