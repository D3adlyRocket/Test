'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration & Helpers
// ─────────────────────────────────────────────────────────────────────────────
var BASE_URL = 'https://hindmovie.ltd';
var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
var HM_WORKER = 'https://hindmoviez.s4nch1tt.workers.dev';

// Helper for regex parsing without Cheerio (TV safe)
function extractMatch(text, regex, group) {
    var match = text.match(regex);
    return (match && match[group]) ? match[group] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Function (ES5 Style for TV Compatibility)
// ─────────────────────────────────────────────────────────────────────────────
function getStreams(tmdbId, type, season, episode) {
    var endpoint = (type === 'movie') ? 'movie' : 'tv';
    var tmdbUrl = 'https://api.themoviedb.org/3/' + endpoint + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

    return fetch(tmdbUrl)
        .then(function(res) { return res.json(); })
        .then(function(details) {
            var query = details.title || details.name;
            var searchUrl = BASE_URL + '/?s=' + encodeURIComponent(query);
            
            return fetch(searchUrl);
        })
        .then(function(res) { return res.text(); })
        .then(function(searchHtml) {
            // Regex to find the first article link
            var pageUrl = extractMatch(searchHtml, /<h2 class="entry-title"><a href="([^"]+)"/, 1);
            if (!pageUrl) return [];

            return fetch(pageUrl);
        })
        .then(function(res) { return res.text(); })
        .then(function(pageHtml) {
            var streams = [];
            var mvlinkRegex = /href="(https:\/\/mvlink\.site\/[^"]+)"/g;
            var match;
            var links = [];

            // Collect all mvlinks found on the page
            while ((match = mvlinkRegex.exec(pageHtml)) !== null) {
                links.push(match[1]);
            }

            // TV logic: just resolve the first 2 links to prevent timeout/crash
            var promises = links.slice(0, 2).map(function(link) {
                return fetch(link)
                    .then(function(res) { return res.text(); })
                    .then(function(mvHtml) {
                        var target = null;
                        if (type === 'movie') {
                            target = extractMatch(mvHtml, /href="(https:\/\/hshare\.ink\/[^"]+)"/, 1);
                        } else {
                            // Find specific episode link
                            var epPattern = new RegExp('href="([^"]+)"[^>]*>Episode\\s*0?' + episode + '<', 'i');
                            target = extractMatch(mvHtml, epPattern, 1);
                        }

                        if (target) {
                            return {
                                name: "🎬 HindMoviez TV",
                                title: "Direct Stream (Optimized for Android TV)",
                                url: HM_WORKER + '/hm/proxy?url=' + encodeURIComponent(target),
                                behaviorHints: {
                                    notWebReady: false,
                                    proxyHeaders: { "Referer": "https://hcloud.to/" }
                                }
                            };
                        }
                        return null;
                    });
            });

            return Promise.all(promises);
        })
        .then(function(results) {
            // Filter out any nulls from the array
            return results.filter(function(r) { return r !== null; });
        })
        .catch(function(err) {
            console.log("TV Critical Error: " + err.message);
            return [];
        });
}

// ─────────────────────────────────────────────────────────────────────────────
// Universal Export
// ─────────────────────────────────────────────────────────────────────────────
if (typeof module !== 'undefined') {
    module.exports = { getStreams: getStreams };
}
if (typeof self !== 'undefined') {
    self.getStreams = getStreams;
}
if (typeof window !== 'undefined') {
    window.getStreams = getStreams;
}
