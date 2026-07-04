/**
 * vidsrcme - Built from src/vidsrcme/
 * Generated: 2026-07-04T19:44:22.418Z
 */
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

// src/vidsrcme/index.js
var BASEDOM = "https://whisperingauroras.com";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
function safeFetch(url, opts, ms) {
  ms = ms || 8e3;
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
  if (controller)
    o.signal = controller.signal;
  return fetch(url, o).then(function(r) {
    if (tid)
      clearTimeout(tid);
    return r;
  }).catch(function(e) {
    if (tid)
      clearTimeout(tid);
    throw e;
  });
}
function bMGyx71TzQLfdonN(str) {
  var step = 3;
  var chunks = [];
  if (typeof str !== "string")
    return "";
  for (var i = 0; i < str.length; i += step) {
    chunks.push(str.slice(i, i + step));
  }
  return chunks.reverse().join("");
}
function Iry9MQXnLs(str) {
  var key = "pWB9V)[*4I`nJpp?ozyB~dbr9yt!_n4u";
  var decoded = str.match(/.{1,2}/g).map(function(hex) {
    return String.fromCharCode(parseInt(hex, 16));
  }).join("");
  var out = "";
  for (var i = 0; i < decoded.length; i++) {
    out += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  var out2 = "";
  for (var j = 0; j < out.length; j++) {
    out2 += String.fromCharCode(out.charCodeAt(j) - 3);
  }
  try {
    return atob(out2);
  } catch (e) {
    return "";
  }
}
function IGLImMhWrI(str) {
  var reversed = str.split("").reverse().join("");
  var rot = reversed.replace(/[a-zA-Z]/g, function(c) {
    return String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() < "n" ? 13 : -13));
  });
  var finalStr = rot.split("").reverse().join("");
  try {
    return atob(finalStr);
  } catch (e) {
    return "";
  }
}
function GTAxQyTyBx(str) {
  var reversed = str.split("").reverse().join("");
  var out = "";
  for (var i = 0; i < reversed.length; i += 2) {
    out += reversed[i];
  }
  try {
    return atob(out);
  } catch (e) {
    return "";
  }
}
function C66jPHx8qu(str) {
  var reversed = str.split("").reverse().join("");
  var key = "X9a(O;FMV2-7VO5x;Ao :dN1NoFs?j,";
  var decoded = reversed.match(/.{1,2}/g).map(function(hex) {
    return String.fromCharCode(parseInt(hex, 16));
  }).join("");
  var out = "";
  for (var i = 0; i < decoded.length; i++) {
    out += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}
function MyL1IRSfHe(str) {
  var reversed = str.split("").reverse().join("");
  var out = "";
  for (var i = 0; i < reversed.length; i++) {
    out += String.fromCharCode(reversed.charCodeAt(i) - 1);
  }
  var out2 = "";
  for (var j = 0; j < out.length; j += 2) {
    out2 += String.fromCharCode(parseInt(out.substr(j, 2), 16));
  }
  return out2;
}
function detdj7JHiK(str) {
  var sliced = str.slice(10, -16);
  var key = '3SAY~#%Y(V%>5d/Yg"$G[Lh1rK4a;7ok';
  var decoded = "";
  try {
    decoded = atob(sliced);
  } catch (e) {
    return "";
  }
  var keyRep = key.repeat(Math.ceil(decoded.length / key.length)).substring(0, decoded.length);
  var out = "";
  for (var i = 0; i < decoded.length; i++) {
    out += String.fromCharCode(decoded.charCodeAt(i) ^ keyRep.charCodeAt(i));
  }
  return out;
}
function nZlUnj2VSo(str) {
  var rotMap = {
    x: "a", y: "b", z: "c", a: "d", b: "e", c: "f", d: "g", e: "h", f: "i", g: "j",
    h: "k", i: "l", j: "m", k: "n", l: "o", m: "p", n: "q", o: "r", p: "s", q: "t",
    r: "u", s: "v", t: "w", u: "x", v: "y", w: "z", X: "A", Y: "B", Z: "C", A: "D",
    B: "E", C: "F", D: "G", E: "H", F: "I", G: "J", H: "K", I: "L", J: "M", K: "N",
    L: "O", M: "P", N: "Q", O: "R", P: "S", Q: "T", R: "U", S: "V", T: "W", U: "X",
    V: "Y", W: "Z"
  };
  return str.replace(/[xyzabcdefghijklmnopqrstuvwXYZABCDEFGHIJKLMNOPQRSTUVW]/g, function(c) {
    return rotMap[c] || c;
  });
}
function laM1dAi3vO(str) {
  var reversed = str.split("").reverse().join("");
  var base64Safe = reversed.replace(/-/g, "+").replace(/_/g, "/");
  var decoded = "";
  try {
    decoded = atob(base64Safe);
  } catch (e) {
    return "";
  }
  var out = "";
  for (var i = 0; i < decoded.length; i++) {
    out += String.fromCharCode(decoded.charCodeAt(i) - 5);
  }
  return out;
}
function GuxKGDsA2T(str) {
  var reversed = str.split("").reverse().join("");
  var base64Safe = reversed.replace(/-/g, "+").replace(/_/g, "/");
  var decoded = "";
  try {
    decoded = atob(base64Safe);
  } catch (e) {
    return "";
  }
  var out = "";
  for (var i = 0; i < decoded.length; i++) {
    out += String.fromCharCode(decoded.charCodeAt(i) - 7);
  }
  return out;
}
function LXVUMCoAHJ(str) {
  var reversed = str.split("").reverse().join("");
  var base64Safe = reversed.replace(/-/g, "+").replace(/_/g, "/");
  var decoded = "";
  try {
    decoded = atob(base64Safe);
  } catch (e) {
    return "";
  }
  var out = "";
  for (var i = 0; i < decoded.length; i++) {
    out += String.fromCharCode(decoded.charCodeAt(i) - 3);
  }
  return out;
}
function decrypt(param, type) {
  switch (type) {
    case "LXVUMCoAHJ": return LXVUMCoAHJ(param);
    case "GuxKGDsA2T": return GuxKGDsA2T(param);
    case "laM1dAi3vO": return laM1dAi3vO(param);
    case "nZlUnj2VSo": return nZlUnj2VSo(param);
    case "Iry9MQXnLs": return Iry9MQXnLs(param);
    case "IGLImMhWrI": return IGLImMhWrI(param);
    case "GTAxQyTyBx": return GTAxQyTyBx(param);
    case "C66jPHx8qu": return C66jPHx8qu(param);
    case "MyL1IRSfHe": return MyL1IRSfHe(param);
    case "detdj7JHiK": return detdj7JHiK(param);
    case "bMGyx71TzQLfdonN": return bMGyx71TzQLfdonN(param);
    default: return null;
  }
}
function serversLoad(html) {
  var servers = [];
  var titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  var title = titleMatch ? titleMatch[1] : "";
  var iframeMatch = html.match(/<iframe\s+[^>]*src="([^"]*)"/i);
  var base = iframeMatch ? iframeMatch[1] : "";
  if (base) {
    BASEDOM = new URL(base.startsWith("//") ? "https:" + base : base).origin;
  }
  var regex = /class="[^"]*server[^"]*"[^>]*data-hash="([^"]*)"[^>]*>([^<]*)/g;
  var match;
  while ((match = regex.exec(html)) !== null) {
    servers.push({
      name: match[2].trim(),
      dataHash: match[1]
    });
  }
  return { servers, title };
}
function PRORCPhandler(prorcp) {
  return __async(this, null, function* () {
    try {
      var prorcpFetch = yield safeFetch(BASEDOM + "/prorcp/" + prorcp, {
        headers: {
          "Referer": "https://vidsrc.me/",
          "User-Agent": UA
        }
      }, 5e3);
      var prorcpResponse = yield prorcpFetch.text();
      var scripts = prorcpResponse.match(/<script\s+src="\/([^"]*\.js)\?\_=([^"]*)"><\/script>/gm);
      if (!scripts)
        return null;
      var script = scripts[scripts.length - 1].includes("cpt.js") ? scripts[scripts.length - 2].replace(/.*src="\/([^"]*\.js)\?\_=([^"]*)".*/, "$1?_=$2") : scripts[scripts.length - 1].replace(/.*src="\/([^"]*\.js)\?\_=([^"]*)".*/, "$1?_=$2");
      var jsFileReq = yield safeFetch(BASEDOM + "/" + script, {}, 5e3);
      var jsCode = yield jsFileReq.text();
      var decryptRegex = /{}\}window\[([^"]+)\("([^"]+)"\)/;
      var decryptMatches = jsCode.match(decryptRegex);
      if (!decryptMatches || decryptMatches.length < 3)
        return null;
      var fnName = decryptMatches[1].toString().trim();
      var key = decryptMatches[2].toString().trim();
      var id = decrypt(key, fnName);
      if (!id)
        return null;
      var idRegex = new RegExp('id="' + id + '"[^>]*>([^<]*)', "i");
      var idMatch = prorcpResponse.match(idRegex);
      if (!idMatch)
        return null;
      var ciphertext = idMatch[1].trim();
      var result = decrypt(ciphertext, key);
      return result;
    } catch (err) {
      console.log("[VidSrc.me] PRORCPhandler error: " + err.message);
      return null;
    }
  });
}
function rcpGrabber(html) {
  var regex = /src:\s*'([^']*)'/;
  var match = html.match(regex);
  if (!match)
    return null;
  return match[1];
}

function cleanTitleString(rawTitle) {
  if (!rawTitle) return "VidSrc Media";
  return rawTitle.replace(/\s*-\s*VidSrc\.me$/i, "").trim();
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      var isMovie = mediaType === "movie";
      var url = isMovie ? "https://vidsrc.me/embed/" + tmdbId : "https://vidsrc.me/embed/" + tmdbId + "/" + (season || 1) + "-" + (episode || 1);
      console.log("[VidSrc.me] Fetching embed page: " + url);
      var embed = yield safeFetch(url, {}, 8e3);
      var embedResp = yield embed.text();
      var meta = serversLoad(embedResp);
      var servers = meta.servers;
      
      var displayTitle = cleanTitleString(meta.title);
      
      console.log("[VidSrc.me] Parsed servers: " + servers.length);
      var streams = [];
      for (var i = 0; i < servers.length; i++) {
        var element = servers[i];
        try {
          console.log("[VidSrc.me] Fetching RCP for server: " + element.name);
          var rcpRes = yield safeFetch(BASEDOM + "/rcp/" + element.dataHash, {}, 5e3);
          var rcpText = yield rcpRes.text();
          var prorcpPath = rcpGrabber(rcpText);
          if (prorcpPath && prorcpPath.substring(0, 8) === "/prorcp/") {
            console.log("[VidSrc.me] Resolving server prorcp: " + element.name);
            var rawStreamUrl = yield PRORCPhandler(prorcpPath.replace("/prorcp/", ""));
            if (rawStreamUrl) {
              var streamUrl = rawStreamUrl;
              if (streamUrl.includes("__TOKEN__") || streamUrl.includes("__TOKENPG__")) {
                try {
                  var streamUrlObj = new URL(streamUrl.split(" or ")[0]);
                  var tokenHost = streamUrlObj.hostname;
                  console.log("[VidSrc.me] Generating token for host: " + tokenHost);
                  var tokenRes = yield safeFetch("https://" + tokenHost + "/generate.php", {
                    headers: {
                      "Referer": "https://vidsrc.me/",
                      "User-Agent": UA
                    }
                  }, 4e3);
                  var tokenText = yield tokenRes.text();
                  var token = tokenText.trim();
                  if (token && token.length > 10) {
                    streamUrl = streamUrl.replace(/__TOKEN__/g, token).replace(/__TOKENPG__/g, token);
                    console.log("[VidSrc.me] Token successfully generated & injected");
                  }
                } catch (tokenErr) {
                  console.log("[VidSrc.me] Token generation failed: " + tokenErr.message);
                }
              }
              var variants = streamUrl.split(" or ");
              for (var v = 0; v < variants.length; v++) {
                var variantUrl = variants[v].trim();
                if (!variantUrl)
                  continue;
                  
                var quality = "1080p";
                if (variantUrl.includes("/720/") || variantUrl.includes("720p") || variantUrl.includes("/7e39f")) {
                  quality = "720p";
                } else if (variantUrl.includes("/360/") || variantUrl.includes("360p") || variantUrl.includes("/7a67b")) {
                  quality = "360p";
                } else if (variantUrl.includes("/1080/") || variantUrl.includes("1080p")) {
                  quality = "1080p";
                }
                var displayQuality = quality.toUpperCase();

                // Format Server Label
                var rawServerNum = element.name.replace(/\D+/g, "");
                var serverLabel = rawServerNum ? "Server " + rawServerNum : "Server " + (i + 1);
                if (variants.length > 1) {
                  serverLabel += " (Variant " + (v + 1) + ")";
                }

                // Extension Format Profiler
                var fileFormat = "MKV";
                if (variantUrl.includes(".m3u8")) fileFormat = "M3U8";
                else if (variantUrl.includes(".mp4")) fileFormat = "MP4";

                // Layout Presentation Mappings
                var headerText = `VidSrc | ${displayQuality} | Original-Audio`;
                
                var epContext = (!isMovie && season && episode) ? ` S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}` : "";
                var line1 = `📽️ ${displayTitle}${epContext} - (2026)`;
                var line2 = `⭐ ${displayQuality} | 🌍 Original-Audio | 🎧 AAC`;
                var line3 = `🎞️ ${fileFormat} | 🎥 x264 | ⏳ Duration`;
                var line4 = `📁 ${serverLabel}`;

                var layoutContext = `${line1}\n${line2}\n${line3}\n${line4}`;

                streams.push({
                  name: headerText,
                  title: layoutContext,
                  size: layoutContext,
                  description: layoutContext,
                  url: variantUrl,
                  quality: "",     // Block quality layout app injection tricks
                  language: "",    // Prevent trailing engine tag line injection
                  headers: {},
                  subtitles: [],
                  provider: "vidsrcme"
                });
              }
            }
          }
        } catch (err) {
          console.log("[VidSrc.me] Server " + element.name + " error: " + err.message);
        }
      }
      console.log("[VidSrc.me] Scraped streams: " + streams.length);
      return streams;
    } catch (error) {
      console.log("[VidSrc.me] Scraper error: " + error.message);
      return [];
    }
  });
}
module.exports = { getStreams };
