/** 
 * hianime - Enhanced with TorrentClaw design patterns
 */
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
var __defNormalProp = (obj, key, value) =>
  key in obj
    ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value })
    : (obj[key] = value);
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop)) __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop)) __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === "object") || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, "default", { value: mod, enumerable: true })
      : target,
    mod
  )
);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = value => {
      try { step(generator.next(value)); } catch (e) { reject(e); }
    };
    var rejected = value => {
      try { step(generator.throw(value)); } catch (e) { reject(e); }
    };
    var step = x => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));

const MEGAPLAY_BASE = "https://megaplay.buzz";
const VIDWISH_BASE = "https://vidwish.live";
const MEGACLOUD_BASE = "https://megacloud.bloggy.click";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
  Connection: "keep-alive"
};

// Robust Settings Resolver adapted from TorrentClaw
function resolveSettings(extraConfig) {
  let settings = {
    subDub: "both",
    preferredAudio: "sub"
  };

  try {
    let source = extraConfig;
    if (!source && typeof globalThis !== "undefined") {
      source = globalThis.SCRAPER_SETTINGS || globalThis.SETTINGS || globalThis.settings;
    }
    if (!source && typeof global !== "undefined") {
      source = global.SCRAPER_SETTINGS || global.SETTINGS || global.settings;
    }
    if (!source && typeof window !== "undefined") {
      source = window.SCRAPER_SETTINGS || window.SETTINGS || window.settings;
    }

    if (source) {
      if (source.subDub) settings.subDub = String(source.subDub).toLowerCase().trim();
      if (source.preferredAudio) settings.preferredAudio = String(source.preferredAudio).toLowerCase().trim();
    }
  } catch (e) {
    console.error("[HiAnime] Error parsing settings:", e);
  }

  return settings;
}

// Zero-Width Sort Encoding pattern from TorrentClaw
function getInvertedSortTag(val, maxBaseline = 999) {
  const safeVal = Math.max(0, parseInt(val, 10) || 0);
  const inverted = Math.max(0, maxBaseline - safeVal);
  const binaryStr = inverted.toString(2).padStart(10, '0');
  return binaryStr.split('').map(bit => bit === '1' ? "\uFEFF" : "\u200B").join('');
}

function fetchText(url, options = {}) {
  return __async(this, null, function* () {
    const response = yield fetch(url, __spreadValues({
      headers: __spreadValues(__spreadValues({}, DEFAULT_HEADERS), options.headers)
    }, options));
    if (!response.ok) throw new Error(`HTTP ${response.status} on ${url}`);
    return yield response.text();
  });
}

function fetchJson(url, options = {}) {
  return __async(this, null, function* () {
    const text = yield fetchText(url, options);
    return JSON.parse(text);
  });
}

// Consolidated TMDB & External IDs call (similar to TorrentClaw)
function getTmdbDetailsWithExternalIds(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const url = `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
      return yield fetchJson(url);
    } catch (e) {
      return null;
    }
  });
}

function findByExternalId(externalId) {
  return __async(this, null, function* () {
    try {
      const url = `https://api.themoviedb.org/3/find/${externalId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const data = yield fetchJson(url);
      if (data.tv_results && data.tv_results.length > 0) return { data: data.tv_results[0], type: "tv" };
      if (data.movie_results && data.movie_results.length > 0) return { data: data.movie_results[0], type: "movie" };
      return null;
    } catch (e) {
      return null;
    }
  });
}

function getKitsuDetails(kitsuId) {
  return __async(this, null, function* () {
    try {
      let malId = null;
      let title = null;

      const mapUrl = `https://kitsu.io/api/edge/anime/${kitsuId}/mappings`;
      const mapData = yield fetchJson(mapUrl);
      if (mapData && mapData.data) {
        const malItem = mapData.data.find(i => i.attributes && i.attributes.externalSite === "myanimelist");
        if (malItem) malId = malItem.attributes.externalId;
      }

      const showUrl = `https://kitsu.io/api/edge/anime/${kitsuId}`;
      const showData = yield fetchJson(showUrl);
      if (showData && showData.data && showData.data.attributes) {
        const attr = showData.data.attributes;
        title = attr.canonicalTitle || (attr.titles && attr.titles.en) || null;
      }

      return { malId, title };
    } catch (e) {
      return { malId: null, title: null };
    }
  });
}

