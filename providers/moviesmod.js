

var BASE = "https://vixsrc.to";
var TMDB_KEY = "68e094699525b18a70bab2f86b1fa706";
var UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function commonHeaders() {
  return {
    "User-Agent": UA,
    "Referer": BASE + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1"
  };
}

function embedHeaders() {
  return {
    "User-Agent": UA,
    "Referer": BASE + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
  };
}

function playlistHeaders(embedUrl) {
  return {
    "User-Agent": UA,
    "Referer": embedUrl,
    "Origin": BASE,
    "Accept": "*/*",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin"
  };
}

// Converte IMDb ID in TMDB ID. Se già numerico, restituisce direttamente.
function resolveId(rawId, type) {
  if (!rawId) return Promise.resolve(null);
  // Rimuovi prefisso tmdb: se presente
  var id = rawId.replace(/^tmdb[:/]/i, "").trim();
  // Se già numerico, non serve conversione
  if (/^\d+$/.test(id)) return Promise.resolve(id);
  // Conversione IMDb → TMDB
  if (!id.startsWith("tt")) return Promise.resolve(null);
  var url = "https://api.themoviedb.org/3/find/" + id +
    "?api_key=" + TMDB_KEY + "&external_source=imdb_id";
  return fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" } })
    .then(function(r) {
      if (!r.ok) return null;
      return r.json().catch(function() { return null; });
    })
    .then(function(data) {
      if (!data) return null;
      var norm = (type === "series" || type === "show") ? "tv" : (type || "movie");
      if (norm === "movie" && data.movie_results && data.movie_results.length > 0)
        return String(data.movie_results[0].id);
      if (norm === "tv" && data.tv_results && data.tv_results.length > 0)
        return String(data.tv_results[0].id);
      return null;
    })
    .catch(function() { return null; });
}

// Costruisce l'URL embed partendo dal payload API, senza new URL()
function buildEmbedUrl(src) {
  if (!src) return null;
  var s = String(src).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.charAt(0) === "/") return BASE + s;
  return BASE + "/" + s;
}

// Estrae token, expires e url dal body HTML dell'embed
function extractPlaylistInfo(html) {
  if (!html || typeof html !== "string") return null;
  // Prova con apici singoli
  var t1 = html.match(/'token'\s*:\s*'([^']+)'/i);
  var e1 = html.match(/'expires'\s*:\s*'([^']+)'/i);
  var u1 = html.match(/url\s*:\s*'([^']+\/playlist\/\d+[^']*)'/i);
  if (t1 && e1 && u1) return { token: t1[1], expires: e1[1], url: u1[1] };
  // Fallback con virgolette doppie
  var t2 = html.match(/"token"\s*:\s*"([^"]+)"/i);
  var e2 = html.match(/"expires"\s*:\s*"([^"]+)"/i);
  var u2 = html.match(/"url"\s*:\s*"([^"]+\/playlist\/\d+[^"]*)"/i);
  if (t2 && e2 && u2) return { token: t2[1], expires: e2[1], url: u2[1] };
  return null;
}

// Funzione principale esposta a NuvioMobile
function getStreams(id, type, season, episode) {
  var rawId = String(id || "").trim();
  var normType = (type === "series" || type === "show") ? "tv" : (type || "movie");

  console.log("[VixSrc] getStreams id=", rawId, "type=", normType, "s=", season, "e=", episode);

  // LIVELLO 1: risolvi ID
  return resolveId(rawId, normType)
    .then(function(tmdbId) {
      if (!tmdbId) {
        console.error("[VixSrc] ID non risolvibile:", rawId);
        return [];
      }

      var apiUrl = normType === "movie"
        ? BASE + "/api/movie/" + tmdbId
        : BASE + "/api/tv/" + tmdbId + "/" + season + "/" + episode;

      console.log("[VixSrc] API URL:", apiUrl);

      // LIVELLO 2: chiama API VixSrc
      return fetch(apiUrl, { headers: commonHeaders() })
        .then(function(r) {
          if (!r.ok) {
            console.error("[VixSrc] API HTTP error:", r.status);
            return [];
          }
          return r.json()
            .catch(function() { return null; })
            .then(function(payload) {
              if (!payload) {
                console.error("[VixSrc] Payload API vuoto o non JSON");
                return [];
              }

              var src = payload && typeof payload === "object" ? payload.src : null;
              var embedUrl = buildEmbedUrl(src);
              if (!embedUrl) {
                console.error("[VixSrc] Nessun src nel payload:", JSON.stringify(payload));
                return [];
              }

              console.log("[VixSrc] Embed URL:", embedUrl);

              // LIVELLO 3: fetch embed HTML
              return fetch(embedUrl, { headers: embedHeaders() })
                .then(function(er) {
                  if (!er.ok) {
                    console.error("[VixSrc] Embed HTTP error:", er.status);
                    return [];
                  }
                  return er.text();
                })
                .then(function(html) {
                  if (!html || typeof html !== "string") {
                    console.error("[VixSrc] HTML embed vuoto");
                    return [];
                  }

                  var info = extractPlaylistInfo(html);
                  if (!info) {
                    console.error("[VixSrc] Token/playlist non trovati. HTML preview:",
                      html.substring(0, 500));
                    return [];
                  }

                  // Costruisci stream URL finale — NO fetch aggiuntivo (crasherebbe su comp-rewrite)
                  var streamUrl = info.url +
                    "?token=" + encodeURIComponent(info.token) +
                    "&expires=" + encodeURIComponent(info.expires) +
                    "&h=1&lang=it";

                  var label = normType === "movie"
                    ? "StreamingCommunity"
                    : "StreamingCommunity S" + season + "E" + episode;

                  console.log("[VixSrc] Stream URL:", streamUrl);

                  return [{
                    name: "\uD83D\uDCE1 VixSrc",
                    title: label,
                    url: streamUrl,
                    quality: "1080p",
                    type: "direct",
                    headers: playlistHeaders(embedUrl),
                    behaviorHints: {
                      notWebReady: false
                    }
                  }];
                });
            });
        });
    })
    .catch(function(err) {
      console.error("[VixSrc] Errore fatale:",
        err && err.message ? err.message : String(err));
      return [];
    });
}

// Export compatibile sia con Node.js che con QuickJS (comp-rewrite)
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
} else if (typeof globalThis !== "undefined") {
  globalThis.getStreams = getStreams;
} else if (typeof global !== "undefined") {
  global.getStreams = getStreams;
}
