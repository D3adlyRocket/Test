"use strict";

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var SF_BASE = "https://api.streamflix.app";

// We use a simplified helper because many TV boxes crash on 'Object.assign'
function getJson(url) {
    return fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
        }
    }).then(function(res) {
        return res.json();
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
    var isTV = (mediaType === 'tv' || mediaType === 'series');
    var typePath = isTV ? "tv" : "movie";
    var tmdbUrl = "https://api.themoviedb.org/3/" + typePath + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;

    return getJson(tmdbUrl).then(function(tmdb) {
        var query = (isTV ? tmdb.name : tmdb.title).toLowerCase();

        // 1. Get Config
        return getJson(SF_BASE + "/config/config-streamflixapp.json").then(function(config) {
            
            // 2. Get Data
            return getJson(SF_BASE + "/data.json").then(function(db) {
                var entry = null;
                var list = db.data || [];
                
                // Simple loop (most compatible)
                for (var i = 0; i < list.length; i++) {
                    if (list[i].moviename && list[i].moviename.toLowerCase().indexOf(query) !== -1) {
                        entry = list[i];
                        break;
                    }
                }

                if (!entry) return [];

                var streams = [];
                var servers = [].concat(config.premium || [], config.movies || []);

                if (!isTV) {
                    // Movie Logic
                    for (var j = 0; j < servers.length; j++) {
                        if (entry.movielink) {
                            streams.push({
                                name: "StreamFlix",
                                title: "Movie | " + entry.moviename,
                                url: servers[j] + entry.movielink,
                                quality: "1080p"
                            });
                        }
                    }
                    return streams;
                } else {
                    // TV Logic - Using the Firebase .json shortcut which is most TV-friendly
                    var fbUrl = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + entry.moviekey + "/seasons/" + season + "/episodes.json";
                    
                    return getJson(fbUrl).then(function(epData) {
                        // Support both array and object responses from Firebase
                        var ep = epData ? (epData[episode - 1] || epData[episode.toString()]) : null;
                        
                        if (ep && ep.link) {
                            for (var k = 0; k < servers.length; k++) {
                                streams.push({
                                    name: "StreamFlix",
                                    title: "TV | S" + season + "E" + episode,
                                    url: servers[k] + ep.link,
                                    quality: "1080p"
                                });
                            }
                        }
                        return streams;
                    }).catch(function() { return []; });
                }
            });
        });
    }).catch(function(err) {
        console.error("SF Error: " + err.message);
        return [];
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
