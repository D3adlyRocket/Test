"use strict";

// Constants - Standard strings only (no backticks)
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var STREAMFLIX_API_BASE = "https://api.streamflix.app";
var CONFIG_URL = STREAMFLIX_API_BASE + "/config/config-streamflixapp.json";
var DATA_URL = STREAMFLIX_API_BASE + "/data.json";

var cache = {
    config: null,
    configTimestamp: 0,
    data: null,
    dataTimestamp: 0
};
var CACHE_TTL = 300000; // 5 minutes

// Helper for HTTP requests - Replaced Spread Operator with Object.assign
function makeRequest(url, options) {
    if (!options) options = {};
    var defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    };
    var headers = Object.assign({}, defaultHeaders, options.headers || {});

    return fetch(url, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body
    }).then(function(res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res;
    });
}

function getAppData() {
    var now = Date.now();
    if (cache.data && (now - cache.dataTimestamp < CACHE_TTL)) {
        return Promise.resolve({ config: cache.config, data: cache.data });
    }

    return Promise.all([
        makeRequest(CONFIG_URL).then(function(r) { return r.json(); }),
        makeRequest(DATA_URL).then(function(r) { return r.json(); })
    ]).then(function(results) {
        cache.config = results[0];
        cache.data = results[1];
        cache.dataTimestamp = now;
        return { config: cache.config, data: cache.data };
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
    var isTV = (mediaType === 'tv' || mediaType === 'series');
    var tmdbUrl = "https://api.themoviedb.org/3/" + (isTV ? "tv" : "movie") + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;

    return makeRequest(tmdbUrl)
        .then(function(res) { return res.json(); })
        .then(function(tmdbData) {
            var searchTitle = (isTV ? tmdbData.name : tmdbData.title).toLowerCase();
            
            return getAppData().then(function(app) {
                // Find matching entry in data.json
                var entry = null;
                var list = app.data.data || [];
                for (var i = 0; i < list.length; i++) {
                    if (list[i].moviename && list[i].moviename.toLowerCase().indexOf(searchTitle) !== -1) {
                        entry = list[i];
                        break;
                    }
                }

                if (!entry) return [];

                var streams = [];
                var bases = [].concat(app.config.premium || [], app.config.movies || []);

                if (!isTV) {
                    // Movie Logic
                    bases.forEach(function(base) {
                        if (entry.movielink) {
                            streams.push({
                                name: "StreamFlix",
                                title: "Direct | " + entry.moviename,
                                url: base + entry.movielink,
                                quality: "1080p"
                            });
                        }
                    });
                    return streams;
                } else {
                    // TV Logic - Direct Firebase Fetch (More stable for TV than WebSockets)
                    var fbUrl = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + entry.moviekey + "/seasons/" + season + "/episodes.json";
                    
                    return fetch(fbUrl).then(function(r) { return r.json(); }).then(function(epData) {
                        var ep = epData ? (epData[episode - 1] || epData[episode.toString()]) : null;
                        if (ep && ep.link) {
                            bases.forEach(function(base) {
                                streams.push({
                                    name: "StreamFlix",
                                    title: "Direct | S" + season + "E" + episode,
                                    url: base + ep.link,
                                    quality: "1080p"
                                });
                            });
                        }
                        return streams;
                    });
                }
            });
        })
        .catch(function(err) {
            console.error("StreamFlix Error: " + err.message);
            return [];
        });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
