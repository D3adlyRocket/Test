"use strict";

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var STREAMFLIX_API_BASE = "https://api.streamflix.app";

// Pre-define Headers (Avoiding Object.assign for old TV engines)
var BASE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://streamflix.app/'
};

function getStreams(tmdbId, mediaType, season, episode) {
    var isTV = (mediaType === 'tv' || mediaType === 'series');
    var tmdbUrl = "https://api.themoviedb.org/3/" + (isTV ? "tv" : "movie") + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;

    return fetch(tmdbUrl, { headers: BASE_HEADERS })
        .then(function(res) { return res.json(); })
        .then(function(tmdbData) {
            var searchTitle = (isTV ? tmdbData.name : tmdbData.title).toLowerCase();
            
            // Fetch Config and Data sequentially to avoid Promise.all (can be buggy on old TVs)
            return fetch(STREAMFLIX_API_BASE + "/config/config-streamflixapp.json", { headers: BASE_HEADERS })
                .then(function(r) { return r.json(); })
                .then(function(config) {
                    return fetch(STREAMFLIX_API_BASE + "/data.json", { headers: BASE_HEADERS })
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            
                            var list = data.data || [];
                            var entry = null;
                            for (var i = 0; i < list.length; i++) {
                                if (list[i].moviename && list[i].moviename.toLowerCase().indexOf(searchTitle) !== -1) {
                                    entry = list[i];
                                    break;
                                }
                            }

                            if (!entry) return [];

                            var streams = [];
                            var bases = [];
                            if (config.premium) bases = bases.concat(config.premium);
                            if (config.movies) bases = bases.concat(config.movies);

                            if (!isTV) {
                                for (var j = 0; j < bases.length; j++) {
                                    if (entry.movielink) {
                                        streams.push({
                                            name: "StreamFlix",
                                            title: "Movie | " + entry.moviename,
                                            url: bases[j] + entry.movielink,
                                            quality: "1080p"
                                        });
                                    }
                                }
                                return streams;
                            } else {
                                // Direct Firebase REST call
                                var fbUrl = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + entry.moviekey + "/seasons/" + season + "/episodes.json";
                                return fetch(fbUrl).then(function(r) { return r.json(); }).then(function(epData) {
                                    var ep = epData ? (epData[episode - 1] || epData[episode.toString()]) : null;
                                    if (ep && ep.link) {
                                        for (var k = 0; k < bases.length; k++) {
                                            streams.push({
                                                name: "StreamFlix",
                                                title: "TV | S" + season + "E" + episode,
                                                url: bases[k] + ep.link,
                                                quality: "1080p"
                                            });
                                        }
                                    }
                                    return streams;
                                });
                            }
                        });
                });
        })
        .catch(function(err) {
            return [];
        });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
