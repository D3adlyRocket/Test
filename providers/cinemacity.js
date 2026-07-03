/**
 * watchanimeworld - Built from src/watchanimeworld/
 * Generated: 2026-07-03T13:30:07.967Z
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

// src/watchanimeworld/http.js
var BASE_URL = "https://watchanimeworld.net";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": BASE_URL + "/",
  "X-Requested-With": "XMLHttpRequest"
};
function fetchText(url, extra) {
  return __async(this, null, function* () {
    var opts = Object.assign({ headers: Object.assign({}, HEADERS) }, extra || {});
    if (extra && extra.headers) {
      Object.assign(opts.headers, extra.headers);
    }
    console.log("[watchanimeworld] GET " + url);
    var res = yield fetch(url, opts);
    if (!res.ok) {
      throw new Error("HTTP " + res.status + " for " + url);
    }
    return yield res.text();
  });
}
function fetchPage(path, extra) {
  return fetchText(BASE_URL + path, extra);
}

// src/watchanimeworld/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var SEL_SEARCH_RESULT_LINK = ".search-results a, .result-item a, .post-item a";
var SEL_SEARCH_RESULT_TITLE = "h2, h3, .title, .post-title";
var SEL_EPISODE_LINK = ".ep-list > a, .episode-list a, .episodes a, .listing a";
var SEL_VIDEO_SRC_DIRECT = "#player source, video source";
var ATTR_VIDEO_SRC_DIRECT = "src";
var SEL_PLAYER_EMBED = "#player";
var ATTR_PLAYER_EMBED = "data-src";
var SEL_IFRAME = "iframe.embed-player, iframe.video-player, .video iframe";
var SEL_QUALITY_BADGE = ".quality-badge, .server-quality, .label-quality";
function searchUrl(query) {
  return "/search/" + encodeURIComponent(query);
}
function episodeUrl(slug, season, episode) {
  if (season && season > 1) {
    return "/" + slug + "/season-" + season + "-episode-" + episode;
  }
  return "/" + slug + "-episode-" + episode;
}
function parseQuality(raw) {
  if (!raw)
    return null;
  var match = raw.match(/\b(4K|2160p|1080p|720p|480p|360p|CAM|HD|SD|FHD)\b/i);
  return match ? match[1].toUpperCase() : null;
}
function extractUrlFromScripts(html) {
  var patterns = [
    /["'](https?:\/\/[^\s"']+\.(m3u8|mp4))["']/i,
    /file\s*:\s*["'](https?:\/\/[^\s"']+)["']/i,
    /source\s*:\s*["'](https?:\/\/[^\s"']+)["']/i,
    /video_url\s*=\s*["'](https?:\/\/[^\s"']+)["']/i,
    /data-url\s*=\s*["'](https?:\/\/[^\s"']+)["']/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = html.match(patterns[i]);
    if (m)
      return m[1];
  }
  return null;
}
function extractFromIframe($) {
  var src = $(SEL_IFRAME).attr("src");
  if (src) {
    if (src.startsWith("/")) {
      src = BASE_URL + src;
    }
    return src;
  }
  return null;
}
function searchAnime(title) {
  return __async(this, null, function* () {
    var html = yield fetchPage(searchUrl(title));
    var $ = import_cheerio_without_node_native.default.load(html);
    var result = null;
    $(SEL_SEARCH_RESULT_LINK).each(function() {
      var el = $(this);
      var link = el.attr("href") || "";
      var name = el.find(SEL_SEARCH_RESULT_TITLE).text().trim() || el.text().trim();
      if (!name)
        return;
      var normalisedName = name.toLowerCase();
      var normalisedQuery = title.toLowerCase();
      if (normalisedName.indexOf(normalisedQuery) !== -1 || normalisedQuery.indexOf(normalisedName.split(/[:\-(]/)[0].trim()) !== -1) {
        result = {
          slug: link.replace(/^\/|\/$/g, "").split("/").pop(),
          title: name,
          detailUrl: link.startsWith("http") ? link : BASE_URL + link
        };
        return false;
      }
    });
    if (!result) {
      console.log('[watchanimeworld] No search result matched "' + title + '"');
    }
    return result;
  });
}
function resolveEpisodePage(detailUrl, season, episode) {
  return __async(this, null, function* () {
    var html = yield fetchText(detailUrl);
    var $ = import_cheerio_without_node_native.default.load(html);
    var slug = detailUrl.replace(BASE_URL, "").replace(/^\/|\/$/g, "").split("/")[0];
    var constructed = episodeUrl(slug, season, episode);
    console.log("[watchanimeworld] Trying constructed URL: " + constructed);
    var found = false;
    $(SEL_EPISODE_LINK).each(function() {
      var href = $(this).attr("href") || "";
      var epNum = String(episode);
      if (href.indexOf(epNum) !== -1) {
        found = true;
        constructed = href.startsWith("http") ? href : BASE_URL + href;
        return false;
      }
    });
    if (!found) {
      console.log("[watchanimeworld] Episode " + episode + " not found in listing, falling back to constructed URL: " + constructed);
    }
    return BASE_URL + constructed;
  });
}
function extractStreamsFromPage(episodePageUrl) {
  return __async(this, null, function* () {
    var html = yield fetchText(episodePageUrl);
    var $ = import_cheerio_without_node_native.default.load(html);
    var streams = [];
    var directSrc = $(SEL_VIDEO_SRC_DIRECT).attr(ATTR_VIDEO_SRC_DIRECT);
    if (directSrc) {
      var quality = parseQuality($(SEL_QUALITY_BADGE).first().text()) || "AUTO";
      streams.push({
        name: "watchanimeworld",
        title: quality + " \u2014 Direct",
        url: directSrc,
        quality,
        headers: HEADERS
      });
    }
    if (streams.length === 0) {
      var embedSrc = $(SEL_PLAYER_EMBED).attr(ATTR_PLAYER_EMBED);
      if (embedSrc) {
        var qualityB = parseQuality($(SEL_QUALITY_BADGE).first().text()) || "AUTO";
        streams.push({
          name: "watchanimeworld",
          title: qualityB + " \u2014 Embed",
          url: embedSrc,
          quality: qualityB,
          headers: HEADERS
        });
      }
    }
    if (streams.length === 0) {
      var iframeUrl = extractFromIframe($);
      if (iframeUrl) {
        streams.push({
          name: "watchanimeworld",
          title: "Embed Player",
          url: iframeUrl,
          quality: "AUTO",
          headers: HEADERS
        });
      }
    }
    if (streams.length === 0) {
      var scriptUrl = extractUrlFromScripts(html);
      if (scriptUrl) {
        var inferredQuality = "AUTO";
        if (scriptUrl.indexOf(".m3u8") !== -1) {
          inferredQuality = "AUTO";
        }
        streams.push({
          name: "watchanimeworld",
          title: inferredQuality + " \u2014 Script Extract",
          url: scriptUrl,
          quality: inferredQuality,
          headers: HEADERS
        });
      }
    }
    if (streams.length === 0) {
      console.log("[watchanimeworld] No streams found on: " + episodePageUrl);
    }
    return streams;
  });
}
function extractStreams(title, mediaType, season, episode) {
  return __async(this, null, function* () {
    var searchResult = yield searchAnime(title);
    if (!searchResult) {
      console.log("[watchanimeworld] Search returned no results for: " + title);
      return [];
    }
    console.log("[watchanimeworld] Found: " + searchResult.title + " \u2192 " + searchResult.detailUrl);
    if (mediaType === "movie") {
      return yield extractStreamsFromPage(searchResult.detailUrl);
    }
    if (episode == null) {
      console.log("[watchanimeworld] No episode specified for TV media");
      return [];
    }
    var epUrl = yield resolveEpisodePage(searchResult.detailUrl, season, episode);
    return yield extractStreamsFromPage(epUrl);
  });
}

// src/watchanimeworld/index.js
var import_cheerio_without_node_native2 = __toESM(require("cheerio-without-node-native"));
var TMDB_API = "https://api.themoviedb.org/3";
var TMDB_KEY = "";
function resolveTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    if (TMDB_KEY) {
      try {
        var endpoint = mediaType === "movie" ? "movie" : "tv";
        var url = TMDB_API + "/" + endpoint + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=en-US";
        var json = JSON.parse(yield fetchText(url));
        return json.title || json.name || "";
      } catch (e) {
        console.log("[watchanimeworld] TMDB lookup failed: " + e.message);
      }
    }
    try {
      var typePath = mediaType === "movie" ? "movie" : "tv";
      var pageUrl = "https://www.themoviedb.org/" + typePath + "/" + tmdbId;
      var html = yield fetchText(pageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      var $ = import_cheerio_without_node_native2.default.load(html);
      var title = $("h2 a").text().trim() || $("h1").text().trim() || $("title").text().trim().split(" | ")[0].split(" \u2014 ")[0];
      if (title)
        return title;
    } catch (e) {
      console.log("[watchanimeworld] TMDB page scrape failed: " + e.message);
    }
    console.log("[watchanimeworld] Could not resolve title for TMDB " + tmdbId);
    return "";
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[watchanimeworld] Request: " + mediaType + " / " + tmdbId + " / S" + (season || "?") + "E" + (episode || "?"));
      var title = yield resolveTitle(tmdbId, mediaType);
      if (!title) {
        console.log("[watchanimeworld] Aborting \u2014 could not resolve title");
        return [];
      }
      console.log("[watchanimeworld] Resolved title: " + title);
      var streams = yield extractStreams(title, mediaType, season, episode);
      console.log("[watchanimeworld] Returning " + streams.length + " stream(s)");
      return streams;
    } catch (error) {
      console.error("[watchanimeworld] Fatal: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
