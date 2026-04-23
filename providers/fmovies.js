/**
 * Movies4u - Nuvio TV (Hermes/ES5) Version
 * Fixed for Android TV where async/await is not supported in plugins.
 */

var TMDB_KEY = '1b3113663c9004682ed61086cf967c44';
var MAIN_URL = 'https://new1.movies4u.style';
var M4U_PLAY = 'https://m4uplay.store';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function getStreams(tmdbId, mediaType, season, episode) {
    // We return a standard Promise. Do NOT use "async function" here.
    return new Promise(function(resolve, reject) {
        var type = (mediaType === 'movie' || mediaType === 'movies') ? 'movie' : 'tv';
        var tmdbUrl = 'https://api.themoviedb.org/3/' + type + '/' + tmdbId + '?api_key=' + TMDB_KEY;

        // Step 1: Get Metadata
        fetch(tmdbUrl)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var query = data.title || data.name;
                // Step 2: Search Website
                return fetch(MAIN_URL + '/?s=' + encodeURIComponent(query), {
                    headers: { 'User-Agent': UA }
                });
            })
            .then(function(r) { return r.text(); })
            .then(function(html) {
                // Find post link
                var postMatch = html.match(/href="(https:\/\/new1\.movies4u\.style\/[^"]+)"/);
                if (!postMatch) throw new Error("No post found");
                // Step 3: Get Post Page
                return fetch(postMatch[1], { headers: { 'User-Agent': UA, 'Referer': MAIN_URL + '/' } });
            })
            .then(function(r) { return r.text(); })
            .then(function(pageHtml) {
                // Find M4UPlay link
                var embedMatch = pageHtml.match(/href="(https:\/\/m4uplay\.[^"]+)"/);
                if (!embedMatch) throw new Error("No embed found");
                // Step 4: Get Player Page
                return fetch(embedMatch[1], { headers: { 'User-Agent': UA, 'Referer': MAIN_URL + '/' } });
            })
            .then(function(r) { return r.text(); })
            .then(function(embedHtml) {
                // Step 5: Extract final stream URL
                var streamUrl = null;
                var sourceMatch = embedHtml.match(/file\s*:\s*["']([^"']+\.(?:m3u8|txt)[^"']*)["']/) ||
                                 embedHtml.match(/(https?:\/\/[^"']+\.(?:m3u8|txt)(?:\?[^"']*)?)/);

                if (sourceMatch) {
                    streamUrl = sourceMatch[1];
                    if (streamUrl.indexOf('/') === 0) streamUrl = M4U_PLAY + streamUrl;

                    resolve([{
                        name: 'Movies4u',
                        title: 'Movies4u • Auto Quality (TV)',
                        url: streamUrl,
                        quality: 'Auto',
                        headers: {
                            'User-Agent': UA,
                            'Referer': M4U_PLAY + '/',
                            'Origin': M4U_PLAY
                        }
                    }]);
                } else {
                    resolve([]);
                }
            })
            .catch(function(err) {
                console.log("Nuvio Movies4u Error: " + err.message);
                resolve([]);
            });
    });
}

// For Nuvio compatibility
if (typeof module !== 'undefined') {
    module.exports = { getStreams: getStreams };
}
