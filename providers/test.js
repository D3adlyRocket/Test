"use strict";

var PROVIDER_NAME = "OnlyKDrama";
var SITE_URL = "https://onlykdrama.shop";
var TMDB_URL = "https://www.themoviedb.org";
var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5"
};

function mergeHeaders(base, extra) {
  var result = {};
  var key;
  for (key in base) {
    if (Object.prototype.hasOwnProperty.call(base, key)) { result[key] = base[key]; }
  }
  if (!extra) { return result; }
  for (key in extra) {
    if (Object.prototype.hasOwnProperty.call(extra, key)) { result[key] = extra[key]; }
  }
  return result;
}

function fetchText(url, options) {
  var request = options || {};
  request.headers = mergeHeaders(DEFAULT_HEADERS, request.headers || {});
  return fetch(url, request).then(function (response) {
    if (!response.ok) { throw new Error("HTTP " + response.status + " for " + url); }
    return response.text();
  });
}

function decodeHtml(text) {
  if (!text) { return ""; }
  return text
    .replace(/&#(\d+);/g, function (_, code) { return String.fromCharCode(parseInt(code, 10)); })
    .replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function stripTags(text) {
  return decodeHtml((text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeText(text) {
  return decodeHtml(text || "")
    .toLowerCase()
    .replace(/[\u2019'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFirstMatch(text, patterns) {
  var i, match;
  for (i = 0; i < patterns.length; i += 1) {
    match = text.match(patterns[i]);
    if (match && match[1]) { return stripTags(match[1]); }
  }
  return "";
}

function getTmdbInfo(tmdbId, mediaType) {
  var route = mediaType === "movie" ? "movie" : "tv";
  var url = TMDB_URL + "/" + route + "/" + encodeURIComponent(String(tmdbId)) + "?language=en-US";
  return fetchText(url).then(function (html) {
    var title = getFirstMatch(html, [
      /<meta property="og:title" content="([^"]+)"/i,
      /<title>([\s\S]*?)<\/title>/i,
      /"name":"([^"]+)"/i
    ]);
    var yearMatch = html.match(/<title>[\s\S]*?\b((?:19|20)\d{2})\b[\s\S]*?<\/title>/i) || html.match(/\b((?:19|20)\d{2})\b/);
    return {
      title: title.replace(/\s+\(TV Series.*$/i, "").replace(/\s+\(\d{4}\).*$/i, "").trim(),
      year: yearMatch ? yearMatch[1] : ""
    };
  });
}

function extractCandidateUrls(html) {
  var regex = /(https?:\/\/onlykdrama\.shop\/(?:drama|movies|episodes)\/[a-z0-9\-]+)\/?/gi;
  var urls = [];
  var seen = {};
  var match;
  
  while ((match = regex.exec(html))) {
    var cleanUrl = match[1].toLowerCase();
    if (!cleanUrl.endsWith('/')) { cleanUrl += '/'; }
    if (seen[cleanUrl]) { continue; }
    seen[cleanUrl] = true;
    urls.push(cleanUrl);
  }
  return urls;
}

function collectCandidatePages(title, mediaType, episode) {
  var searchUrl = SITE_URL + "/?s=" + encodeURIComponent(title);
  return fetchText(searchUrl).then(function (html) {
    var extracted = extractCandidateUrls(html);
    var filtered = [];
    var i;

    for (i = 0; i < extracted.length; i += 1) {
      var url = extracted[i];
      // For TV shows, prioritize the direct episode paths if found
      if (mediaType === "tv") {
        if (url.indexOf("/episodes/") !== -1 || url.indexOf("-episode-") !== -1 || url.indexOf("-ep-") !== -1) {
          filtered.unshift(url); 
        } else {
          filtered.push(url);
        }
      } else if (mediaType === "movie" && url.indexOf("/movies/") !== -1) {
        filtered.push(url);
      }
    }
    return filtered;
  }).catch(function () {
    return [];
  });
}

// Recursively unwrap base64 payload strings to handle nested redirects
function decodePayloadString(payload) {
  if (!payload) return "";
  try {
    var decoded = atob(decodeURIComponent(payload));
    if (decoded.indexOf('{"url":"') === 0) {
      var parsed = JSON.parse(decoded);
      if (parsed && parsed.url) {
        // Look inside the extracted string for nested layers
        var nestedMatch = parsed.url.match(/[?&][dd]=([^&]+)/);
        if (nestedMatch && nestedMatch[1]) {
          return decodePayloadString(nestedMatch[1]);
        }
        return parsed.url;
      }
    }
    return decoded;
  } catch (e) {
    return "";
  }
}

function extractEpisodeAnchors(html) {
  // Broad match layout pattern covering raw tags, targets, and parameters
  var regex = /href=["'](https?:\/\/(?:ads\d*?\.onlykdrama\.(?:shop|top)\/continue\.php|new5\.filepress\.wiki\/file\/|hubcloud\.[a-z0-9]+\/video\/)[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var results = [];
  var seen = {};
  var match;

  while ((match = regex.exec(html))) {
    var originalUrl = match[1];
    var rawText = match[2] ? stripTags(match[2]) : "";
    var finalUrl = originalUrl;

    if (originalUrl.indexOf("/continue.php") !== -1) {
      var paramMatch = originalUrl.match(/[?&][idvdt]=([^&]+)/);
      if (paramMatch && paramMatch[1]) {
        var unwrapped = decodePayloadString(paramMatch[1]);
        if (unwrapped && unwrapped.indexOf("http") === 0) {
          finalUrl = unwrapped;
        }
      }
    }

    if (!finalUrl || seen[finalUrl]) { continue; }
    seen[finalUrl] = true;

    results.push({
      url: finalUrl,
      text: rawText
    });
  }
  return results;
}

function checkMatch(text, url, season, episode) {
  var normText = text.toLowerCase().replace(/[^a-z0-9]/g, " ");
  var normUrl = decodeURIComponent(url).toLowerCase().replace(/[^a-z0-9]/g, " ");
  
  var sStr = "s" + (season < 10 ? "0" + season : season);
  var eStr = "e" + (episode < 10 ? "0" + episode : episode);
  var epFullStr = "episode " + episode;
  var epShortStr = "ep " + episode;

  // Exact Match targeting signature: checking both standard and fallback styles
  if (normText.indexOf(sStr + eStr) !== -1 || normUrl.indexOf(sStr + eStr) !== -1) { return true; }
  if (season === 1) {
    if (normText.indexOf(epFullStr) !== -1 || normText.indexOf(epShortStr) !== -1) { return true; }
    if (normUrl.indexOf(epFullStr) !== -1 || normUrl.indexOf(epShortStr) !== -1) { return true; }
  }
  return false;
}

function tryCandidatePages(urls, index, mediaType, tmdbInfo, season, episode) {
  if (index >= urls.length) { return Promise.resolve([]); }
  
  var currentUrl = urls[index];

  return fetchText(currentUrl).then(function (html) {
    var anchors = extractEpisodeAnchors(html);
    var streams = [];
    var i;

    for (i = 0; i < anchors.length; i += 1) {
      var a = anchors[i];
      if (mediaType === "movie" || checkMatch(a.text, a.url, season, episode)) {
        var qualityMatch = a.text.match(/\b(2160p|1080p|720p|480p)\b/i);
        var q = qualityMatch ? qualityMatch[1] : "HD";
        
        streams.push({
          name: PROVIDER_NAME,
          title: a.text || (tmdbInfo.title + " E" + episode),
          url: a.url,
          quality: q
        });
      }
    }

    if (streams.length > 0) { return streams; }
    return tryCandidatePages(urls, index + 1, mediaType, tmdbInfo, season, episode);
  }).catch(function () {
    return tryCandidatePages(urls, index + 1, mediaType, tmdbInfo, season, episode);
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  var normalizedMediaType = mediaType === "movie" ? "movie" : "tv";
  var normalizedSeason = Number(season) || 1;
  var normalizedEpisode = Number(episode) || 1;

  return getTmdbInfo(tmdbId, normalizedMediaType).then(function (tmdbInfo) {
    if (!tmdbInfo || !tmdbInfo.title) { return []; }
    
    return collectCandidatePages(tmdbInfo.title, normalizedMediaType, normalizedEpisode).then(function (urls) {
      if (!urls || !urls.length) {
        // If the query engine came up short, synthesize path fallbacks directly
        var slug = normalizeText(tmdbInfo.title).replace(/\s+/g, "-");
        urls = [
          SITE_URL + "/episodes/" + slug + "-episode-" + normalizedEpisode + "/",
          SITE_URL + "/episodes/" + slug + "-ep-" + normalizedEpisode + "/"
        ];
      }
      return tryCandidatePages(urls, 0, normalizedMediaType, tmdbInfo, normalizedSeason, normalizedEpisode);
    });
  }).catch(function (error) {
    console.log("[" + PROVIDER_NAME + "] Error: " + error.message);
    return [];
  });
}

module.exports = { getStreams: getStreams };
