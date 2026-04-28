/**
 * patronDizipal - UHDMovies Template Optimized for Android TV
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

var patronDizipal_exports = {};
__export(patronDizipal_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(patronDizipal_exports);

// TV OPTIMIZED CONSTANTS (From UHDMovies Template)
var TV_UA = "Mozilla/5.0 (Linux; Android 10; BRAVIA 4K VH2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var TV_HEADERS = {
  "User-Agent": TV_UA,
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1"
};

var KNOWN_DOMAINS = [
  "https://dizipal2064.com",
  "https://dizipal2063.com",
  "https://dizipal2062.com"
];

var _resolvedUrl = null;

function resolveMainUrl() {
  return __async(this, null, function* () {
    if (_resolvedUrl) return _resolvedUrl;
    for (const domain of KNOWN_DOMAINS) {
      try {
        const res = yield fetch(`${domain}/`, {
          method: "HEAD",
          headers: TV_HEADERS,
          mode: 'cors',
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
          _resolvedUrl = new URL(res.url).origin;
          return _resolvedUrl;
        }
      } catch (e) {}
    }
    return KNOWN_DOMAINS[0];
  });
}

function fetchTV(url, options = {}) {
  return __async(this, null, function* () {
    return yield fetch(url, __spreadValues({
      headers: __spreadValues(__spreadValues({}, TV_HEADERS), options.headers || {}),
      method: options.method || "GET",
      mode: 'cors',
      credentials: 'omit',
      signal: AbortSignal.timeout(15000)
    }, options));
  });
}

// Extraction Logic
function resolveDizipal(url, activeUrl) {
  return __async(this, null, function* () {
    try {
      const res = yield fetchTV(url);
      const html = yield res.text();
      
      // Look for data-cfg (Player Config)
      const cfgMatch = html.match(/data-cfg="([^"]+)"/);
      if (cfgMatch) {
        const configRes = yield fetchTV(`${activeUrl}/ajax-player-config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": url
          },
          body: `cfg=${encodeURIComponent(cfgMatch[1])}`
        });
        const configJson = yield configRes.json();
        const streamUrl = configJson?.config?.v || configJson?.url;
        if (streamUrl) return { url: streamUrl.replace(/\\\//g, "/"), ref: url };
      }

      // Fallback to M3U8 regex
      const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
      if (m3u8Match) return { url: m3u8Match[1], ref: url };

      return null;
    } catch (e) {
      return null;
    }
  });
}

async function getStreams(tmdbId, type, season, episode) {
  try {
    const activeUrl = yield resolveMainUrl();
    
    // TMDB Search Logic (Simplified for TV Speed)
    const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=500330721680edb6d5f7f12ba7cd9023&language=tr-TR`;
    const tmdbRes = yield fetch(tmdbUrl);
    const tmdbData = yield tmdbRes.json();
    const query = tmdbData.title || tmdbData.name;
    
    if (!query) return [];

    const searchUrl = `${activeUrl}/ajax-search?q=${encodeURIComponent(query)}`;
    const searchRes = yield fetchTV(searchUrl, { headers: { "X-Requested-With": "XMLHttpRequest" }});
    const searchData = yield searchRes.json();
    
    if (!searchData.success || !searchData.results.length) return [];

    // Find closest match
    const match = searchData.results[0];
    let targetUrl = match.url.startsWith('http') ? match.url : `${activeUrl}${match.url}`;

    if (type === "tv") {
      const pageRes = yield fetchTV(targetUrl);
      const pageHtml = yield pageRes.text();
      const epPattern = new RegExp(`${season}.*sezon.*${episode}.*b\xF6l\xFCm`, "i");
      const blocks = pageHtml.split('class="detail-episode-item');
      
      for (const block of blocks) {
        if (epPattern.test(block)) {
          const href = block.match(/href="([^"]+)"/);
          if (href) targetUrl = href[1].startsWith('http') ? href[1] : `${activeUrl}${href[1]}`;
        }
      }
    }

    const stream = yield resolveDizipal(targetUrl, activeUrl);
    if (stream) {
      return [{
        name: "Dizipal TV",
        url: stream.url,
        quality: "Auto",
        headers: {
          "User-Agent": TV_UA,
          "Referer": stream.ref,
          "Origin": activeUrl
        }
      }];
    }
  } catch (e) {
    console.log("TV Fetch Error: " + e.message);
  }
  return [];
}
