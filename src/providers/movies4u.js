/**
 * Movies4u - Nuvio Universal (Mobile & Android TV)
 * Rebuilt using the proven AnimeWorld structure.
 */

var TMDB_KEY = '1b3113663c9004682ed61086cf967c44';
var MAIN_URL = 'https://new1.movies4u.style';
var M4U_PLAY = 'https://m4uplay.store';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function httpGet(url, headers) {
    return fetch(url, {
        headers: Object.assign({ 'User-Agent': UA }, headers || {})
    }).then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
    });
}

// Fixed Unpacker for m4uplay's protected JS
function unpack(p, a, c, k) {
    while (c--) {
        if (k[c]) {
            p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), k[c]);
        }
    }
    return p;
}

function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise(function(resolve) {
        // 1. Get Metadata from TMDB
        var type = (mediaType === 'movie' || mediaType === 'movies') ? 'movie' : 'tv';
        var tmdbUrl = 'https://api.themoviedb.org/3/' + type + '/' + tmdbId + '?api_key=' + TMDB_KEY;

        fetch(tmdbUrl)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var title = data.title || data.name;
                // 2. Search Movies4u (Site uses ?s= query)
                return httpGet(MAIN_URL + '/?s=' + encodeURIComponent(title), { 'Referer': MAIN_URL + '/' });
            })
            .then(function(searchHtml) {
                // Find the first post link using Regex (Reliable on TV)
                var postMatch = searchHtml.match(/href="(https:\/\/new1\.movies4u\.style\/[^"]+)"/);
                if (!postMatch) return null;
                return httpGet(postMatch[1], { 'Referer': MAIN_URL + '/' });
            })
            .then(function(pageHtml) {
                if (!pageHtml) return null;
                // 3. Find the M4UPlay watch link
                var embedMatch = pageHtml.match(/href="(https:\/\/m4uplay\.[^"]+)"/);
                if (!embedMatch) return null;
                return httpGet(embedMatch[1], { 'Referer': MAIN_URL + '/' });
            })
            .then(function(embedHtml) {
                if (!embedHtml) { resolve([]); return; }

                var sourceToSearch = embedHtml;
                // Handle "Packed" code if it exists
                var packerMatch = embedHtml.match(/eval\(function\(p,a,c,k,e,d\)\{.*?\}\((.*)\)\)/);
                if (packerMatch) {
                    try {
                        var args = packerMatch[1].split(',');
                        var p = args[0].replace(/['"]/g, '');
                        var a = parseInt(args[1]);
                        var c = parseInt(args[2]);
                        var k = args[3].split('|');
                        sourceToSearch += unpack(p, a, c, k);
                    } catch(e) {}
                }

                // 4. Extract the m3u8 or txt stream
                var m3u8Match = sourceToSearch.match(/(https?:\/\/[^"']+\.(?:m3u8|txt)(?:\?[^"']*)?)/i);
                
                if (m3u8Match) {
                    var finalUrl = m3u8Match[1];
                    if (finalUrl.indexOf('/') === 0) finalUrl = M4U_PLAY + finalUrl;

                    resolve([{
                        name: '🎬 Movies4u',
                        title: 'Movies4u • Adaptive Stream',
                        url: finalUrl,
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
                console.log("M4U Error: " + err.message);
                resolve([]);
            });
    });
}

module.exports = { getStreams: getStreams };
