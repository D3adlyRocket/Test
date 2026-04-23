/**
 * Movies4u - Restored Original Logic
 * Patched for Android TV Syntax Compatibility
 */

var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;

var __defNormalProp = function(obj, key, value) {
    return key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value: value }) : obj[key] = value;
};

var __spreadValues = function(a, b) {
    for (var prop in b || (b = {}))
        if (__hasOwnProp.call(b, prop))
            __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
        for (var prop of __getOwnPropSymbols(b)) {
            if (__propIsEnum.call(b, prop))
                __defNormalProp(a, prop, b[prop]);
        }
    return a;
};

var __spreadProps = function(a, b) { return __defProps(a, __getOwnPropDescs(b)); };

var __async = function(__this, __arguments, generator) {
    return new Promise(function(resolve, reject) {
        var fulfilled = function(value) {
            try { step(generator.next(value)); } catch (e) { reject(e); }
        };
        var rejected = function(value) {
            try { step(generator.throw(value)); } catch (e) { reject(e); }
        };
        var step = function(x) { return x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected); };
        step((generator = generator.apply(__this, __arguments)).next());
    });
};

// --- Providers Logic ---
var cheerio = require("cheerio-without-node-native");
var TMDB_API_KEY = "1b3113663c9004682ed61086cf967c44";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var MAIN_URL = "https://new1.movies4u.style";
var M4UPLAY_BASE = "https://m4uplay.store";
var HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Referer": MAIN_URL + "/"
};

function fetchWithTimeout(url, options, timeout) {
    var opt = options || {};
    var time = timeout || 1e4;
    return __async(this, null, function* () {
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, time);
        try {
            var response = yield fetch(url, __spreadProps(__spreadValues({}, opt), {
                signal: controller.signal
            }));
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    });
}

function normalizeTitle(title) {
    if (!title) return "";
    return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function calculateTitleSimilarity(title1, title2) {
    var norm1 = normalizeTitle(title1);
    var norm2 = normalizeTitle(title2);
    if (norm1 === norm2) return 1;
    if (norm1.indexOf(norm2) !== -1 || norm2.indexOf(norm1) !== -1) return 0.9;
    var words1 = norm1.split(/\s+/).filter(function(w) { return w.length > 2; });
    var words2 = norm2.split(/\s+/).filter(function(w) { return w.length > 2; });
    if (words1.length === 0 || words2.length === 0) return 0;
    var intersection = words1.filter(function(w) { return words2.indexOf(w) !== -1; });
    return intersection.length / (words1.length + words2.length - intersection.length);
}

function findBestTitleMatch(mediaInfo, searchResults) {
    if (!searchResults || searchResults.length === 0) return null;
    var targetTitle = mediaInfo.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    var targetYear = mediaInfo.year ? parseInt(mediaInfo.year) : null;
    var bestMatch = null;
    var bestScore = 0;
    for (var i = 0; i < searchResults.length; i++) {
        var result = searchResults[i];
        var normalizedResultTitle = result.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        var score = calculateTitleSimilarity(mediaInfo.title, result.title);
        var titleMatch = normalizedResultTitle.indexOf(targetTitle) !== -1 || targetTitle.indexOf(normalizedResultTitle) !== -1;
        var yearMatch = !targetYear || result.title.indexOf(targetYear.toString()) !== -1;
        if (titleMatch && yearMatch) score += 0.5;
        if (score > bestScore) {
            bestScore = score;
            bestMatch = result;
        }
    }
    return (bestMatch && bestScore > 0.4) ? bestMatch : null;
}

function formatStreamTitle(mediaInfo, stream) {
    var quality = stream.quality || "Unknown";
    var title = mediaInfo.title || "Unknown";
    return "Movies4u (Instant) (" + quality + ")\n\u1F4FC: " + title + " - " + quality;
}

function unpack(p, a, c, k) {
    while (c--) {
        if (k[c]) {
            p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
        }
    }
    return p;
}

function extractFromM4UPlay(embedUrl) {
    return __async(this, null, function* () {
        try {
            var response = yield fetchWithTimeout(embedUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": MAIN_URL }) });
            var html = yield response.text();
            var m3u8Match = html.match(/https?:\/\/[^\s"']+\.(?:m3u8|txt)(?:\?[^\s"']*)?/);
            if (m3u8Match) {
                return [{ url: m3u8Match[0], quality: "Auto", isMaster: m3u8Match[0].indexOf("master") !== -1 }];
            }
            return [];
        } catch (e) { return []; }
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
    return __async(this, null, function* () {
        try {
            var type = (mediaType === "movie" || mediaType === "movies") ? "movie" : "tv";
            var tmdbUrl = TMDB_BASE_URL + "/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
            var tmdbRes = yield fetch(tmdbUrl);
            var data = yield tmdbRes.json();
            var mediaInfo = {
                title: data.title || data.name,
                year: (data.release_date || data.first_air_date || "").split("-")[0]
            };

            var searchUrl = MAIN_URL + "/?s=" + encodeURIComponent(mediaInfo.title);
            var searchRes = yield fetchWithTimeout(searchUrl, { headers: HEADERS });
            var searchHtml = yield searchRes.text();
            var $ = cheerio.load(searchHtml);
            var results = [];
            
            $("h3.entry-title a").each(function(i, el) {
                results.push({ title: $(el).text().trim(), url: $(el).attr("href") });
            });

            var bestMatch = findBestTitleMatch(mediaInfo, results);
            if (!bestMatch) return [];

            var pageRes = yield fetchWithTimeout(bestMatch.url, { headers: HEADERS });
            var pageHtml = yield pageRes.text();
            var $page = cheerio.load(pageHtml);
            var streams = [];

            var watchLink = $page("a.btn.btn-zip").first().attr("href");
            if (watchLink) {
                var extraction = yield extractFromM4UPlay(watchLink);
                for (var j = 0; j < extraction.length; j++) {
                    var res = extraction[j];
                    streams.push({
                        name: "Movies4u",
                        title: formatStreamTitle(mediaInfo, res),
                        url: res.url,
                        quality: res.quality,
                        headers: { "Referer": M4UPLAY_BASE + "/", "User-Agent": HEADERS["User-Agent"] }
                    });
                }
            }
            return streams;
        } catch (e) { return []; }
    });
}

module.exports = { getStreams: getStreams };
