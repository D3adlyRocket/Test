/**
 * PinoyMoviesHub Nuvio Plugin - Simple Edition
 * Domain: pinoymovieshub.win
 * Supports: Movies & TV Shows
 * Language: Filipino / Tagalog / English
 * Author: Enhanced by AI
 * Version: 4.0.0
 */

var cheerio = require("cheerio-without-node-native");

var PROVIDER_NAME = "PinoyMoviesHub";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL = "https://pinoymovieshub.win";

var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": BASE_URL,
  "Cookie": "starstruck_7da72d90b632af60dd1158c068193d61=99f22538d0588cdd7ccfc783299f88a7"
};

// ===== UTILITY FUNCTIONS =====

function merge(obj1, obj2) {
  var out = {};
  var k;
  for (k in obj1 || {}) out[k] = obj1[k];
  for (k in obj2 || {}) out[k] = obj2[k];
  return out;
}

function fetchText(url, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || "GET",
    redirect: options.redirect || "follow",
    headers: merge(HEADERS, options.headers || {}),
    body: options.body
  }).then(function(res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  });
}

function fetchJson(url, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || "GET",
    redirect: options.redirect || "follow",
    headers: merge(HEADERS, options.headers || {}),
    body: options.body
  }).then(function(res) {
    if (!res.ok) return null;
    return res.json();
  }).catch(function() { return null; });
}

