'use strict';

var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
var SF_BASE      = 'https://api.streamflix.app';
// Strict TV User-Agent to bypass Cloudflare "headless" blocks
var TV_UA        = 'Mozilla/5.0 (Linux; Android 10; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

// ─────────────────────────────────────────────────────────────────────────────
// TV-SAFE HELPERS (No AbortSignal, No Object.assign)
// ─────────────────────────────────────────────────────────────────────────────

function tvFetch(url) {
    return fetch(url, {
        headers: {
            'User-Agent': TV_UA,
            'Accept': 'application/json',
            'Referer': 'https://api.streamflix.app/'
        }
    }).then(function(res) {
        if (!res.ok) return null;
        return res.json();
    }).catch(function() { return null; });
}

// ─────────────────────────────────────────────────────────────────────────────
// THE CORE LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function getStreams(tmdbId, type, season, episode) {
    var isSeries = (type === 'series' || type === 'tv');
    var tmdbUrl = 'https://api.themoviedb.org/3/' + (isSeries ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

    return tvFetch(tmdbUrl).then(function(tmdb) {
        if (!tmdb) return [];
        var query = (isSeries ? tmdb.name : tmdb.title).toLowerCase();

        // 1. Get Config
        return tvFetch(SF_BASE + '/config/config-streamflixapp.json').then(function(config) {
            if (!config) return [];

            // 2. Get Data
            return tvFetch(SF_BASE + '/data.json').then(function(db) {
                var items = (db && db.data) ? db.data : [];
                var match = null;

                // Simple loop matching (most stable for TV memory)
                for (var i = 0; i < items.length; i++) {
                    var itmName = (items[i].moviename || items[i].title || "").toLowerCase();
                    if (itmName.indexOf(query) !== -1) {
                        match = items[i];
                        break;
                    }
                }

                if (!match) return [];

                var streams = [];
                var hosts = [].concat(config.premium || [], config.movies || []);
                
                // Meta info for Nuvio display
                var info = {
                    rating: match.imdbrating || "8.0",
                    genre: (match.moviegenre || "Action").split('|').join(' · ')
                };

                if (!isSeries) {
                    // Movie Logic
                    for (var j = 0; j < hosts.length; j++) {
                        if (match.movielink) {
                            streams.push(createNuvioStream(hosts[j] + match.movielink, "1080p", match.moviename, info));
                        }
                    }
                    return streams;
                } else {
                    // TV Logic - Direct Firebase REST (Replaces the broken WebSockets)
                    var fbUrl = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + match.moviekey + "/seasons/" + season + "/episodes.json";
                    
                    return tvFetch(fbUrl).then(function(epData) {
                        var ep = epData ? (epData[episode - 1] || epData[episode.toString()]) : null;
                        
                        if (ep && ep.link) {
                            for (var k = 0; k < hosts.length; k++) {
                                streams.push(createNuvioStream(hosts[k] + ep.link, "1080p", "S" + season + "E" + episode + " - " + (ep.name || "Episode"), info));
                            }
                        }
                        return streams;
                    });
                }
            });
        });
    }).catch(function() { return []; });
}

function createNuvioStream(url, q, title, info) {
    return {
        name: '🎬 StreamFlix | ' + q,
        title: '📺 ' + title + '\n⭐ ' + info.rating + '  🎭 ' + info.genre + '\nSanchit TV-Fix v2',
        url: url,
        quality: q,
        behaviorHints: {
            notWebReady: false,
            headers: {
                'User-Agent': TV_UA,
                'Referer': 'https://api.streamflix.app/',
                'Origin': 'https://api.streamflix.app'
            }
        }
    };
}

if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; }
else { global.getStreams = getStreams; }
