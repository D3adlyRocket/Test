// src/embed69/index.js
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE_URL = "https://embed69.org";
var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 11; BRAVIA 4K Build/RP1A.200720.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.50 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

// --- CORE UTILS ---

function get(url, extraHeaders) {
  var headers = Object.assign({}, DEFAULT_HEADERS, extraHeaders || {});
  return fetch(url, { headers: headers }).then(function(res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  });
}

function b64decode(str) {
  try {
    var base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    return atob(base64);
  } catch (e) { return null; }
}

// --- HOST RESOLVERS (Extracted from Original Code) ---

function resolveVoe(embedUrl) {
  return get(embedUrl, { "Referer": embedUrl }).then(function(html) {
    // Voe uses a specific 'hls' variable in their script
    var hlsMatch = html.match(/'hls'\s*:\s*'([^']+)'/i) || html.match(/"hls"\s*:\s*"([^"]+)"/i);
    if (hlsMatch) {
      var url = hlsMatch[1].indexOf("aHR0") === 0 ? b64decode(hlsMatch[1]) : hlsMatch[1];
      return { url: url, quality: "1080p", headers: { "Referer": embedUrl } };
    }
    return null;
  });
}

function resolveStreamWish(embedUrl) {
  var host = embedUrl.split('/').slice(0, 3).join('/');
  return get(embedUrl, { "Referer": "https://embed69.org/" }).then(function(html) {
    var fileMatch = html.match(/file\s*:\s*["']([^"']+)["']/i);
    if (fileMatch) {
      return { url: fileMatch[1], quality: "1080p", headers: { "Referer": host + "/" } };
    }
    return null;
  });
}

// --- PROVIDER LOGIC ---

function getImdbId(tmdbId, type) {
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "/external_ids?api_key=" + TMDB_API_KEY;
  return fetch(url).then(function(res) { return res.json(); }).then(function(data) {
    return data.imdb_id || null;
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  var type = (mediaType === "series" || mediaType === "tv") ? "tv" : "movie";
  
  return getImdbId(tmdbId, type).then(function(imdbId) {
    if (!imdbId) return [];

    var targetUrl = (type === "movie") 
      ? BASE_URL + "/f/" + imdbId 
      : BASE_URL + "/f/" + imdbId + "-" + season + "x" + (String(episode).padStart(2, '0'));

    return get(targetUrl, { "Referer": "https://sololatino.net/" });
  }).then(function(html) {
    // Extract the dataLink array from the page script
    var dataMatch = html.match(/let\s+dataLink\s*=\s*(\[.+\]);/);
    if (!dataMatch) return [];

    var dataLinks = JSON.parse(dataMatch[1]);
    var results = [];
    var languages = ["LAT", "ESP", "SUB"];

    // Sequential Promise chain for TV compatibility
    var sequence = Promise.resolve();

    languages.forEach(function(langKey) {
      sequence = sequence.then(function() {
        // If we found streams in a higher priority language, stop
        if (results.length > 0) return;

        var langData = dataLinks.filter(function(i) { return i.video_language === langKey; })[0];
        if (!langData || !langData.sortedEmbeds) return;

        var embedSequence = Promise.resolve();
        langData.sortedEmbeds.forEach(function(embed) {
          embedSequence = embedSequence.then(function() {
            // Decode the embed.link (which is a encoded JWT-style string)
            var parts = embed.link.split(".");
            if (parts.length < 2) return;
            
            var decoded = JSON.parse(b64decode(parts[1]));
            var rawUrl = decoded.link;
            var resolver = null;

            if (rawUrl.indexOf("voe.sx") !== -1) resolver = resolveVoe;
            if (rawUrl.indexOf("streamwish") !== -1 || rawUrl.indexOf("swish") !== -1) resolver = resolveStreamWish;

            if (resolver) {
              return resolver(rawUrl).then(function(res) {
                if (res) {
                  results.push({
                    name: "Embed69",
                    title: "[" + langKey + "] " + embed.servername + " - " + res.quality,
                    url: res.url,
                    quality: res.quality,
                    headers: res.headers || {}
                  });
                }
              }).catch(function() {});
            }
          });
        });
        return embedSequence;
      });
    });

    return sequence.then(function() { return results; });
  }).catch(function(err) {
    console.error("[Embed69 Error]", err);
    return [];
  });
}

// Global Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
