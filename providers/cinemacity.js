/**
 * videasy - Optimized Integration
 * Generated: 2026-07-06
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

// Target Routing Endpoints & Servers
var BACKEND = "https://nvmindl.duckdns.org/cineby";
var VIDEASY_API = "https://api.wingsdatabase.com";
var VIDEASY_DB = "https://db.wingsdatabase.com/3";
var ANIME_DB = "https://anime-db.videasy.net/api/v2/hianime";

var SERVERS = [
  { name: "Oxygen", endpoint: "myflixerzupcloud/sources-with-title" },
  { name: "Hydrogen", endpoint: "cdn/sources-with-title" },
  { name: "Lithium", endpoint: "moviebox/sources-with-title" },
  { name: "Helium", endpoint: "1movies/sources-with-title" },
  { name: "Titanium", endpoint: "primesrcme/sources-with-title" }
];

var SERVER_ORDER = { Hydrogen: 0, Cypher: 1, Neon: 2, Helium: 3, Vidlink: 4, "Vidlink Proxy": 5 };
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

var REQUEST_HEADERS = {
  "User-Agent": UA,
  "Accept": "*/*",
  "Origin": "https://www.cineby.sc",
  "Referer": "https://www.cineby.sc/",
  "Connection": "keep-alive"
};

var PLAY_HEADERS = {
  "User-Agent": UA,
  "Referer": "https://player.videasy.to/",
  "Origin": "https://player.videasy.to"
};

// Core Network & Fallback Actions
function safeFetch(url, opts, ms) {
  ms = ms || 15e3;
  var controller;
  var tid;
  try {
    controller = new AbortController();
    tid = setTimeout(function() {
      controller.abort();
    }, ms);
  } catch (e) {
    controller = null;
  }
  var o = Object.assign({ method: "GET" }, opts || {});
  if (controller) o.signal = controller.signal;
  return fetch(url, o).then(function(r) {
    if (tid) clearTimeout(tid);
    return r;
  }).catch(function(e) {
    if (tid) clearTimeout(tid);
    throw e;
  });
}

function getTmdbMeta(mediaType, tmdbId, season) {
  return __async(this, null, function* () {
    var url = VIDEASY_DB + "/" + mediaType + "/" + tmdbId + "?append_to_response=external_ids,genres";
    var resp = yield safeFetch(url, {}, 8e3);
    if (!resp.ok) throw new Error("TMDB " + resp.status);
    var data = yield resp.json();
    var title, year, imdbId, isAnime;
    if (mediaType === "movie") {
      title = data.title;
      year = data.release_date ? new Date(data.release_date).getFullYear() : "";
    } else {
      title = data.name;
      year = data.first_air_date ? new Date(data.first_air_date).getFullYear() : "";
    }
    imdbId = data.external_ids && data.external_ids.imdb_id || "";
    var genres = (data.genres || []).map(function(g) { return g.id; });
    var isAnimation = genres.indexOf(16) !== -1;
    var isJapanese = data.original_language === "ja";
    isAnime = mediaType === "tv" && isAnimation && isJapanese;
    
    var seasonName = null;
    var seasonEpisodeCount = 0;
    if (season && data.seasons) {
      var seasonInt = parseInt(season, 10);
      for (var i = 0; i < data.seasons.length; i++) {
        if (data.seasons[i].season_number === seasonInt) {
          seasonName = data.seasons[i].name;
          seasonEpisodeCount = data.seasons[i].episode_count || 0;
          break;
        }
      }
    }
    return { title, year, imdbId, isAnime, originalTitle: data.original_name || data.original_title || "", seasonName, seasonEpisodeCount };
  });
}

function fetchEncrypted(serverEndpoint, params) {
  return __async(this, null, function* () {
    var url = VIDEASY_API + "/" + serverEndpoint + "?title=" + encodeURIComponent(params.title) + "&mediaType=" + params.mediaType + "&year=" + params.year + "&episodeId=" + (params.episodeId || "1") + "&seasonId=" + (params.seasonId || "1") + "&tmdbId=" + params.tmdbId + "&imdbId=" + encodeURIComponent(params.imdbId || "") + "&_t=" + Date.now();
    var resp = yield safeFetch(url, {
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache" }
    }, 12e3);
    if (!resp.ok) throw new Error("API " + resp.status);
    return resp.text();
  });
}

function decryptItems(items, tmdbId, cacheKey) {
  return __async(this, null, function* () {
    var resp = yield safeFetch(BACKEND + "/decrypt-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, tmdbId: String(tmdbId), cacheKey })
    }, 1e4);
    if (!resp.ok) return null;
    var data = yield resp.json();
    if (data.error) return null;
    return data;
  });
}

