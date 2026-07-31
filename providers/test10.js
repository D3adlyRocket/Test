/** MoviesDrive - generated from src/moviesdrive/index.js */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
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
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
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

// src/config/domains.js
var require_domains = __commonJS({
  "src/config/domains.js"(exports, module2) {
    module2.exports = Object.freeze({
      TMDB_API: "https://api.themoviedb.org/3",
      PHISHER_DOMAINS: "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json",
      WORKER: "https://lucky-star-3059.salman-sohail93.workers.dev",
      MOVIESDRIVE_FALLBACK: "https://new1.moviesdrive.christmas",
      VEGAMOVIES_FALLBACK: "https://vegamovies.catering",
      MOVIES4U_FALLBACK: "https://new2.movies4u.clinic",
      FOURKHDHUB_FALLBACK: "https://4khdhub.one",
      MULTIMOVIES_FALLBACK: "https://multimovies.makeup",
      CASTLE_API: "https://api.hlowb.com",
      NEXDRIVE: "https://nexdrive.fit",
      HUBCLOUD: "https://hubcloud.cx",
      VCLOUD: "https://vcloud.zip",
      FASTDL: "https://fastdl.zip",
      GDFLIX_MIRRORS: ["https://new3.gdflix.cfd", "https://new2.gdflix.cfd"]
    });
  }
});

// src/shared/html.js
var require_html = __commonJS({
  "src/shared/html.js"(exports, module2) {
    var cheerio3 = require("cheerio-without-node-native");
    function parseHtml(html) {
      return cheerio3.load(typeof html === "string" ? html : "");
    }
    function decodeBase64(value) {
      if (!value)
        return "";
      if (typeof globalThis.atob === "function")
        return globalThis.atob(value);
      if (typeof Buffer !== "undefined")
        return Buffer.from(value, "base64").toString("utf8");
      throw new Error("No base64 decoder is available in this runtime");
    }
    function absoluteUrl2(value, baseUrl) {
      if (!value)
        return "";
      try {
        return new URL(value, baseUrl).href;
      } catch (_) {
        return "";
      }
    }
    module2.exports = { absoluteUrl: absoluteUrl2, decodeBase64, parseHtml };
  }
});

// src/shared/http.js
var require_http = __commonJS({
  "src/shared/http.js"(exports, module2) {
    var DEFAULT_TIMEOUT_MS = 3e4;
    var RETRYABLE_STATUS = /* @__PURE__ */ new Set([408, 425, 429, 500, 502, 503, 504]);
    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    function mergeHeaders(...sets) {
      const result = {};
      for (const set of sets) {
        if (!set)
          continue;
        for (const key of Object.keys(set)) {
          if (set[key] !== void 0 && set[key] !== null && set[key] !== "")
            result[key] = String(set[key]);
        }
      }
      return result;
    }
    function withReferer(headers, referer) {
      if (!referer)
        return mergeHeaders(headers);
      let origin;
      try {
        origin = new URL(referer).origin;
      } catch (_) {
      }
      return mergeHeaders(headers, { Referer: referer, Origin: origin });
    }
    function request(_0) {
      return __async(this, arguments, function* (url, options = {}) {
        const _a = options, {
          timeoutMs = DEFAULT_TIMEOUT_MS,
          retries = 1,
          retryDelayMs = 300
        } = _a, fetchOptions = __objRest(_a, [
          "timeoutMs",
          "retries",
          "retryDelayMs"
        ]);
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
          const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
          try {
            const response = yield fetch(url, __spreadProps(__spreadValues({
              skipSizeCheck: true
            }, fetchOptions), {
              signal: controller ? controller.signal : fetchOptions.signal
            }));
            if (!response.ok && RETRYABLE_STATUS.has(response.status) && attempt < retries) {
              yield sleep(retryDelayMs * (attempt + 1));
              continue;
            }
            return response;
          } catch (error) {
            lastError = error;
            if (attempt >= retries)
              throw error;
            yield sleep(retryDelayMs * (attempt + 1));
          } finally {
            if (timer)
              clearTimeout(timer);
          }
        }
        throw lastError || new Error(`Request failed: ${url}`);
      });
    }
    function getText(url, options) {
      return __async(this, null, function* () {
        const response = yield request(url, options);
        if (!response.ok)
          throw new Error(`HTTP ${response.status} for ${url}`);
        return response.text();
      });
    }
    function getJson(url, options) {
      return __async(this, null, function* () {
        const response = yield request(url, options);
        if (!response.ok)
          throw new Error(`HTTP ${response.status} for ${url}`);
        return response.json();
      });
    }
    module2.exports = { DEFAULT_TIMEOUT_MS, getJson, getText, mergeHeaders, request, withReferer };
  }
});

