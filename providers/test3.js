const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const TORRENTIO_API = "https://torrentio.strem.fun";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept": "application/json"
};

// =========================================================================
// ARCHITECTURAL IMPLEMENTATIONS FROM CODE 1 (Safeguards for TV Runtimes)
// =========================================================================

// Safe Object Properties Merger (replaces standard object assigns or spreads that fail on older TVs)
const objProtoHasOwn = Object.prototype.hasOwnProperty;
const objProtoIsEnum = Object.prototype.propertyIsEnumerable;
const getSymbols = Object.getOwnPropertySymbols;

const defineProp = (target, key, val) => 
  key in target 
    ? Object.defineProperty(target, key, { enumerable: true, configurable: true, writable: true, value: val }) 
    : (target[key] = val);

const mergeProperties = (target, source) => {
  for (var key in source || (source = {})) {
    if (objProtoHasOwn.call(source, key)) defineProp(target, key, source[key]);
  }
  if (getSymbols) {
    for (var sym of getSymbols(source)) {
      if (objProtoIsEnum.call(source, sym)) defineProp(target, sym, source[sym]);
    }
  }
  return target;
};

// Custom TV Async Runner (Ensures Generator-based Async Tasks execute reliably on limited runtimes)
function tvAsyncRunner(self, args, generatorFunc) {
  return new Promise((resolve, reject) => {
    var onFulfilled = res => { try { step(generatorFunc.next(res)); } catch (e) { reject(e); } };
    var onRejected = err => { try { step(generatorFunc.throw(err)); } catch (e) { reject(e); } };
    var step = result => result.done ? resolve(result.value) : Promise.resolve(result.value).then(onFulfilled, onRejected);
    step((generatorFunc = generatorFunc.apply(self, args)).next());
  });
}

// Android TV Fallback Abort / Timeout Signal Controller
function createTimeoutSignal(ms) {
  let parsedMs = Number.parseInt(String(ms), 10);
  if (!Number.isFinite(parsedMs) || parsedMs <= 0) {
    return { signal: undefined, cleanup: null, timed: false };
  }
  // If the TV engine natively supports AbortSignal.timeout
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return { signal: AbortSignal.timeout(parsedMs), cleanup: null, timed: true };
  }
  // Manual AbortController + setTimeout fallback loop for older TV layers
  if (typeof AbortController !== 'undefined' && typeof setTimeout === 'function') {
    let controller = new AbortController();
    let timeoutId = setTimeout(() => { controller.abort(); }, parsedMs);
    return { signal: controller.signal, cleanup: () => clearTimeout(timeoutId), timed: true };
  }
  return { signal: undefined, cleanup: null, timed: false };
}

// The Exact fetchWithTimeout Wrapper utilized by the first script
function fetchWithTimeout(url, options = {}) {
  return tvAsyncRunner(this, arguments, function* (targetUrl, fetchOpts = {}) {
    if (typeof fetch === 'undefined') throw new Error("No fetch implementation found!");
    
    let originalTimeout = fetchOpts.timeout || 20000; // 20000ms from the original script
    let timeoutObj = createTimeoutSignal(originalTimeout);
    let requestConfig = mergeProperties({}, fetchOpts);

    if (timeoutObj.timed) {
      if (requestConfig.signal && typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
        requestConfig.signal = AbortSignal.any([requestConfig.signal, timeoutObj.signal]);
      } else if (!requestConfig.signal) {
        requestConfig.signal = timeoutObj.signal;
      }
    }

    try {
      return yield fetch(targetUrl, requestConfig);
    } catch (fetchErr) {
      if (fetchErr && fetchErr.name === 'AbortError' && timeoutObj.timed) {
        throw new Error("Request to " + targetUrl + " timed out after " + originalTimeout + "ms");
      }
      throw fetchErr;
    } finally {
      if (typeof timeoutObj.cleanup === 'function') timeoutObj.cleanup();
    }
  });
}

// =========================================================================
// CORE SCRAPER UTILITIES
// =========================================================================

function extractQuality(str = "") {
  const u = str.toLowerCase();
  if (u.includes("2160p") || u.includes("4k")) return "4K";
  if (u.includes("1080p")) return "1080p";
  if (u.includes("720p")) return "720p";
  if (u.includes("480p")) return "480p";
  return "Unknown";
}

const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce"
];

function buildMagnet(infoHash) {
  if (!infoHash) return "";
  const tr = TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join("");
  return `magnet:?xt=urn:btih:${infoHash}${tr}`;
}

// =========================================================================
// DATA FETCHING LAYERS (Wrapped in the TV runtime async engine)
// =========================================================================

function getImdbId(tmdbId, mediaType) {
  return tvAsyncRunner(this, arguments, function* (id, type) {
    try {
      const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
      
      // Fixed: Injecting runtime-safe fetch wrapper and appending the mandatory HEADERS configuration
      const response = yield fetchWithTimeout(url, { 
        headers: HEADERS, 
        timeout: 20000, 
        skipSizeCheck: true 
      });
      
      const res = yield response.json();
      return res.external_ids?.imdb_id || res.imdb_id || null;
    } catch (e) {
      return null;
    }
  });
}

function invokeTorrentio(imdbId, season, episode) {
  return tvAsyncRunner(this, arguments, function* (id, s, e) {
    try {
      const isTV = s != null && e != null;
      const url = isTV
        ? `${TORRENTIO_API}/stream/series/${id}:${s}:${e}.json`
        : `${TORRENTIO_API}/stream/movie/${id}.json`;

      console.log("[TORRENTIO URL]", url);

      // Using the exact timeout behavior context from the working script
      const response = yield fetchWithTimeout(url, {
        headers: HEADERS,
        timeout: 20000,
        skipSizeCheck: true
      });

      const json = yield response.json();

      if (!json || !json.streams) {
        console.log("[TORRENTIO] No streams");
        return [];
      }

      const streams = [];
      for (const stream of json.streams.slice(0, 15)) {
        try {
          const title = stream.title || "";
          const quality = extractQuality(title);
          const seeders = title.match(/👤\s*(\d+)/)?.[1] || "?";
          const magnet = buildMagnet(stream.infoHash);

          if (!magnet) continue;

          streams.push({
            url: magnet,
            quality,
            title: `Torrentio | ${quality} | 👤 ${seeders}`,
            subtitles: []
          });
        } catch (innerEx) {}
      }

      return streams;
    } catch (err) {
      console.log("[TORRENTIO ERROR]", err && err.message ? err.message : err);
      return [];
    }
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return tvAsyncRunner(this, arguments, function* (id, type, s, e) {
    try {
      const imdbId = yield getImdbId(id, type);

      if (!imdbId) {
        console.log("[TORRA] No IMDB ID");
        return [];
      }

      console.log("[TORRA IMDB]", imdbId);

      const streams = yield invokeTorrentio(
        imdbId,
        type === "tv" ? s : null,
        type === "tv" ? e : null
      );

      return streams;
    } catch (masterErr) {
      console.log("[TORRA FATAL]", masterErr);
      return [];
    }
  });
}

// ======================================
// REQUIRED EXPORT ROUTE
// ======================================
module.exports = {
  getStreams
};
