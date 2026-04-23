/**
 * Movies4u - Android TV Legacy Optimized
 * Uses ES5 syntax to ensure compatibility with restricted TV JS engines.
 */

var TMDB_KEY = '1b3113663c9004682ed61086cf967c44';
var MAIN_URL = 'https://new1.movies4u.style';
var M4U_PLAY = 'https://m4uplay.store';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise(function(resolve) {
        // 1. Get Title from TMDB (Ensuring we have a search string)
        var tmdbUrl = 'https://api.themoviedb.org/3/' + (mediaType === 'movie' ? 'movie' : 'tv') + '/' + tmdbId + '?api_key=' + TMDB_KEY;

        fetch(tmdbUrl)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                var title = data.title || data.name;
                if (!title) throw new Error("No Title");
                
                // 2. Search Movies4u
                return fetch(MAIN_URL + '/?s=' + encodeURIComponent(title), {
                    headers: { 'User-Agent': UA }
                });
            })
            .then(function(res) { return res.text(); })
            .then(function(searchHtml) {
                // Find the first result link using basic Regex
                var postMatch = searchHtml.match(/href="(https:\/\/new1\.movies4u\.style\/[^"]+)"/);
                if (!postMatch) return resolve([]);
                
                // 3. Get the Movie/Show Page
                return fetch(postMatch[1], { headers: { 'User-Agent': UA, 'Referer': MAIN_URL + '/' } });
            })
            .then(function(res) { return res.text(); })
            .then(function(pageHtml) {
                // Find M4UPlay links
                var streamMatch = pageHtml.match(/href="(https:\/\/m4uplay\.[^"]+)"/);
                if (!streamMatch) return resolve([]);
                
                // 4. Get the Embed/Player Page
                return fetch(streamMatch[1], { headers: { 'User-Agent': UA, 'Referer': MAIN_URL + '/' } });
            })
            .then(function(res) { return res.text(); })
            .then(function(embedHtml) {
                // Look for m3u8 playlist or .txt sources
                var finalSource = null;
                var sourceMatch = embedHtml.match(/file\s*:\s*["']([^"']+\.(?:m3u8|txt)[^"']*)["']/) ||
                                 embedHtml.match(/(https?:\/\/[^"']+\.(?:m3u8|txt)(?:\?[^"']*)?)/);

                if (sourceMatch) {
                    finalSource = sourceMatch[1];
                    if (finalSource.indexOf('/') === 0) finalSource = M4U_PLAY + finalSource;

                    resolve([{
                        name: '🎬 Movies4u (TV)',
                        title: 'Movies4u • Standard Stream',
                        url: finalSource,
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
                resolve([]);
            });
    });
}

module.exports = { getStreams: getStreams };
