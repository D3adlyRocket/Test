"use strict";

var TMDB_API = "https://api.themoviedb.org/3";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var DATA_URL = "https://api.streamflix.app/data.json";
var CONFIG_URL = "https://api.streamflix.app/config/config-streamflixapp.json";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// --- Utility Functions (Borrowed from UHD Style) ---

function fetchJson(url) {
    return fetch(url, { 
        headers: { "User-Agent": USER_AGENT },
        redirect: "follow" 
    }).then(function(res) {
        return res.json();
    });
}

function cleanTitle(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

// --- Main Logic ---

function getStreams(tmdbId, mediaType, season, episode) {
    console.log("[StreamFlix] Start: " + tmdbId + " (" + mediaType + ")");
    
    var isSeries = (mediaType === "series" || mediaType === "tv");
    var tmdbUrl = TMDB_API + "/" + (isSeries ? "tv" : "movie") + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;

    return fetchJson(tmdbUrl).then(function(tmdbData) {
        if (!tmdbData) return [];
        
        var targetTitle = cleanTitle(isSeries ? tmdbData.name : tmdbData.title);
        console.log("[StreamFlix] Target: " + targetTitle);

        return fetchJson(CONFIG_URL).then(function(config) {
            return fetchJson(DATA_URL).then(function(remote) {
                if (!remote || !remote.data) return [];
                
                var match = null;
                var list = remote.data;
                
                // Optimized Search
                for (var i = 0; i < list.length; i++) {
                    if (list[i].moviename) {
                        var currentName = cleanTitle(list[i].moviename);
                        if (currentName === targetTitle || currentName.indexOf(targetTitle) !== -1) {
                            match = list[i];
                            break;
                        }
                    }
                }

                if (!match) {
                    console.log("[StreamFlix] No match found in database");
                    return [];
                }

                var streams = [];
                var hosts = (config && config.premium) ? config.premium : ["https://stream.streamflix.app/"];

                // HANDLE MOVIE
                if (!isSeries && match.movielink) {
                    for (var j = 0; j < hosts.length; j++) {
                        streams.push({
                            name: "StreamFlix",
                            title: match.moviename + " [1080p Premium]",
                            url: hosts[j] + match.movielink,
                            quality: "1080p"
                        });
                    }
                    return streams;
                }

                // HANDLE TV (Using the UHD-style Firebase Fetch)
                if (isSeries && season && episode) {
                    var fbUrl = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + 
                                match.moviekey + "/seasons/" + season + "/episodes.json";
                    
                    console.log("[StreamFlix] Fetching Episodes: " + fbUrl);

                    return fetchJson(fbUrl).then(function(episodes) {
                        if (!episodes) return [];
                        
                        var epIndex = (episode - 1);
                        var ep = episodes[epIndex] || episodes[episode.toString()] || null;

                        if (ep && ep.link) {
                            for (var k = 0; k < hosts.length; k++) {
                                streams.push({
                                    name: "StreamFlix",
                                    title: "S" + season + "E" + episode + " - " + (ep.name || match.moviename),
                                    url: hosts[k] + ep.link,
                                    quality: "1080p"
                                });
                            }
                        }
                        return streams;
                    }).catch(function() { return []; });
                }

                return streams;
            });
        });
    }).catch(function(err) {
        console.error("[StreamFlix] Error: " + err.message);
        return [];
    });
}

// Universal Export (Standard UHD Strategy)
if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
