"use strict";

var cheerio = require("cheerio-without-node-native");

var PROVIDER_NAME = "PikaHD (Streamtape)";
var DEFAULT_MAIN_URL = "https://new.pikahd.co";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
};

// --- Helper Utilities ---

function assign(target, source) {
  target = target || {}; source = source || {};
  var out = {};
  for (var k in target) out[k] = target[k];
  for (var k in source) out[k] = source[k];
  return out;
}

function fixUrl(url, baseUrl) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return "https:" + url;
  try { return new URL(url, baseUrl).toString(); } catch(e) { return url; }
}

function fetchText(url, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || "GET",
    headers: assign(DEFAULT_HEADERS, options.headers || {}),
    redirect: "follow"
  }).then(function(res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  });
}

function getTmdbMeta(tmdbId, mediaType) {
  var type = (mediaType === "tv" || mediaType === "series") ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
  return fetch(url, { headers: DEFAULT_HEADERS }).then(function(res) {
    return res.json();
  }).then(function(data) {
    return {
      title: data.title || data.name || "",
      year: (data.release_date || data.first_air_date || "").split("-")[0] || "2026"
    };
  }).catch(function() {
    return { title: "", year: "2026" };
  });
}

// --- Scraper Core Logic ---

function searchContent(query) {
  var searchUrl = DEFAULT_MAIN_URL + "/?s=" + encodeURIComponent(query);
  return fetchText(searchUrl).then(function(html) {
    var $ = cheerio.load(html);
    var targetHref = null;
    
    $("article, .post, .entry").each(function(_, el) {
      if (targetHref) return;
      var linkEl = $(el).find("h1 a, h2 a, h3 a, .entry-title a, a").first();
      var href = linkEl.attr("href");
      if (href) targetHref = fixUrl(href, DEFAULT_MAIN_URL);
    });

    if (!targetHref) {
      $("a").each(function(_, el) {
        if (targetHref) return;
        var href = $(el).attr("href") || "";
        if (href.includes("/movie/") || href.includes("/series/") || href.includes("/tv/")) {
          targetHref = fixUrl(href, DEFAULT_MAIN_URL);
        }
      });
    }
    return targetHref;
  });
}

function extractFromPage(contentUrl, metaTitle) {
  return fetchText(contentUrl).then(function(html) {
    var $ = cheerio.load(html);
    var rawLinks = [];

    // Extract potential Streamtape embedded links or proxies
    $("iframe[src], iframe[data-src], a[href]").each(function(_, el) {
      var target = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("href") || "";
      if (target.includes("streamtape") || target.includes("tapecontent") || target.includes("kmhd.eu")) {
        rawLinks.push(fixUrl(target, contentUrl));
      }
    });

    if (rawLinks.length === 0) return [];

    var outStreams = [];
    var p = Promise.resolve();

    // Iterate sequentially through found targets to process stream links cleanly
    rawLinks.slice(0, 4).forEach(function(url) {
      p = p.then(function() {
        return resolveStreamtape(url).then(function(resolvedMediaUrl) {
          if (resolvedMediaUrl) {
            var quality = /1080p/.test(resolvedMediaUrl.toLowerCase()) ? "1080p" : "720p";
            
            var fullLayout = 
              "🎬 " + metaTitle + "\n" +
              "💎 " + quality + " | 🔊 Hindi / Multiaudio 🌐\n" +
              "⛓️‍💥 Engine: " + PROVIDER_NAME;

            outStreams.push({
              name: PROVIDER_NAME + " | " + quality,
              title: fullLayout,
              size: fullLayout,
              description: fullLayout,
              url: resolvedMediaUrl
            });
          }
        });
      });
    });

    return p.then(function() { return outStreams; });
  });
}

// --- Dedicated Streamtape Extraction Engine ---

function resolveStreamtape(url) {
  // If we already intercepted a hotlink directly, pass it straight through
  if (url.includes("tapecontent.net/radosgw/")) {
    return Promise.resolve(url);
  }

  // Convert default links to embedded variant paths for easier parsing
  var embedUrl = url.replace("/v/", "/e/");
  
  return fetchText(embedUrl).then(function(html) {
    // Locate the hidden JavaScript token allocation strings Streamtape uses
    var match = html.match(/document\.getElementById\('robotlink'\)\.innerHTML\s*=\s*['"]([^'"]+)['"]/i);
    if (!match) return null;

    var parts = match[1].split("+");
    var finalPath = "";

    parts.forEach(function(part) {
      var clean = part.replace(/['"\s]/g, "");
      if (clean.indexOf("substring") > -1) {
        // Evaluate dynamic string slice offsets used to fool simple scrapers
        var subMatch = clean.match(/.*?substring\((\d+)\)/);
        if (subMatch) {
          var index = parseInt(subMatch[1], 10);
          finalPath += clean.split(".substring")[0].substring(index);
        }
      } else {
        finalPath += clean;
      }
    });

    if (!finalPath) return null;
    
    // Add custom dynamic security generation parameters required by Streamtape CDNs
    var streamToken = html.match(/&token=([A-Za-z0-9_-]+)/);
    var tokenSuffix = streamToken ? "&token=" + streamToken[1] : "";

    var realStreamUrl = "https:" + finalPath + tokenSuffix + "&stream=1";
    return realStreamUrl;
  }).catch(function() {
    return null;
  });
}

// --- Nuvio Entry Points ---

function getStreams(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType).then(function(tmdbData) {
    if (!tmdbData.title) return [];
    
    var searchQuery = tmdbData.title;
    if ((mediaType === "tv" || mediaType === "series") && season && episode) {
      searchQuery += " S" + (season < 10 ? "0" + season : season) + "E" + (episode < 10 ? "0" + episode : episode);
    }

    return searchContent(searchQuery).then(function(contentUrl) {
      if (!contentUrl) {
        return searchContent(tmdbData.title).then(function(fallbackUrl) {
          if (!fallbackUrl) return [];
          return extractFromPage(fallbackUrl, tmdbData.title);
        });
      }
      return extractFromPage(contentUrl, tmdbData.title);
    });
  }).catch(function() {
    return [];
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
