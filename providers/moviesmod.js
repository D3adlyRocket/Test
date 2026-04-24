(function() {
    "use strict";

    var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
    var BASE = "https://api.streamflix.app";

    function getStreams(tmdbId, mediaType, season, episode) {
        var isTV = (mediaType === 'tv' || mediaType === 'series');
        
        // 1. Fetch TMDB Data first
        return fetch("https://api.themoviedb.org/3/" + (isTV ? "tv" : "movie") + "/" + tmdbId + "?api_key=" + TMDB_KEY)
            .then(function(r) { return r.json(); })
            .then(function(tmdb) {
                var name = (isTV ? tmdb.name : tmdb.title).toLowerCase();

                // 2. Fetch the Database (data.json)
                return fetch(BASE + "/data.json")
                    .then(function(r) { return r.json(); })
                    .then(function(db) {
                        var list = db.data || [];
                        var match = null;

                        // Strict matching loop for performance
                        for (var i = 0; i < list.length; i++) {
                            if (list[i] && list[i].moviename && list[i].moviename.toLowerCase().indexOf(name) !== -1) {
                                match = list[i];
                                break;
                            }
                        }

                        if (!match) return [];

                        // 3. Fetch Config (To get the server domains)
                        return fetch(BASE + "/config/config-streamflixapp.json")
                            .then(function(r) { return r.json(); })
                            .then(function(config) {
                                var streams = [];
                                var hosts = [].concat(config.premium || [], config.movies || []);

                                if (!isTV) {
                                    // Movie Logic
                                    for (var j = 0; j < hosts.length; j++) {
                                        if (match.movielink) {
                                            streams.push({
                                                name: "StreamFlix",
                                                title: "1080p | " + match.moviename,
                                                url: hosts[j] + match.movielink,
                                                quality: "1080p"
                                            });
                                        }
                                    }
                                    return streams;
                                } else {
                                    // TV Logic - Direct Firebase REST API
                                    var fb = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + match.moviekey + "/seasons/" + season + "/episodes.json";
                                    return fetch(fb)
                                        .then(function(r) { return r.json(); })
                                        .then(function(episodes) {
                                            var ep = episodes ? (episodes[episode - 1] || episodes[episode.toString()]) : null;
                                            if (ep && ep.link) {
                                                for (var k = 0; k < hosts.length; k++) {
                                                    streams.push({
                                                        name: "StreamFlix",
                                                        title: "1080p | S" + season + "E" + episode,
                                                        url: hosts[k] + ep.link,
                                                        quality: "1080p"
                                                    });
                                                }
                                            }
                                            return streams;
                                        })
                                        .catch(function() { return []; });
                                }
                            });
                    });
            })
            .catch(function() {
                return [];
            });
    }

    // Export logic for TV Apps (Nuvio, Stremio, etc)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { getStreams: getStreams };
    } else if (typeof window !== 'undefined') {
        window.getStreams = getStreams;
    } else {
        global.getStreams = getStreams;
    }
})();
