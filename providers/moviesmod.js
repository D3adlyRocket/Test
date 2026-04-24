"use strict";

// Constants - Replaced template literals with standard strings
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var STREAMFLIX_API_BASE = "https://api.streamflix.app";
var CONFIG_URL = STREAMFLIX_API_BASE + "/config/config-streamflixapp.json";
var DATA_URL = STREAMFLIX_API_BASE + "/data.json";

// Global cache
var cache = {
    config: null,
    configTimestamp: 0,
    data: null,
    dataTimestamp: 0,
};
var CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// Helper function for HTTP requests - Replaced Spread Operator with Object.assign
function makeRequest(url, options) {
    if (!options) options = {};
    var defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive'
    };

    var headers = Object.assign({}, defaultHeaders, options.headers || {});

    return fetch(url, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body
    }).then(function(response) {
        if (!response.ok) {
            throw new Error("HTTP " + response.status + ": " + response.statusText);
        }
        return response;
    });
}

function getConfig() {
    var now = Date.now();
    if (cache.config && now - cache.configTimestamp < CACHE_TTL) {
        return Promise.resolve(cache.config);
    }

    return makeRequest(CONFIG_URL)
        .then(function(response) { return response.json(); })
        .then(function(json) {
            cache.config = json;
            cache.configTimestamp = now;
            return json;
        });
}

function getData() {
    var now = Date.now();
    if (cache.data && now - cache.dataTimestamp < CACHE_TTL) {
        return Promise.resolve(cache.data);
    }

    return makeRequest(DATA_URL)
        .then(function(response) { return response.json(); })
        .then(function(json) {
            cache.data = json;
            cache.dataTimestamp = now;
            return json;
        });
}

function calculateSimilarity(str1, str2) {
    var words1 = str1.split(/\s+/);
    var words2 = str2.split(/\s+/);
    var matches = 0;
    for (var i = 0; i < words1.length; i++) {
        var word = words1[i];
        if (word.length > 2 && words2.some(function(w) { return w.indexOf(word) !== -1 || word.indexOf(w) !== -1; })) {
            matches++;
        }
    }
    return matches / Math.max(words1.length, words2.length);
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    var isTV = (mediaType === 'tv' || mediaType === 'series');
    var tmdbUrl = "https://api.themoviedb.org/3/" + (isTV ? "tv" : "movie") + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;

    return makeRequest(tmdbUrl)
        .then(function(response) { return response.json(); })
        .then(function(tmdbData) {
            var title = isTV ? tmdbData.name : tmdbData.title;
            var year = isTV ? (tmdbData.first_air_date ? tmdbData.first_air_date.substring(0, 4) : "") : (tmdbData.release_date ? tmdbData.release_date.substring(0, 4) : "");

            if (!title) throw new Error('No title found');

            return getData().then(function(data) {
                var searchQuery = title.toLowerCase();
                var searchWords = searchQuery.split(/\s+/);
                
                var results = (data.data || []).filter(function(item) {
                    if (!item.moviename) return false;
                    var itemTitle = item.moviename.toLowerCase();
                    return searchWords.every(function(word) { return itemTitle.indexOf(word) !== -1; });
                });

                if (results.length === 0) return [];

                // Best Match Logic
                var bestMatch = null;
                var bestScore = 0;
                for (var i = 0; i < results.length; i++) {
                    var score = calculateSimilarity(searchQuery, results[i].moviename.toLowerCase());
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = results[i];
                    }
                }

                if (!bestMatch) return [];

                return getConfig().then(function(config) {
                    var streams = [];
                    var headers = {
                        'Referer': 'https://api.streamflix.app',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    };

                    if (!isTV) {
                        // Movie Logic
                        var movieBases = [].concat(config.premium || [], config.movies || []);
                        movieBases.forEach(function(base) {
                            if (bestMatch.movielink) {
                                streams.push({
                                    name: "StreamFlix",
                                    title: bestMatch.moviename + " [1080p]",
                                    url: base + bestMatch.movielink,
                                    quality: "1080p",
                                    type: 'direct',
                                    headers: headers
                                });
                            }
                        });
                        return streams;
                    } else {
                        // TV Logic - Using the Firebase path directly for better TV performance
                        var fbUrl = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + bestMatch.moviekey + "/seasons/" + seasonNum + "/episodes.json";
                        
                        return fetch(fbUrl).then(function(r) { return r.json(); }).then(function(episodes) {
                            var ep = episodes ? (episodes[episodeNum - 1] || episodes[episodeNum.toString()]) : null;
                            if (ep && ep.link) {
                                (config.premium || []).forEach(function(base) {
                                    streams.push({
                                        name: "StreamFlix",
                                        title: bestMatch.moviename + " S" + seasonNum + "E" + episodeNum + " - " + (ep.name || ""),
                                        url: base + ep.link,
                                        quality: "1080p",
                                        type: 'direct',
                                        headers: headers
                                    });
                                });
                            }
                            return streams;
                        }).catch(function() { return []; });
                    }
                });
            });
        })
        .catch(function(err) {
            console.error("StreamFlix Error: " + err.message);
            return [];
        });
}

// Universal Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
