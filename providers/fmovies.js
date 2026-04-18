/**
 * fmovies - Updated with Aurora Server
 * Generated: 2026-04-18
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
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// --- Configuration ---
var TMDB_API_KEY = "d131017ccc6e5462a81c9304d21476de";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var DECRYPT_API_URL = "https://enc-dec.app/api/dec-videasy";

var REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Connection: "keep-alive"
};

var PLAYBACK_HEADERS = {
  "User-Agent": REQUEST_HEADERS["User-Agent"],
  Accept: "application/vnd.apple.mpegurl,application/x-mpegURL,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.fmovies.gd/",
  Origin: "https://www.fmovies.gd"
};

// New Server Specific Headers
var AURORA_HEADERS = {
  "Origin": "https://www.fmovies.gd",
  "User-Agent": "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36",
  "Referer": "https://www.fmovies.gd/",
  "Accept": "*/*"
};

var SERVERS = [
  {
    name: "Aurora",
    language: "Original",
    url: "https://fast.vidplus.dev/file2/C24ISXZKekbvhV2heEaSIHLlWUgQKZtz33kSMyvfga4D~lF+3BRahVFNK2~bgSCrrSMwgcwAfaTqw29+h5Fjo+PpBsCzl+ExsOidfIYbi73ZtiAa6rpyc9OtHyjo51e8s9PKeF3mtJpEv7wShU3YWwk0lbTrtqlOhhpZcQFgsYQ=/MTA4MA==/aW5kZXgubTN1OA==.m3u8?host=aurorabird6.live",
    customHeaders: AURORA_HEADERS,
    isStatic: true // Flag for the direct link you provided
  },
  {
    name: "Yoru",
    language: "Original",
    url: "https://api.videasy.net/cdn/sources-with-title"
  },
  {
    name: "Vyse",
    language: "Hindi",
    url: "https://api.videasy.net/hdmovie/sources-with-title"
  }
];

// --- Utilities ---
function getJson(url) {
  return fetch(url, { headers: REQUEST_HEADERS }).then((res) => res.json());
}

function getText(url) {
  return fetch(url, { headers: REQUEST_HEADERS }).then((res) => res.text());
}

function postJson(url, payload) {
  return fetch(url, {
    method: "POST",
    headers: __spreadProps(__spreadValues({}, REQUEST_HEADERS), { "Content-Type": "application/json" }),
    body: JSON.stringify(payload)
  }).then((res) => res.json());
}

function fetchMediaDetails(tmdbId, mediaType) {
  const normalizedType = mediaType === "tv" || mediaType === "series" ? "tv" : "movie";
  const url = `${TMDB_BASE_URL}/${normalizedType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
  return getJson(url).then((data) => ({
    tmdbId: String(data.id || tmdbId),
    mediaType: normalizedType,
    title: normalizedType === "tv" ? data.name : data.title,
    year: String(data.first_air_date || data.release_date || "").slice(0, 4),
    imdbId: data.external_ids?.imdb_id || ""
  }));
}

function buildServerUrl(server, media, season, episode) {
  if (server.isStatic) return server.url;
  const params = new URLSearchParams();
  params.set("title", encodeURIComponent(encodeURIComponent(media.title).replace(/\+/g, "%20")));
  params.set("mediaType", media.mediaType);
  params.set("year", media.year || "");
  params.set("tmdbId", media.tmdbId);
  if (media.mediaType === "tv") {
    params.set("seasonId", String(season || 1));
    params.set("episodeId", String(episode || 1));
  }
  return `${server.url}?${params.toString()}`;
}

function normalizeQuality(value) {
  const raw = String(value || "").toUpperCase();
  if (raw.includes("2160") || raw.includes("4K")) return "2160p";
  if (raw.includes("1080")) return "1080p";
  if (raw.includes("720")) return "720p";
  if (raw.includes("480")) return "480p";
  return "Multi-Quality"; // Adaptive streams usually have all
}

function createStream(source, server, media) {
  const quality = normalizeQuality(source.quality);
  return {
    name: `Fmovies ${server.name} [${server.language}]`,
    title: `${media.title} (${quality})`,
    url: source.url,
    quality: quality,
    headers: server.customHeaders || PLAYBACK_HEADERS,
    provider: "fmovies",
    language: server.language
  };
}

async function fetchFromServer(server, media, season, episode) {
  try {
    if (server.isStatic) {
        // Direct link provided by user
        return [createStream({ url: server.url, quality: "1080p" }, server, media)];
    }

    const encryptedText = await getText(buildServerUrl(server, media, season, episode));
    if (!encryptedText) return [];
    
    const payload = await postJson(DECRYPT_API_URL, { text: encryptedText, id: String(media.tmdbId) });
    const sources = payload.result?.sources || [];
    
    return sources.map(source => createStream(source, server, media));
  } catch (e) {
    return [];
  }
}

// --- Main Execution ---
async function getStreams(tmdbIdOrMedia, mediaType = "movie", season = null, episode = null) {
  try {
    let mediaParams = typeof tmdbIdOrMedia === "object" ? tmdbIdOrMedia : { tmdbId: tmdbIdOrMedia, mediaType, season, episode };
    const media = await fetchMediaDetails(mediaParams.tmdbId, mediaParams.mediaType);
    
    const results = await Promise.all(
      SERVERS.map(server => fetchFromServer(server, media, mediaParams.season, mediaParams.episode))
    );

    const flatResults = results.flat();
    // Sort high quality to top
    return flatResults.sort((a, b) => {
        const qA = parseInt(a.quality) || 0;
        const qB = parseInt(b.quality) || 0;
        return qB - qA;
    });
  } catch (error) {
    return [];
  }
}

module.exports = { getStreams };
