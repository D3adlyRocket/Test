"use strict";

var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";

function getStreams(tmdbId, mediaType, season, episode) {
    // Return empty array if fetch fails to prevent app hang
    return new Promise(function(resolve) {
        var type = (mediaType === 'tv' || mediaType === 'series') ? 'tv' : 'movie';
        var tmdbUrl = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_KEY;

        // STEP 1: Get Title from TMDB
        fetch(tmdbUrl)
            .then(function(r) { return r.json(); })
            .then(function(tmdb) {
                var title = (type === 'tv' ? tmdb.name : tmdb.title).toLowerCase();

                // STEP 2: Get Stream Data (Stripped headers to avoid CORS Preflight)
                return fetch("https://api.streamflix.app/data.json")
                    .then(function(r) { return r.json(); })
                    .then(function(remote) {
                        var match = null;
                        var list = remote.data || [];
                        
                        for (var i = 0; i < list.length; i++) {
                            if (list[i].moviename && list[i].moviename.toLowerCase() === title) {
                                match = list[i];
                                break;
                            }
                        }

                        if (!match) return resolve([]);

                        // STEP 3: Handle Movie or TV
                        if (type === 'movie' && match.movielink) {
                            resolve([{
                                name: "StreamFlix 1080p",
                                url: "https://stream.streamflix.app/" + match.movielink,
                                quality: "1080p"
                            }]);
                        } else if (type === 'tv') {
                            // TV logic requires another fetch to Firebase
                            var fb = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + match.moviekey + "/seasons/" + season + "/episodes.json";
                            fetch(fb).then(function(r) { return r.json(); }).then(function(eps) {
                                var ep = eps[episode - 1] || eps[episode.toString()];
                                if (ep && ep.link) {
                                    resolve([{
                                        name: "StreamFlix TV",
                                        url: "https://stream.streamflix.app/" + ep.link,
                                        quality: "1080p"
                                    }]);
                                } else { resolve([]); }
                            }).catch(function() { resolve([]); });
                        } else { resolve([]); }
                    });
            })
            .catch(function(err) {
                console.log("Fetch Error: " + err.message);
                resolve([]);
            });
    });
}
