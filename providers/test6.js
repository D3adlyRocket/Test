/**
 * torrentio - Built from src/torrentio/
 * Generated: 2026-05-31T21:31:18.383Z
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/torrentio/http.js
var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var LANGUAGE_SETTINGS = "language=english";
var TORRENTIO_API = "https://torrentio.strem.fun/" + LANGUAGE_SETTINGS;
var TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce"
];
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept": "application/json, text/plain, */*"
};

// src/torrentio/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var _a;
    try {
      const imdbId = yield getImdbId(tmdbId, mediaType);
      if (!imdbId) {
        console.log("[TORRENTIO] IMDB ID not found");
        return [];
      }
      const isTv = season != null && episode != null;
      const url = isTv ? TORRENTIO_API + "/stream/series/" + imdbId + ":" + season + ":" + episode + ".json" : TORRENTIO_API + "/stream/movie/" + imdbId + ".json";
      console.log("[TORRENTIO] Fetching:", url);
      const response = yield fetch(url, { headers: HEADERS });
      const body = yield response.json();
      if (!body || !body.streams) {
        console.log("[TORRENTIO] No streams");
        return [];
      }
      const results = [];
      for (const stream of body.streams.slice(0, 15)) {
        try {
          const title = stream.title || "";
          const titleLower = title.toLowerCase();
          const quality = extractQuality(title);
          const seeders = ((_a = title.match(/👤\s*(\d+)/)) != null ? _a : [])[1] || "?";
          const magnet = buildMagnet(stream.infoHash);
          if (!magnet)
            continue;
          if (!stream.title.toLowerCase().includes("ita"))
            continue;
          const formattedStream = streamFormat(stream);
          results.push(formattedStream);
        } catch (e) {
          console.log("errore", e);
        }
      }
      return results;
    } catch (e) {
      console.error("[TORRENTIO] Error extracting streams:", e);
      return [];
    }
  });
}
function streamFormat(stream) {
  const name = stream.name || "TorrentIO Stream";
  const title = stream.name || "";
  const infoHash = stream.infoHash || "";
  const description = stream.title;
  const behaviorHints = stream.behaviorHints || {};
  const url = buildMagnet(infoHash);
  return {
    name,
    title,
    description,
    url,
    infoHash,
    addonName: "TorrentIO Plugin",
    isInstalledAddonStream: true,
    // Should trigger local debrid resolution in Nuvio
    needsLocalDebridResolve: true,
    // Should trigger local debrid resolution in Nuvio
    behaviorHints
  };
}
function buildMagnet(infoHash) {
  if (!infoHash)
    return "";
  const trackerParams = TRACKERS.map((t) => "&tr=" + encodeURIComponent(t)).join("");
  return "magnet:?xt=urn:btih:" + infoHash + trackerParams;
}
function extractQuality(title = "") {
  const t = title.toLowerCase();
  if (t.includes("2160p") || t.includes("4k"))
    return "4K";
  if (t.includes("1080p"))
    return "1080p";
  if (t.includes("720p"))
    return "720p";
  if (t.includes("480p"))
    return "480p";
  return "Unknown";
}
function getImdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const normalizedType = mediaType.toLowerCase() === "tv" ? "tv" : "movie";
      const findUrl = `https://api.themoviedb.org/3/${normalizedType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
      const response = yield fetch(findUrl);
      console.log(response);
      if (!response.ok)
        return null;
      const data = yield response.json();
      console.log(data);
      if (!data)
        return null;
      return data.imdb_id || null;
    } catch (e) {
      console.error("[TORRENTIO] Error fetching IMDB ID:", e);
    }
  });
}

// src/torrentio/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[TorrentIO] Request: ${mediaType} ${tmdbId}`);
      const imdbId = yield getImdbId(tmdbId, mediaType);
      if (!imdbId) {
        console.log("[TORRENTIO] IMDB ID not found");
        return [];
      }
      const streams = yield extractStreams(tmdbId, mediaType, season, episode);
      return streams;
    } catch (error) {
      console.error(`[TorrentIO] Error: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
