const TORRENTIO_API = "https://torrentio.strem.fun";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json"
};

// =========================================================================
// WORKING CODE EXECUTION IMPLEMENTATIONS (Safeguards for TV Runtimes)
// =========================================================================

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

function tvAsyncRunner(self, args, generatorFunc) {
  return new Promise((resolve, reject) => {
    var onFulfilled = res => { try { step(generatorFunc.next(res)); } catch (e) { reject(e); } };
    var onRejected = err => { try { step(generatorFunc.throw(err)); } catch (e) { reject(e); } };
    var step = result => result.done ? resolve(result.value) : Promise.resolve(result.value).then(onFulfilled, onRejected);
    step((generatorFunc = generatorFunc.apply(self, args)).next());
  });
}

function createTimeoutSignal(ms) {
  let parsedMs = Number.parseInt(String(ms), 10);
  if (!Number.isFinite(parsedMs) || parsedMs <= 0) {
    return { signal: undefined, cleanup: null, timed: false };
  }
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return { signal: AbortSignal.timeout(parsedMs), cleanup: null, timed: true };
  }
  if (typeof AbortController !== 'undefined' && typeof setTimeout === 'function') {
    let controller = new AbortController();
    let timeoutId = setTimeout(() => { controller.abort(); }, parsedMs);
    return { signal: controller.signal, cleanup: () => clearTimeout(timeoutId), timed: true };
  }
  return { signal: undefined, cleanup: null, timed: false };
}

function fetchWithTimeout(url, options = {}) {
  return tvAsyncRunner(this, arguments, function* (targetUrl, fetchOpts = {}) {
    if (typeof fetch === 'undefined') throw new Error("No fetch implementation found!");
    
    let originalTimeout = fetchOpts.timeout || 20000;
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
      throw fetchErr;
    } finally {
      if (typeof timeoutObj.cleanup === 'function') timeoutObj.cleanup();
    }
  });
}

// =========================================================================
// MAGNET UTILITIES
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
// CORE TV ROUTING GATEWAY (Direct IMDB Pipeline mapping)
// =========================================================================

function invokeTorrentio(imdbId, mediaType, season, episode) {
  return tvAsyncRunner(this, arguments, function* (id, type, s, e) {
    try {
      const isTV = type === "tv" || type === "series";
      
      // Clean up string ID variations if passed inside objects on older layouts
      let cleanImdbId = String(id || '').trim();

      const url = isTV
        ? `${TORRENTIO_API}/stream/series/${cleanImdbId}:${s || 1}:${e || 1}.json`
        : `${TORRENTIO_API}/stream/movie/${cleanImdbId}.json`;

      console.log("[TORRENTIO TV URL]", url);

      const response = yield fetchWithTimeout(url, {
        headers: HEADERS,
        timeout: 20000,
        skipSizeCheck: true
      });

      if (!response || !response.ok) return [];
      const json = yield response.json();

      if (!json || !json.streams) return [];

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
      console.log("[TORRENTIO TV ERROR]", err);
      return [];
    }
  });
}

// Fixed Entrypoint matching the working layout's native call parsing
function getStreams(imdbId, mediaType, season, episode) {
  return tvAsyncRunner(this, arguments, function* (id, type, s, e) {
    try {
      if (!id) return [];
      
      console.log("[TORRA TV NATIVE ID]", id);

      // Skips TMDB step entirely to avoid breaking layouts where ID is already an IMDB string
      const streams = yield invokeTorrentio(id, type, s, e);
      return streams;
    } catch (masterErr) {
      console.log("[TORRA MASTER FATAL]", masterErr);
      return [];
    }
  });
}

module.exports = {
  getStreams
};
