"use strict";

var cheerio = require("cheerio-without-node-native");

var PROVIDER_NAME = "PikaHD";
var DEFAULT_MAIN_URL = "https://new.pikahd.co";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
};

// --- Helper Functions ---

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

function fetchJson(url) {
  return fetch(url, { headers: DEFAULT_HEADERS }).then(function(res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  });
}

function getTmdbMeta(tmdbId, mediaType) {
  var type = (mediaType === "tv" || mediaType === "series") ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
  return fetchJson(url).then(function(data) {
    return {
      title: data.title || data.name || "",
      year: (data.release_date || data.first_air_date || "").split("-")[0] || "2026"
    };
  }).catch(function() {
    return { title: "", year: "2026" };
  });
}

// --- Scraper Implementation Engine ---

function searchContent(query) {
  var searchUrl = DEFAULT_MAIN_URL + "/?s=" + encodeURIComponent(query);
  return fetchText(searchUrl).then(function(html) {
    var $ = cheerio.load(html);
    var targetHref = null;
    
    // Look through WordPress standard article layouts
    $("article, .post, .entry").each(function(_, el) {
      if (targetHref) return;
      var linkEl = $(el).find("h1 a, h2 a, h3 a, .entry-title a, a").first();
      var href = linkEl.attr("href");
      if (href) targetHref = fixUrl(href, DEFAULT_MAIN_URL);
    });

    // Fallback global link processing
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

    // 1. Check for nested iframes or direct streaming paths embedded on the layout
    $("iframe[src], iframe[data-src]").each(function(_, el) {
      var src = $(el).attr("src") || $(el).attr("data-src");
      if (src && !src.includes("youtube.com")) {
        rawLinks.push(fixUrl(src, contentUrl));
      }
    });

    // 2. Extract outbound streaming indicators, direct mirror assets, or link proxy patterns
    $("a[href]").each(function(_, el) {
      var href = $(el).attr("href") || "";
      var lower = href.toLowerCase();
      if (lower.includes("kmhd.eu") || lower.includes("player") || lower.includes("embed") || /\.(mp4|mkv|m3u8)/.test(lower)) {
        rawLinks.push(fixUrl(href, contentUrl));
      }
    });

    if (rawLinks.length === 0) return [];

    var outStreams = [];
    var maxLinks = rawLinks.slice(0, 5); // Performance throttle loop bounds
    
    // Process items sequentially to prevent event-loop lockups inside the mobile ecosystem
    var p = Promise.resolve();
    maxLinks.forEach(function(url) {
      p = p.then(function() {
        return resolveStreamSource(url).then(function(resolvedUrl) {
          if (resolvedUrl) {
            var quality = /4k|2160/.test(resolvedUrl.toLowerCase()) ? "2160p" : "1080p";
            
            // Generate the multi-line layout formatting scheme requested by Nuvio
            var fullLayout = 
              "🎬 " + metaTitle + "\n" +
              "💎 " + quality + " | 🔊 English 🇺🇸\n" +
              "⛓️‍💥 Provider: " + PROVIDER_NAME;

            outStreams.push({
              name: PROVIDER_NAME + " | " + quality,
              title: fullLayout,
              size: fullLayout,
              description: fullLayout,
              url: resolvedUrl
            });
          }
        });
      });
    });

    return p.then(function() { return outStreams; });
  });
}

// Deep page resolution pipeline to trace actual video URLs past redirection layers
function resolveStreamSource(url) {
  if (/\.(mp4|mkv|m3u8)/.test(url.toLowerCase())) {
    return Promise.resolve(url);
  }
  return fetchText(url).then(function(html) {
    var $ = cheerio.load(html);
    var foundUrl = "";

    // Parse internal deep layers looking for native source variables or configurations
    $("video source, video").each(function(_, el) {
      var src = $(el).attr("src");
      if (src) foundUrl = fixUrl(src, url);
    });

    if (!foundUrl) {
      $("iframe[src]").each(function(_, el) {
        var src = $(el).attr("src") || "";
        if (/\.(mp4|mkv|m3u8)/.test(src.toLowerCase())) foundUrl = fixUrl(src, url);
      });
    }

    // Try tracking setup script configuration blocks if standard tags are empty
    if (!foundUrl) {
      var scriptContent = "";
      $("script").each(function(_, el) {
        scriptContent += $(el).html() || "";
      });
      var fileMatch = scriptContent.match(/file\s*:\s*["'](http[^"']+)["']/i) || 
                      scriptContent.match(/source\s*:\s*["'](http[^"']+)["']/i);
      if (fileMatch) foundUrl = fileMatch[1];
    }

    return foundUrl || null;
  }).catch(function() {
    return null;
  });
}

// --- Core Exports Interface ---

function getStreams(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType).then(function(tmdbData) {
    if (!tmdbData.title) return [];
    
    var searchQuery = tmdbData.title;
    // Append serialization indicators for TV show logic
    if ((mediaType === "tv" || mediaType === "series") && season && episode) {
      searchQuery += " S" + (season < 10 ? "0" + season : season) + "E" + (episode < 10 ? "0" + episode : episode);
    }

    return searchContent(searchQuery).then(function(contentUrl) {
      if (!contentUrl) {
        // Fallback search strictly utilizing name title if precise serialization queries fail
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
