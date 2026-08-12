var forge = require('node-forge');

var PROVIDER_NAME = "Peachify";
var AES_KEY_HEX = "a8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b8cad1e2d0a4d5c5d";
var KEY_BYTES = forge.util.hexToBytes(AES_KEY_HEX);
var MOBILE_UAS = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-F946U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36"
];
var TIMEOUT = 15000;
var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";

// Array of different proxy servers.
var SERVERS = [
  { label: "Iron",  base: "https://proxy.eat-peach.sbs", path: "moviebox" },
  { label: "Wolf",  base: "https://proxy.eat-peach.sbs", path: "air" },
  { label: "Spider", base: "https://proxy.eat-peach.sbs", path: "holly" },
  { label: "Multi", base: "https://proxy.eat-peach.sbs", path: "multi" },
  { label: "Dark",  base: "https://proxy.eat-peach.sbs", path: "net" }
];

async function fetchTitle(tmdbId, mediaType) {
  var type = (mediaType === 'tv' || mediaType === 'series') ? 'tv' : 'movie';
  try {
    var res = await fetchWithTimeout(
      "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_KEY,
      { headers: { "User-Agent": UA } },
      8000
    );
    if (res && res.ok) {
      var data = await res.json();
      return data.title || data.name || null;
    }
  } catch(e) {}
  return null;
}

function getRequestHeaders(sessionUA) {
  return {
    "User-Agent": sessionUA,
    "Origin": "https://peachify.top",
    "Referer": "https://peachify.top/"
  };
}

function b64urlDecode(s) {
    let t = s.replace(/-/g, "+").replace(/_/g, "/");
    let padding = t.length % 4 === 0 ? "" : "=".repeat(4 - t.length % 4);
    return forge.util.decode64(t + padding);
}

function aesGcmDecrypt(encryptedStr) {
    const parts = encryptedStr.split(".");
    if (parts.length < 3) return null;
    
    const iv = b64urlDecode(parts[0]);
    const c1 = b64urlDecode(parts[1]);
    const c2 = b64urlDecode(parts[2]);
    
    const combined = c1 + c2;
    const actual_ciphertext = combined.substring(0, combined.length - 16);
    const tag = combined.substring(combined.length - 16);
    
    const decipher = forge.cipher.createDecipher('AES-GCM', KEY_BYTES);
    
    decipher.start({
        iv: iv,
        tagLength: 128,
        tag: forge.util.createBuffer(tag)
    });
    
    decipher.update(forge.util.createBuffer(actual_ciphertext));
    const pass = decipher.finish();
    
    if (pass) {
        try {
            return JSON.parse(decipher.output.toString('utf8'));
        } catch(e) {
            return null;
        }
    } else {
        return null;
    }
}

async function fetchWithTimeout(url, options, timeout) {
  timeout = timeout || TIMEOUT;
  try {
    var signal = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout)
      ? AbortSignal.timeout(timeout) : null;
    var merged = { ...(options || {}) };
    if (signal) merged.signal = signal;
    return await fetch(url, merged);
  } catch (e) {
    if (e.name === 'AbortError' || e.name === 'TimeoutError')
      console.log("[" + PROVIDER_NAME + "] Timeout: " + url.substring(0, 80));
    return null;
  }
}

async function fetchFromServer(server, tmdbId, mediaType, season, episode, sessionUA) {
  var typePath = (mediaType === 'tv' || mediaType === 'series') ? 'tv' : 'movie';
  var url = server.base + "/" + server.path + "/" + typePath + "/" + tmdbId;
  if ((mediaType === 'tv' || mediaType === 'series') && season != null && episode != null)
    url += "/" + season + "/" + episode;

  console.log("[" + PROVIDER_NAME + "] " + server.label + ": " + url.substring(0, 100));

  var headers = getRequestHeaders(sessionUA);
  var res = await fetchWithTimeout(url, { headers: headers }, TIMEOUT);
  if (!res || !res.ok) {
    console.log("[" + PROVIDER_NAME + "] " + server.label + " -> " + (res ? res.status : "no response"));
    return null;
  }

  var json = await res.json();
  if (!json || !json.isEncrypted || !json.data) {
    console.log("[" + PROVIDER_NAME + "] " + server.label + " unexpected format");
    return null;
  }

  var decrypted = aesGcmDecrypt(json.data);
  if (!decrypted) {
    console.log("[" + PROVIDER_NAME + "] " + server.label + " decrypt fail");
    return null;
  }

  var count = decrypted.sources ? decrypted.sources.length : 0;
  console.log("[" + PROVIDER_NAME + "] " + server.label + " OK (" + count + " sources)");
  return decrypted;
}

function normalizeQuality(q) {
  var t = String(q || '').toLowerCase();
  var m = t.match(/(2160|1080|720|480)\s*p/i);
  return m ? m[1] + 'p' : (t.indexOf('4k') >= 0 ? '2160p' : 'HD');
}

