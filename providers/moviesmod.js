'use strict';

/**
 * ANDROID TV UNIVERSAL VERSION
 * 0 Dependencies | 0 Imports | ES5 Only
 * This version uses raw string manipulation to avoid the Cheerio/Node crash.
 */

var BASE_URL = 'https://hindmovie.ltd';
var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var PROXY    = 'https://hindmoviez.s4nch1tt.workers.dev';

function getStreams(tmdbId, type, season, episode) {
    var isSeries = (type === 'tv' || type === 'series');
    var tmdbUrl = 'https://api.themoviedb.org/3/' + (isSeries ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY;

    return fetch(tmdbUrl)
        .then(function(res) { return res.json(); })
        .then(function(details) {
            var title = details.title || details.name;
            return fetch(BASE_URL + '/?s=' + encodeURIComponent(title));
        })
        .then(function(res) { return res.text(); })
        .then(function(searchHtml) {
            // Find page link using basic string splitting (Fastest on TV)
            var pageUrl = searchHtml.split('<h2 class="entry-title"><a href="')[1];
            if (!pageUrl) return [];
            pageUrl = pageUrl.split('"')[0];

            return fetch(pageUrl);
        })
        .then(function(res) { return res.text(); })
        .then(function(pageHtml) {
            var streams = [];
            var links = pageHtml.split('href="https://mvlink.site/');
            
            // Start at 1 to skip the first split chunk
            var fetchTasks = [];
            for (var i = 1; i < Math.min(links.length, 4); i++) {
                var mvUrl = 'https://mvlink.site/' + links[i].split('"')[0];
                
                fetchTasks.push(
                    fetch(mvUrl)
                        .then(function(res) { return res.text(); })
                        .then(function(mvHtml) {
                            var target = null;
                            if (!isSeries) {
                                // Movie logic
                                if (mvHtml.indexOf('hshare.ink') !== -1) {
                                    target = 'https://hshare.ink/' + mvHtml.split('hshare.ink/')[1].split('"')[0];
                                }
                            } else {
                                // Episode logic
                                var epKey = 'Episode ' + (episode < 10 ? '0' + episode : episode);
                                if (mvHtml.indexOf(epKey) !== -1) {
                                    target = mvHtml.split(epKey)[0].split('href="').pop().split('"')[0];
                                }
                            }

                            if (target && target.indexOf('http') === 0) {
                                return {
                                    name: "🎬 HindMoviez TV",
                                    title: "Direct Link | Multi-Server\nOptimized for Leanback UI",
                                    url: PROXY + "/hm/proxy?url=" + encodeURIComponent(target),
                                    behaviorHints: {
                                        notWebReady: false,
                                        proxyHeaders: { "Referer": "https://hcloud.to/" }
                                    }
                                };
                            }
                            return null;
                        })
                        .catch(function() { return null; })
                );
            }

            return Promise.all(fetchTasks);
        })
        .then(function(results) {
            var filtered = [];
            for (var j = 0; j < results.length; j++) {
                if (results[j]) filtered.push(results[j]);
            }
            return filtered;
        })
        .catch(function() {
            return [];
        });
}

// Attach to global scope for Android TV Engines
if (typeof self !== 'undefined') { self.getStreams = getStreams; }
if (typeof window !== 'undefined') { window.getStreams = getStreams; }
if (typeof global !== 'undefined') { global.getStreams = getStreams; }
