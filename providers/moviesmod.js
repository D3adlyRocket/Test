"use strict";

// Configuration matched to Castle's structure
var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var SF_BASE = 'https://api.streamflix.app';
var SF_STREAM_BASE = 'https://stream.streamflix.app/';

// Headers taken directly from the working Castle code
var WORKING_HEADERS = {
    'User-Agent': 'okhttp/4.9.3',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'Keep-Alive'
};

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    // Determine path early
    var isTV = (mediaType === 'tv' || mediaType === 'series');
    var tmdbUrl = "https://api.themoviedb.org/3/" + (isTV ? "tv/" : "movie/") + tmdbId + "?api_key=" + TMDB_KEY;

    return new Promise(function(resolve) {
        // Step 1: TMDB Fetch using okhttp User-Agent
        fetch(tmdbUrl, { headers: WORKING_HEADERS })
            .then(function(response) {
                if (!response.ok) throw new Error('TMDB Fail');
                return response.json();
            })
            .then(function(tmdbData) {
                var searchTitle = (isTV ? tmdbData.name : tmdbData.title).toLowerCase().trim();

                // Step 2: Fetch the StreamFlix JSON Database
                return fetch(SF_BASE + "/data.json", { headers: WORKING_HEADERS })
                    .then(function(response) { return response.json(); })
                    .then(function(sfData) {
                        var list = sfData.data || [];
                        var match = null;

                        // Case-insensitive match
                        for (var i = 0; i < list.length; i++) {
                            if (list[i].moviename && list[i].moviename.toLowerCase() === searchTitle) {
                                match = list[i];
                                break;
                            }
                        }

                        if (!match) return resolve([]);

                        // Step 3: Handle Movie
                        if (!isTV) {
                            if (match.movielink) {
                                resolve([{
                                    name: "StreamFlix | 1080p",
                                    url: SF_STREAM_BASE + match.movielink,
                                    quality: "1080p",
                                    headers: WORKING_HEADERS
                                }]);
                            } else {
                                resolve([]);
                            }
                        } 
                        // Step 4: Handle TV (Firebase logic)
                        else {
                            var fbUrl = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + match.moviekey + "/seasons/" + seasonNum + "/episodes.json";
                            
                            fetch(fbUrl, { headers: WORKING_HEADERS })
                                .then(function(response) { return response.json(); })
                                .then(function(episodes) {
                                    if (!episodes) return resolve([]);
                                    
                                    // Match episode by index or key
                                    var ep = episodes[episodeNum - 1] || episodes[episodeNum.toString()];
                                    
                                    if (ep && ep.link) {
                                        resolve([{
                                            name: "StreamFlix TV | " + (ep.name || "Episode " + episodeNum),
                                            url: SF_STREAM_BASE + ep.link,
                                            quality: "1080p",
                                            headers: WORKING_HEADERS
                                        }]);
                                    } else {
                                        resolve([]);
                                    }
                                })
                                .catch(function() { resolve([]); });
                        }
                    });
            })
            .catch(function(err) {
                // If anything fails, return empty to prevent app hang
                resolve([]);
            });
    });
}

// Export logic matched to Castle
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
