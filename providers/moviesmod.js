'use strict';

/**
 * PURE JAVASCRIPT VERSION (No Cheerio, No Node.js)
 * Designed specifically for Android TV / Nuvio Beta
 */

var BASE_URL = 'https://hindmovie.ltd';
var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var WORKER   = 'https://hindmoviez.s4nch1tt.workers.dev';

function getStreams(tmdbId, type, season, episode) {
    var isSeries = (type === 'series' || type === 'tv');
    var tmdbUrl = 'https://api.themoviedb.org/3/' + (isSeries ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY;

    return fetch(tmdbUrl)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var name = data.title || data.name;
            return fetch(BASE_URL + '/?s=' + encodeURIComponent(name));
        })
        .then(function(r) { return r.text(); })
        .then(function(html) {
            // Find the first article link using Regex instead of Cheerio
            var pageMatch = html.match(/<h2 class="entry-title"><a href="([^"]+)"/);
            if (!pageMatch) return [];
            return fetch(pageMatch[1]);
        })
        .then(function(r) { return r.text(); })
        .then(function(html) {
            var streams = [];
            // Match all mvlink buttons
            var linkRegex = /href="(https:\/\/mvlink\.site\/[^"]+)"/g;
            var match;
            var foundLinks = [];
            
            while ((match = linkRegex.exec(html)) !== null) {
                foundLinks.push(match[1]);
            }

            // Process the first 3 links only to stay under TV memory limits
            var promises = foundLinks.slice(0, 3).map(function(link) {
                return fetch(link)
                    .then(function(r) { return r.text(); })
                    .then(function(mvHtml) {
                        var finalLink = null;
                        if (!isSeries) {
                            // Find "Get Links" button for movies
                            var movieMatch = mvHtml.match(/href="(https:\/\/hshare\.ink\/[^"]+)"/);
                            if (movieMatch) finalLink = movieMatch[1];
                        } else {
                            // Find specific episode
                            var epRegex = new RegExp('href="([^"]+)"[^>]*>Episode\\s*0?' + episode + '<', 'i');
                            var epMatch = mvHtml.match(epRegex);
                            if (epMatch) finalLink = epMatch[1];
                        }

                        if (finalLink) {
                            return {
                                name: "🎬 HindMoviez TV",
                                title: "Direct Stream · " + (isSeries ? "Ep " + episode : "Movie"),
                                url: WORKER + "/hm/proxy?url=" + encodeURIComponent(finalLink),
                                behaviorHints: {
                                    notWebReady: false,
                                    proxyHeaders: { "Referer": "https://hcloud.to/" }
                                }
                            };
                        }
                        return null;
                    })
                    .catch(function() { return null; });
            });

            return Promise.all(promises);
        })
        .then(function(results) {
            return results.filter(function(x) { return x !== null; });
        })
        .catch(function() {
            return [];
        });
}

// Android TV Exports
if (typeof module !== 'undefined') module.exports = { getStreams: getStreams };
if (typeof self !== 'undefined') self.getStreams = getStreams;
