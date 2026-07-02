"use strict";

// ─── Constants ──────────────────────────────────────────────────────
var SOURCE_NAME = "VidCore";
var VIDCORE_BASE = "https://vidcore.net";
var TAG = "VidCore";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
var ENC_DEC_API = "https://enc-dec.app/api";

// ─── HTTP Helpers (Pure Promises for Hermes) ────────────────────────
function httpGet(url, customHeaders) {
    var headers = customHeaders || {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    };
    // Uses standard fetch which is fully injected in Nuvio
    return fetch(url, { method: "GET", headers: headers })
        .then(function (res) {
            if (!res.ok) throw new Error("HTTP status " + res.status);
            return res.text();
        });
}

// ─── Data Extraction & URL Helpers ─────────────────────────────────
function safeJsonParse(str) {
    if (!str || typeof str !== "string") return null;
    try { return JSON.parse(str); } catch (_) { return null; }
}

function qualityLabel(h) {
    if (h >= 2160) return "2160p";
    if (h >= 1440) return "1440p";
    if (h >= 1080) return "1080p";
    if (h >= 720) return "720p";
    if (h >= 480) return "480p";
    return h ? h + "p" : "1080p"; // default fallback
}

function resolveRelativeUrl(baseUrl, relativePath) {
    if (!baseUrl) return relativePath;
    if (relativePath.indexOf("//") === 0) return "https:" + relativePath;
    if (relativePath.indexOf("/") === 0) {
        var om = baseUrl.match(/^(https?:\/\/[^/]+)/);
        return (om ? om[1] : "") + relativePath;
    }
    var idx = baseUrl.lastIndexOf("/");
    if (idx <= 8) return baseUrl + "/" + relativePath;
    return baseUrl.substring(0, idx + 1) + relativePath;
}

function isValidStreamUrl(url) {
    if (!url || typeof url !== "string") return false;
    return url.indexOf("https://") === 0 || url.indexOf("http://") === 0;
}

// ─── M3U8 Master Parser ───────────────────────────────────────────
function parseM3U8Master(playlistUrl, referer) {
    var headers = { "User-Agent": UA, "Accept": "*/*", "Referer": referer || VIDCORE_BASE + "/" };
    
    return httpGet(playlistUrl, headers)
        .then(function (content) {
            if (!content || content.indexOf("#EXTM3U") === -1 || content.indexOf("#EXT-X-STREAM-INF:") === -1) {
                return [{ url: playlistUrl, quality: "1080p" }];
            }

            var lines = content.split("\n");
            var variants = [];

            for (var li = 0; li < lines.length; li++) {
                var line = lines[li];
                if (line.indexOf("#EXT-X-STREAM-INF:") !== -1) {
                    var resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
                    var height = resMatch ? parseInt(resMatch[1], 10) : 0;

                    for (var ni = li + 1; ni < lines.length; ni++) {
                        var urlPart = lines[ni].trim();
                        if (urlPart && urlPart.indexOf("#") !== 0) {
                            variants.push({
                                url: urlPart.indexOf("http") === 0 ? urlPart : resolveRelativeUrl(playlistUrl, urlPart),
                                quality: qualityLabel(height)
                            });
                            break;
                        }
                    }
                }
            }
            return variants.length ? variants : [{ url: playlistUrl, quality: "1080p" }];
        })
        .catch(function () {
            return [{ url: playlistUrl, quality: "1080p" }];
        });
}

// ─── Parsing Fallbacks & RSC Scripts ──────────────────────────────
function extractM3U8FromScripts(html) {
    if (!html) return [];
    var results = [];
    var seen = {};
    
    var directRegex = /https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4)[^"'\s<>]*/gi;
    var match;
    while ((match = directRegex.exec(html)) !== null) {
        var u = match[0].trim();
        if (!seen[u]) { seen[u] = true; results.push(u); }
    }
    return results;
}

// ─── Core Nuvio Hook Entrypoint ────────────────────────────────────
function getStreams(tmdbId, mediaType, season, episode) {
    var type = (mediaType === "tv" || mediaType === "series") ? "tv" : "movie";
    var s = season || 1;
    var ep = episode || 1;
    
    var streamsOutput = [];

    // Route 1: Try endpoint API Probing
    var apiUrl = type === "tv" 
        ? VIDCORE_BASE + "/api/tv/" + tmdbId + "/" + s + "/" + ep
        : VIDCORE_BASE + "/api/movie/" + tmdbId;

    return httpGet(apiUrl)
        .then(function (resp) {
            var data = safeJsonParse(resp);
            if (data && data.url) return data.url;
            throw new Error("No direct API stream tracking URL");
        })
        .catch(function () {
            // Route 2 Fallback: Scrape the HTML Embed Page directly
            var embedUrl = type === "tv"
                ? VIDCORE_BASE + "/tv/" + tmdbId + "/" + s + "/" + ep
                : VIDCORE_BASE + "/movie/" + tmdbId;
            return httpGet(embedUrl).then(function (html) {
                var found = extractM3U8FromScripts(html);
                if (found.length > 0) return found[0];
                
                // Route 3 Fallback: Try proxy resolver endpoint
                var proxyUrl = type === "tv"
                    ? ENC_DEC_API + "/vidcore/tv/" + tmdbId + "/" + s + "/" + ep
                    : ENC_DEC_API + "/vidcore/movie/" + tmdbId;
                return httpGet(proxyUrl).then(function (pResp) {
                    var pData = safeJsonParse(pResp);
                    if (pData && pData.url) return pData.url;
                    throw new Error("All scrapers exhausted");
                });
            });
        })
        .then(function (finalStreamUrl) {
            if (!isValidStreamUrl(finalStreamUrl)) return [];
            
            // Expand master manifests into individual stream tracks for Nuvio
            return parseM3U8Master(finalStreamUrl, VIDCORE_BASE + "/");
        })
        .then(function (variants) {
            return variants.map(function (v) {
                return {
                    name: SOURCE_NAME,
                    title: "VidCore Server (" + v.quality + ")",
                    url: v.url,
                    quality: v.quality
                };
            });
        })
        .catch(function (err) {
            console.error("[" + TAG + "] Error parsing targets: ", err.message);
            return []; // Always fallback cleanly to an empty stream array
        });
}

// Export the precise function Nuvio checks for out of the box
module.exports = { getStreams: getStreams };
