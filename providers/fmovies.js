/**
 * patronDizipal - Full 559+ Line TV Optimized Version
 * Generated: 2026-04-29
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
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

// src/patronDizipal/index.js
var patronDizipal_exports = {};
__export(patronDizipal_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(patronDizipal_exports);

// src/patronDizipal/http.js
var MAIN_URL = "https://dizipal2063.com";
// TV OPTIMIZATION: Sony Bravia UA + CORS Headers from UHDMovies Template
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; BRAVIA 4K VH2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache"
};
var KNOWN_DOMAINS = [
  "https://dizipal2064.com",
  "https://dizipal2063.com",
  "https://dizipal2062.com",
  "https://dizipal2061.com"
];
var _resolvedUrl = null;
function resolveMainUrl() {
  return __async(this, null, function* () {
    if (_resolvedUrl)
      return _resolvedUrl;
    for (const domain of KNOWN_DOMAINS) {
      try {
        const res = yield fetch(`${domain}/`, {
          method: "HEAD",
          headers: HEADERS,
          mode: 'cors',
          signal: AbortSignal.timeout(5000) // TV FIX: Rapid domain switching
        });
        if (res.ok || res.status === 302 || res.status === 301) {
          const finalUrl = new URL(res.url).origin;
          _resolvedUrl = finalUrl;
          return finalUrl;
        }
      } catch (_) {
      }
    }
    _resolvedUrl = KNOWN_DOMAINS[0];
    return _resolvedUrl;
  });
}
function fixUrl(url, baseUrl = MAIN_URL) {
  if (!url)
    return "";
  if (url.startsWith("http://") || url.startsWith("https://"))
    return url;
  if (url.startsWith("//"))
    return `https:${url}`;
  try {
    return new URL(url, baseUrl).toString();
  } catch (_) {
    return url;
  }
}
function fetchWithResponse(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    // TV FIX: Merged UHDMovies fetch logic (mode/credentials/timeout)
    const response = yield fetch(url, __spreadProps(__spreadValues({}, options), {
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {}),
      mode: 'cors',
      credentials: 'omit',
      signal: AbortSignal.timeout(15e3)
    }));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} -> ${url}`);
    }
    return response;
  });
}
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const res = yield fetchWithResponse(url, options);
    return yield res.text();
  });
}
function fetchJSON(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const text = yield fetchText(url, options);
    try {
      return JSON.parse(text.replace(/^\ufeff/, ""));
    } catch (e) {
      throw new Error(`JSON parse hatas\u0131: ${e.message}`);
    }
  });
}

// src/patronDizipal/tmdb.js
var TMDB_API_KEY = "500330721680edb6d5f7f12ba7cd9023";
var PROVIDER_TAG = "[Dizipal]";
function decodeHtml(text) {
  return (text || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#039;/g, "'");
}
function getTmdbTitleFromHtml(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const type = mediaType === "movie" ? "movie" : "tv";
      const url = `https://www.themoviedb.org/${type}/${tmdbId}?language=tr-TR`;
      const response = yield fetch(url, {
        headers: { "User-Agent": HEADERS["User-Agent"] },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) return null;
      const html = yield response.text();
      let trTitle = "";
      const ogMatch = html.match(/<meta property="og:title" content="([^"]+)">/i);
      if (ogMatch) {
        trTitle = decodeHtml(ogMatch[1]).split("(")[0].trim();
      }
      const yearMatch = html.match(/\((\d{4})\)/);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;
      return { trTitle, origTitle: trTitle, shortTitle: trTitle.split(" ")[0], year };
    } catch (e) {
      return null;
    }
  });
}
function getTmdbTitleFromApi(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const type = mediaType === "movie" ? "movie" : "tv";
      const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=tr-TR`;
      const response = yield fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;
      const data = yield response.json();
      const trTitle = data.title || data.name || "";
      const dateStr = data.release_date || data.first_air_date || "";
      const year = dateStr ? parseInt(dateStr.substring(0, 4)) : null;
      return { trTitle, origTitle: data.original_title || trTitle, shortTitle: trTitle.split(" ")[0], year };
    } catch (e) {
      return null;
    }
  });
}
function getTmdbTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const htmlResult = yield getTmdbTitleFromHtml(tmdbId, mediaType);
    if (htmlResult) return htmlResult;
    const apiResult = yield getTmdbTitleFromApi(tmdbId, mediaType);
    return apiResult || { trTitle: "", origTitle: "", shortTitle: "", year: null };
  });
}

// src/patronDizipal/extractor.js
var PROVIDER_TAG2 = "[Dizipal]";
function resolveDizipal(url, activeUrl) {
  return __async(this, null, function* () {
    try {
      const response = yield fetchWithResponse(url);
      const html = yield response.text();
      const setCookie = response.headers.get("set-cookie");
      const cookies = setCookie ? setCookie.split(",").map((c) => c.split(";")[0]).join("; ") : "";
      const configToken = extractConfigToken(html);
      if (configToken) {
        const stream = yield resolveViaPlayerConfig(configToken, url, cookies, activeUrl);
        if (stream) return stream;
      }
      const directM3u8 = extractM3u8FromPage(html);
      if (directM3u8) {
        return { url: directM3u8, quality: "Auto", headers: { "Referer": url, "User-Agent": HEADERS["User-Agent"] } };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function extractConfigToken(html) {
  const patterns = [/data-cfg="([^"]+)"/, /data-hash="([^"]+)"/, /playerConfig\s*=\s*["']([^"']+)["']/];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}
function extractDirectEmbed(html) {
  const match = html.match(/iframe[^>]+src="([^"]*(?:embed|player|watch)[^"]+)"/i);
  return match ? fixUrl(match[1]) : null;
}
function extractM3u8FromPage(html) {
  const match = html.match(/["']([^"']*\.m3u8[^"']*)["']/);
  return match ? match[1] : null;
}
function resolveViaPlayerConfig(configToken, refererUrl, cookies, siteUrl) {
  return __async(this, null, function* () {
    try {
      const baseUrl = siteUrl || MAIN_URL;
      const configRes = yield fetch(`${baseUrl}/ajax-player-config`, {
        method: "POST",
        headers: __spreadValues(__spreadProps(__spreadValues({}, HEADERS), {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": refererUrl
        }), cookies ? { "Cookie": cookies } : {}),
        body: `cfg=${encodeURIComponent(configToken)}`,
        mode: 'cors',
        signal: AbortSignal.timeout(12000)
      });
      const configJson = yield configRes.json();
      const rawUrl = configJson?.config?.v || configJson?.url || null;
      if (!rawUrl) return null;
      const embedUrl = fixUrl(rawUrl.replace(/\\\//g, "/"));
      return yield resolveEmbed(embedUrl, refererUrl);
    } catch (e) {
      return null;
    }
  });
}
function resolveEmbed(embedUrl, refererUrl) {
  return __async(this, null, function* () {
    if (embedUrl.includes("imagestoo")) return yield resolveImagestoo(embedUrl);
    return yield resolveStandard(embedUrl, refererUrl);
  });
}
function resolveImagestoo(embedUrl) {
  return __async(this, null, function* () {
    try {
      const videoId = embedUrl.split("/").filter(Boolean).pop();
      const apiUrl = `https://imagestoo.com/player/index.php?data=${videoId}&do=getVideo`;
      const response = yield fetch(apiUrl, {
        method: "POST",
        headers: __spreadProps(__spreadValues({}, HEADERS), { "X-Requested-With": "XMLHttpRequest", "Referer": embedUrl }),
        mode: 'cors',
        signal: AbortSignal.timeout(15e3)
      });
      const data = yield response.json();
      if (data.securedLink) {
        return { url: fixUrl(data.securedLink), quality: "Auto", headers: { "Referer": embedUrl, "User-Agent": HEADERS["User-Agent"] } };
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
function resolveStandard(embedUrl, referer) {
  return __async(this, null, function* () {
    const html = yield fetchText(embedUrl, { headers: { "Referer": referer } });
    const m3u8Match = html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) || html.match(/["']([^"']*\.m3u8[^"']*)["']/i);
    if (m3u8Match) {
      return { url: m3u8Match[1], quality: "Auto", headers: { "Referer": embedUrl, "User-Agent": HEADERS["User-Agent"] } };
    }
    return null;
  });
}

// src/patronDizipal/index.js
// TV FIX: Final getStreams export with full logic integration
function getStreams(tmdbId, type, season, episode) {
  return __async(this, null, function* () {
    try {
      const activeUrl = yield resolveMainUrl();
      const { trTitle, origTitle, year } = yield getTmdbTitle(tmdbId, type);
      if (!trTitle && !origTitle) return [];
      
      const matchType = type === "movie" ? "Film" : "Dizi";
      const queries = [...new Set([trTitle, origTitle].filter(q => q.length > 2))];
      let match = null;

      for (const query of queries) {
        const searchUrl = `${activeUrl}/ajax-search?q=${encodeURIComponent(query)}`;
        try {
          const results = yield fetchJSON(searchUrl, { 
            headers: { "X-Requested-With": "XMLHttpRequest", "Referer": `${activeUrl}/` } 
          });
          if (results?.success && Array.isArray(results.results)) {
            match = results.results.find(r => r.type === matchType && (!year || !r.year || Math.abs(year - r.year) <= 1));
            if (match) break;
          }
        } catch (e) {}
      }

      if (!match) return [];
      let contentUrl = fixUrl(match.url, activeUrl);

      if (type === "tv") {
        contentUrl = yield getEpisodeUrl(contentUrl, season, episode, activeUrl);
        if (!contentUrl) return [];
      }

      const stream = yield resolveDizipal(contentUrl, activeUrl);
      if (stream) {
        return [{
          name: "Dizipal TV",
          url: stream.url,
          quality: "Auto",
          headers: __spreadValues(stream.headers || {}, { "User-Agent": HEADERS["User-Agent"], "Origin": activeUrl })
        }];
      }
    } catch (e) {
      console.error(`${PROVIDER_TAG} Error: ${e.message}`);
    }
    return [];
  });
}

function getEpisodeUrl(seriesUrl, season, episode, activeUrl) {
  return __async(this, null, function* () {
    try {
      const html = yield fetchText(seriesUrl);
      const epPattern = new RegExp(`${season}[.\\s]*sezon[\\s.]*${episode}[.\\s]*b[oö]l[uü]m`, "i");
      const blocks = html.split('class="detail-episode-item');
      for (const block of blocks) {
        if (epPattern.test(block)) {
          const hrefMatch = block.match(/href="([^"]+)"/);
          if (hrefMatch) return fixUrl(hrefMatch[1], activeUrl);
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}
