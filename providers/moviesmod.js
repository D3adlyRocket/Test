"use strict";

var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";

function getStreams(tmdbId, mediaType, season, episode) {
    var type = (mediaType === 'tv' || mediaType === 'series') ? 'tv' : 'movie';
    var tmdbUrl = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_KEY;

    return new Promise(function(resolve) {
        // Use standard fetch but handle response like the Castle code (Text -> Parse)
        fetch(tmdbUrl)
            .then(function(res) { return res.text(); })
            .then(function(text) {
                var tmdb = JSON.parse(text.trim());
                var title = (type === 'tv' ? tmdb.name : tmdb.title).toLowerCase();

                return fetch("https://api.streamflix.app/data.json");
            })
            .then(function(res) { return res.text(); })
            .then(function(text) {
                var sf = JSON.parse(text.trim());
                var list = sf.data || [];
                var match = null;

                for (var i = 0; i < list.length; i++) {
                    if (list[i].moviename && list[i].moviename.toLowerCase() === title) {
                        match = list[i];
                        break;
                    }
                }

                if (!match) return resolve([]);

                if (type === 'movie') {
                    resolve([{
                        name: "StreamFlix 1080p",
                        url: "https://stream.streamflix.app/" + match.movielink,
                        quality: "1080p"
                    }]);
                } else {
                    var fb = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + match.moviekey + "/seasons/" + season + "/episodes.json";
                    
                    fetch(fb)
                        .then(function(res) { return res.text(); })
                        .then(function(text) {
                            var eps = JSON.parse(text.trim());
                            var ep = eps[episode - 1] || eps[episode.toString()];
                            if (ep && ep.link) {
                                resolve([{
                                    name: "StreamFlix TV",
                                    url: "https://stream.streamflix.app/" + ep.link,
                                    quality: "1080p"
                                }]);
                            } else { resolve([]); }
                        }).catch(function() { resolve([]); });
                }
            })
            .catch(function(err) {
                resolve([]);
            });
    });
}

module.exports = { getStreams: getStreams };