function buildStreams(data, serverLabel, mediaTitle, season, episode, sessionUA) {
  var streams = [];
  var seen = {};
  if (!data || !data.sources) return streams;

  var isTv = season != null && episode != null;
  var epLabel = isTv ? ' S' + season + 'E' + episode : '';
  var prefix = mediaTitle ? mediaTitle + epLabel + ' - Peachify' : 'Peachify';

  for (var i = 0; i < data.sources.length; i++) {
    var src = data.sources[i];
    var url = src.url || src.src || src.file || src.stream || src.streamUrl || '';
    var dub = src.dub || src.audio || src.language || src.name || 'Original';
    var dedupKey = url + '|' + dub;
    if (!url || seen[dedupKey]) continue;
    seen[dedupKey] = true;

    var quality = normalizeQuality(src.quality || src.resolution || '');
    var label = prefix + ' | ' + serverLabel + ' | ' + quality + ' | ' + dub;

    var finalHeaders = {
      "origin": "https://peachify.top",
      "referer": "https://peachify.top/",
      "user-agent": sessionUA,
      "accept": "*/*"
    };
    
    if (src.headers) {
        for (var k in src.headers) {
            finalHeaders[k.toLowerCase()] = src.headers[k];
        }
    }

    var isHls = (src.type === 'hls') || (url.indexOf('m3u8') !== -1);
    var streamObj = {
      name: label,
      title: label,
      url: url,
      quality: quality,
      behaviorHints: {
        notWebReady: true
      }
    };

    if (isHls) {
      streamObj.headers = finalHeaders; // Bypasses Nuvio proxy to keep Referer on HTTP 302 redirects
    } else {
      streamObj.behaviorHints.proxyHeaders = { request: finalHeaders }; // Routes MP4 through Nuvio proxy to prevent Cloudflare 405 HEAD errors
    }

    streams.push(streamObj);
  }

  return streams;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    var sessionUA = MOBILE_UAS[Math.floor(Math.random() * MOBILE_UAS.length)];
    console.log("[" + PROVIDER_NAME + "] ID=" + tmdbId + " T=" + mediaType + " S=" + season + " E=" + episode);

    var idStr = String(tmdbId || '').trim();
    if (idStr.indexOf('tt') === 0) {
      console.log("[" + PROVIDER_NAME + "] Resolving IMDb ID...");
      var tmdbRes = await fetchWithTimeout(
        "https://api.themoviedb.org/3/find/" + idStr + "?api_key=" + TMDB_KEY + "&external_source=imdb_id",
        { headers: { "User-Agent": sessionUA } }, 10000
      );
      if (tmdbRes && tmdbRes.ok) {
        var tmdbData = await tmdbRes.json();
        var results = (mediaType === 'tv' || mediaType === 'series') ? tmdbData.tv_results : tmdbData.movie_results;
        if (results && results.length > 0) {
          idStr = String(results[0].id);
          console.log("[" + PROVIDER_NAME + "] Resolved to TMDB: " + idStr);
        }
      }
    }

    // Pass the sessionUA properly down the chain instead of relying on global UA
    var titlePromise = (async () => {
      var type = (mediaType === 'tv' || mediaType === 'series') ? 'tv' : 'movie';
      try {
        var res = await fetchWithTimeout(
          "https://api.themoviedb.org/3/" + type + "/" + idStr + "?api_key=" + TMDB_KEY,
          { headers: { "User-Agent": sessionUA } },
          8000
        );
        if (res && res.ok) {
          var data = await res.json();
          return data.title || data.name || null;
        }
      } catch(e) {}
      return null;
    })();

    var serverTasks = SERVERS.map(async function(s) {
        var data = await fetchFromServer(s, idStr, mediaType, season, episode, sessionUA);
        return { data: data, label: s.label };
    });

    var title = await titlePromise;
    var serverResults = await Promise.all(serverTasks);

    var allStreams = [];
    for (var r = 0; r < serverResults.length; r++) {
        var sr = serverResults[r];
        if (sr.data) {
            var ss = buildStreams(sr.data, sr.label, title, season, episode, sessionUA);
            for (var i = 0; i < ss.length; i++)
                allStreams.push(ss[i]);
        }
    }

    var qOrder = { '2160p': 0, '1080p': 1, '720p': 2, '480p': 3, 'HD': 4 };
    allStreams.sort(function(a, b) {
        var qa = qOrder[a.quality] !== undefined ? qOrder[a.quality] : 99;
        var qb = qOrder[b.quality] !== undefined ? qOrder[b.quality] : 99;
        return qa - qb;
    });

    console.log("[" + PROVIDER_NAME + "] Total: " + allStreams.length + " streams");
    return allStreams;

  } catch (e) {
    console.error("[" + PROVIDER_NAME + "] Fatal: " + (e.message || e));
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
