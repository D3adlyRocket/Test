/**
 * Movies4u - Android TV Optimized 
 * Date: 2026-04-23
 */

var TMDB_KEY = '1b3113663c9004682ed61086cf967c44';
var MAIN_URL = 'https://new1.movies4u.style';
var M4U_PLAY = 'https://m4uplay.store';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Helper for standard HTTP GET
function httpGet(url, headers) {
    return fetch(url, {
        headers: Object.assign({ 'User-Agent': UA }, headers || {})
    }).then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
    });
}

// Simplified unpacker for protected JS
function simpleUnpack(p, a, c, k) {
    while (c--) {
        if (k[c]) p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), k[c]);
    }
    return p;
}

function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise(function(resolve) {
        var tmdbUrl = 'https://api.themoviedb.org/3/' + (mediaType === 'movie' ? 'movie' : 'tv') + '/' + tmdbId + '?api_key=' + TMDB_KEY;

        fetch(tmdbUrl)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var title = data.title || data.name;
                var searchUrl = MAIN_URL + '/?s=' + encodeURIComponent(title);
                return httpGet(searchUrl, { 'Referer': MAIN_URL + '/' });
            })
            .then(function(html) {
                // Regex to find the movie link in search results
                var linkMatch = html.match(/class="entry-title"><a href="([^"]+)"/);
                if (!linkMatch) return null;
                return httpGet(linkMatch[1], { 'Referer': MAIN_URL + '/' });
            })
            .then(function(pageHtml) {
                if (!pageHtml) return null;
                
                // Find m4uplay embed/watch links
                var streamMatch = pageHtml.match(/href="(https:\/\/m4uplay\.[^"]+)"/);
                if (!streamMatch) return null;
                
                return httpGet(streamMatch[1], { 'Referer': MAIN_URL + '/' });
            })
            .then(function(embedHtml) {
                if (!embedHtml) { resolve([]); return; }

                // Look for packed JavaScript containing the file URL
                var finalUrl = null;
                var packerMatch = embedHtml.match(/eval\(function\(p,a,c,k,e,d\)\{.*?\}\((.*)\)\)/);
                
                var sourceToSearch = embedHtml;
                if (packerMatch) {
                    try {
                        var args = packerMatch[1].split(',');
                        var p = args[0].replace(/['"]/g, '');
                        var a = parseInt(args[1]);
                        var c = parseInt(args[2]);
                        var k = args[3].split('|');
                        sourceToSearch += simpleUnpack(p, a, c, k);
                    } catch(e) { /* ignore unpack errors */ }
                }

                // Extract m3u8 playlist
                var m3u8Match = sourceToSearch.match(/(https?:\/\/[^"']+\.m3u8[^"']*)/i) || 
                                sourceToSearch.match(/file\s*:\s*"([^"]+)"/);
                
                if (m3u8Match) {
                    finalUrl = m3u8Match[1];
                    // Clean up potential relative paths
                    if (finalUrl.startsWith('/')) finalUrl = M4U_PLAY + finalUrl;

                    resolve([{
                        name: '🎬 Movies4u',
                        title: 'Movies4u (Instant) • Auto Quality',
                        url: finalUrl,
                        quality: '720p', // Defaulting to 720p as a label
                        headers: {
                            'Referer': M4U_PLAY + '/',
                            'Origin': M4U_PLAY,
                            'User-Agent': UA
                        }
                    }]);
                } else {
                    resolve([]);
                }
            })
            .catch(function(err) {
                console.error('Movies4u Error: ' + err.message);
                resolve([]);
            });
    });
}

module.exports = { getStreams };
