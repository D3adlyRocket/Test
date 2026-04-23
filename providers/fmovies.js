// StreamM4U Provider for Nuvio
// Optimized for SV Emb1 (rpmvip.com) extraction

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE = 'https://streamm4u.com.co';
var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36';

function httpGet(url, headers) {
    return fetch(url, {
        headers: Object.assign({ 'User-Agent': UA }, headers || {})
    }).then(function(r) { return r.text(); });
}

function searchSite(title) {
    // StreamM4U search format
    var url = BASE + '/search/' + encodeURIComponent(title).replace(/%20/g, '+');
    return httpGet(url, { 'Referer': BASE + '/' }).then(function(html) {
        var results = [];
        var movieRegex = /<div class="movie-box">[\s\S]*?href="([^"]+)" title="([^"]+)"/g;
        var match;
        while ((match = movieRegex.exec(html)) !== null) {
            results.push({ url: match[1], title: match[2] });
        }
        return results;
    });
}

function extractStream(movieUrl) {
    return httpGet(movieUrl, { 'Referer': BASE + '/' }).then(function(html) {
        // Look for the iframe that contains the rpmvip.com domain
        var rpmMatch = html.match(/src="(https:\/\/youtube-prime\.rpmvip\.com\/[^"]+)"/i);
        
        if (!rpmMatch) {
            // Fallback: Check if it's hidden in a data-src or a script variable
            rpmMatch = html.match(/["'](https:\/\/youtube-prime\.rpmvip\.com\/[^"']+)["']/i);
        }

        if (rpmMatch) {
            var playerUrl = rpmMatch[1];
            // Now fetch the player page to find the master.m3u8
            return httpGet(playerUrl, { 'Referer': movieUrl }).then(function(playerHtml) {
                var m3u8Match = playerHtml.match(/(https:\/\/[^"']+\.m3u8[^"']*)/i);
                return m3u8Match ? m3u8Match[1] : playerUrl; // Return URL or the player page
            });
        }
        return null;
    });
}

function getStreams(tmdbId, mediaType) {
    return new Promise(function(resolve) {
        var tmdbUrl = 'https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '?api_key=' + TMDB_KEY;

        fetch(tmdbUrl).then(function(r) { return r.json(); }).then(function(data) {
            var title = data.title || data.name;
            return searchSite(title);
        }).then(function(results) {
            if (!results || results.length === 0) throw new Error('Not found');
            // Try the first result
            return extractStream(results[0].url);
        }).then(function(finalUrl) {
            if (!finalUrl) { resolve([]); return; }

            resolve([{
                name: '🎬 StreamM4U (SV Emb1)',
                title: 'Full HD • rpmvip',
                url: finalUrl,
                quality: '1080p',
                headers: {
                    'User-Agent': UA,
                    'Referer': 'https://youtube-prime.rpmvip.com/', // New critical Referer
                    'Accept': '*/*',
                    'Origin': 'https://youtube-prime.rpmvip.com',
                    'Sec-Fetch-Mode': 'cors'
                }
            }]);
        }).catch(function(err) {
            console.error('[StreamM4U] Error: ' + err.message);
            resolve([]);
        });
    });
}

module.exports = { getStreams };
