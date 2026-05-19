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

// src/formatter.js
var require_formatter = __commonJS({
  "src/formatter.js"(exports2, module2) {
    function formatStream2(stream, providerName) {
      return stream;
    }
    module2.exports = { formatStream: formatStream2 };
  }
});

// src/quality_helper.js
var require_quality_helper = __commonJS({
  "src/quality_helper.js"(exports2, module2) {
    function checkQualityFromText2(text) {
      if (!text) return null;
      if (/RESOLUTION=\d+x2160/i.test(text) || /RESOLUTION=2160/i.test(text)) return "4K";
      if (/RESOLUTION=\d+x1440/i.test(text) || /RESOLUTION=1440/i.test(text)) return "1440p";
      if (/RESOLUTION=\d+x1080/i.test(text) || /RESOLUTION=1080/i.test(text)) return "1080p";
      if (/RESOLUTION=\d+x720/i.test(text) || /RESOLUTION=720/i.test(text)) return "720p";
      if (/RESOLUTION=\d+x480/i.test(text) || /RESOLUTION=480/i.test(text)) return "480p";
      return null;
    }
    function getQualityFromUrl(url) {
      if (!url) return null;
      const urlPath = url.split("?")[0].toLowerCase();
      if (urlPath.includes("4k") || urlPath.includes("2160")) return "4K";
      if (urlPath.includes("1440") || urlPath.includes("2k")) return "1440p";
      if (urlPath.includes("1080") || urlPath.includes("fhd")) return "1080p";
      if (urlPath.includes("720") || urlPath.includes("hd")) return "720p";
      if (urlPath.includes("480") || urlPath.includes("sd")) return "480p";
      return null;
    }
    module2.exports = { getQualityFromUrl, checkQualityFromText: checkQualityFromText2 };
  }
});

// src/streamingcommunity/index.js
function getStreamingCommunityBaseUrl() {
  return "https://vixsrc.to";
}
var { formatStream } = require_formatter();
var { checkQualityFromText, getQualityFromUrl } = require_quality_helper();

var TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function getCommonHeaders() {
  return {
    "User-Agent": USER_AGENT,
    "Referer": `${getStreamingCommunityBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
  };
}
function getEmbedHeaders(embedUrl) {
  return {
    "User-Agent": USER_AGENT,
    "Referer": `${getStreamingCommunityBaseUrl()}/`,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8"
  };
}
function getPlaylistHeaders(embedUrl) {
  return {
    "User-Agent": USER_AGENT,
    "Referer": embedUrl || `${getStreamingCommunityBaseUrl()}/`,
    "Origin": getStreamingCommunityBaseUrl(),
    "Accept": "*/*"
  };
}
function extractEmbedSrcFromApiPayload(payload) {
  const rawSrc = payload && typeof payload === "object" ? payload.src : null;
  if (!rawSrc) return null;
  try {
    return new URL(rawSrc, getStreamingCommunityBaseUrl()).toString();
  } catch (e) {
    return null;
  }
}
function extractMasterPlaylistFromEmbedHtml(html) {
  if (!html) return null;
  const tokenMatch = html.match(/'token'\s*:\s*'([^']+)'/i);
  const expiresMatch = html.match(/'expires'\s*:\s*'([^']+)'/i);
  const urlMatch = html.match(/url\s*:\s*'([^']+\/playlist\/\d+[^']*)'/i);
  if (!tokenMatch || !expiresMatch || !urlMatch) {
    return null;
  }
  return {
    token: tokenMatch[1],
    expires: expiresMatch[1],
    url: urlMatch[1]
  };
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "Variable Size";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

function buildTitle(meta, res, lang, format, size, season, episode) {
  const qIcon = res.includes("4K") || res.includes("2160") ? "🌟" : "💎";
  let cleanLang = "Multi-Audio";
  if (lang) cleanLang = lang;

  let line1 = "🎬 ";
  if (season && episode) {
    line1 += `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')} | ${meta.name}`;
  } else {
    line1 += `${meta.name}${meta.year ? " (" + meta.year + ")" : ""}`;
  }

  const line2 = `${qIcon} ${res} | 🌍 ${cleanLang} | 💾 ${size}`;
  const line3 = `🎞️ ${format.toUpperCase()} | ⏱️ ${meta.duration} | ⚡ VixSrc Connection`;

  return `${line1}\n${line2}\n${line3}`;
}

