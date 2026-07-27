/**
 * piratebay - Built from src/piratebay/
 * Generated: 2026-07-25T17:20:01.533Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
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

// Settings Parser
function resolveSettings(extraConfig) {
  let settings = {
    language: "any",
    minQuality: "any",
    sortBy: "seeders"
  };

  try {
    let source = extraConfig;
    if (!source && typeof globalThis !== "undefined") source = globalThis.SCRAPER_SETTINGS || globalThis.SETTINGS;
    if (!source && typeof global !== "undefined") source = global.SCRAPER_SETTINGS || global.SETTINGS;
    if (!source && typeof window !== "undefined") source = window.SCRAPER_SETTINGS || window.SETTINGS;

    if (source) {
      if (source.language) settings.language = String(source.language).trim();
      if (source.minQuality) settings.minQuality = String(source.minQuality).trim();
      if (source.sortBy) settings.sortBy = String(source.sortBy).trim();
    }
  } catch (e) {
    console.error(`[ThePirateBay] Error parsing settings:`, e);
  }

  return settings;
}

// Strict LTR Zero-Width Sort Marker (Prevents UI alignment flipping)
function getInvertedSortTag(val, maxBaseline = 999999) {
  const safeVal = Math.max(0, parseInt(val, 10) || 0);
  const inverted = Math.max(0, maxBaseline - safeVal);
  const binaryStr = inverted.toString(2).padStart(20, '0');
  return binaryStr.split('').map(bit => bit === '1' ? "\uFEFF" : "\u200B").join('');
}

// HTTP Helper
var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache"
};

function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}, retries = 2) {
    const _a = options, { headers: extraHeaders } = _a, restOptions = __objRest(_a, ["headers"]);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = yield fetch(url, __spreadValues({
          headers: __spreadValues(__spreadValues({}, DEFAULT_HEADERS), extraHeaders)
        }, restOptions));
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return yield response.text();
      } catch (err) {
        if (attempt === retries) throw err;
        yield new Promise((r) => setTimeout(r, (attempt + 1) * 1e3));
      }
    }
  });
}

function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const text = yield fetchText(url, __spreadProps(__spreadValues({}, options), {
      headers: __spreadValues({ "Accept": "application/json" }, options.headers || {})
    }));
    return JSON.parse(text);
  });
}

var API_URL = "https://apibay.org";
var SITE_URL = "https://thepiratebay.org";
var HEADERS = __spreadProps(__spreadValues({}, DEFAULT_HEADERS), { "Referer": `${SITE_URL}/` });

function fetchJson2(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    return fetchJson(url, __spreadProps(__spreadValues({}, options), {
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers || {})
    }));
  });
}

// TMDB Metadata
var TMDB_API_KEY = "ebfc7be4cc7fa987bd5616de3c688c5d";
var TMDB_BASE = "https://api.themoviedb.org/3";
var cache = {};

function getTmdbInfo(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const cacheKey = `${mediaType}_${tmdbId}`;
    if (cache[cacheKey]) return cache[cacheKey];
    try {
      const url = `${TMDB_BASE}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
      const data = yield fetchJson(url);
      const title = mediaType === "movie" ? data.title : data.name;
      const releaseDate = mediaType === "movie" ? data.release_date : data.first_air_date;
      const year = releaseDate ? releaseDate.split("-")[0] : "";
      const info = {
        title: title || "",
        year,
        imdbId: data.imdb_id || ""
      };
      cache[cacheKey] = info;
      return info;
    } catch (err) {
      return { title: "", year: "", imdbId: "" };
    }
  });
}

// Quality Parsing
function parseQuality(title) {
  const t = title || "";
  const is4K = /2160[pP]|4K|UHD/i.test(t);
  const is1080p = /1080[pP]/i.test(t);
  const is720p = /720[pP]/i.test(t);
  const isHDR = /HDR10\+?|HDR/i.test(t);
  const isDV = /\bDV\b|Dolby[\s\-]?Vision/i.test(t);
  
  let codec = "";
  if (/x265|HEVC|H\.?265/i.test(t)) codec = "HEVC";
  else if (/x264|AVC|H\.?264/i.test(t)) codec = "x264";

  let audio = "English";
  if (/DUAL|DUAL-AUDIO/i.test(t)) audio = "Dual-Audio";
  else if (/MULTI|MULTI-AUDIO/i.test(t)) audio = "Multi-Audio";

  let resolution = "1080p";
  let qualityEmoji = "⚔️"; // 1080p default
  let qualityRank = 3;

  if (is4K) {
    resolution = "2160p";
    qualityEmoji = "🏴‍☠️"; // 4K / 2160p
    qualityRank = 4;
  } else if (is720p) {
    resolution = "720p";
    qualityEmoji = "🗡️"; // 720p
    qualityRank = 2;
  } else if (!is1080p && /480[pP]|SD/i.test(t)) {
    resolution = "480p";
    qualityEmoji = "📱";
    qualityRank = 1;
  }

  return { resolution, qualityEmoji, qualityRank, isHDR, isDV, codec, audio };
}

function encodeSearchQuery(query) {
  return encodeURIComponent(query).replace(/%20/g, "+");
}

var PROVIDER_NAME = "ThePirateBay";

function buildMagnetLink(infoHash, name) {
  const trackers = [
    "udp://tracker.coppersurfer.tk:6969/announce",
    "udp://tracker.openbittorrent.com:6969/announce",
    "udp://tracker.opentrackr.org:1337",
    "udp://tracker.leechers-paradise.org:6969/announce",
    "udp://opentracker.i2p.rocks:6969/announce",
    "udp://open.demonii.com:1337/announce"
  ];
  const trString = trackers.map((tr) => `&tr=${encodeURIComponent(tr)}`).join("");
  return `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}${trString}`;
}

function formatSize(bytes) {
  const num = parseInt(bytes, 10);
  if (isNaN(num) || num === 0) return "Unknown Size";
  const gb = num / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = num / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

// Extractor Engine
function extractStreams(tmdbId, mediaType, season, episode, settings) {
  return __async(this, null, function* () {
    try {
      const isSeries = mediaType === "tv" || mediaType === "series";
      const tmdbInfo = yield getTmdbInfo(tmdbId, mediaType);
      if (!tmdbInfo.title) return [];

      let query = tmdbInfo.title;
      if (!isSeries && tmdbInfo.year) {
        query += ` ${tmdbInfo.year}`;
      } else if (isSeries && season && episode) {
        const s = String(season).padStart(2, "0");
        const e = String(episode).padStart(2, "0");
        query += ` S${s}E${e}`;
      }

      const searchUrl = `${API_URL}/q.php?q=${encodeSearchQuery(query)}&cat=200`;
      const results = yield fetchJson2(searchUrl);
      if (!Array.isArray(results) || results.length === 0 || results[0].name === "No results found") return [];

      const parsedStreams = [];

      for (const item of results) {
        if (!item.info_hash || item.info_hash === "0000000000000000000000000000000000000000") continue;

        const name = item.name || "";
        const quality = parseQuality(name);
        const seedersNum = parseInt(item.seeders || "0", 10);
        const sizeBytes = parseInt(item.size || "0", 10);
        const sizeInMB = Math.floor(sizeBytes / (1024 * 1024));
        const sizeStr = formatSize(item.size);

        // Quality Filter
        if (settings.minQuality && settings.minQuality !== "any") {
          const reqRank = settings.minQuality === "4k" ? 4 : settings.minQuality === "1080p" ? 3 : 2;
          if (quality.qualityRank < reqRank) continue;
        }

        // Tech specs list
        const techTags = [];
        if (quality.isDV) techTags.push("DV");
        if (quality.isHDR) techTags.push("HDR");
        if (quality.codec) techTags.push(quality.codec);
        techTags.push(quality.audio);

        const techString = techTags.join(" • ");

        // Stream detail lines
        const line1 = isSeries ? `🎦 ${tmdbInfo.title} | S${season || 1} E${episode || 1}` : `🎬 ${tmdbInfo.title} - ${tmdbInfo.year}`;
        const line2 = `${quality.qualityEmoji} ${quality.resolution} | ${techString}`;
        const line3 = `🦜 ${seedersNum} | 💰 ${sizeStr} | ⛵ ${PROVIDER_NAME}`;
        const fullLayout = `${line1}\n${line2}\n${line3}`;

        // Invisible sort marker string for header
        let sortTag = "";
        if (settings.sortBy === "size") {
          sortTag = getInvertedSortTag(sizeInMB, 999999);
        } else if (settings.sortBy === "quality") {
          sortTag = getInvertedSortTag((quality.qualityRank * 10000) + seedersNum, 999999);
        } else {
          sortTag = getInvertedSortTag(seedersNum, 999999);
        }

        const headerLayout = `${sortTag}☠️ ${PROVIDER_NAME} | ${quality.resolution.toUpperCase()} | 🦜${seedersNum}`;
        const magnet = buildMagnetLink(item.info_hash, name);

        parsedStreams.push({
          seeders: seedersNum,
          sizeBytes: sizeBytes,
          qualityRank: quality.qualityRank,
          data: {
            name: headerLayout,
            title: fullLayout,
            size: fullLayout,
            description: fullLayout,
            url: magnet
          }
        });
      }

      // Internal Array Sort
      parsedStreams.sort((a, b) => {
        if (settings.sortBy === "size") return b.sizeBytes - a.sizeBytes;
        if (settings.sortBy === "quality") {
          if (b.qualityRank !== a.qualityRank) return b.qualityRank - a.qualityRank;
          return b.seeders - a.seeders;
        }
        return b.seeders - a.seeders;
      });

      return parsedStreams.map(item => item.data);
    } catch (err) {
      console.error(`[${PROVIDER_NAME}] Error:`, err);
      return [];
    }
  });
}

// Module Exports & Settings Menu
function getStreams(tmdbId, mediaType, season, episode, userSettings = null) {
  return __async(this, null, function* () {
    const settings = resolveSettings(userSettings);
    return yield extractStreams(tmdbId, mediaType, season, episode, settings);
  });
}

function onSettings() {
  return __async(this, null, function* () {
    return [
      { type: "header", label: "Basics" },
      {
        type: "select",
        key: "language",
        label: "Preferred Language",
        options: [
          { label: "Any", value: "any" },
          { label: "🇬🇧 English", value: "en" },
          { label: "🇪🇸 Español", value: "es" },
          { label: "🇫🇷 Français", value: "fr" },
          { label: "🇩🇪 Deutsch", value: "de" },
          { label: "🇮🇹 Italiano", value: "it" },
          { label: "🇷🇺 Русский", value: "ru" }
        ],
        default: "any"
      },
      {
        type: "select",
        key: "minQuality",
        label: "Minimum Quality",
        options: [
          { label: "Any", value: "any" },
          { label: "720p+", value: "720p" },
          { label: "1080p+", value: "1080p" },
          { label: "2160p / 4K only", value: "4k" }
        ],
        default: "any"
      },
      {
        type: "select",
        key: "sortBy",
        label: "Sort By",
        options: [
          { label: "Most Seeders", value: "seeders" },
          { label: "Quality Score", value: "quality" },
          { label: "Largest Size", value: "size" }
        ],
        default: "seeders"
      }
    ];
  });
}

module.exports = { getStreams, onSettings };
