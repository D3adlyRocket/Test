"use strict";

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var MURPH_BASE = "https://badboysxs-morpheus.hf.space";
var PROVIDER_NAME = "HindMoviez";
var PROVIDER_TAG = "[HindMoviez]";
var REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*"
};

var __doomProbeCache = Object.create(null);
var __doomProbeCacheTtlMs = 10 * 60 * 1000;
var __doomProbeTimeoutMs = 6 * 1000;

function withTimeout(promise, timeoutMs) {
  return new Promise(function(resolve, reject) {
    var settled = false;
    var timer = setTimeout(function() {
      if (settled) return;
      settled = true;
      reject(new Error("timeout"));
    }, timeoutMs);
    Promise.resolve(promise).then(function(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, function(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function mergeHeaders(base, extra) {
  var merged = {};
  var key;
  for (key in base || {}) merged[key] = base[key];
  for (key in extra || {}) merged[key] = extra[key];
  return merged;
}

function normalizeQuality(value) {
  var text = String(value || "");
  if (/2160p|4k/i.test(text)) return "2160p";
  var match = text.match(/(1080p|720p|480p|360p|240p)/i);
  return match ? match[1].toLowerCase() : "Auto";
}

function extractSize(value) {
  var match = String(value || "").match(/\[([^\]]+)\]/);
  return match ? match[1] : "";
}

function looksLikeHls(url, contentType) {
  var normalizedUrl = String(url || "").toLowerCase();
  var normalizedType = String(contentType || "").toLowerCase();
  return normalizedUrl.indexOf(".m3u8") !== -1
    || normalizedType.indexOf("mpegurl") !== -1
    || normalizedType.indexOf("application/x-mpegurl") !== -1
    || normalizedType.indexOf("vnd.apple.mpegurl") !== -1;
}

function getProbeCacheKey(stream) {
  var headers = stream && stream.headers ? stream.headers : {};
  return [
    stream && stream.url ? stream.url : "",
    headers.Referer || headers.referer || "",
    headers.Origin || headers.origin || ""
  ].join("|");
}

function getCachedProbeResult(cacheKey) {
  var entry = __doomProbeCache[cacheKey];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > __doomProbeCacheTtlMs) {
    delete __doomProbeCache[cacheKey];
    return null;
  }
  return entry.ok;
}

function setCachedProbeResult(cacheKey, ok) {
  __doomProbeCache[cacheKey] = { ok: !!ok, timestamp: Date.now() };
}

function responseIsSeekable(response, url) {
  if (!response || !response.ok) return false;
  var headers = response.headers;
  var contentType = headers && headers.get ? headers.get("content-type") || "" : "";
  if (looksLikeHls(url, contentType)) return true;
  var acceptRanges = headers && headers.get ? headers.get("accept-ranges") || "" : "";
  var contentRange = headers && headers.get ? headers.get("content-range") || "" : "";
  return response.status === 206 || /bytes/i.test(acceptRanges) || /^bytes\s+/i.test(contentRange);
}

function probeStream(stream) {
  if (!stream || !stream.url || typeof fetch !== "function") return Promise.resolve(false);
  var cacheKey = getProbeCacheKey(stream);
  var cached = getCachedProbeResult(cacheKey);
  if (cached !== null) return Promise.resolve(cached);
  var url = stream.url;
  var isHls = looksLikeHls(url, "");
  var baseHeaders = mergeHeaders({}, stream.headers || {});
  var rangedHeaders = mergeHeaders({}, baseHeaders);
  if (!isHls && !rangedHeaders.Range && !rangedHeaders.range) {
    rangedHeaders.Range = "bytes=0-1";
  }
  var attempts = [
    { method: "GET", headers: isHls ? baseHeaders : rangedHeaders, redirect: "follow" },
    { method: "HEAD", headers: baseHeaders, redirect: "follow" }
  ];
  function tryAttempt(index) {
    if (index >= attempts.length) return Promise.resolve(false);
    return withTimeout(fetch(url, attempts[index]), __doomProbeTimeoutMs)
      .then(function(response) {
        if (responseIsSeekable(response, url)) return true;
        return tryAttempt(index + 1);
      })
      .catch(function() { return tryAttempt(index + 1); });
  }
  return tryAttempt(0).then(function(ok) {
    setCachedProbeResult(cacheKey, ok);
    return ok;
  });
}

function looksLikeDirectMediaUrl(url) {
  var normalized = String(url || "").toLowerCase();
  if (!/^https?:\/\//i.test(normalized)) return false;
  return /\.m(?:kv|p4|3u8|ts)(?:$|[?#])/.test(normalized);
}

function filterSeekableStreams(streams) {
  if (!Array.isArray(streams) || streams.length === 0) return Promise.resolve([]);
  return Promise.all(streams.map(function(stream) {
    return probeStream(stream)
      .then(function(ok) { return { stream: stream, ok: ok }; })
      .catch(function() { return { stream: stream, ok: false }; });
  })).then(function(results) {
    var filtered = results.filter(function(item) { return item.ok; }).map(function(item) { return item.stream; });
    // If probing fails all of them, return everything as a backup
    if (filtered.length === 0) {
      return streams;
    }
    return filtered;
  });
}

function fetchJson(url) {
  return withTimeout(fetch(url, { headers: REQUEST_HEADERS, redirect: "follow" }), 15 * 1000).then(function(response) {
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  });
}

function absolutizeUrl(url) {
  if (!url) return "";
  url = String(url);
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return MURPH_BASE + url;
  return MURPH_BASE + "/" + url.replace(/^\.?\//, "");
}

function extractMurphStreams(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  var candidates = [payload.streams, (payload.data && payload.data.streams), payload.results];
  for (var i = 0; i < candidates.length; i += 1) {
    if (Array.isArray(candidates[i])) return candidates[i];
  }
  return [];
}

/**
 * UPDATED MATCH LOGIC FOR HINDMOVIEZ
 */
function isProviderMatch(name) {
  var n = String(name || "").toLowerCase();
  // Checks for various spellings of HindMoviez
  return n.indexOf("hind") !== -1 || n.indexOf("moviez") !== -1 || n.indexOf("hmz") !== -1;
}

function resolveImdbId(id, mediaType) {
  if (!id) return Promise.resolve("");
  if (String(id).startsWith("tt")) return Promise.resolve(String(id));
  var url = "https://api.themoviedb.org/3/" + (mediaType === "tv" ? "tv" : "movie") + "/" + id + (mediaType === "tv" ? "/external_ids" : "") + "?api_key=" + TMDB_API_KEY;
  return fetchJson(url).then(function(data) { return data && data.imdb_id ? data.imdb_id : ""; }).catch(function() { return ""; });
}

function buildEndpoint(imdbId, mediaType, season, episode) {
  if (!imdbId) return "";
  return mediaType === "tv" 
    ? MURPH_BASE + "/stream/series/" + imdbId + ":" + season + ":" + episode + ".json"
    : MURPH_BASE + "/stream/movie/" + imdbId + ".json";
}

function dedupeStreams(streams) {
  var seen = new Set();
  return streams.filter(function(stream) {
    var fingerprint = [stream.url || ""].join("|");
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

function mapMurphStream(item) {
  if (!item) return null;
  var name = String(item.name || "");
  if (!isProviderMatch(name)) return null;
  
  var url = item.url || item.streamUrl || item.src || "";
  if (!url) return null;

  var title = item.title || item.description || "HindMoviez Stream";
  return {
    name: PROVIDER_NAME,
    title: title,
    url: absolutizeUrl(url),
    quality: normalizeQuality(name + " " + title),
    size: extractSize(title),
    behaviorHints: item.behaviorHints || {}
  };
}

function getStreams(id, type, season, episode) {
  var mediaType = type === "series" ? "tv" : "movie";
  return resolveImdbId(id, mediaType).then(function(imdbId) {
    if (!imdbId) return [];
    var endpoint = buildEndpoint(imdbId, mediaType, season, episode);
    return fetchJson(endpoint).then(function(payload) {
      var streams = extractMurphStreams(payload);
      var mapped = streams.map(mapMurphStream).filter(Boolean);
      // We dedupe first, then return them
      return filterSeekableStreams(dedupeStreams(mapped));
    });
  }).catch(function(err) {
    return [];
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}

// DOOM NORMALIZATION BLOCK
function __doomNormalizeStream(raw) {
  if (!raw || !raw.url) return null;
  var bh = raw.behaviorHints || {};
  if (!bh.bingeGroup) bh.bingeGroup = "hindmoviez-group";
  return {
    name: raw.name || PROVIDER_NAME,
    title: raw.title,
    url: raw.url,
    behaviorHints: bh
  };
}

(function() {
  var oldGet = getStreams;
  getStreams = function() {
    return Promise.resolve(oldGet.apply(this, arguments)).then(function(s) {
      return Array.isArray(s) ? s.map(__doomNormalizeStream).filter(Boolean) : [];
    });
  };
})();