// src/shared/streams.js
var require_streams = __commonJS({
  "src/shared/streams.js"(exports, module2) {
    var { absoluteUrl: absoluteUrl2, parseHtml } = require_html();
    var { mergeHeaders, request } = require_http();
    var MEDIA_EXTENSION = /\.(?:m3u8|mp4|m4v|webm|mkv|mpd)(?:$|[?#])/i;
    var EMBED_HINT = /(?:embed|player|watch|streamtape|dood|vidhide|filemoon|streamwish|vidwish|megacloud)/i;
    var PLACEHOLDER_MEDIA = /(?:one\.one\.one\.one\/media\/open-graph\.mp4|\/favicon\.|\/logo\.(?:mp4|m3u8)|\b(?:trailer|sample|placeholder|preview)[-_./])/i;
    function parseQuality2(...values) {
      const text = values.filter(Boolean).join(" ").toLowerCase();
      if (/\b(?:2160p?|4k|uhd)\b/.test(text))
        return "4K";
      for (const quality of [1440, 1080, 720, 576, 480, 360, 240]) {
        if (new RegExp(`\\b${quality}p?\\b`).test(text))
          return `${quality}p`;
      }
      return "Unknown";
    }
    function parseMediaAttributes(...values) {
      var _a;
      const text = values.filter(Boolean).join(" ");
      const lower = text.toLowerCase();
      const languages = [];
      const languagePatterns = [
        ["Hindi", /\b(?:hindi|hin)\b/i],
        ["English", /\b(?:english|eng)\b/i],
        ["Tamil", /\b(?:tamil|tam)\b/i],
        ["Telugu", /\b(?:telugu|tel)\b/i],
        ["Malayalam", /\b(?:malayalam|mal)\b/i],
        ["Kannada", /\b(?:kannada|kan)\b/i],
        ["Portuguese", /\b(?:portuguese|portugu[eê]s|pt-br)\b/i],
        ["French", /\b(?:french|fran[cç]ais)\b/i]
      ];
      for (const [name, pattern] of languagePatterns)
        if (pattern.test(text))
          languages.push(name);
      return {
        quality: parseQuality2(text),
        hdr: /\b(?:hdr10\+?|dolby\s*vision|dv)\b/i.test(text),
        codec: /\b(?:hevc|h\.?265|x265)\b/i.test(text) ? "HEVC" : /\b(?:avc|h\.?264|x264)\b/i.test(text) ? "AVC" : void 0,
        audio: /\b(?:dual[ -]?audio|multi[ -]?audio|dual)\b/i.test(text) ? "Dual/Multi Audio" : void 0,
        languages,
        size: (_a = text.match(/\b\d+(?:\.\d+)?\s*(?:GB|MB)\b/i)) == null ? void 0 : _a[0]
      };
    }
    function normalizeSubtitles(subtitles) {
      if (!Array.isArray(subtitles))
        return [];
      const seen = /* @__PURE__ */ new Set();
      return subtitles.flatMap((subtitle) => {
        const url = typeof subtitle === "string" ? subtitle : subtitle && (subtitle.url || subtitle.file);
        if (!/^https?:\/\//i.test(url || "") || seen.has(url))
          return [];
        seen.add(url);
        return [{
          url,
          language: subtitle && (subtitle.language || subtitle.lang || subtitle.label) || "Unknown"
        }];
      });
    }
    function normalizeStream(stream, defaults = {}) {
      if (!stream || !/^https?:\/\//i.test(stream.url || ""))
        return null;
      const attributes = parseMediaAttributes(stream.url, stream.title, stream.name, stream.label, stream.fileName);
      return __spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues({
        url: stream.url,
        quality: stream.quality || parseQuality2(stream.url, stream.title, stream.name),
        title: stream.title || stream.name || defaults.title || "Stream",
        headers: mergeHeaders(defaults.headers, stream.headers),
        subtitles: normalizeSubtitles(stream.subtitles)
      }, stream.size || attributes.size ? { size: stream.size || attributes.size } : {}), stream.hdr !== void 0 || attributes.hdr ? { hdr: stream.hdr !== void 0 ? stream.hdr : attributes.hdr } : {}), stream.codec || attributes.codec ? { codec: stream.codec || attributes.codec } : {}), stream.audio || attributes.audio ? { audio: stream.audio || attributes.audio } : {}), stream.languages || attributes.languages.length ? { languages: stream.languages || attributes.languages } : {});
    }
    function uniqueStreams(streams, defaults) {
      const seen = /* @__PURE__ */ new Set();
      return (streams || []).flatMap((stream) => {
        const normalized = normalizeStream(stream, defaults);
        if (!normalized || seen.has(normalized.url))
          return [];
        seen.add(normalized.url);
        return [normalized];
      });
    }
    function extractMediaCandidates(html, baseUrl) {
      const values = [];
      const patterns = [
        /(?:file|source|src)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4|webm|mkv|mpd)[^"']*)["']/gi,
        /https?:\\?\/\\?\/[^"'\s<>]+\.(?:m3u8|mp4|webm|mkv|mpd)(?:[^"'\s<>]*)/gi
      ];
      for (const pattern of patterns) {
        let match;
        while (match = pattern.exec(html || ""))
          values.push((match[1] || match[0]).replace(/\\\//g, "/"));
      }
      return values.map((value) => absoluteUrl2(value, baseUrl)).filter(Boolean);
    }
    function resolveFinalUrl(_0) {
      return __async(this, arguments, function* (url, options = {}, depth = 0) {
        if (!/^https?:\/\//i.test(url || "") || PLACEHOLDER_MEDIA.test(url) || depth > 2)
          return null;
        const response = yield request(url, __spreadProps(__spreadValues({}, options), { redirect: "follow", retries: 0 }));
        if (!response.ok)
          return null;
        const finalUrl = response.url || url;
        if (PLACEHOLDER_MEDIA.test(finalUrl))
          return null;
        const contentType = response.headers && response.headers.get && response.headers.get("content-type") || "";
        const isHtml = /html|text\/html/i.test(contentType);
        if (/^(?:video|audio)\//i.test(contentType) || /mpegurl|dash\+xml/i.test(contentType) || MEDIA_EXTENSION.test(finalUrl) && !isHtml)
          return finalUrl;
        if (!/html|text\//i.test(contentType))
          return EMBED_HINT.test(finalUrl) ? null : finalUrl;
        const html = yield response.text();
        const candidates = extractMediaCandidates(html, finalUrl);
        for (const candidate of candidates) {
          const resolved = yield resolveFinalUrl(candidate, options, depth + 1).catch(() => null);
          if (resolved)
            return resolved;
        }
        const $ = parseHtml(html);
        const iframe = absoluteUrl2($("iframe").first().attr("src") || $("iframe").first().attr("data-src"), finalUrl);
        if (iframe && iframe !== url)
          return resolveFinalUrl(iframe, options, depth + 1).catch(() => null);
        return null;
      });
    }
    function qualityRank(quality) {
      const text = String(quality || "").toUpperCase();
      if (text === "4K" || text.includes("2160"))
        return 2160;
      const match = text.match(/(1440|1080|720|576|480|360|240)/);
      return match ? Number(match[1]) : 0;
    }
    function normalizeDisplayQuality(value) {
      const rank = qualityRank(value);
      return rank === 2160 ? "4K" : rank > 0 ? `${rank}p` : "Unknown";
    }
    function qualityOrderPrefix(quality) {
      const rank = { "4K": 1, "1080p": 2, "720p": 3, "480p": 4, "360p": 5, "240p": 6 }[quality] || 9;
      return "\u200B".repeat(rank);
    }
    function streamOrderPrefix(quality, seekable) {
      var _a;
      const qualityPosition = (_a = { "4K": 0, "1080p": 1, "720p": 2, "480p": 3, "360p": 4, "240p": 5 }[quality]) != null ? _a : 8;
      const seekPosition = seekable === true ? 1 : seekable === false ? 3 : 2;
      return "\u200B".repeat(qualityPosition * 3 + seekPosition);
    }
    function getSeekableHint(stream) {
      if (stream && (stream.seekable === true || stream.seekable === false)) {
        return stream.seekable;
      }
      const url = String((stream == null ? void 0 : stream.url) || "").toLowerCase();
      const source = String((stream == null ? void 0 : stream.source) || (stream == null ? void 0 : stream.name) || "").toLowerCase();
      if (/hubcloud\s*fsl|\bfsl\b/i.test(source) || /cloudflarestorage\.com\/hub\//i.test(url)) {
        return true;
      }
      if (/\.m3u8(?:$|[?#])/i.test(url) || /castle/i.test(source) && /hls|m3u8/i.test(`${source} ${url}`)) {
        return true;
      }
      if (/hubcloud\s*pixel\s*10gbps|10gbps/i.test(source)) {
        return false;
      }
      return "unknown";
    }
    function seekableOrderRank(hint) {
      if (hint === true)
        return 2;
      if (hint === "unknown")
        return 1;
      if (hint === false)
        return 0;
      return 1;
    }
    function uniqueExactStreams2(streams) {
      const seen = /* @__PURE__ */ new Set();
      const valid = [];
      for (const stream of streams || []) {
        if (!stream || !stream.url)
          continue;
        const quality = normalizeDisplayQuality(stream.quality || stream.name || stream.title);
        const rawSource = stream.source || stream.provider || "Direct";
        const canonicalSource = rawSource.replace(/\s*\([^)]*no\s*seek[^)]*\)/gi, "").trim();
        const key = `${quality}|${canonicalSource}|${stream.url}`;
        if (seen.has(key))
          continue;
        seen.add(key);
        const provider = stream.provider || "StreamPlay";
        const seekable = getSeekableHint(__spreadProps(__spreadValues({}, stream), { source: canonicalSource }));
        let displaySource = canonicalSource;
        if (seekable === false && !/\(no\s*seek\)/i.test(displaySource)) {
          displaySource = `${displaySource} (No Seek)`;
        }
        const prefix = streamOrderPrefix(quality, seekable);
        const name = `${prefix}${provider} \u2022 ${quality} \u2022 ${displaySource}`;
        valid.push(__spreadProps(__spreadValues({}, stream), {
          name,
          quality,
          source: canonicalSource,
          provider,
          seekable
        }));
      }
      return valid.sort((a, b) => {
        const qDiff = qualityRank(b.quality) - qualityRank(a.quality);
        if (qDiff !== 0)
          return qDiff;
        return seekableOrderRank(b.seekable) - seekableOrderRank(a.seekable);
      });
    }
    function mapConcurrent2(items, concurrency, fn) {
      return __async(this, null, function* () {
        if (!Array.isArray(items) || !items.length)
          return [];
        const limit = Math.max(1, Number(concurrency) || 4);
        const results = new Array(items.length);
        let index = 0;
        function worker() {
          return __async(this, null, function* () {
            while (index < items.length) {
              const i = index++;
              try {
                results[i] = yield fn(items[i], i);
              } catch (err) {
                results[i] = null;
              }
            }
          });
        }
        const workers = [];
        for (let w = 0; w < Math.min(limit, items.length); w++) {
          workers.push(worker());
        }
        yield Promise.all(workers);
        return results;
      });
    }
    function checkStreamRange(_0) {
      return __async(this, arguments, function* (url, headers = {}, timeoutMs = 3e3) {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
          const res = yield fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: controller ? controller.signal : void 0,
            headers: __spreadValues({
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36",
              Range: "bytes=1000000-1001023"
            }, headers)
          });
          if (timer)
            clearTimeout(timer);
          const contentRange = res.headers ? res.headers.get("content-range") : null;
          const acceptRanges = res.headers ? res.headers.get("accept-ranges") : null;
          const contentType = res.headers ? res.headers.get("content-type") : null;
          const status = res.status;
          const seekable = status === 206 || !!contentRange || acceptRanges === "bytes";
          if (res.body && typeof res.body.cancel === "function") {
            try {
              yield res.body.cancel();
            } catch (_) {
            }
          }
          return {
            ok: res.ok || status === 206,
            status,
            finalUrl: res.url || url,
            contentType,
            contentRange,
            acceptRanges,
            seekable
          };
        } catch (error) {
          if (timer)
            clearTimeout(timer);
          return { ok: false, status: 0, seekable: false, error: error.message };
        }
      });
    }
    module2.exports = {
      MEDIA_EXTENSION,
      PLACEHOLDER_MEDIA,
      extractMediaCandidates,
      normalizeStream,
      normalizeSubtitles,
      parseMediaAttributes,
      parseQuality: parseQuality2,
      qualityRank,
      normalizeDisplayQuality,
      qualityOrderPrefix,
      streamOrderPrefix,
      getSeekableHint,
      resolveFinalUrl,
      uniqueStreams,
      uniqueExactStreams: uniqueExactStreams2,
      mapConcurrent: mapConcurrent2,
      checkStreamRange
    };
  }
});

// src/moviesdrive/index.js
var moviesdrive_exports = {};
__export(moviesdrive_exports, {
  default: () => moviesdrive_default,
  discoverCandidates: () => discoverCandidates,
  getStreams: () => getStreams,
  resolveCandidate: () => resolveCandidate
});
module.exports = __toCommonJS(moviesdrive_exports);
var import_cheerio_without_node_native2 = __toESM(require("cheerio-without-node-native"));

// src/moviesdrive/constants.js
var import_domains = __toESM(require_domains());
var MAIN_URL = import_domains.default.MOVIESDRIVE_FALLBACK;
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "Referer": `${MAIN_URL}/`
};
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

// src/moviesdrive/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var import_domains2 = __toESM(require_domains());
function absoluteUrl(value, base) {
  if (!value || typeof value !== "string")
    return null;
  try {
    return new URL(value, base).toString();
  } catch (_) {
    return null;
  }
}
function parseSize(value) {
  const match = String(value || "").match(/([\d.]+)\s*(GB|MB)/i);
  return match ? `${Number(match[1]).toFixed(match[1].includes(".") ? 1 : 0)} ${match[2].toUpperCase()}` : void 0;
}
function parseQuality(value) {
  const text = String(value || "");
  if (/\b(?:2160p?|4k)\b/i.test(text))
    return "4K";
  const match = text.match(/\b(1080|720|480|360|240)p?\b/i);
  return match ? `${match[1]}p` : "Unknown";
}
function safeUrl(value) {
  if (!value)
    return null;
  const parsed = new URL(value);
  parsed.pathname = parsed.pathname.split("/").map((segment) => {
    try {
      return encodeURIComponent(decodeURIComponent(segment));
    } catch (_) {
      return encodeURIComponent(segment);
    }
  }).join("/");
  return parsed.toString();
}
function hubCloudServer(text, link) {
  const value = `${text || ""} ${link || ""}`.toLowerCase();
  if (/gpdl\.|server\s*:\s*10gbps/.test(value))
    return "HubCloud Pixel 10Gbps";
  if (/fslv2/.test(value))
    return "HubCloud FSLv2";
  if (/fsl/.test(value))
    return "HubCloud FSL";
  if (/s3 server/.test(value))
    return "HubCloud S3";
  if (/mega server/.test(value))
    return "HubCloud Mega";
  if (/pdl server/.test(value))
    return "HubCloud PDL";
  if (/buzzserver/.test(value))
    return "HubCloud BuzzServer";
  if (/pixeldrain/.test(value))
    return "HubCloud Pixeldrain";
  if (/pixel\.|pixelserver/.test(value))
    return "HubCloud Pixel";
  if (/workers\.dev|download file/.test(value))
    return "HubCloud Direct";
  return "HubCloud";
}
function wrapFslMkvUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!(host === "r2.cloudflarestorage.com" || host.endsWith(".r2.cloudflarestorage.com")))
      return url;
    return `${import_domains2.default.WORKER}/media/file.mkv?url=${encodeURIComponent(url)}`;
  } catch (_) {
    return url;
  }
}
function expandMovieButton(_0) {
  return __async(this, arguments, function* (url, hint = {}) {
    var _a, _b;
    try {
      const response = yield fetch(url, { headers: HEADERS });
      const html = yield response.text();
      if (/search-recover\.php/i.test(response.url || url)) {
        const query = (_a = html.match(/Q_INITIAL\s*=\s*"([^"]+)"/)) == null ? void 0 : _a[1];
        const token = (_b = html.match(/FROM_AC_TOKEN\s*=\s*"([^"]+)"/)) == null ? void 0 : _b[1];
        if (!query || !token)
          return [];
        const endpoint = (response.url || url).split("?")[0];
        const pageNumbers = hint.season && hint.episode ? [1, 2, 3, 4, 5] : [1];
        const payloads = yield Promise.all(pageNumbers.map((page) => {
          const params = new URLSearchParams({ api: "search", q: query, page: String(page), from_ac: token });
          return fetch(`${endpoint}?${params}`, { headers: __spreadProps(__spreadValues({}, HEADERS), { Accept: "application/json" }) }).then((r) => r.json()).catch(() => ({ hits: [] }));
        }));
        const hits = payloads.flatMap((data) => data.hits || []);
        const words = query.toLowerCase().replace(/\b(download|19\d{2}|20\d{2}|2160p|1080p|720p|480p)\b/g, "").split(/\W+/).filter((w) => w.length > 2);
        return hits.filter((hit) => {
          const name = String(hit.file_name || "");
          const normalized = name.toLowerCase();
          if (!words.every((word) => normalized.includes(word)) || /\.zip(?:$|\?)/i.test(name))
            return false;
          if (!hint.season || !hint.episode)
            return true;
          const season = Number(hint.season);
          const episode = Number(hint.episode);
          const seasonMatch = new RegExp(`(?:s|season[ ._-]*)0?${season}(?:\\D|$)`, "i").test(name);
          const episodeMatch = new RegExp(`(?:e|ep|episode[ ._-]*)0?${episode}(?:\\D|$)`, "i").test(name);
          const compactMatch = new RegExp(`(?:^|\\D)${season}x0?${episode}(?:\\D|$)`, "i").test(name);
          return seasonMatch && episodeMatch || compactMatch;
        }).map((hit) => hit.url).filter((link, index, all) => link && all.indexOf(link) === index);
      }
      const $ = import_cheerio_without_node_native.default.load(html);
      const hosts = $("a[href]").map((_, anchor) => $(anchor).attr("href")).get().filter((href) => /hubcloud/i.test(href || ""));
      return hosts.length ? hosts : [response.url || url];
    } catch (_) {
      return [];
    }
  });
}
function extractHubCloud(url, referer) {
  return __async(this, null, function* () {
    var _a;
    try {
      let currentUrl = url.replace("hubcloud.foo", "hubcloud.cx").replace("hubcloud.ink", "hubcloud.dad");
      let response = yield fetch(currentUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }) });
      let html = yield response.text();
      let pageUrl = response.url || currentUrl;
      let $ = import_cheerio_without_node_native.default.load(html);
      const generate = $('a[href*="hubcloud.php"]').first().attr("href") || $("#download").attr("href") || ((_a = html.match(/var url = '([^']+)'/)) == null ? void 0 : _a[1]);
      if (generate) {
        const next = absoluteUrl(generate, pageUrl);
        if (next) {
          response = yield fetch(next, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: pageUrl }) });
          html = yield response.text();
          pageUrl = response.url || next;
          $ = import_cheerio_without_node_native.default.load(html);
        }
      }
      const header = $("div.card-header").text().trim() || $("title").text().trim();
      const size = parseSize($("i#size").text());
      const quality = parseQuality(header);
      const buttons = $("a.btn[href]").map((_, element) => {
        const link = $(element).attr("href");
        const text = $(element).text().toLowerCase();
        if (!link || !/(download file|download\s*\[server|fsl|buzzserver|pixeldra|pixelserver|pixel server|s3 server|mega server|pdl server)/i.test(text))
          return null;
        if (/workers\.dev/i.test(link) && /download file/i.test(text))
          return null;
        return { link: absoluteUrl(link, pageUrl), text };
      }).get().filter(Boolean);
      const streams = yield Promise.all(buttons.map((button) => __async(this, null, function* () {
        var _a2, _b, _c, _d, _e, _f, _g, _h;
        let link = button.link;
        if (/pixeldra|pixelserver|pixel server/i.test(button.text)) {
          return null;
        } else if (/gpdl\.|download\s*\[server\s*:\s*10gbps/i.test(`${button.link} ${button.text}`)) {
          try {
            const gateway = yield fetch(link, { redirect: "manual", headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: pageUrl }) });
            const worker = absoluteUrl((_b = (_a2 = gateway.headers) == null ? void 0 : _a2.get) == null ? void 0 : _b.call(_a2, "location"), link);
            if (!worker)
              return null;
            const generated = yield fetch(worker, { redirect: "manual", headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: link }) });
            const wrapper = absoluteUrl((_d = (_c = generated.headers) == null ? void 0 : _c.get) == null ? void 0 : _d.call(_c, "location"), worker);
            if (!wrapper)
              return null;
            link = new URL(wrapper).searchParams.get("link");
            if (!link)
              return null;
          } catch (_) {
            return null;
          }
        } else if (/buzzserver/i.test(button.text)) {
          try {
            const response2 = yield fetch(link, { redirect: "manual", headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: pageUrl }) });
            link = absoluteUrl(((_f = (_e = response2.headers) == null ? void 0 : _e.get) == null ? void 0 : _f.call(_e, "hx-redirect")) || ((_h = (_g = response2.headers) == null ? void 0 : _g.get) == null ? void 0 : _h.call(_g, "location")), link);
            if (!link)
              return null;
          } catch (_) {
            return null;
          }
        }
        const source = hubCloudServer(button.text, button.link);
        if (/HubCloud FSL/i.test(source))
          link = wrapFslMkvUrl(link);
        return {
          source,
          title: [quality, size].filter(Boolean).join(" \u2022 "),
          url: safeUrl(link),
          quality,
          size,
          headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: pageUrl }),
          subtitles: []
        };
      })));
      return streams.filter(Boolean);
    } catch (_) {
      return [];
    }
  });
}
function extractGdflix(_0, _1) {
  return __async(this, arguments, function* (url, referer, hint = {}) {
    var _a, _b, _c, _d, _e, _f;
    const makeStream = (source, link, quality, size, pageUrl, headers = {}) => ({
      source,
      title: [quality, size].filter(Boolean).join(" \u2022 "),
      url: safeUrl(link),
      quality,
      size,
      headers: __spreadValues(__spreadProps(__spreadValues({}, HEADERS), { Referer: pageUrl }), headers),
      subtitles: []
    });
    const metaRefreshUrl = (html, base) => {
      var _a2, _b2;
      const $ = import_cheerio_without_node_native.default.load(html || "");
      const content = $('meta[http-equiv="refresh"]').first().attr("content") || "";
      const target = (_b2 = (_a2 = content.match(/url\s*=\s*["']?([^"';]+)/i)) == null ? void 0 : _a2[1]) == null ? void 0 : _b2.trim();
      return target ? absoluteUrl(target, base) : null;
    };
    const extractGofile = (link, quality, size, pageUrl) => __async(this, null, function* () {
      var _a2, _b2, _c2, _d2;
      try {
        const id = (_a2 = link.match(/(?:[?&]c=|\/d\/)([a-zA-Z0-9-]+)/)) == null ? void 0 : _a2[1];
        if (!id)
          return [];
        const account = yield fetch("https://api.gofile.io/accounts", {
          method: "POST",
          headers: __spreadProps(__spreadValues({}, HEADERS), { Accept: "application/json" })
        }).then((response) => response.json());
        const token = (_b2 = account == null ? void 0 : account.data) == null ? void 0 : _b2.token;
        if (!token)
          return [];
        const globalJs = yield fetch("https://gofile.io/dist/js/global.js", { headers: HEADERS }).then((response) => response.text());
        const wt = (_c2 = globalJs.match(/appdata\.wt\s*=\s*["']([^"']+)/)) == null ? void 0 : _c2[1];
        if (!wt)
          return [];
        const data = yield fetch(`https://api.gofile.io/contents/${id}?wt=${encodeURIComponent(wt)}`, {
          headers: __spreadProps(__spreadValues({}, HEADERS), { Accept: "application/json", Authorization: `Bearer ${token}` })
        }).then((response) => response.json());
        const children = Object.values(((_d2 = data == null ? void 0 : data.data) == null ? void 0 : _d2.children) || {});
        return children.filter((file) => file == null ? void 0 : file.link).map((file) => makeStream(
          "GDFlix GoFile",
          file.link,
          parseQuality(file.name) === "Unknown" ? quality : parseQuality(file.name),
          parseSize(file.name) || size,
          pageUrl,
          { Cookie: `accountToken=${token}` }
        ));
      } catch (_) {
        return [];
      }
    });
    try {
      const first = yield fetch(url, { redirect: "manual", headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }) });
      const firstHtml = yield first.text();
      const redirected = absoluteUrl((_b = (_a = first.headers) == null ? void 0 : _a.get) == null ? void 0 : _b.call(_a, "location"), url) || metaRefreshUrl(firstHtml, url);
      const id = (_c = url.match(/\/(?:w?file)\/([^/?#]+)/i)) == null ? void 0 : _c[1];
      const pageCandidates = [...new Set([
        redirected,
        first.ok && !redirected ? first.url || url : null,
        ...import_domains2.default.GDFLIX_MIRRORS.map((base) => id ? `${base}/file/${id}` : null)
      ].filter(Boolean))];
      const isCloudflareChallenge = (status, html) => status === 403 || /just a moment|cf-chl|turnstile|challenge-running/i.test(String(html || ""));
      const pages = yield Promise.all(pageCandidates.map((pageUrl) => __async(this, null, function* () {
        try {
          if (pageUrl === (first.url || url) && first.ok && !redirected) {
            if (isCloudflareChallenge(first.status, firstHtml))
              return null;
            return { html: firstHtml, pageUrl };
          }
          const response = yield fetch(pageUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: url }) });
          if (!response.ok)
            return null;
          const html = yield response.text();
          if (isCloudflareChallenge(response.status, html))
            return null;
          return { html, pageUrl: response.url || pageUrl };
        } catch (_) {
          return null;
        }
      })));
      const results = [];
      for (const page of pages.filter(Boolean)) {
        const $ = import_cheerio_without_node_native.default.load(page.html);
        const details = $("ul > li.list-group-item").text() || $("li").text() || $("title").text();
        const detectedQuality = parseQuality(details);
        const quality = detectedQuality === "Unknown" ? hint.quality || "1080p" : detectedQuality;
        const size = parseSize(details) || hint.size;
        const buttons = [];
        $("div.text-center a[href], a.btn[href]").each((_, element) => {
          buttons.push({ text: $(element).text().trim(), link: absoluteUrl($(element).attr("href"), page.pageUrl) });
        });
        if (!/list-group-item|direct\s*dl|instant\s*dl|gofile|pixeldra|pixelserver/i.test(page.html))
          continue;
        for (const button of buttons) {
          if (!button.link)
            continue;
          if (/direct\s*dl/i.test(button.text)) {
            results.push(makeStream("GDFlix Direct", button.link, quality, size, page.pageUrl));
          } else if (/instant\s*dl/i.test(button.text)) {
            try {
              const instant = yield fetch(button.link, { redirect: "manual", headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: page.pageUrl }) });
              const location = ((_e = (_d = instant.headers) == null ? void 0 : _d.get) == null ? void 0 : _e.call(_d, "location")) || instant.url;
              const direct = (_f = location == null ? void 0 : location.match(/[?&]url=([^&]+)/i)) == null ? void 0 : _f[1];
              const resolved = direct ? decodeURIComponent(direct) : location;
              if (resolved && resolved !== button.link)
                results.push(makeStream("GDFlix Instant Download", resolved, quality, size, page.pageUrl));
            } catch (_) {
            }
          } else if (/gofile/i.test(button.text)) {
            results.push(...yield extractGofile(button.link, quality, size, page.pageUrl));
          } else if (/pixeldra|pixelserver|\bpixel\b/i.test(button.text)) {
            continue;
          }
        }
        const cfBase = page.pageUrl.replace("/file/", "/wfile/").replace(/\?.*$/, "");
        const cfPages = yield Promise.all(["type=1", "type=2"].map((query) => __async(this, null, function* () {
          try {
            const cfUrl = `${cfBase}?${query}`;
            const response = yield fetch(cfUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: page.pageUrl }) });
            return response.ok ? { html: yield response.text(), url: response.url || cfUrl } : null;
          } catch (_) {
            return null;
          }
        })));
        for (const cfPage of cfPages.filter(Boolean)) {
          const $$ = import_cheerio_without_node_native.default.load(cfPage.html);
          const link = absoluteUrl($$("a.btn-success[href]").first().attr("href"), cfPage.url);
          if (link)
            results.push(makeStream("GDFlix CF", link, quality, size, cfPage.url));
        }
      }
      if (results.length)
        return results;
    } catch (_) {
    }
    return [];
  });
}
function extractHost(url, referer, hint = {}) {
  return /gdflix|gdlink/i.test(url) ? extractGdflix(url, referer, hint) : extractHubCloud(url, referer);
}

// src/moviesdrive/index.js
var import_streams = __toESM(require_streams());
var import_domains3 = __toESM(require_domains());
var DOMAINS_URL = import_domains3.default.PHISHER_DOMAINS;
function normalizeType(value) {
  return /^(tv|series|show)$/i.test(String(value || "")) ? "tv" : "movie";
}
function getMetadata(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var _a;
    const response = yield fetch(`${import_domains3.default.TMDB_API}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`, { headers: HEADERS });
    if (!response.ok)
      return null;
    const data = yield response.json();
    return { title: mediaType === "tv" ? data.name : data.title, imdbId: (_a = data.external_ids) == null ? void 0 : _a.imdb_id };
  });
}
function coversSeason(document, season) {
  if (!season)
    return true;
  const text = `${document.post_title || ""} ${document.permalink || ""}`;
  const range = text.match(/season\s*0?(\d+)\s*[-–—]\s*0?(\d+)/i);
  if (range && season >= Number(range[1]) && season <= Number(range[2]))
    return true;
  return new RegExp(`(?:season[ ._/-]*|\\bs)0?${season}(?:\\D|$)`, "i").test(text);
}
function getMainUrls() {
  return __async(this, null, function* () {
    const candidates = [];
    try {
      const response = yield fetch(DOMAINS_URL, { headers: HEADERS });
      if (response.ok) {
        const configured = String((yield response.json()).moviesdrive || "").replace(/\/$/, "");
        if (/^https?:\/\//i.test(configured))
          candidates.push(configured);
      }
    } catch (_) {
    }
    candidates.push(MAIN_URL);
    return [...new Set(candidates)];
  });
}
function search(metadata, season, mainUrls) {
  return __async(this, null, function* () {
    const queries = [metadata.imdbId, metadata.title].filter(Boolean);
    const attempts = mainUrls.flatMap((mainUrl) => queries.map((query) => __async(this, null, function* () {
      const data = yield fetch(`${mainUrl}/search.php?q=${encodeURIComponent(query)}&page=1`, { headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: `${mainUrl}/` }) }).then((r) => r.json());
      const documents = (data.hits || []).map((hit) => hit.document).filter(Boolean);
      const exact = metadata.imdbId ? documents.filter((doc) => doc.imdb_id === metadata.imdbId) : [];
      const titled = documents.filter((doc) => String(doc.post_title || "").toLowerCase().includes(String(metadata.title || "").toLowerCase()));
      const candidates = exact.length ? exact : titled;
      const match = candidates.find((doc) => coversSeason(doc, season));
      if (match)
        return `${mainUrl}${String(match.permalink).startsWith("/") ? "" : "/"}${match.permalink}`;
      throw new Error("No matching result");
    })));
    try {
      return yield Promise.any(attempts);
    } catch (_) {
      return null;
    }
  });
}
function seasonPages($, season) {
  const result = [];
  const pattern = new RegExp(`Season\\s*0?${season}(?:\\D|$)`, "i");
  $("h5").each((_, heading) => {
    if (!pattern.test($(heading).text()))
      return;
    let node = $(heading).next();
    let traversed = 0;
    while (node.length && traversed++ < 100) {
      const nodeText = node.text();
      const anchors = node.attr("href") ? [node] : node.find("a[href]").get();
      anchors.forEach((anchor) => {
        const text = $(anchor).text();
        const href = $(anchor).attr("href");
        if (href && /single\s*episode/i.test(text) && !/zip/i.test(text) && !result.some((item) => item.url === href)) {
          const qualityMatch = text.match(/\b(1080|720|480|360|240)p?\b/i);
          const quality = /(?:2160p?|4k)/i.test(text) ? "4K" : qualityMatch ? `${qualityMatch[1]}p` : "Unknown";
          result.push({ url: href, quality });
        }
      });
      if (/Season\s*\d+/i.test(nodeText))
        break;
      node = node.next();
    }
  });
  return result;
}
function episodeLinks($, episode) {
  const result = [];
  const pattern = new RegExp(`(?:Ep|Episode)\\s*0?${episode}(?:\\D|$)`, "i");
  $("h5").each((_, heading) => {
    var _a;
    const headingText = $(heading).text();
    if (!pattern.test(headingText))
      return;
    const qualityMatch = headingText.match(/\b(1080|720|480|360|240)p?\b/i);
    const quality = /(?:2160p?|4k)/i.test(headingText) ? "4K" : qualityMatch ? `${qualityMatch[1]}p` : "Unknown";
    const size = (_a = headingText.match(/([\d.]+)\s*(GB|MB)/i)) == null ? void 0 : _a[0];
    let node = $(heading).next();
    let traversed = 0;
    while (node.length && traversed++ < 100) {
      const nodeText = node.text();
      const anchors = node.attr("href") ? [node] : node.find("a[href]").get();
      anchors.forEach((anchor) => {
        const href = $(anchor).attr("href");
        if (href && /(hubcloud|gdflix|gdlink)/i.test(href) && !result.some((item) => item.url === href)) {
          result.push({ url: href, quality, size });
        }
      });
      if (/(?:Ep|Episode)\s*\d+/i.test(nodeText))
        break;
      node = node.next();
    }
  });
  return result;
}
function discoverCandidates(tmdbId, mediaType, season = 1, episode = 1) {
  return __async(this, null, function* () {
    try {
      const type = normalizeType(mediaType);
      const seasonNumber = Number(season) || 1;
      const episodeNumber = Number(episode) || 1;
      const [metadata, mainUrls] = yield Promise.all([
        getMetadata(String(tmdbId).replace(/^tmdb:/i, ""), type),
        getMainUrls()
      ]);
      if (!(metadata == null ? void 0 : metadata.title))
        return [];
      const mediaUrl = yield search(metadata, type === "tv" ? seasonNumber : null, mainUrls);
      if (!mediaUrl)
        return [];
      const html = yield fetch(mediaUrl, { headers: HEADERS }).then((r) => r.text());
      const $ = import_cheerio_without_node_native2.default.load(html);
      let hostPages = [];
      if (type === "movie") {
        const buttons = $("h5 > a[href]").map((_, anchor) => $(anchor).attr("href")).get().filter(Boolean);
        hostPages = (yield Promise.all([...new Set(buttons)].map(expandMovieButton))).flat();
      } else {
        const pages = seasonPages($, seasonNumber);
        const pageResults = yield Promise.all(pages.map((page) => __async(this, null, function* () {
          try {
            if (/search-recover\.php/i.test(page.url)) {
              return [__spreadProps(__spreadValues({}, page), { season: seasonNumber, episode: episodeNumber, referer: mediaUrl })];
            }
            const episodeHtml = yield fetch(page.url, { headers: HEADERS }).then((r) => r.text());
            return episodeLinks(import_cheerio_without_node_native2.default.load(episodeHtml), episodeNumber).map((item) => __spreadProps(__spreadValues({}, item), {
              season: seasonNumber,
              episode: episodeNumber,
              referer: page.url
            }));
          } catch (_) {
            return [];
          }
        })));
        hostPages = pageResults.flat();
      }
      const uniqueHosts = hostPages.filter((item, index, all) => {
        const url = typeof item === "string" ? item : item.url;
        return all.findIndex((other) => (typeof other === "string" ? other : other.url) === url) === index;
      });
      const expandedHosts = (yield Promise.all(uniqueHosts.map((item) => __async(this, null, function* () {
        const url = typeof item === "string" ? item : item.url;
        if (!/search-recover\.php/i.test(url))
          return [item];
        const expanded = yield expandMovieButton(url, typeof item === "string" ? {} : item);
        return expanded.map((expandedUrl) => typeof item === "string" ? expandedUrl : __spreadProps(__spreadValues({}, item), { url: expandedUrl }));
      })))).flat();
      return expandedHosts.map((item) => {
        const hint = typeof item === "string" ? {} : item;
        const url = typeof item === "string" ? item : item.url;
        const referer = hint.referer || mediaUrl;
        const isGdflix = /gdflix|gdlink/i.test(url);
        const isHubcloud = /hubcloud/i.test(url);
        return {
          provider: "MoviesDrive",
          source: isGdflix ? "GDFlix" : isHubcloud ? "HubCloud" : "MoviesDrive Host",
          quality: hint.quality || "Unknown",
          size: hint.size,
          url,
          referer,
          headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: referer }),
          resolverType: isGdflix ? "gdflix" : isHubcloud ? "hubcloud" : "direct"
        };
      });
    } catch (error) {
      console.error("[MoviesDrive Candidate Discovery] Error:", error.message);
      return [];
    }
  });
}
function resolveCandidate(candidate) {
  return __async(this, null, function* () {
    if (!candidate || !candidate.url)
      return [];
    try {
      if (candidate.resolverType === "direct") {
        return [{
          name: candidate.name || `MoviesDrive \u2022 ${candidate.quality || "Unknown"} \u2022 ${candidate.source || "Direct"}`,
          title: candidate.title,
          url: candidate.url,
          quality: candidate.quality || "Unknown",
          size: candidate.size,
          headers: candidate.headers || HEADERS,
          provider: "MoviesDrive",
          source: candidate.source || "Direct",
          subtitles: []
        }];
      }
      const streams = yield extractHost(candidate.url, candidate.referer || MAIN_URL, {
        quality: candidate.quality,
        size: candidate.size
      });
      return (streams || []).map((stream) => __spreadProps(__spreadValues({}, stream), {
        provider: "MoviesDrive"
      }));
    } catch (error) {
      return [];
    }
  });
}
function getStreams(tmdbId, mediaType, season = 1, episode = 1) {
  return __async(this, null, function* () {
    try {
      const candidates = yield discoverCandidates(tmdbId, mediaType, season, episode);
      const resolvedResults = yield (0, import_streams.mapConcurrent)(candidates, 4, resolveCandidate);
      const flatStreams = resolvedResults.flat().filter(Boolean);
      return (0, import_streams.uniqueExactStreams)(flatStreams);
    } catch (error) {
      console.error("[MoviesDrive] Error:", error.message);
      return [];
    }
  });
}
var moviesdrive_default = { discoverCandidates, resolveCandidate, getStreams };
