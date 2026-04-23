"use strict";

var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
// This proxy helps bypass TV-level domain blocking
var PROXY = "https://api.allorigins.win/raw?url=";

function xhrGet(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    // Mimicking the Castle App's working header
    xhr.setRequestHeader("User-Agent", "okhttp/4.9.3");
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    callback(JSON.parse(xhr.responseText));
                } catch (e) {
                    callback(null);
                }
            } else {
                callback(null);
            }
        }
    };
    xhr.send();
}

function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise(function(resolve) {
        var type = (mediaType === 'tv' || mediaType === 'series') ? 'tv' : 'movie';
        var tmdbUrl = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_KEY;

        // 1. Get TMDB Data
        xhrGet(tmdbUrl, function(tmdb) {
            if (!tmdb) return resolve([]);
            var title = (type === 'tv' ? tmdb.name : tmdb.title).toLowerCase().trim();

            // 2. Get StreamFlix Data via Proxy
            var dataUrl = PROXY + encodeURIComponent("https://api.streamflix.app/data.json");
            
            xhrGet(dataUrl, function(remote) {
                if (!remote || !remote.data) return resolve([]);
                
                var match = null;
                var list = remote.data;
                for (var i = 0; i < list.length; i++) {
                    if (list[i].moviename && list[i].moviename.toLowerCase().indexOf(title) !== -1) {
                        match = list[i];
                        break;
                    }
                }

                if (!match) return resolve([]);

                // 3. Resolve Movie
                if (type === 'movie') {
                    return resolve([{
                        name: "StreamFlix Premium",
                        url: "https://stream.streamflix.app/" + match.movielink,
                        quality: "1080p"
                    }]);
                }

                // 4. Resolve TV (Firebase)
                if (type === 'tv') {
                    var fb = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + match.moviekey + "/seasons/" + season + "/episodes.json";
                    xhrGet(fb, function(eps) {
                        if (!eps) return resolve([]);
                        var ep = eps[episode - 1] || eps[episode.toString()];
                        if (ep && ep.link) {
                            resolve([{
                                name: "StreamFlix TV",
                                url: "https://stream.streamflix.app/" + ep.link,
                                quality: "1080p"
                            }]);
                        } else {
                            resolve([]);
                        }
                    });
                }
            });
        });
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
