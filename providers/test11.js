/** AnimeCloud - generated from src/providers/animecloud.js */
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

// src/shared/html.js
var require_html = __commonJS({
  "src/shared/html.js"(exports2, module2) {
    var cheerio = require("cheerio-without-node-native");
    function parseHtml2(html) {
      return cheerio.load(typeof html === "string" ? html : "");
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
    module2.exports = { absoluteUrl: absoluteUrl2, decodeBase64, parseHtml: parseHtml2 };
  }
});

// src/shared/http.js
var require_http = __commonJS({
  "src/shared/http.js"(exports2, module2) {
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
    function withReferer2(headers, referer) {
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
    function getText2(url, options) {
      return __async(this, null, function* () {
        const response = yield request(url, options);
        if (!response.ok)
          throw new Error(`HTTP ${response.status} for ${url}`);
        return response.text();
      });
    }
    function getJson2(url, options) {
      return __async(this, null, function* () {
        const response = yield request(url, options);
        if (!response.ok)
          throw new Error(`HTTP ${response.status} for ${url}`);
        return response.json();
      });
    }
    module2.exports = { DEFAULT_TIMEOUT_MS, getJson: getJson2, getText: getText2, mergeHeaders, request, withReferer: withReferer2 };
  }
});

// src/shared/media.js
var require_media = __commonJS({
  "src/shared/media.js"(exports2, module2) {
    var { getJson: getJson2 } = require_http();
    var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
    function getMediaInfo2(_0, _1) {
      return __async(this, arguments, function* (tmdbId, mediaType, options = {}) {
        const type = mediaType === "tv" ? "tv" : "movie";
        const url = `https://api.themoviedb.org/3/${type}/${encodeURIComponent(tmdbId)}?api_key=${TMDB_API_KEY}`;
        const data = yield getJson2(url, options);
        return {
          title: data.title || data.name || "",
          year: Number(String(data.release_date || data.first_air_date || "").slice(0, 4)) || null,
          raw: data
        };
      });
    }
    module2.exports = { getMediaInfo: getMediaInfo2 };
  }
});

// src/shared/matching.js
var require_matching = __commonJS({
  "src/shared/matching.js"(exports2, module2) {
    function normalizeTitle(value) {
      return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(the|a|an)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
    }
    function titleScore(candidate, wanted) {
      const a = normalizeTitle(candidate);
      const b = normalizeTitle(wanted);
      if (!a || !b)
        return 0;
      if (a === b)
        return 100;
      if (a.includes(b) || b.includes(a))
        return 70;
      const wantedWords = new Set(b.split(" "));
      const overlap = a.split(" ").filter((word) => wantedWords.has(word)).length;
      return Math.round(overlap / Math.max(wantedWords.size, 1) * 50);
    }
    function bestTitleMatch2(items, wanted, getTitle = (item) => item.title) {
      var _a;
      return ((_a = items.reduce((best, item) => {
        const score = titleScore(getTitle(item), wanted);
        return !best || score > best.score ? { item, score } : best;
      }, null)) == null ? void 0 : _a.item) || null;
    }
    function episodeNumber(value) {
      const match = String(value || "").match(/(?:episode|ep|e)\s*[-.:#]?\s*(\d+(?:\.\d+)?)/i) || String(value || "").match(/\b(\d+(?:\.\d+)?)\b/);
      return match ? Number(match[1]) : null;
    }
    function matchesEpisode(value, wanted) {
      const actual = episodeNumber(value);
      return actual !== null && actual === Number(wanted);
    }
    module2.exports = { bestTitleMatch: bestTitleMatch2, episodeNumber, matchesEpisode, normalizeTitle, titleScore };
  }
});

// src/shared/streams.js
var require_streams = __commonJS({
  "src/shared/streams.js"(exports2, module2) {
    var { absoluteUrl: absoluteUrl2, parseHtml: parseHtml2 } = require_html();
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
    function uniqueStreams2(streams, defaults) {
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
    function resolveFinalUrl2(_0) {
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
          const resolved = yield resolveFinalUrl2(candidate, options, depth + 1).catch(() => null);
          if (resolved)
            return resolved;
        }
        const $ = parseHtml2(html);
        const iframe = absoluteUrl2($("iframe").first().attr("src") || $("iframe").first().attr("data-src"), finalUrl);
        if (iframe && iframe !== url)
          return resolveFinalUrl2(iframe, options, depth + 1).catch(() => null);
        return null;
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
      resolveFinalUrl: resolveFinalUrl2,
      uniqueStreams: uniqueStreams2
    };
  }
});

// src/providers/animecloud.js
var { absoluteUrl, parseHtml } = require_html();
var { getJson, getText, withReferer } = require_http();
var { getMediaInfo } = require_media();
var { bestTitleMatch } = require_matching();
var { parseQuality, resolveFinalUrl, uniqueStreams } = require_streams();
var BASE_URL = "https://fireani.me";
var HEADERS = withReferer({
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
}, `${BASE_URL}/`);
function getStreams(tmdbId, mediaType, season = 1, episode = 1) {
  return __async(this, null, function* () {
    var _a;
    try {
      const { title } = yield getMediaInfo(tmdbId, mediaType);
      if (!title)
        return [];
      const search = yield getJson(`${BASE_URL}/api/anime/search?q=${encodeURIComponent(title)}`, { headers: HEADERS });
      const results = Array.isArray(search == null ? void 0 : search.data) ? search.data : [];
      const match = bestTitleMatch(results, title, (item) => item.title || item.name || item.slug);
      if (!(match == null ? void 0 : match.slug))
        return [];
      const targetSeason = Number(season) === 0 ? "Filme" : String(Number(season) || 1);
      const data = yield getJson(`${BASE_URL}/api/anime/episode?slug=${encodeURIComponent(match.slug)}&season=${encodeURIComponent(targetSeason)}&episode=${Number(episode) || 1}`, { headers: HEADERS });
      const links = ((_a = data == null ? void 0 : data.data) == null ? void 0 : _a.anime_episode_links) || [];
      const streams = [];
      for (const link of links) {
        const pageUrl = absoluteUrl(link.link, BASE_URL);
        if (!pageUrl)
          continue;
        const pageHeaders = withReferer(HEADERS, BASE_URL);
        const finalUrl = yield resolveFinalUrl(pageUrl, { headers: pageHeaders }).catch(() => null);
        if (!finalUrl)
          continue;
        streams.push({
          url: finalUrl,
          quality: parseQuality(finalUrl, link.quality),
          title: `AnimeCloud [${String(link.lang || "Unknown").toUpperCase()}]`,
          headers: withReferer(HEADERS, pageUrl),
          subtitles: []
        });
      }
      return uniqueStreams(streams);
    } catch (error) {
      console.error("[AnimeCloud]", error.message || error);
      return [];
    }
  });
}
module.exports = { getStreams };