function slugify(title) {
  return String(title || "").toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseQuality(text) {
  var value = String(text || "").toLowerCase();
  var m = value.match(/\b(2160p|1440p|1080p|720p|480p|360p|4k|uhd|hd|sd|cam)\b/);
  if (m) {
    var q = m[1];
    if (q === "4k" || q === "uhd") return "2160p";
    if (q === "hd") return "720p";
    if (q === "sd") return "480p";
    if (q === "cam") return "CAM";
    return q;
  }
  return "Auto";
}

function inferLang(text) {
  var t = String(text || "").toLowerCase();
  if (t.indexOf("tagalog") !== -1 || t.indexOf("filipino") !== -1) return "Tagalog";
  if (t.indexOf("english") !== -1 || /\beng\b/.test(t)) return "English";
  if (t.indexOf("spanish") !== -1) return "Spanish";
  if (t.indexOf("korean") !== -1) return "Korean";
  if (t.indexOf("japanese") !== -1) return "Japanese";
  if (t.indexOf("chinese") !== -1) return "Chinese";
  if (t.indexOf("hindi") !== -1) return "Hindi";
  return "Tagalog";
}

// ===== TMDB =====

function getTmdbTitle(tmdbId, mediaType) {
  var type = mediaType === "tv" ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
  return fetchJson(url).then(function(data) {
    if (!data) return null;
    if (mediaType === "tv") return data.name || data.original_name || null;
    return data.title || data.original_title || null;
  });
}

function getTmdbEpisodeTitle(tmdbId, season, episode) {
  if (!season || !episode) return Promise.resolve("");
  var url = "https://api.themoviedb.org/3/tv/" + tmdbId + "/season/" + season + "/episode/" + episode + "?api_key=" + TMDB_API_KEY;
  return fetchJson(url).then(function(data) {
    return data.name || "";
  }).catch(function() { return ""; });
}

// ===== DOOPLAYER API =====

function extractPlayerData(html) {
  var $ = cheerio.load(html);
  var players = [];

  // Look for dooplayer elements with data attributes
  $("[data-post][data-type][data-source], [data-post][data-type], #dooplay_player, .dooplay_player, .dooplay_player_response").each(function(_, el) {
    var postId = $(el).attr("data-post") || $(el).attr("data-id");
    var type = $(el).attr("data-type") || "movie";
    var source = $(el).attr("data-source") || $(el).attr("data-nume") || "1";
    var nonce = $(el).attr("data-nonce") || "";

    if (postId) {
      players.push({
        postId: postId,
        type: type,
        source: source,
        nonce: nonce
      });
    }
  });

  // Also look in scripts for dooplayer initialization
  var scripts = $("script").map(function(_, el) { return $(el).html() || ""; }).get();
  var i;
  for (i = 0; i < scripts.length; i++) {
    var script = scripts[i];
    var postMatch = script.match(/data-post[=:]\s*["'](\d+)["']/);
    var typeMatch = script.match(/data-type[=:]\s*["']([^"']+)["']/);
    var sourceMatch = script.match(/data-source[=:]\s*["']([^"']+)["']/);
    var nonceMatch = script.match(/data-nonce[=:]\s*["']([^"']+)["']/);

    if (postMatch) {
      players.push({
        postId: postMatch[1],
        type: typeMatch ? typeMatch[1] : "movie",
        source: sourceMatch ? sourceMatch[1] : "1",
        nonce: nonceMatch ? nonceMatch[1] : ""
      });
    }
  }

  // Deduplicate by postId+source
  var seen = {};
  var unique = [];
  for (i = 0; i < players.length; i++) {
    var key = players[i].postId + "-" + players[i].source;
    if (!seen[key]) {
      seen[key] = 1;
      unique.push(players[i]);
    }
  }

  console.log("[PinoyMoviesHub] Found", unique.length, "player(s)");
  return unique;
}

function callDooPlayerAPI(playerData) {
  var apiUrl = BASE_URL + "/wp-json/dooplayer/v2/" + playerData.postId + "/" + playerData.type + "/" + playerData.source;
  console.log("[PinoyMoviesHub] Calling Dooplayer API:", apiUrl);

  return fetchJson(apiUrl, {
    headers: merge(HEADERS, {
      "X-Requested-With": "XMLHttpRequest"
    })
  }).then(function(data) {
    if (!data) {
      console.log("[PinoyMoviesHub] Dooplayer API returned null");
      return null;
    }
    console.log("[PinoyMoviesHub] Dooplayer API response keys:", Object.keys(data || {}).join(", "));

    var embedUrl = data.embed_url || data.url || data.source || data.link || data.file || data.src;
    if (embedUrl) {
      console.log("[PinoyMoviesHub] Dooplayer embed URL:", embedUrl);
      return embedUrl;
    }

    if (data.data) {
      embedUrl = data.data.embed_url || data.data.url || data.data.source || data.data.link || data.data.file || data.data.src;
      if (embedUrl) {
        console.log("[PinoyMoviesHub] Dooplayer nested embed URL:", embedUrl);
        return embedUrl;
      }
    }

    var html = data.html || data.iframe || data.embed || data.player;
    if (html && typeof html === "string") {
      var iframeMatch = html.match(/src=["']([^"']+)["']/);
      if (iframeMatch && iframeMatch[1]) {
        console.log("[PinoyMoviesHub] Dooplayer iframe src:", iframeMatch[1]);
        return iframeMatch[1];
      }
    }

    console.log("[PinoyMoviesHub] Dooplayer API response:", JSON.stringify(data).substring(0, 200));
    return null;
  }).catch(function(e) {
    console.log("[PinoyMoviesHub] Dooplayer API error:", e.message);
    return null;
  });
}

// ===== STREAM BUILDER =====

function buildStream(name, url, quality, language, displayTitle, meta) {
  var lang = inferLang(language);
  var isSeries = !!(meta && meta.season);
  var host = "";
  try { host = new URL(url).hostname.replace(/^www\./, "").replace(/\.com$/, "").replace(/\.top$/, "").replace(/\.click$/, ""); } catch(e) {}

  // Detect if this is an embed URL (not a direct video file)
  var isEmbed = !/\.(m3u8|mp4|mkv|webm|avi|mov)(\?|#|$)/i.test(url);
  var q = isEmbed ? "Browser" : parseQuality(quality + " " + language);

  var line1, line2;
  if (isSeries) {
    var epPart = meta.episodeTitle ? " - " + meta.episodeTitle : "";
    line1 = "S" + meta.season + "E" + meta.episode + epPart + " | " + displayTitle;
  } else {
    line1 = displayTitle;
  }

  if (isEmbed) {
    line2 = "Browser | " + lang + (host ? " | " + host : "");
  } else {
    line2 = q + " | " + lang + (host ? " | " + host : "");
  }

  return {
    name: "PinoyMoviesHub" + (isEmbed ? " | " + lang + " | (Embed)" : " | " + q + " | " + lang),
    title: line1 + "\n" + line2,
    url: url,
    quality: q,
    headers: { Referer: BASE_URL },
    provider: "pinoymovieshub",
    behaviorHints: {
      bingeGroup: "pinoymovieshub-" + (isEmbed ? "embed" : q.toLowerCase()),
      notWebReady: isEmbed
    }
  };
}

// ===== MAIN ENTRY =====

function getStreams(tmdbId, mediaType, season, episode) {
  console.log("[PinoyMoviesHub] === START for " + mediaType + " TMDB ID:" + tmdbId + " S" + season + "E" + episode + " ===");

  var epPromise = (mediaType === "tv")
    ? getTmdbEpisodeTitle(tmdbId, season, episode)
    : Promise.resolve("");

  return epPromise.then(function(episodeTitle) {
    return getTmdbTitle(tmdbId, mediaType).then(function(title) {
      if (!title) {
        console.log("[PinoyMoviesHub] TMDB title not found");
        return [];
      }
      console.log("[PinoyMoviesHub] TMDB title: '" + title + "'");

      var slug = slugify(title);
      var pageUrl, displayTitle;

      if (mediaType === "movie") {
        displayTitle = title;
        pageUrl = BASE_URL + "/movies/" + slug + "/";
      } else {
        displayTitle = title + " S" + season + "E" + episode;
        pageUrl = BASE_URL + "/episodes/" + slug + "-" + season + "x" + episode + "/";
      }

      console.log("[PinoyMoviesHub] Fetching page:", pageUrl);

      return fetchText(pageUrl).then(function(html) {
        var meta = {
          season: season,
          episode: episode,
          episodeTitle: episodeTitle
        };

        var players = extractPlayerData(html);
        if (!players.length) {
          console.log("[PinoyMoviesHub] No player data found");
          return [];
        }

        console.log("[PinoyMoviesHub] Using Dooplayer API approach");

        return Promise.all(players.map(function(player) {
          return callDooPlayerAPI(player).then(function(embedUrl) {
            if (!embedUrl) return null;
            return buildStream(
              "PinoyMoviesHub - Source " + player.source,
              embedUrl,
              "Auto",
              "",
              displayTitle,
              meta
            );
          });
        })).then(function(results) {
          var streams = [];
          var i;
          for (i = 0; i < results.length; i++) {
            if (results[i]) streams.push(results[i]);
          }
          console.log("[PinoyMoviesHub] Returning", streams.length, "stream(s)");
          return streams;
        });
      });
    });
  }).catch(function(err) {
    console.error("[PinoyMoviesHub] error:", err.message || err);
    return [];
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