function getEpisodeMetadata(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      if (mediaType === "movie") {
        const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const data = yield fetchJson(url);
        return { title: data.title || "Movie", duration: data.runtime ? `${data.runtime}m` : "N/A" };
      } else {
        const url = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
        const data = yield fetchJson(url);
        return { title: data.name || `Episode ${episode}`, duration: data.runtime ? `${data.runtime}m` : "24m" };
      }
    } catch (e) {
      return { title: `Episode ${episode}`, duration: "24m" };
    }
  });
}

function resolveMapping(imdbId, season, episode) {
  return __async(this, null, function* () {
    try {
      const url = `https://id-mapping-api-malid.hf.space/api/resolve?id=${imdbId}&s=${season}&e=${episode}`;
      const data = yield fetchJson(url);
      if (data.error) return null;
      return data;
    } catch (e) {
      return null;
    }
  });
}

function searchMalId(title, mediaType) {
  return __async(this, null, function* () {
    try {
      const type = mediaType === "movie" ? "movie" : "tv";
      const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&type=${type}&limit=1`;
      const data = yield fetchJson(url);
      if (data.data && data.data.length > 0) return data.data[0].mal_id;
      return null;
    } catch (e) {
      return null;
    }
  });
}

function extractSources(apiUrl, referer, origin, serverName, animeTitle, mediaType, seasonNum, episodeNum, type, meta, prefAudio = "sub") {
  return __async(this, null, function* () {
    try {
      const json = yield fetchJson(apiUrl, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Referer: referer,
          Origin: origin
        }
      });
      const file = json.sources?.file;
      if (!file) return [];

      const isSub = type.toLowerCase() === "sub";
      const langString = isSub ? "Original (SUB)" : "English (DUB)";
      const upperType = type.toUpperCase();

      const lines = mediaType === "movie"
        ? [
            `🎬 ${animeTitle}`,
            `🎞️ M3U8 | ⚡ Auto | 🔊 ${langString} | ⌛ ${meta.duration}`,
            `🔗 Source: ${serverName}`
          ]
        : [
            `🎬 ${animeTitle}`,
            `🎥 S${seasonNum}E${episodeNum} - ${meta.epTitle}`,
            `🎞️ M3U8 | ⚡ Auto | 🔊 ${langString} | ⌛ ${meta.duration}`,
            `🔗 Source: ${serverName}`
          ];

      const streamTitle = lines.join("\n");

      // Calculate priority score for zero-width sorting
      let audioScore = 1;
      if ((prefAudio === "sub" && isSub) || (prefAudio === "dub" && !isSub)) {
        audioScore = 10;
      }
      const sortTag = getInvertedSortTag(audioScore, 100);
      const nameTag = `${sortTag}H!Anime | [${serverName}] (${upperType})`;

      const streams = [{
        name: nameTag,
        title: streamTitle,
        size: streamTitle,
        description: streamTitle,
        url: file,
        quality: "Auto",
        headers: __spreadProps(__spreadValues({}, DEFAULT_HEADERS), {
          Referer: `${origin}/`,
          Origin: origin
        }),
        provider: "hianime",
        type: "m3u8",
        _sortScore: audioScore
      }];

      if (json.tracks && json.tracks.length > 0) {
        streams[0].subtitles = json.tracks
          .filter(t => t.file && t.kind === "captions")
          .map(t => ({
            url: t.file,
            name: t.label || "English",
            language: t.label ? t.label.slice(0, 3).toLowerCase() : "en"
          }));
      }
      return streams;
    } catch (e) {
      return [];
    }
  });
}

function scrapeType(malId, episode, type, animeTitle, meta, mediaType, season, prefAudio) {
  return __async(this, null, function* () {
    const streams = [];
    const megaUrl = `${MEGAPLAY_BASE}/stream/mal/${malId}/${episode}/${type}`;
    try {
      const html = yield fetchText(megaUrl, { headers: { Referer: megaUrl } });
      const $ = import_cheerio_without_node_native.default.load(html);
      const player = $("div.fix-area#megaplay-player");
      if (!player.length) return [];

      const dataId = player.attr("data-id");
      const realId = player.attr("data-realid");
      const extractions = [];

      if (dataId) {
        const apiUrl = `${MEGAPLAY_BASE}/stream/getSources?id=${dataId}&id=${dataId}`;
        extractions.push(extractSources(apiUrl, megaUrl, MEGAPLAY_BASE, "MegaPlay", animeTitle, mediaType, season, episode, type, meta, prefAudio));
      }
      if (realId) {
        const vidPage = `${VIDWISH_BASE}/stream/s-2/${realId}/${type}`;
        extractions.push((() => __async(this, null, function* () {
          try {
            const vidHtml = yield fetchText(vidPage, { headers: { Referer: megaUrl } });
            const $v = import_cheerio_without_node_native.default.load(vidHtml);
            const vPlayer = $v("div.fix-area#megaplay-player");
            const vDataId = vPlayer.attr("data-id");
            if (vDataId) {
              const apiUrl = `${VIDWISH_BASE}/stream/getSources?id=${vDataId}&id=${vDataId}`;
              return yield extractSources(apiUrl, vidPage, VIDWISH_BASE, "Vidwish", animeTitle, mediaType, season, episode, type, meta, prefAudio);
            }
          } catch (err) {}
          return [];
        }))());
      }
      if (realId) {
        const megacloudPage = `${MEGACLOUD_BASE}/stream/s-3/${realId}/${type}`;
        extractions.push((() => __async(this, null, function* () {
          try {
            const mcHtml = yield fetchText(megacloudPage, { headers: { Referer: megaUrl } });
            const $m = import_cheerio_without_node_native.default.load(mcHtml);
            const mPlayer = $m("div.fix-area#megaplay-player");
            const mDataId = mPlayer.attr("data-id");
            if (mDataId) {
              const apiUrl = `${MEGACLOUD_BASE}/stream/getSources?id=${mDataId}&id=${mDataId}`;
              return yield extractSources(apiUrl, megacloudPage, MEGACLOUD_BASE, "MegaCloud", animeTitle, mediaType, season, episode, type, meta, prefAudio);
            }
          } catch (err) {}
          return [];
        }))());
      }
      const results = yield Promise.all(extractions);
      for (const res of results) streams.push(...res);
    } catch (e) {}
    return streams;
  });
}

function getStreams(rawId, mediaType = "tv", inSeason = 1, inEpisode = 1, userSettings = null) {
  return __async(this, null, function* () {
    try {
      const settings = resolveSettings(userSettings);
      let idStr = String(rawId || "").trim();
      let tmdbId = null;
      let imdbId = null;
      let malId = null;
      let tmdbData = null;
      let showTitle = "Anime";
      let season = inSeason;
      let episode = inEpisode;

      const parts = idStr.split(":");
      const prefix = parts[0].toLowerCase();

      if (prefix === "kitsu") {
        const kId = parts[1];
        if (parts.length === 3) {
          episode = parseInt(parts[2], 10) || episode;
        } else if (parts.length >= 4) {
          season = parseInt(parts[2], 10) || season;
          episode = parseInt(parts[3], 10) || episode;
        }
        const kitsuRes = yield getKitsuDetails(kId);
        if (kitsuRes.malId) malId = kitsuRes.malId;
        if (kitsuRes.title) showTitle = kitsuRes.title;
      } else if (prefix === "mal") {
        malId = parts[1];
        if (parts.length >= 3) {
          episode = parseInt(parts[parts.length - 1], 10) || episode;
        }
      } else if (prefix === "tmdb") {
        tmdbId = parts[1];
        if (parts.length === 3) {
          episode = parseInt(parts[2], 10) || episode;
        } else if (parts.length >= 4) {
          season = parseInt(parts[2], 10) || season;
          episode = parseInt(parts[3], 10) || episode;
        }
      } else if (parts[0].startsWith("tt")) {
        imdbId = parts[0];
        if (parts.length === 2) {
          episode = parseInt(parts[1], 10) || episode;
        } else if (parts.length >= 3) {
          season = parseInt(parts[1], 10) || season;
          episode = parseInt(parts[2], 10) || episode;
        }
        const res = yield findByExternalId(imdbId);
        if (res) {
          tmdbData = res.data;
          tmdbId = res.data.id;
          mediaType = res.type;
        }
      } else {
        tmdbId = parts[0];
        if (parts.length === 2) {
          episode = parseInt(parts[1], 10) || episode;
        } else if (parts.length >= 3) {
          season = parseInt(parts[1], 10) || season;
          episode = parseInt(parts[2], 10) || episode;
        }
      }

      // Single call fetching TMDB details + external IDs concurrently
      if (tmdbId && !tmdbData && /^\d+$/.test(tmdbId)) {
        tmdbData = yield getTmdbDetailsWithExternalIds(tmdbId, mediaType);
        if (tmdbData && tmdbData.external_ids) {
          imdbId = tmdbData.external_ids.imdb_id || imdbId;
        }
      }

      if (tmdbData) {
        showTitle = tmdbData.name || tmdbData.title || tmdbData.original_title || showTitle;
      }

      let mappedEp = episode;
      const tmdbMeta = tmdbId
        ? yield getEpisodeMetadata(tmdbId, mediaType, season, episode)
        : { title: `Episode ${episode}`, duration: "24m" };
      const meta = { epTitle: tmdbMeta.title, duration: tmdbMeta.duration };
      const s = mediaType === "movie" ? 1 : season;
      const e = mediaType === "movie" ? 1 : episode;

      if (mediaType === "movie" && !malId) {
        malId = yield searchMalId(showTitle, "movie");
        mappedEp = 1;
      }

      if (!malId && imdbId) {
        let mapping = yield resolveMapping(imdbId, s, e);
        if (!mapping && s > 1) {
          mapping = yield resolveMapping(imdbId, 1, e);
        }
        if (mapping && mapping.mal_id) {
          malId = mapping.mal_id;
          mappedEp = mapping.mal_episode || episode;
        }
      }

      if (!malId && showTitle && showTitle !== "Anime") {
        malId = yield searchMalId(showTitle, mediaType);
      }

      if (!malId) return [];

      const preference = settings.subDub || "both";
      let allStreams = [];

      if (preference === "both") {
        const [subStreams, dubStreams] = yield Promise.all([
          scrapeType(malId, mappedEp, "sub", showTitle, meta, mediaType, s, settings.preferredAudio),
          scrapeType(malId, mappedEp, "dub", showTitle, meta, mediaType, s, settings.preferredAudio)
        ]);
        allStreams = [...subStreams, ...dubStreams];
      } else {
        allStreams = yield scrapeType(malId, mappedEp, preference, showTitle, meta, mediaType, s, settings.preferredAudio);
      }

      // Sort by preference score
      allStreams.sort((a, b) => (b._sortScore || 0) - (a._sortScore || 0));

      const seen = new Set();
      return allStreams.filter(s2 => {
        if (seen.has(s2.url)) return false;
        seen.add(s2.url);
        return true;
      });
    } catch (e) {
      return [];
    }
  });
}

function onSettings() {
  return __async(this, null, function* () {
    return [
      { type: "header", label: "Stream Preferences" },
      {
        type: "select",
        key: "subDub",
        label: "Audio Modes to Fetch",
        options: [
          { label: "Sub & Dub", value: "both" },
          { label: "Sub Only", value: "sub" },
          { label: "Dub Only", value: "dub" }
        ],
        defaultValue: "both"
      },
      {
        type: "select",
        key: "preferredAudio",
        label: "Primary Audio Display Preference",
        options: [
          { label: "Sub First", value: "sub" },
          { label: "Dub First", value: "dub" }
        ],
        defaultValue: "sub"
      }
    ];
  });
}

module.exports = { getStreams, onSettings };
