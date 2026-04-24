'use strict';

var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
var SF_BASE      = 'https://api.streamflix.app';
var SF_UA        = 'Mozilla/5.0 (Linux; Android 10; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

var st = { config: null, items: null, tf: null, lf: null, kf: null };

// ─────────────────────────────────────────────────────────────────────────────
// TV-Safe Fetch (No Object.assign, No WebSockets)
// ─────────────────────────────────────────────────────────────────────────────
function tvFetch(url) {
    return fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': SF_UA,
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://streamflix.app/'
        }
    }).then(function(r) {
        if (!r.ok) return null;
        return r.text(); // Get text first to prevent JSON parse crashes
    }).then(function(t) {
        try { return JSON.parse(t); } catch(e) { return null; }
    }).catch(function() { return null; });
}

// ─────────────────────────────────────────────────────────────────────────────
// The "Magic" TV Logic: Replaces WebSockets with Firebase REST
// ─────────────────────────────────────────────────────────────────────────────
function getTvEpisodes(movieKey, season) {
    // Android TVs love REST, hate WebSockets. This is the direct Firebase link.
    var url = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + movieKey + "/seasons/" + season + "/episodes.json";
    return tvFetch(url).then(function(data) {
        if (!data) return null;
        // Firebase returns either an array or an object
        return data; 
    });
}

function getStreams(tmdbId, type, season, episode) {
    var isSeries = (type === 'series' || type === 'tv');
    var tmdbUrl = 'https://api.themoviedb.org/3/' + (isSeries ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

    return fetch(tmdbUrl).then(function(res) { return res.json(); }).then(function(tmdb) {
        var query = (isSeries ? tmdb.name : tmdb.title).toLowerCase();

        // 1. Get Config & Data (Sequential for TV stability)
        return tvFetch(SF_BASE + '/config/config-streamflixapp.json').then(function(config) {
            return tvFetch(SF_BASE + '/data.json').then(function(db) {
                var items = db ? (db.data || db.movies || []) : [];
                var match = null;

                for (var i = 0; i < items.length; i++) {
                    var title = (items[i].moviename || items[i].title || "").toLowerCase();
                    if (title.indexOf(query) !== -1) {
                        match = items[i];
                        break;
                    }
                }

                if (!match) return [];

                var streams = [];
                var hosts = [].concat(config.premium || [], config.movies || []);
                var info = { 
                    imdb: match.imdbrating || "N/A", 
                    genre: (match.moviegenre || "Action").replace(/\|/g, ' · ') 
                };

                if (!isSeries) {
                    // Movie Logic
                    for (var j = 0; j < hosts.length; j++) {
                        if (match.movielink) {
                            streams.push(buildStreamObj(hosts[j] + match.movielink, "1080p", match.moviename, info));
                        }
                    }
                    return streams;
                } else {
                    // TV Logic: Use the TV-Safe Firebase Fetch
                    return getTvEpisodes(match.moviekey, season).then(function(eps) {
                        var ep = eps ? (eps[episode - 1] || eps[episode.toString()]) : null;
                        if (ep && ep.link) {
                            for (var k = 0; k < hosts.length; k++) {
                                streams.push(buildStreamObj(hosts[k] + ep.link, "1080p", "S" + season + " E" + episode, info));
                            }
                        }
                        return streams;
                    });
                }
            });
        });
    }).catch(function() { return []; });
}

// ─────────────────────────────────────────────────────────────────────────────
// Nuvio Stream Builder (Optimized for TV Display)
// ─────────────────────────────────────────────────────────────────────────────
function buildStreamObj(url, quality, title, info) {
    return {
        name: '🎬 StreamFlix | ' + quality,
        title: '📺 ' + title + '\n⭐ IMDb: ' + info.imdb + '  🎭 ' + info.genre + '\nSanchit TV-Fix Applied',
        url: url,
        quality: quality,
        behaviorHints: {
            notWebReady: false,
            headers: {
                'User-Agent': SF_UA,
                'Referer': 'https://api.streamflix.app/',
                'Origin': 'https://api.streamflix.app'
            }
        }
    };
}

if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; }
else { global.getStreams = getStreams; }