function getM3U8Size(m3u8Url, durationText, headers = {}) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(m3u8Url, { headers });
      if (!res.ok) return "Variable Size";
      const text = yield res.text();
      const matches = [...text.matchAll(/BANDWIDTH=(\d+)/gi)];
      if (matches.length > 0) {
        const bandwidths = matches.map(m => parseInt(m[1])).sort((a, b) => b - a);
        const bps = bandwidths[0]; 
        const mins = parseInt(durationText) || 90;
        const totalBytes = (bps / 8) * (mins * 60);
        return formatBytes(totalBytes);
      }
      return "Variable Size";
    } catch (e) {
      return "Variable Size";
    }
  });
}

function getTmdbId(imdbId, type) {
  return __async(this, null, function* () {
    const normalizedType = String(type).toLowerCase();
    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    try {
      const response = yield fetch(findUrl);
      if (!response.ok) return null;
      const data = yield response.json();
      if (!data) return null;
      if (normalizedType === "movie" && data.movie_results && data.movie_results.length > 0) {
        return data.movie_results[0].id.toString();
      } else if (normalizedType === "tv" && data.tv_results && data.tv_results.length > 0) {
        return data.tv_results[0].id.toString();
      }
      return null;
    } catch (e) {
      return null;
    }
  });
}

async function getMetadata(id, type, season, episode) {
  try {
    const normalizedType = String(type).toLowerCase();
    const endpoint = normalizedType === "movie" ? "movie" : "tv";
    const url = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${TMDB_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("TMDB Fail");
    const data = await response.json();

    let duration = "90 min"; 
    if (normalizedType === "movie" && data.runtime) {
      duration = `${data.runtime} min`;
    } else if (normalizedType === "tv") {
      const epUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
      const epRes = await fetch(epUrl);
      if (epRes.ok) {
        const epData = await epRes.json();
        if (epData.runtime) duration = `${epData.runtime} min`;
      }
    }

    return {
      name: data.title || data.name,
      year: (data.release_date || data.first_air_date || "").split("-")[0],
      duration: duration
    };
  } catch (e) {
    return { name: "VixSrc Stream", year: "", duration: "90 min" };
  }
}

function getStreams(id, type, season, episode, providerContext = null) {
  return __async(this, null, function* () {
    const requestedType = String(type).toLowerCase();
    const normalizedType = requestedType === "series" ? "tv" : requestedType;
    const baseUrl = getStreamingCommunityBaseUrl();
    const commonHeaders = getCommonHeaders();
    
    // FIX FROM VIDLINK: Standardize and clean input parameters immediately at startup
    let tmdbId = id.toString().replace("tmdb:", "");
    let resolvedSeason = season;

    // Validate incoming query context matching tracking variables
    const contextTmdbId = providerContext && /^\d+$/.test(String(providerContext.tmdbId || "")) ? String(providerContext.tmdbId) : null;
    if (contextTmdbId) {
      tmdbId = contextTmdbId;
    } else if (tmdbId.startsWith("tt")) {
      const convertedId = yield getTmdbId(tmdbId, normalizedType);
      if (convertedId) {
        tmdbId = convertedId;
      }
    }

    // Explicit Mapping Safeguard for Collision IDs (e.g., Project Hail Mary)
    let internalId = tmdbId;
    if (tmdbId === "687163" || tmdbId === "705669") {
      tmdbId = "687163"; 
      internalId = "640875"; 
    } else {
      // Dynamic Search Lookup API matching
      try {
        const lookupUrl = `${baseUrl}/api/search?tmdb=${tmdbId}&type=${normalizedType}`;
        const lookupResponse = yield fetch(lookupUrl, { headers: commonHeaders });
        if (lookupResponse.ok) {
          const lookupData = yield lookupResponse.json().catch(() => null);
          if (lookupData && Array.isArray(lookupData.data) && lookupData.data.length > 0) {
            if (lookupData.data[0] && lookupData.data[0].id) {
              internalId = lookupData.data[0].id.toString();
            }
          }
        }
      } catch(e) {}
    }

    let metadata = { name: "VixSrc Video", year: "", duration: "90 min" };
    try {
      metadata = yield getMetadata(tmdbId, type, resolvedSeason, episode); 
    } catch (e) {}

    let url;
    let apiUrl;
    if (normalizedType === "movie") {
      url = `${baseUrl}/movie/${internalId}`;
      apiUrl = `${baseUrl}/api/movie/${internalId}`;
    } else if (normalizedType === "tv") {
      url = `${baseUrl}/tv/${internalId}/${resolvedSeason}/${episode}`;
      apiUrl = `${baseUrl}/api/tv/${internalId}/${resolvedSeason}/${episode}`;
    } else {
      return [];
    }

    try {
      const response = yield fetch(apiUrl, { headers: commonHeaders });
      if (!response.ok) return [];
      
      const apiPayload = yield response.json().catch(() => null);
      const embedUrl = extractEmbedSrcFromApiPayload(apiPayload);
      if (!embedUrl) return [];

      const embedResponse = yield fetch(embedUrl, { headers: getEmbedHeaders(embedUrl) });
      if (!embedResponse.ok) return [];
      const embedHtml = yield embedResponse.text();
      if (!embedHtml) return [];
      
      const masterPlaylist = extractMasterPlaylistFromEmbedHtml(embedHtml);
      if (masterPlaylist) {
        const streamUrl = `${masterPlaylist.url}?token=${encodeURIComponent(masterPlaylist.token)}&expires=${encodeURIComponent(masterPlaylist.expires)}&h=1&lang=it`;
        const streamHeaders = getPlaylistHeaders(embedUrl);

        let streamLanguage = "Multi-Audio"; 
        let detectedQuality = "1080p";

        try {
          const playlistResponse = yield fetch(streamUrl, { headers: streamHeaders });
          if (playlistResponse.ok) {
            const playlistText = yield playlistResponse.text();
            const playlistQuality = checkQualityFromText(playlistText);
            detectedQuality = playlistQuality || getQualityFromUrl(streamUrl) || getQualityFromUrl(embedUrl) || "1080p";

            const languageMatches = [...playlistText.matchAll(/LANGUAGE="([^"]+)"/gi)];
            const uniqueLanguages = [...new Set(languageMatches.map(x => x[1].toLowerCase()))];

            if (uniqueLanguages.length > 1 || playlistText.includes("ita") || streamUrl.includes("lang=it")) {
              streamLanguage = "Multi-Audio";
            } else if (uniqueLanguages.length === 1) {
              const lang = uniqueLanguages[0];
              if (lang.includes("it")) streamLanguage = "Italian";
              else if (lang.includes("en")) streamLanguage = "English";
              else streamLanguage = lang.toUpperCase();
            }
          }
        } catch (e) {}

        const computedSize = yield getM3U8Size(streamUrl, metadata.duration, streamHeaders);
        let detectedFormat = "M3U8"; 

        const generatedTitle = buildTitle(
          metadata,
          detectedQuality,
          streamLanguage,
          detectedFormat,
          computedSize,
          normalizedType === "tv" ? resolvedSeason : null,
          normalizedType === "tv" ? episode : null
        );
        
        const result = {
          name: `🎦 VixSrc | ${detectedQuality} | ${streamLanguage}`,
          title: generatedTitle,
          url: streamUrl,
          easyProxySourceUrl: embedUrl,
          quality: detectedQuality.toLowerCase().includes("p") ? detectedQuality : "1080p", 
          type: "direct",
          headers: {
             "User-Agent": USER_AGENT,
             "Referer": embedUrl,
             "Origin": baseUrl
          },
          behaviorHints: { notWebReady: false }
        };
        return [formatStream(result, "StreamingCommunity")].filter((s) => s !== null);
      } else {
        return [];
      }
    } catch (error) {
      return [];
    }
  });
}

module.exports = { getStreams };
