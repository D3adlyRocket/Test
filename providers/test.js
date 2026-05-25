var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE = "https://entrepeliculasyseries.nz";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
var CryptoJS = require("crypto-js");
var DECRYPT_KEY = "558e4d18ca7c0be131e1b406bb47ea79b6ea9444e93bf3315fc62484044c150b";

// ---- Util ----
function fetchText(url, ref) {
    return new Promise(function (resolve) {
        var headers = { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" };
        if (ref) headers["Referer"] = ref;
        fetch(url, { headers: headers }).then(function (r) {
            r.text().then(function (t) { resolve(t); }).catch(function () { resolve(null); });
        }).catch(function () { resolve(null); });
    });
}

function b64decode(str) {
    try { return atob(str); } catch(e) { return null; }
}

function unpackEval(packed, radix, symtab) {
    var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var unbase = function (s) {
        var r = 0;
        for (var i = 0; i < s.length; i++) { var p = chars.indexOf(s[i]); if (p === -1) return NaN; r = r * radix + p; }
        return r;
    };
    return packed.replace(/\b([0-9a-zA-Z]+)\b/g, function (match) {
        var idx = unbase(match);
        return (isNaN(idx) || idx >= symtab.length) ? match : (symtab[idx] || match);
    });
}

function voeDecode(ct, lutsRaw) {
    try {
        var rawLuts = lutsRaw.replace(/^\[|\]$/g, "").split("','").map(function (s) { return s.replace(/^'+|'+$/g, ""); });
        var escapedLuts = rawLuts.map(function (i) { return i.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
        var txt = "";
        for (var i = 0; i < ct.length; i++) {
            var x = ct.charCodeAt(i);
            if (x > 64 && x < 91) x = (x - 52) % 26 + 65;
            else if (x > 96 && x < 123) x = (x - 84) % 26 + 97;
            txt += String.fromCharCode(x);
        }
        for (var j = 0; j < escapedLuts.length; j++) txt = txt.replace(new RegExp(escapedLuts[j], "g"), "_");
        txt = txt.split("_").join("");
        var d1 = b64decode(txt);
        if (!d1) return null;
        var s4 = "";
        for (var k = 0; k < d1.length; k++) s4 += String.fromCharCode((d1.charCodeAt(k) - 3 + 256) % 256);
        var rev = s4.split("").reverse().join("");
        var fin = b64decode(rev);
        return fin ? JSON.parse(fin) : null;
    } catch(e) { return null; }
}

// ---- AES Decrypt ----
function aesDecrypt(encryptedBase64) {
    try {
        var raw = CryptoJS.enc.Base64.parse(encryptedBase64);
        var iv = CryptoJS.lib.WordArray.create(raw.words.slice(0, 4), 16);
        var ciphertext = CryptoJS.lib.WordArray.create(raw.words.slice(4), raw.sigBytes - 16);
        var key = CryptoJS.enc.Hex.parse(DECRYPT_KEY);
        var dec = CryptoJS.AES.decrypt({ ciphertext: ciphertext }, key, { iv: iv, mode: CryptoJS.mode.CBC });
        return dec.toString(CryptoJS.enc.Utf8);
    } catch(e) { return null; }
}

// ---- Resolver: VOE ----
function resolveVoe(embedUrl) {
    return new Promise(function (resolve) {
        fetchText(embedUrl, embedUrl).then(function (data) {
            if (!data) return resolve(null);
            var rMain = data.match(/json">\s*\[\s*['"]([^'"]+)['"]\s*\]\s*<\/script>\s*<script[^>]*src=['"]([^'"]+)['"]/i);
            if (rMain) {
                var encArr = rMain[1];
                var loaderUrl = rMain[2].startsWith("http") ? rMain[2] : new URL(rMain[2], embedUrl).href;
                fetchText(loaderUrl, embedUrl).then(function (jsData) {
                    if (!jsData) return resolve(null);
                    var replMatch = jsData.match(/(\[(?:'[^']{1,10}'[\s,]*){4,12}\])/i) || jsData.match(/(\[(?:"[^"]{1,10}"[,\s]*){4,12}\])/i);
                    if (replMatch) {
                        var decoded = voeDecode(encArr, replMatch[1]);
                        if (decoded && (decoded.source || decoded.direct_access_url)) {
                            var url = decoded.source || decoded.direct_access_url;
                            return resolve({ url: url, quality: "1080p", headers: { "User-Agent": UA, Referer: embedUrl } });
                        }
                    }
                    resolve(null);
                }).catch(function () { resolve(null); });
            } else {
                var re1 = /hls['"]\s*:\s*['"]([^'"]+)['"]/i;
                var m = data.match(re1);
                if (m) return resolve({ url: m[1], quality: "720p", headers: { "User-Agent": UA, Referer: embedUrl } });
                resolve(null);
            }
        }).catch(function () { resolve(null); });
    });
}

// ---- Resolver: StreamWish ----
function resolveStreamwish(embedUrl) {
    return new Promise(function (resolve) {
        fetchText(embedUrl, "https://entrepeliculasyseries.nz/").then(function (data) {
            if (!data) return resolve(null);
            var embedHost = embedUrl.match(/^(https?:\/\/[^/]+)/);
            embedHost = embedHost ? embedHost[1] : "https://streamwish.com";
            var fileMatch = data.match(/file\s*:\s*["']([^"']+)["']/i);
            if (fileMatch) {
                var u = fileMatch[1];
                if (u.startsWith("/")) u = embedHost + u;
                return resolve({ url: u, quality: "720p", headers: { "User-Agent": UA, Referer: embedHost + "/" } });
            }
            var packMatch = data.match(/eval\(function\(p,a,c,k,e,[a-z]\)\{[^}]+\}\s*\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)/);
            if (packMatch) {
                var unpacked = unpackEval(packMatch[1], parseInt(packMatch[2]), packMatch[4].split("|"));
                var objMatch = unpacked.match(/\{[^{}]*"hls[234]"\s*:\s*"([^"]+)"[^{}]*\}/);
                if (objMatch) {
                    try {
                        var norm = objMatch[0].replace(/(\w+)\s*:/g, '"$1":');
                        var obj = JSON.parse(norm);
                        var u2 = obj.hls4 || obj.hls3 || obj.hls2;
                        if (u2) {
                            if (u2.startsWith("/")) u2 = embedHost + u2;
                            return resolve({ url: u2, quality: "720p", headers: { "User-Agent": UA, Referer: embedHost + "/" } });
                        }
                    } catch(e) {}
                }
                var m3u = unpacked.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
                if (m3u) return resolve({ url: m3u[0], quality: "720p", headers: { "User-Agent": UA, Referer: embedHost + "/" } });
            }
            var rawM3u = data.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
            if (rawM3u) return resolve({ url: rawM3u[0], quality: "720p", headers: { "User-Agent": UA, Referer: embedHost + "/" } });
            resolve(null);
        }).catch(function () { resolve(null); });
    });
}

// ---- Resolver: VidHide/minochinos ----
function resolveVidhide(embedUrl) {
    return new Promise(function (resolve) {
        fetchText(embedUrl, "https://entrepeliculasyseries.nz/").then(function (data) {
            if (!data) return resolve(null);
            var evalMatch = data.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
            if (!evalMatch) {
                var directM3u = data.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
                if (directM3u) return resolve({ url: directM3u[0], quality: "720p", headers: { Referer: embedUrl } });
                resolve(null);
                return;
            }
            var unpacked = unpackEval(evalMatch[1], 36, evalMatch[4].split("|"));
            var hlsMatch = unpacked.match(/"hls4"\s*:\s*"([^"]+)"/) || unpacked.match(/"hls2"\s*:\s*"([^"]+)"/) || unpacked.match(/"hls"\s*:\s*"([^"]+)"/);
            if (!hlsMatch) return resolve(null);
            var m3u8Url = hlsMatch[1];
            if (!m3u8Url.startsWith("http")) m3u8Url = new URL(embedUrl).origin + m3u8Url;
            resolve({ url: m3u8Url, quality: "720p", headers: { "User-Agent": UA, Referer: new URL(embedUrl).origin + "/" } });
        }).catch(function () { resolve(null); });
    });
}

// ---- Resolver: Filemoon ----
function resolveFilemoon(embedUrl) {
    return new Promise(function (resolve) {
        fetchText(embedUrl, "https://entrepeliculasyseries.nz/").then(function (data) {
            if (!data) return resolve(null);
            var evalMatch = data.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?\.split\('\|'\)[^\)]*\)\)/);
            if (evalMatch) {
                var unpacked = unpackEval(evalMatch[1], 36, (evalMatch[4] || "").split("|"));
                var m3u = unpacked.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
                if (m3u) return resolve({ url: m3u[0], quality: "1080p", headers: { "User-Agent": UA, Referer: embedUrl } });
            }
            var m3u8Match = data.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
            if (m3u8Match) return resolve({ url: m3u8Match[0], quality: "720p", headers: { "User-Agent": UA, Referer: embedUrl } });
            resolve(null);
        }).catch(function () { resolve(null); });
    });
}

// ---- Dispatch resolver ----
function resolveServer(embedUrl, serverName) {
    var u = embedUrl.toLowerCase();
    if (u.indexOf("voe") !== -1) return resolveVoe(embedUrl);
    if (u.indexOf("streamwish") !== -1 || u.indexOf("hlswish") !== -1 || u.indexOf("flaswish") !== -1 || u.indexOf("sfastwish") !== -1 || u.indexOf("hglink") !== -1) return resolveStreamwish(embedUrl);
    if (u.indexOf("filemoon") !== -1) return resolveFilemoon(embedUrl);
    if (u.indexOf("vidhide") !== -1 || u.indexOf("minochinos") !== -1) return resolveVidhide(embedUrl);
    if (u.indexOf("goodstream") !== -1) return resolveStreamwish(embedUrl);
    return new Promise(function (r) { r(null); });
}

// ---- TMDB IMDb lookup ----
function getImdbId(tmdbId, mediaType) {
    return new Promise(function (resolve) {
        var type = mediaType === "movie" ? "movie" : "tv";
        var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "/external_ids?api_key=" + TMDB_API_KEY;
        fetch(url, { headers: { "User-Agent": UA } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { resolve(d && d.imdb_id ? d.imdb_id : null); })
            .catch(function () { resolve(null); });
    });
}

// ---- Main ----
var SERVER_LABELS = {
    "voe": "VOE", "streamwish": "StreamWish", "filemoon": "Filemoon",
    "vidhide": "VidHide", "doodstream": "DoodStream", "rapidvideo": "RapidVideo"
};

function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise(function (resolve) {
        try {
            var cleanId = String(tmdbId).trim();
            if (cleanId.includes("|")) cleanId = cleanId.split("|")[0];
            cleanId = cleanId.replace(/^tmdb:/, "").replace(/^series:/, "").replace(/^movie:/, "").split(":")[0].split("/")[0];
            if (!cleanId || cleanId === "null" || cleanId === "undefined") return resolve([]);

            getImdbId(cleanId, mediaType).then(function (imdbId) {
                if (!imdbId) return resolve([]);
                fetchText(BASE + "/vidurl/" + imdbId + "/").then(function (html) {
                    if (!html) return resolve([]);
                    var match = html.match(/let\s+dataLink\s*=\s*(\[[\s\S]*?\])\s*;/);
                    if (!match) return resolve([]);
                    var dataLink;
                    try { dataLink = JSON.parse(match[1]); } catch(e) { return resolve([]); }
                    if (!dataLink || dataLink.length === 0) return resolve([]);

                    var embeds = [];
                    for (var i = 0; i < dataLink.length && embeds.length < 10; i++) {
                        var se = dataLink[i].sortedEmbeds || [];
                        for (var j = 0; j < se.length && embeds.length < 10; j++) {
                            var decrypted = aesDecrypt(se[j].link);
                            if (decrypted && decrypted.indexOf("http") === 0) {
                                embeds.push({ name: se[j].servername, url: decrypted });
                            }
                        }
                    }

                    if (embeds.length === 0) return resolve([]);

                    var results = [];
                    var resolveNext = function (idx) {
                        if (idx >= embeds.length) return resolve(results);
                        resolveServer(embeds[idx].url, embeds[idx].name).then(function (resolved) {
                            if (resolved && resolved.url) {
                                var label = SERVER_LABELS[embeds[idx].name] ||
                                    embeds[idx].name.charAt(0).toUpperCase() + embeds[idx].name.slice(1);
                                var stream = {
                                    name: "EPS - " + label,
                                    url: resolved.url,
                                    quality: resolved.quality || "HD",
                                    language: "Latino"
                                };
                                if (resolved.headers) stream.headers = resolved.headers;
                                if (typeof __yield_result === "function") __yield_result(JSON.stringify(stream));
                                results.push(stream);
                            }
                            resolveNext(idx + 1);
                        }).catch(function () { resolveNext(idx + 1); });
                    };
                    resolveNext(0);
                }).catch(function () { resolve([]); });
            }).catch(function () { resolve([]); });
        } catch (e) {
            resolve([]);
        }
    });
}

module.exports = { getStreams };
