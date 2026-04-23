"use strict";

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var DATA_URL = "https://api.streamflix.app/data.json";
var CONFIG_URL = "https://api.streamflix.app/config/config-streamflixapp.json";

// Working headers for TV/Mobile stability (taken from your working Castle code)
var TV_HEADERS = {
    'User-Agent': 'okhttp/4.9.3',
    'Accept': 'application/json',
    'Connection': 'Keep-Alive'
};

function makeRequest(url) {
    return fetch(url, {
        method: 'GET',
        headers: TV_HEADERS
    }).then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
    });
}

// Manual Query Builder for TVs that don't support URLSearchParams
function buildTmdbUrl(id, type) {
    var endpoint = (type === 'tv' || type === 'series') ? 'tv' : 'movie';
    return "https://api.themoviedb.org/3/" + endpoint + "/" + id + "?api_key=" + TMDB_API_KEY;
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    console.log("[StreamFlix] Starting extraction for: " + tmdbId);

    return new Promise(function(resolve, reject) {
        makeRequest(buildTmdbUrl(tmdbId, mediaType))
            .then(function(tmdbData) {
                var isTV = (mediaType === 'tv' || mediaType === 'series');
                var searchTitle = (isTV ? tmdbData.name : tmdbData.title).toLowerCase().trim();

                return makeRequest(CONFIG_URL).then(function(config) {
                    return makeRequest(DATA_URL).then(function(remote) {
                        if (!remote || !remote.data) return resolve([]);
                        
                        var match = null;
                        var list = remote.data;
                        
                        // Basic loop for maximum compatibility
                        for (var i = 0; i < list.length; i++) {
                            if (list[i].moviename) {
                                var entryName = list[i].moviename.toLowerCase();
                                if (entryName === searchTitle || entryName.indexOf(searchTitle) !== -1) {
                                    match = list[i];
                                    break;
                                }
                            }
                        }

                        if (!match) return resolve([]);
                        var streams = [];
                        var hosts = (config && config.premium) ? config.premium : ["https://stream.streamflix.app/"];

                        // MOVIE LOGIC
                        if (!isTV && match.movielink) {
                            for (var j = 0; j < hosts.length; j++) {
                                streams.push({
                                    name: "StreamFlix | 1080p",
                                    title: match.moviename,
                                    url: hosts[j] + match.movielink,
                                    quality: "1080p"
                                });
                            }
                            return resolve(streams);
                        }

                        // TV LOGIC (JSON Endpoint Strategy)
                        if (isTV && seasonNum && episodeNum) {
                            var fbUrl = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + 
                                        match.moviekey + "/seasons/" + seasonNum + "/episodes.json";
                            
                            return makeRequest(fbUrl).then(function(episodes) {
                                if (!episodes) return resolve([]);
                                
                                // Direct index check (Manual fallback for Object-based responses)
                                var ep = episodes[episodeNum - 1] || episodes[episodeNum.toString()] || null;

                                if (ep && ep.link) {
                                    for (var k = 0; k < hosts.length; k++) {
                                        streams.push({
                                            name: "StreamFlix | TV",
                                            title: "S" + seasonNum + "E" + episodeNum + " - " + (ep.name || match.moviename),
                                            url: hosts[k] + ep.link,
                                            quality: "1080p"
                                        });
                                    }
                                }
                                resolve(streams);
                            }).catch(function() { resolve([]); });
                        }
                        
                        resolve(streams);
                    });
                });
            })
            .catch(function(err) {
                console.error("[StreamFlix] Error: " + err.message);
                resolve([]);
            });
    });
}

// Export for TV Apps (Nuvio/React Native compatibility)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
