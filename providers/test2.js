/** StreamPlay - Movies4U Provider Only */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
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

// src/config/domains.js
var require_domains = __commonJS({
  "src/config/domains.js"(exports2, module2) {
    module2.exports = Object.freeze({
      TMDB_API: "https://api.themoviedb.org/3",
      PHISHER_DOMAINS: "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json",
      WORKER: "https://lucky-star-3059.salman-sohail93.workers.dev",
      MOVIES4U_FALLBACK: "https://new2.movies4u.clinic",
      GDFLIX_MIRRORS: ["https://new3.gdflix.cfd", "https://new2.gdflix.cfd"]
    });
  }
});

// src/providers/vcloud.js
var require_vcloud = __commonJS({
  "src/providers/vcloud.js"(exports2, module2) {
    var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
    function clean(value) {
      return String(value || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
    }
    function origin(url) {
      const match = String(url).match(/^(https?:\/\/[^/]+)/i);
      return match ? match[1] : "";
    }
    function absolute(value, base) {
      if (!value)
        return null;
      const url = String(value).replace(/&amp;/gi, "&").trim();
      if (/^https?:\/\//i.test(url))
        return url;
      if (url.startsWith("/"))
        return origin(base) + url;
      return String(base).replace(/\/[^/]*$/, "/") + url.replace(/^\.\//, "");
    }
    function anchors(html, base) {
      const output = [];
      const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while (match = regex.exec(html)) {
        const url = absolute(match[1], base);
        if (url)
          output.push({ url, text: clean(match[2]) });
      }
      return output;
    }
    function getResponse(url, referer, redirect) {
      return __async(this, null, function* () {
        return fetch(url, {
          redirect: redirect || "follow",
          headers: __spreadValues({ "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" }, referer ? { Referer: referer } : {})
        });
      });
    }
    function decodeTwice(value) {
      try {
        return atob(atob(value));
      } catch (_) {
        return "";
      }
    }
    function extractIntermediate(html) {
      const script = String(html);
      const encoded = script.match(/atob\(atob\(['"]([^'"]+)['"]\)\)/i);
      if (encoded)
        return decodeTwice(encoded[1]);
      const plain = script.match(/var\s+url\s*=\s*['"]([^'"]+)['"]/i);
      return plain ? plain[1] : "";
    }
    function qualityFrom(value) {
      const match = String(value).match(/(2160|1080|720|480|360)p?/i);
      if (!match)
        return "Unknown";
      return match[1] === "2160" ? "4K" : `${match[1]}p`;
    }
    function resolveServer(server, label, referer) {
      return __async(this, null, function* () {
        let url = server.url;
        const text = server.text;
        let name = text || "V-Cloud";
        if (/buzzserver/i.test(text)) {
          const response = yield getResponse(url.replace(/\/$/, "") + "/download", url, "manual");
          const target = response.headers.get("hx-redirect");
          if (!target)
            return null;
          url = absolute(target, url);
          name = "BuzzServer";
        } else if (/pixeldra|pixelserver|\bpixel\b/i.test(text)) {
          if (!/download/i.test(url))
            url = origin(url) + "/api/file/" + url.split("/").filter(Boolean).pop() + "?download";
          name = "Pixeldrain";
        } else if (/10\s*gbps/i.test(text)) {
          const response = yield getResponse(url, referer, "follow");
          url = response.url || url;
          if (url.includes("link="))
            url = decodeURIComponent(url.split("link=").pop());
          name = "10Gbps";
          if (response.body && response.body.cancel)
            yield response.body.cancel();
        } else if (/fslv2/i.test(text))
          name = "FSLv2";
        else if (/\bfsl\b/i.test(text))
          name = "FSL";
        else if (/pdl server/i.test(text))
          name = "PDL";
        else if (/s3 server/i.test(text))
          name = "S3";
        else if (/mega server/i.test(text))
          name = "Mega";
        return { name, url, quality: qualityFrom(label), headers: { "User-Agent": USER_AGENT, Referer: referer } };
      });
    }
    function resolveVCloud(url, referer, label) {
      return __async(this, null, function* () {
        try {
          let response = yield getResponse(url, referer);
          if (!response.ok)
            return { streams: [], blocked: `HTTP ${response.status}` };
          let html = yield response.text();
          let pageUrl = response.url || url;
          if (/api\/index\.php/i.test(pageUrl)) {
            const next = anchors(html, pageUrl).find((item) => /download|v-?cloud|continue/i.test(item.text + " " + item.url));
            if (!next)
              return { streams: [], blocked: "api/index.php target missing" };
            response = yield getResponse(next.url, pageUrl);
            if (!response.ok)
              return { streams: [], blocked: `HTTP ${response.status}` };
            html = yield response.text();
            pageUrl = response.url || next.url;
          }
          const intermediate = absolute(extractIntermediate(html), pageUrl);
          if (!intermediate)
            return { streams: [], blocked: "encoded intermediate URL missing" };
          response = yield getResponse(intermediate, pageUrl);
          if (!response.ok)
            return { streams: [], blocked: `intermediate HTTP ${response.status}` };
          const serverHtml = yield response.text();
          const serverPage = response.url || intermediate;
          const candidates = anchors(serverHtml, serverPage).filter((item) => /fsl|buzz|pixel|pdl|10\s*gbps|s3 server|mega server/i.test(item.text));
          const results = yield Promise.all(candidates.map((item) => resolveServer(item, label, serverPage).catch(() => null)));
          return { streams: results.filter(Boolean), blocked: null };
        } catch (error) {
          return { streams: [], blocked: error && error.message ? error.message : String(error) };
        }
      });
    }
    module2.exports = { resolveVCloud };
  }
});

// src/shared/html.js
var require_html = __commonJS({
  "src/shared/html.js"(exports2, module2) {
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
    module2.exports = { DEFAULT_TIMEOUT_MS, mergeHeaders, request };
  }
});

// src/shared/streams.js
var require_streams = __commonJS({
  "src/shared/streams.js"(exports2, module2) {
    var { mergeHeaders } = require_http();
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
      const languages = [];
      const languagePatterns = [
        ["Hindi", /\b(?:hindi|hin)\b/i],
        ["English", /\b(?:english|eng)\b/i],
        ["Tamil", /\b(?:tamil|tam)\b/i],
        ["Telugu", /\b(?:telugu|tel)\b/i],
        ["Malayalam", /\b(?:malayalam|mal)\b/i],
        ["Kannada", /\b(?:kannada|kan)\b/i]
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
    function normalizeStream(stream, defaults = {}) {
      if (!stream || !/^https?:\/\//i.test(stream.url || ""))
        return null;
      const attributes = parseMediaAttributes(stream.url, stream.title, stream.name, stream.label, stream.fileName);
      return __spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues({
        url: stream.url,
        quality: stream.quality || parseQuality2(stream.url, stream.title, stream.name),
        title: stream.title || stream.name || defaults.title || "Stream",
        headers: mergeHeaders(defaults.headers, stream.headers),
        subtitles: stream.subtitles || []
      }, stream.size || attributes.size ? { size: stream.size || attributes.size } : {}), stream.hdr !== void 0 || attributes.hdr ? { hdr: stream.hdr !== void 0 ? stream.hdr : attributes.hdr } : {}), stream.codec || attributes.codec ? { codec: stream.codec || attributes.codec } : {}), stream.audio || attributes.audio ? { audio: stream.audio || attributes.audio } : {}), stream.languages || attributes.languages.length ? { languages: stream.languages || attributes.languages } : {});
    }
    function qualityRank(quality) {
      const text = String(quality || "").toUpperCase();
      if (text === "4K" || text.includes("2160"))
        return 2160;
      const match = text.match(/(1440|1080|720|480|360|240)/);
      return match ? Number(match[1]) : 0;
    }
    function normalizeDisplayQuality(value) {
      const rank = qualityRank(value);
      return rank === 2160 ? "4K" : rank > 0 ? `${rank}p` : "Unknown";
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
      if (/\.m3u8(?:$|[?#])/i.test(url)) {
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
    function uniqueExactStreams3(streams) {
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
        const provider = "Movies4U";
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
    function mapConcurrent3(items, concurrency, fn) {
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
    module2.exports = {
      normalizeStream,
      parseMediaAttributes,
      parseQuality: parseQuality2,
      qualityRank,
      normalizeDisplayQuality,
      streamOrderPrefix,
      getSeekableHint,
      uniqueExactStreams: uniqueExactStreams3,
      mapConcurrent: mapConcurrent3
    };
  }
});

// src/providers/movies4u.js
var require_movies4u = __commonJS({
  "src/providers/movies4u.js"(exports2, module2) {
    var DOMAINS = require_domains();
    var TMDB_API = DOMAINS.TMDB_API;
    var WORKER = DOMAINS.WORKER;
    var { resolveVCloud } = require_vcloud();
    var { mapConcurrent, uniqueExactStreams } = require_streams();
    var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
    var DOMAINS_URL = DOMAINS.PHISHER_DOMAINS;
    var MOVIES4U_FALLBACK = DOMAINS.MOVIES4U_FALLBACK;
    var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

    function requestText(url, referer) {
      return __async(this, null, function* () {
        let lastError;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = yield fetch(url, {
              redirect: "follow",
              headers: __spreadValues({
                "User-Agent": USER_AGENT,
                Accept: "text/html,application/json;q=0.9,*/*;q=0.8"
              }, referer ? { Referer: referer } : {})
            });
            if (!response.ok)
              throw new Error(`HTTP ${response.status} for ${url}`);
            return response.text();
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      });
    }

    function getMediaInfo(tmdbId, mediaType) {
      return __async(this, null, function* () {
        const endpoint = mediaType === "tv" ? "tv" : "movie";
        const url = `${TMDB_API}/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=external_ids`;
        const data = JSON.parse(yield requestText(url));
        return {
          title: mediaType === "tv" ? data.name : data.title,
          year: Number(String(mediaType === "tv" ? data.first_air_date : data.release_date).slice(0, 4)) || null,
          imdbId: data.imdb_id || (data.external_ids && data.external_ids.imdb_id) || null
        };
      });
    }

    function getMovies4uBase() {
      return __async(this, null, function* () {
        try {
          const domains = JSON.parse(yield requestText(DOMAINS_URL));
          if (domains.movies4u)
            return String(domains.movies4u).replace(/\/$/, "");
        } catch (_) {
        }
        return MOVIES4U_FALLBACK;
      });
    }

    function searchMovies4u(base, query) {
      return __async(this, null, function* () {
        const data = JSON.parse(yield requestText(`${base}/search.php?q=${encodeURIComponent(query)}`, base));
        return (data.hits || []).map((hit) => hit && hit.document).filter(Boolean);
      });
    }

    function chooseResult(results, media, mediaType) {
      const imdbMatch = results.find((item) => media.imdbId && item.imdb_id === media.imdbId);
      if (imdbMatch)
        return imdbMatch;
      const title = String(media.title || "").toLowerCase();
      const year = String(media.year || "");
      return results.find((item) => {
        const value = String(item.post_title || "").toLowerCase();
        return value.includes(title) && (!year || value.includes(year)) && (mediaType !== "tv" || /season|series|episode/i.test(value));
      }) || results[0];
    }

    function absoluteUrl(value, base) {
      if (!value)
        return null;
      const url = String(value).trim();
      if (/^https?:\/\//i.test(url))
        return url;
      const origin = String(base || "").match(/^(https?:\/\/[^/]+)/i);
      if (!origin)
        return null;
      if (url.startsWith("/"))
        return origin[1] + url;
      return String(base).replace(/\/[^/]*$/, "/").replace(/\/$/, "/") + url.replace(/^\.\//, "");
    }

    function cleanText(value) {
      return String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
    }

    function headingBlocks(html) {
      const blocks = [];
      const regex = /<(h[3-5])\b[^>]*>([\s\S]*?)<\/\1>([\s\S]*?)(?=<h[3-5]\b|$)/gi;
      let match;
      while (match = regex.exec(html))
        blocks.push({ heading: cleanText(match[2]), body: match[3] });
      return blocks;
    }

    function anchors(html, base) {
      const values = [];
      const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while (match = regex.exec(html)) {
        const url = absoluteUrl(match[1].replace(/&amp;/gi, "&"), base);
        if (url)
          values.push({ url, text: cleanText(match[2]) });
      }
      return values;
    }

    function movieReleaseLinks(html, base) {
      const links = [];
      for (const block of headingBlocks(html)) {
        for (const anchor of anchors(block.body, base)) {
          if (/nexdrive|dwd-button|download now/i.test(anchor.url + " " + anchor.text + " " + block.body)) {
            links.push({ url: anchor.url, label: block.heading });
          }
        }
      }
      return links;
    }

    function episodeReleaseLinks(html, base, season, episode) {
      const links = [];
      const seasonRegex = new RegExp(`season\\s*0?${season}(?:\\D|$)`, "i");
      for (const block of headingBlocks(html)) {
        if (!seasonRegex.test(block.heading))
          continue;
        for (const anchor of anchors(block.body, base)) {
          if (/(g-?direct|v-?cloud|single|download|nexdrive)/i.test(anchor.text + " " + anchor.url)) {
            links.push({ url: anchor.url, label: block.heading });
          }
        }
      }
      return links;
    }

    function qualityFrom(label) {
      const match = String(label).match(/(2160|1080|720|480|360)p?/i);
      if (!match)
        return "Unknown";
      return match[1] === "2160" ? "4K" : `${match[1]}p`;
    }

    function discoverCandidates(tmdbId, mediaType, season, episode) {
      return __async(this, null, function* () {
        if (!tmdbId || !["movie", "tv"].includes(mediaType))
          return [];
        if (mediaType === "tv" && (!season || !episode))
          return [];
        try {
          const [base, media] = yield Promise.all([getMovies4uBase(), getMediaInfo(tmdbId, mediaType)]);
          let results = media.imdbId ? yield searchMovies4u(base, media.imdbId) : [];
          if (!results.length)
            results = yield searchMovies4u(base, media.title);
          const result = chooseResult(results, media, mediaType);
          if (!result || !result.permalink)
            return [];
          const detailUrl = absoluteUrl(result.permalink, base);
          const detail = yield requestText(detailUrl, base);
          const releases = mediaType === "movie" ? movieReleaseLinks(detail, base) : episodeReleaseLinks(detail, base, Number(season), Number(episode));
          const candidateJobs = releases.map((release) => __async(this, null, function* () {
            try {
              const page = yield requestText(release.url, base);
              let routes = [];
              if (mediaType === "tv" && episode) {
                const episodeRegex = new RegExp(`episodes?\\s*:\\s*0?${episode}(?:\\D|$)`, "i");
                for (const block of headingBlocks(page)) {
                  if (!episodeRegex.test(block.heading))
                    continue;
                  routes = anchors(block.body, release.url);
                  break;
                }
              } else {
                routes = anchors(page, release.url);
              }
              const useful = routes.filter((item) => /g-?direct|instant|fastdl|v-?cloud|resumable|vcloud\.zip/i.test(item.text + " " + item.url));
              const quality = qualityFrom(release.label);
              return useful.map((route) => ({
                provider: "Movies4U",
                source: /vcloud\.zip|v-?cloud|resumable/i.test(route.text + " " + route.url) ? "VCloud" : "FastDL",
                quality,
                url: route.url,
                label: release.label,
                referer: release.url,
                headers: { "User-Agent": USER_AGENT, Referer: release.url },
                resolverType: /vcloud\.zip|v-?cloud|resumable/i.test(route.text + " " + route.url) ? "vcloud" : "fastdl"
              }));
            } catch (_) {
              return [];
            }
          }));
          const candidatesList = yield Promise.all(candidateJobs);
          return candidatesList.flat();
        } catch (error) {
          console.log(`[Movies4U Candidates] ${error && error.message ? error.message : error}`);
          return [];
        }
      });
    }

    function resolveCandidate(candidate) {
      return __async(this, null, function* () {
        if (!candidate || !candidate.url)
          return [];
        try {
          if (candidate.resolverType === "vcloud") {
            const resolved = yield resolveVCloud(candidate.url, candidate.referer, candidate.label || candidate.quality);
            return (resolved.streams || []).map((stream) => __spreadProps(__spreadValues({}, stream), {
              quality: candidate.quality || stream.quality,
              provider: "Movies4U",
              source: stream.name || "VCloud",
              subtitles: []
            }));
          }

          if (candidate.resolverType === "fastdl") {
            const workerUrl = `${WORKER}/?url=${encodeURIComponent(candidate.url)}&referer=${encodeURIComponent(candidate.referer)}`;
            const res = yield requestText(workerUrl, candidate.referer);
            const data = JSON.parse(res);
            if (data && data.url) {
              return [{
                url: data.url,
                quality: candidate.quality,
                provider: "Movies4U",
                source: "FastDL",
                headers: { "User-Agent": USER_AGENT, Referer: candidate.referer },
                subtitles: []
              }];
            }
          }

          return [];
        } catch (_) {
          return [];
        }
      });
    }

    function getStreams(tmdbId, mediaType, season, episode) {
      return __async(this, null, function* () {
        try {
          const candidates = yield discoverCandidates(tmdbId, mediaType, season, episode);
          const resolvedResults = yield mapConcurrent(candidates, 4, resolveCandidate);
          const flat = resolvedResults.flat().filter(Boolean);
          return uniqueExactStreams(flat);
        } catch (error) {
          console.log(`[Movies4U] ${error && error.message ? error.message : error}`);
          return [];
        }
      });
    }

    module2.exports = { discoverCandidates, resolveCandidate, getStreams };
  }
});

// Entry Point
var movies4u = require_movies4u();
module.exports = {
  getStreams: movies4u.getStreams
};
