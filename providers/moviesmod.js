'use strict';

/**
 * NUVIO ANDROID TV - HERMES COMPATIBLE
 * No async, no await, no const, no let, no require.
 * Pure ES5 logic for direct execution on Android TV.
 */

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var BASE_URL = 'https://hindmovie.ltd';
var PROXY    = 'https://hindmoviez.s4nch1tt.workers.dev';

function getStreams(tmdbId, type, season, episode) {
    var isSeries = (type === 'tv' || type === 'series');
    var tmdbUrl = 'https://api.themoviedb.org/3/' + (isSeries ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY;

    // We use a flat chain because Hermes often fails with nested async logic
    return fetch(tmdbUrl)
        .then(function(res) { return res.json(); })
        .then(function(data) {
            var query = data.title || data.name;
            return fetch(BASE_URL + '/?s=' + encodeURIComponent(query));
        })
        .then(function(res) { return res.text(); })
        .then(function(html) {
            // Find the link to the movie/show page
            var parts = html.split('<h2 class="entry-title"><a href="');
            if (parts.length < 2) return [];
            var pageUrl = parts[1].split('"')[0];

            return fetch(pageUrl)
                .then(function(res) { return res.text(); })
                .then(function(pageHtml) {
                    var streams = [];
                    // Find all download buttons
                    var buttons = pageHtml.split('https://mvlink.site/');
                    
                    // Limit to 2 results to avoid the TV's memory cap
                    for (var i = 1; i < Math.min(buttons.length, 3); i++) {
                        var mvUrl = 'https://mvlink.site/' + buttons[i].split('"')[0];
                        
                        // We must return this inner chain to the main promise
                        streams.push(fetch(mvUrl)
                            .then(function(res) { return res.text(); })
                            .then(function(mvHtml) {
                                var link = null;
                                if (!isSeries) {
                                    if (mvHtml.indexOf('hshare.ink') !== -1) {
                                        link = 'https://hshare.ink/' + mvHtml.split('hshare.ink/')[1].split('"')[0];
                                    }
                                } else {
                                    var epStr = 'Episode ' + (episode < 10 ? '0' + episode : episode);
                                    if (mvHtml.indexOf(epStr) !== -1) {
                                        link = mvHtml.split(epStr)[0].split('href="').pop().split('"')[0];
                                    }
                                }

                                if (link) {
                                    return {
                                        name: "🎬 HindMoviez",
                                        title: "Android TV Optimized · 1080p/720p",
                                        url: PROXY + "/hm/proxy?url=" + encodeURIComponent(link),
                                        behaviorHints: {
                                            notWebReady: false,
                                            proxyHeaders: { "Referer": "https://hcloud.to/" }
                                        }
                                    };
                                }
                                return null;
                            }));
                    }
                    return Promise.all(streams);
                });
        })
        .then(function(results) {
            // Clean up the array
            var finalArr = [];
            for (var k = 0; k < results.length; k++) {
                if (results[k]) finalArr.push(results[k]);
            }
            return finalArr;
        })
        .catch(function() {
            return [];
        });
}

// Crucial: Hermes requires the function to be global
global.getStreams = getStreams;
