var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var CryptoJS = typeof CryptoJS !== "undefined" ? CryptoJS : null;

function fetchText(url) {
  return new Promise(function (resolve) {
    fetch(url, { headers: { "User-Agent": UA }, skipSizeCheck: true }).then(function (r) { return r.ok ? r.text() : null; }).catch(function () { resolve(null); });
  });
}

function safeAtob(input) {
  if (!input) return "";
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var str = String(input).replace(/=+$/, "").replace(/[\s\n\r\t]/g, "");
  var output = "";
  if (str.length % 4 === 1) return "";
  for (var bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

function extractDataLink(html) {
  if (!html) return null;
  var start = html.indexOf("let dataLink = ");
  if (start === -1) start = html.indexOf("dataLink = ");
  if (start === -1) return null;
  start = html.indexOf("[", start);
  if (start === -1) return null;
  var depth = 1, i = start + 1;
  while (i < html.length && depth > 0) {
    if (html[i] === "[") depth++;
    else if (html[i] === "]") depth--;
    i++;
  }
  if (depth !== 0) return null;
  try { return JSON.parse(html.substring(start, i)); } catch(e) { return null; }
}

function extractPOWConstants(html) {
  var challenge = null, difficulty = null, salt = null;
  var m = html.match(/const\s+POW_CHALLENGE\s*=\s*['"]([^'"]+)['"]/);
  if (m) challenge = m[1];
  m = html.match(/const\s+POW_DIFFICULTY\s*=\s*(\d+)/);
  if (m) difficulty = parseInt(m[1]);
  m = html.match(/const\s+POW_SALT\s*=\s*['"]([^'"]+)['"]/);
  if (m) salt = m[1];
  return challenge && difficulty && salt ? { challenge: challenge, difficulty: difficulty, salt: salt } : null;
}

function solvePoW(challenge, difficulty, salt) {
  if (!CryptoJS) return null;
  var prefix = "";
  for (var p = 0; p < difficulty; p++) prefix += "0";
  var nonce = 0;
  while (nonce < 100000) {
    var hash = CryptoJS.SHA256(challenge + nonce).toString(CryptoJS.enc.Hex);
    if (hash.indexOf(prefix) === 0) {
      return CryptoJS.SHA256(challenge + nonce + salt);
    }
    nonce++;
  }
  return null;
}

function decryptLink(link, aesKey) {
  if (!CryptoJS || !link || !aesKey) return null;
  try {
    var raw = CryptoJS.enc.Base64.parse(link);
    var iv = CryptoJS.lib.WordArray.create(raw.words.slice(0, 4), 16);
    var ct = CryptoJS.lib.WordArray.create(raw.words.slice(4), raw.sigBytes - 16);
    var decrypted = CryptoJS.AES.decrypt({ ciphertext: ct }, aesKey, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch(e) { return null; }
}

function unpack(code) {
  try {
    var m = code.match(/eval\(function\(p,a,c,k,e,[rd]\)\{.*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
    if (!m) return code;
    var p = m[1], a = parseInt(m[2]), c = parseInt(m[3]), kData = m[4].split("|");
    return p.replace(/\b\w+\b/g, function (e) { var idx = parseInt(e, 36), word = kData[idx] || kData[parseInt(e, a)]; return word || e; });
  } catch(e) { return code; }
}

function resolveVoe(url) {
  return new Promise(function (resolve) {
    fetch(url, { headers: { "User-Agent": UA, "Referer": url } }).then(function (r) { return r.ok ? r.text() : null; }).then(function (html) {
      if (!html) { resolve(null); return; }
      if (html.indexOf("permanentToken") !== -1) {
        var rm = html.match(/window\.location\.href\s*=\s*'([^']+)'/i);
        if (rm) { resolve(resolveVoe(rm[1])["catch"](function () { return null; })); return; }
      }
      var jm = html.match(/<script type="application\/json">([\s\S]*?)<\/script>/);
      if (jm) {
        try {
          var parsed = JSON.parse(jm[1].trim());
          var encText = Array.isArray(parsed) ? parsed[0] : parsed;
          if (typeof encText === "string") {
            var decoded = encText.replace(/[a-zA-Z]/g, function (c) { var cd = c.charCodeAt(0), l = cd <= 90 ? 90 : 122, s = cd + 13; return String.fromCharCode(l >= s ? s : s - 26); });
            var noise = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
            for (var n = 0; n < noise.length; n++) decoded = decoded.split(noise[n]).join("");
            var b1 = safeAtob(decoded);
            if (b1) {
              var shifted = "";
              for (var j = 0; j < b1.length; j++) shifted += String.fromCharCode(b1.charCodeAt(j) - 3);
              var b2 = safeAtob(shifted.split("").reverse().join(""));
              if (b2) {
                var data = JSON.parse(b2);
                if (data && data.source) { resolve({ url: data.source, quality: "1080p", headers: { "User-Agent": UA, "Referer": url } }); return; }
              }
            }
          }
        } catch(e) {}
      }
      var m3 = html.match(/["'](https?:\/\/[^"']+?\.m3u8[^"']*?)["']/i);
      if (m3) { resolve({ url: m3[1], quality: "Auto", headers: { "User-Agent": UA, "Referer": url } }); return; }
      resolve(null);
    }).catch(function () { resolve(null); });
  });
}

function resolveStreamwish(url) {
  return new Promise(function (resolve) {
    var domains = ["vibuxer.com", "awish.pro", "dwish.pro", "streamwish.to", "embedwish.com", "strish.com", "wishembed.pro"];
    var idx = 0;
    function tryNext() {
      if (idx >= domains.length) { resolve(null); return; }
      fetch(url.replace(/[^/]+\.(?:com|to|pro|net|org)/, domains[idx]), { headers: { "User-Agent": UA, "Referer": "https://embed69.org/" } }).then(function (r) { return r.ok ? r.text() : null; }).then(function (html) {
        if (!html) { idx++; tryNext(); return; }
        var cs = html;
        if (html.indexOf("eval(function") !== -1) cs += "\n" + unpack(html);
        var m3u8 = cs.match(/(?:file|source|src|hls)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/i) || cs.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
        if (m3u8) { resolve({ url: m3u8[1] || m3u8[0], quality: "Auto", headers: { "User-Agent": UA, "Referer": "https://" + domains[idx] + "/" } }); return; }
        idx++; tryNext();
      }).catch(function () { idx++; tryNext(); });
    }
    tryNext();
  });
}

function resolveFilemoon(url) {
  return new Promise(function (resolve) {
    fetch(url, { headers: { "User-Agent": UA, "Referer": "https://embed69.org/" } }).then(function (r) { return r.ok ? r.text() : null; }).then(function (html) {
      if (!html) { resolve(null); return; }
      var cs = html;
      if (html.indexOf("eval(function") !== -1) cs += "\n" + unpack(html);
      var m3u8 = cs.match(/(?:file|source|src|hls|url)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/i);
      if (m3u8) { resolve({ url: m3u8[1], quality: "Auto", headers: { "User-Agent": UA, "Referer": url } }); return; }
      resolve(null);
    }).catch(function () { resolve(null); });
  });
}

function resolveVidhide(url) {
  return new Promise(function (resolve) {
    fetch(url, { headers: { "User-Agent": UA, "Referer": "https://embed69.org/" } }).then(function (r) { return r.ok ? r.text() : null; }).then(function (html) {
      if (!html) { resolve(null); return; }
      if (html.indexOf("window.location.href") !== -1 && html.length < 2000) {
        var rm = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
        if (rm) { resolve(resolveVidhide(rm[1])["catch"](function () { return null; })); return; }
      }
      var cs = html;
      if (html.indexOf("eval(function") !== -1) cs += "\n" + unpack(html);
      var m3u8 = cs.match(/(?:hls2|file|source|src|hls)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) || cs.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
      if (m3u8) { resolve({ url: m3u8[1] || m3u8[0], quality: "1080p", headers: { "User-Agent": UA, "Referer": new URL(url).origin + "/" } }); return; }
      resolve(null);
    }).catch(function () { resolve(null); });
  });
}

function getImdbId(tmdbId, mediaType) {
  return new Promise(function (resolve) {
    var cleanId = String(tmdbId).replace(/^tmdb:|^series:|^movie:/, "").split(":")[0].split("/")[0];
    if (cleanId.indexOf("tt") === 0) { resolve(cleanId); return; }
    var type = mediaType === "movie" ? "movie" : "tv";
    fetch("https://api.themoviedb.org/3/" + type + "/" + cleanId + "/external_ids?api_key=" + TMDB_API_KEY, { headers: { "User-Agent": UA } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { resolve(d && d.imdb_id ? d.imdb_id : null); }).catch(function () { resolve(null); });
  });
}

var SERVER_LABELS = { "voe": "VOE", "streamwish": "StreamWish", "filemoon": "Filemoon", "vidhide": "VidHide" };

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function (resolve) {
    try {
      var cleanId = String(tmdbId).replace(/^tmdb:|^series:|^movie:/, "").split(":")[0].split("/")[0];
      if (!cleanId || cleanId === "null" || cleanId === "undefined") return resolve([]);

      getImdbId(cleanId, mediaType).then(function (imdbId) {
        if (!imdbId) return resolve([]);

        var urlId;
        if (mediaType === "movie") {
          urlId = imdbId;
        } else {
          var s = season || 1;
          var e = episode || 1;
          urlId = imdbId + "-" + s + "x" + (e < 10 ? "0" + e : e);
        }

        fetchText("https://embed69.org/f/" + urlId).then(function (html) {
          if (!html) return resolve([]);

          var dataLink = extractDataLink(html);
          if (!dataLink || dataLink.length === 0) return resolve([]);

          var pow = extractPOWConstants(html);
          if (!pow) return resolve([]);

          var aesKey = solvePoW(pow.challenge, pow.difficulty, pow.salt);
          if (!aesKey) return resolve([]);

          var lat = null;
          for (var i = 0; i < dataLink.length; i++) {
            var vl = (dataLink[i].video_language || "").toUpperCase();
            if (vl === "LAT" || vl === "LATINO") { lat = dataLink[i]; break; }
          }
          if (!lat) lat = dataLink[0];

          var embeds = lat.sortedEmbeds || [];
          var results = [], pending = 0;

          for (var j = 0; j < embeds.length; j++) {
            (function (embed) {
              if (!embed.link || embed.servername === "download") { pending++; checkDone(); return; }

              var embedUrl = decryptLink(embed.link, aesKey);
              if (!embedUrl) { pending++; checkDone(); return; }

              pending++;
              var sName = embed.servername.toLowerCase();
              var resolver = null;

              if (sName === "voe") resolver = resolveVoe;
              else if (sName === "streamwish") resolver = resolveStreamwish;
              else if (sName === "filemoon") resolver = resolveFilemoon;
              else if (sName === "vidhide") resolver = resolveVidhide;

              if (!resolver) { checkDone(); return; }

              resolver(embedUrl).then(function (resolved) {
                if (resolved && resolved.url) {
                  var label = SERVER_LABELS[sName] || sName.charAt(0).toUpperCase() + sName.slice(1);
                  var stream = { name: label, url: resolved.url, quality: resolved.quality || "HD", language: "Latino" };
                  if (resolved.headers) stream.headers = resolved.headers;
                  if (typeof __yield_result === "function") __yield_result(JSON.stringify(stream));
                  results.push(stream);
                }
                checkDone();
              }).catch(function () { checkDone(); });
            })(embeds[j]);
          }

          function checkDone() {
            pending--;
            if (pending <= 0) resolve(results);
          }
        }).catch(function () { resolve([]); });
      }).catch(function () { resolve([]); });
    } catch (e) { resolve([]); }
  });
}

module.exports = { getStreams };