function fetchVidlinkFallback(params) {
  return __async(this, null, function* () {
    var url = BACKEND + "/vidlink-streams?tmdbId=" + encodeURIComponent(params.tmdbId) + "&mediaType=" + encodeURIComponent(params.mediaType) + "&season=" + encodeURIComponent(params.seasonId || "1") + "&episode=" + encodeURIComponent(params.episodeId || "1");
    var resp = yield safeFetch(url, {}, 22e3);
    if (!resp.ok) throw new Error("Vidlink " + resp.status);
    return resp.json();
  });
}

function fetchRealBackend(params) {
  return __async(this, null, function* () {
    var url = BACKEND + "/real-streams?title=" + encodeURIComponent(params.title) + "&mediaType=" + encodeURIComponent(params.mediaType) + "&year=" + encodeURIComponent(params.year || "") + "&episodeId=" + encodeURIComponent(params.episodeId || "1") + "&seasonId=" + encodeURIComponent(params.seasonId || "1") + "&tmdbId=" + encodeURIComponent(params.tmdbId) + "&imdbId=" + encodeURIComponent(params.imdbId || "");
    var resp = yield safeFetch(url, {}, 3e4);
    if (!resp.ok) throw new Error("Real backend " + resp.status);
    return resp.json();
  });
}

// Processing Transformers
function normalizeQuality(q) {
  if (!q) return "Unknown";
  var s = String(q).toUpperCase().trim();
  if (s === "4K" || s === "2160P") return "4K";
  if (s === "1080P") return "1080p";
  if (s === "720P") return "720p";
  if (s === "480P") return "480p";
  if (s === "360P") return "360p";
  return q;
}

function formatVidlinkStreams(data) {
  var sources = data.sources || [];
  var streams = [];
  for (var i = 0; i < sources.length; i++) {
    var src = sources[i];
    if (!src.url) continue;
    var quality = normalizeQuality(src.quality || "auto");
    var proxyUrl = BACKEND + "/vidlink-proxy?url=" + encodeURIComponent(src.url);
    streams.push({
      name: "Cineby Vidlink",
      title: quality + " [Vidlink]",
      url: proxyUrl,
      quality,
      size: "",
      headers: {},
      subtitles: [],
      provider: "cineby"
    });
  }
  return streams;
}

function formatRegularStreams(data) {
  var sources = data.sources || [];
  var streams = [];
  for (var j = 0; j < sources.length; j++) {
    var src = sources[j];
    if (!src.url) continue;
    var url = src.url;
    if (url.startsWith("http://")) {
      url = url.replace("http://", "https://");
    }
    var quality = normalizeQuality(src.quality);
    var serverTag = src.server ? " [" + src.server + "]" : "";
    var proxyUrl = BACKEND + "/videasy-proxy?url=" + encodeURIComponent(url);
    var isHls = String(url).indexOf(".m3u8") !== -1;
    if (!isHls) {
      streams.push({
        name: src.server ? "Cineby " + src.server : "Cineby",
        title: quality + serverTag,
        url,
        quality,
        size: "",
        headers: PLAY_HEADERS,
        subtitles: [],
        provider: "cineby"
      });
      continue;
    }
    streams.push({
      name: src.server ? "Cineby " + src.server : "Cineby",
      title: quality + serverTag,
      url: proxyUrl,
      quality,
      size: "",
      headers: {},
      subtitles: [],
      provider: "cineby"
    });
  }
  return streams;
}

function compareStreams(a, b) {
  var qr = qualityRank(b && b.quality) - qualityRank(a && a.quality);
  if (qr) return qr;
  var direct = directRank(b) - directRank(a);
  if (direct) return direct;
  var sr = serverRank(a) - serverRank(b);
  if (sr) return sr;
  return String(a && a.title || "").localeCompare(String(b && b.title || ""));
}

function directRank(stream) {
  if (stream && stream.title) {
    if (String(stream.title).indexOf("Fallback") !== -1) return 0;
    if (String(stream.title).indexOf("Proxy") !== -1) return 1;
  }
  return 2;
}

function serverRank(stream) {
  var title = String(stream && stream.title || "");
  var match = title.match(/\[([^\]]+)\]/);
  var name = match ? match[1] : "";
  return SERVER_ORDER.hasOwnProperty(name) ? SERVER_ORDER[name] : 99;
}

