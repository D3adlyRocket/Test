'use strict';

var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
var SF_API_BASE  = 'https://api.streamflix.app';
// Using the worker proxy that worked for HindMoviez
var PROXY_WORKER = 'https://hindmoviez.s4nch1tt.workers.dev';

var DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
};

// The Proxy Wrapper
function proxyUrl(url) {
    if (!url) return url;
    return PROXY_WORKER + '/hm/proxy?url=' + encodeURIComponent(url);
}

function getStreams(tmdbId, mediaType, season, episode) {
    var isTV = (mediaType === 'tv' || mediaType === 'series');
    var tmdbUrl = 'https://api.themoviedb.org/3/' + (isTV ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

    return fetch(tmdbUrl)
        .then(function(res) { return res.json(); })
        .then(function(tmdb) {
            var searchTitle = (isTV ? tmdb.name : tmdb.title).toLowerCase();

            // 1. Fetch Config and Data through Proxy for maximum TV compatibility
            return fetch(proxyUrl(SF_API_BASE + '/config/config-streamflixapp.json'))
                .then(function(r) { return r.json(); })
                .then(function(config) {
                    return fetch(proxyUrl(SF_API_BASE + '/data.json'))
                        .then(function(r) { return r.json(); })
                        .then(function(db) {
                            
                            var list = db.data || [];
                            var match = null;
                            for (var i = 0; i < list.length; i++) {
                                if (list[i] && list[i].moviename && list[i].moviename.toLowerCase().indexOf(searchTitle) !== -1) {
                                    match = list[i];
                                    break;
                                }
                            }

                            if (!match) return [];

                            var streams = [];
                            var hosts = [].concat(config.premium || [], config.movies || []);

                            if (!isTV) {
                                // Movie Logic
                                for (var j = 0; j < hosts.length; j++) {
                                    if (match.movielink) {
                                        streams.push({
                                            name: '🎬 StreamFlix | ' + (j + 1),
                                            title: '📺 1080p • ' + match.moviename + '\n(TV Mode)',
                                            url: proxyUrl(hosts[j] + match.movielink),
                                            quality: '1080p'
                                        });
                                    }
                                }
                                return streams;
                            } else {
                                // TV Logic - Use Proxy for Firebase REST call
                                var fbUrl = 'https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/' + match.moviekey + '/seasons/' + season + '/episodes.json';
                                
                                return fetch(proxyUrl(fbUrl))
                                    .then(function(r) { return r.json(); })
                                    .then(function(episodes) {
                                        var ep = episodes ? (episodes[episode - 1] || episodes[episode.toString()]) : null;
                                        if (ep && ep.link) {
                                            for (var k = 0; k < hosts.length; k++) {
                                                streams.push({
                                                    name: '🎬 StreamFlix | ' + (k + 1),
                                                    title: '📺 1080p • S' + season + 'E' + episode + '\n(TV Mode)',
                                                    url: proxyUrl(hosts[k] + ep.link),
                                                    quality: '1080p'
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

if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; }
else { global.getStreams = getStreams; }
