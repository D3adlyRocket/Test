'use strict';

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var SF_BASE  = 'https://api.streamflix.app';

var DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*'
};

// Fail-safe fetch from your HindMoviez code
function safeFetch(url) {
    return fetch(url, { headers: DEFAULT_HEADERS })
        .then(function(res) { 
            if (!res.ok) return null;
            return res.text(); // TV engines prefer text() then manual JSON.parse
        })
        .catch(function() { return null; });
}

function getStreams(tmdbId, type, season, episode) {
    var isTV = (type === 'series' || type === 'tv');
    var tmdbUrl = 'https://api.themoviedb.org/3/' + (isTV ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY;

    return fetch(tmdbUrl)
        .then(function(res) { return res.json(); })
        .then(function(details) {
            if (!details) return [];
            var query = (isTV ? details.name : details.title).toLowerCase();

            // 1. Get Config
            return safeFetch(SF_BASE + '/config/config-streamflixapp.json').then(function(configRaw) {
                if (!configRaw) return [];
                var config = JSON.parse(configRaw);

                // 2. Get Data
                return safeFetch(SF_BASE + '/data.json').then(function(dataRaw) {
                    if (!dataRaw) return [];
                    var db = JSON.parse(dataRaw);
                    var list = db.data || [];
                    var match = null;

                    for (var i = 0; i < list.length; i++) {
                        if (list[i] && list[i].moviename && list[i].moviename.toLowerCase().indexOf(query) !== -1) {
                            match = list[i];
                            break;
                        }
                    }

                    if (!match) return [];

                    var streams = [];
                    var hosts = [].concat(config.premium || [], config.movies || []);

                    if (!isTV) {
                        for (var j = 0; j < hosts.length; j++) {
                            if (match.movielink) {
                                streams.push({
                                    name: '🎬 StreamFlix | Server ' + (j + 1),
                                    title: '📺 1080p • ' + match.moviename,
                                    url: hosts[j] + match.movielink,
                                    quality: '1080p'
                                });
                            }
                        }
                        return streams;
                    } else {
                        // 3. TV Episode Logic
                        var fbUrl = 'https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/' + match.moviekey + '/seasons/' + season + '/episodes.json';
                        return safeFetch(fbUrl).then(function(epRaw) {
                            if (!epRaw) return [];
                            var episodes = JSON.parse(epRaw);
                            var ep = episodes[episode - 1] || episodes[episode.toString()];
                            
                            if (ep && ep.link) {
                                for (var k = 0; k < hosts.length; k++) {
                                    streams.push({
                                        name: '🎬 StreamFlix | Server ' + (k + 1),
                                        title: '📺 1080p • S' + season + 'E' + episode,
                                        url: hosts[k] + ep.link,
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
        .catch(function() { return []; });
}

if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; }
else { global.getStreams = getStreams; }