function qualityRank(q) {
  q = normalizeQuality(q);
  if (q === "4K") return 4e3;
  var m = String(q || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function normTitle(s) {
  return String(s || "").toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function titleScore(a, b) {
  var wa = normTitle(a).split(" ").filter(Boolean);
  var wb = normTitle(b).split(" ").filter(Boolean);
  var query = wa.length <= wb.length ? wa : wb;
  var result = wa.length <= wb.length ? wb : wa;
  var setResult = {};
  result.forEach(function(w) { setResult[w] = true; });
  var hits = query.filter(function(w) { return setResult[w]; }).length;
  if (hits === query.length) return 1;
  return hits / Math.max(wa.length, wb.length, 1);
}

// Dedicated Anime Resolvers
function findHiAnimeId(title, originalTitle, year, seasonName, seasonEpisodeCount) {
  return __async(this, null, function* () {
    var queries = [title];
    if (originalTitle && normTitle(originalTitle) !== normTitle(title)) {
      queries.push(originalTitle);
    }
    var searchResults = yield Promise.all(queries.map(function(q2) {
      var url = ANIME_DB + "/search?q=" + encodeURIComponent(q2);
      return safeFetch(url, {}, 8e3).then(function(resp) {
        return resp.ok ? resp.json() : null;
      }).then(function(data) {
        if (!data) return [];
        return data.data && data.data.animes || data.animes || [];
      }).catch(function() { return []; });
    }));
    var bestId = null;
    var bestScore = 0;
    var bestHasDub = false;
    var bestWordDiff = Infinity;
    var allResults = [];
    for (var qi = 0; qi < searchResults.length; qi++) {
      var results = searchResults[qi];
      var q = queries[qi];
      var qWords = normTitle(q).split(" ").filter(Boolean).length;
      for (var i = 0; i < results.length; i++) {
        var anime = results[i];
        var score = titleScore(anime.name, q);
        var hasDub = !!(anime.episodes && anime.episodes.dub);
        var wordDiff = Math.abs(normTitle(anime.name).split(" ").filter(Boolean).length - qWords);
        var better = score > bestScore || score === bestScore && wordDiff < bestWordDiff || score === bestScore && wordDiff === bestWordDiff && hasDub && !bestHasDub;
        if (better) {
          bestScore = score;
          bestId = anime.id;
          bestHasDub = hasDub;
          bestWordDiff = wordDiff;
        }
        if (score >= 0.8) allResults.push(anime);
      }
    }
    if (bestScore < 0.4) return null;
    if (seasonName && allResults.length > 1) {
      var normSeason = normTitle(seasonName);
      var seasonWords = normSeason.split(" ").filter(function(w2) { return w2.length > 2; });
      if (seasonWords.length > 0) {
        var bestSeasonScore = -1;
        var bestSeasonId = null;
        var bestSeasonHasDub = false;
        for (var i = 0; i < allResults.length; i++) {
          var anime = allResults[i];
          var normName = normTitle(anime.name);
          var hits = 0;
          for (var w = 0; w < seasonWords.length; w++) {
            if (normName.indexOf(seasonWords[w]) > -1) hits++;
          }
          var snScore = hits / seasonWords.length;
          if (seasonEpisodeCount > 4) {
            var totalEps = anime.episodes && (anime.episodes.sub || anime.episodes.dub || 0) || 0;
            if (totalEps > 0 && totalEps < seasonEpisodeCount * 0.5) {
              snScore *= 0.3;
            }
          }
          var hasDub = !!(anime.episodes && anime.episodes.dub);
          if (snScore > bestSeasonScore || snScore === bestSeasonScore && hasDub && !bestSeasonHasDub) {
            bestSeasonScore = snScore;
            bestSeasonId = anime.id;
            bestSeasonHasDub = hasDub;
          }
        }
        if (bestSeasonScore >= 0.5 && bestSeasonId) {
          return bestSeasonId;
        }
      }
    }
    return bestId;
  });
}

function getHiAnimeStreams(hiAnimeId, episodeNumber) {
  return __async(this, null, function* () {
    var url = VIDEASY_API + "/hianime/sources-with-id?providerId=" + encodeURIComponent(hiAnimeId) + "&episodeId=" + episodeNumber + "&dub=true";
    var resp = yield safeFetch(url, {}, 15e3);
    if (!resp.ok) throw new Error("HiAnime API " + resp.status);
    var data = yield resp.json();
    var ms = data.mediaSources;
    if (!ms) throw new Error("No mediaSources in response");
    return {
      sources: ms.sources || [],
      subtitles: ms.subtitles || []
    };
  });
}

// Master Request Interface
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      var mType = mediaType === "movie" ? "movie" : "tv";
      var seasonId = String(parseInt(season, 10) || 1);
      var episodeId = String(parseInt(episode, 10) || 1);
      
      var meta = yield getTmdbMeta(mType, tmdbId, mType === "tv" ? seasonId : null);
      
      if (meta.isAnime) {
        try {
          var hiAnimeId = yield findHiAnimeId(meta.title, meta.originalTitle, meta.year, meta.seasonName, meta.seasonEpisodeCount);
          if (hiAnimeId) {
            var hiResult = yield getHiAnimeStreams(hiAnimeId, episodeId);
            var hiSources = hiResult.sources;
            if (hiSources.length > 0) {
              var streams = [];
              for (var j = 0; j < hiSources.length; j++) {
                var src = hiSources[j];
                if (!src.url) continue;
                var qLabel = src.quality || "Unknown";
                var qParts = qLabel.split(" - ");
                var res = normalizeQuality(qParts[0]);
                var audioLabel = qParts[1] || "";
                var displayTitle = audioLabel ? res + " - " + audioLabel : res;
                var proxyUrl = BACKEND + "/hianime-proxy?url=" + encodeURIComponent(src.url);
                var streamName = audioLabel ? "Cineby HiAnime " + res + " " + audioLabel : "Cineby HiAnime " + res;
                streams.push({
                  name: streamName,
                  title: displayTitle + " [HiAnime]",
                  url: proxyUrl,
                  quality: res,
                  size: "",
                  headers: {},
                  subtitles: [],
                  provider: "cineby"
                });
              }
              streams.sort(compareStreams);
              return streams;
            }
          }
        } catch (animeErr) {
          // Silent fallback to standard video architecture pipelines
        }
      }

      var params = {
        title: meta.title,
        mediaType: mType,
        year: String(meta.year),
        tmdbId: String(tmdbId),
        imdbId: meta.imdbId,
        seasonId,
        episodeId
      };
      var cacheKey = mType + ":" + tmdbId + ":" + seasonId + ":" + episodeId;

      var realPromise = fetchRealBackend(params).then(function(d) { return d; }).catch(() => null);
      var vidlinkPromise = fetchVidlinkFallback(params).then(function(d) { return d; }).catch(() => null);

      try {
        var results = yield Promise.all([realPromise, vidlinkPromise]);
        var realData = results[0];
        var vidlinkData = results[1];
        var streams = [];

        if (realData && realData.sources && realData.sources.length > 0) {
          streams = streams.concat(formatRegularStreams(realData));
        }
        if (vidlinkData && vidlinkData.sources && vidlinkData.sources.length > 0) {
          streams = streams.concat(formatVidlinkStreams(vidlinkData));
        }
        if (streams.length > 0) {
          streams.sort(compareStreams);
          return streams;
        }
      } catch (mergeErr) {
        // Drop down safely into structural sequential fallbacks
      }

      var primaryServer = SERVERS[1] || SERVERS[0];
      var primaryItem = yield fetchEncrypted(primaryServer.endpoint, params).then(function(text) {
        if (!text || text.length < 10) throw new Error("Empty");
        return { server: primaryServer.name, encrypted: text };
      }).catch(() => null);

      if (primaryItem) {
        var primaryData = yield decryptItems([primaryItem], tmdbId, cacheKey + ":" + primaryServer.name);
        if (primaryData && primaryData.sources && primaryData.sources.length > 0) {
          var primaryStreams = formatRegularStreams(primaryData);
          primaryStreams.sort(compareStreams);
          return primaryStreams;
        }
      }

      var backupServers = SERVERS.filter(function(srv) { return srv.name !== primaryServer.name; });
      var encPromises = backupServers.map(function(srv) {
        return fetchEncrypted(srv.endpoint, params).then(function(text) {
          if (!text || text.length < 10) throw new Error("Empty");
          return { server: srv.name, encrypted: text };
        }).catch(() => null);
      });

      var encResults = yield Promise.all(encPromises);
      var items = [];
      for (var i = 0; i < encResults.length; i++) {
        if (encResults[i]) items.push(encResults[i]);
      }

      if (items.length === 0) {
        try {
          return formatVidlinkStreams(yield fetchVidlinkFallback(params));
        } catch (fallbackError) {
          return [];
        }
      }

      var data = yield decryptItems(items, tmdbId, cacheKey + ":backups");
      if (!data) {
        try {
          return formatVidlinkStreams(yield fetchVidlinkFallback(params));
        } catch (fErr) { return []; }
      }

      var finalStreams = formatRegularStreams(data);
      if (finalStreams.length === 0) {
        try {
          finalStreams = formatVidlinkStreams(yield fetchVidlinkFallback(params));
        } catch (fErr) {}
      }
      
      finalStreams.sort(compareStreams);
      return finalStreams;
    } catch (error) {
      return [];
    }
  });
}

module.exports = { getStreams };
