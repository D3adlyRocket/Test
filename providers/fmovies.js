// StreamM4U Provider for Nuvio
// Final attempt: Direct Regex + Header Injection

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE = 'https://streamm4u.com.co';
var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36';

function httpGet(url, headers) {
    return fetch(url, {
        headers: Object.assign({ 
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        }, headers || {})
    }).then(function(r) { 
        if (!r.ok) throw new Error('Status ' + r.status);
        return r.text(); 
    });
}

function getStreams(tmdbId, mediaType) {
    return new Promise(function(resolve) {
        var tmdbUrl = 'https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '?api_key=' + TMDB_KEY;

        fetch(tmdbUrl).then(function(r) { return r.json(); }).then(function(data) {
            var title = data.title || data.name;
            // StreamM4U search format uses '+' for spaces
            var searchUrl = BASE + '/search/' + encodeURIComponent(title).replace(/%20/g, '+');
            return httpGet(searchUrl, { 'Referer': BASE + '/' });
        }).then(function(searchHtml) {
            // Find the first movie link
            var linkMatch = searchHtml.match(/<div class="movie-box">[\s\S]*?href="([^"]+)"/);
            if (!linkMatch) throw new Error('Search failed to find movie');
            
            var movieUrl = linkMatch[1];
            return httpGet(movieUrl, { 'Referer': BASE + '/' });
        }).then(function(movieHtml) {
            // Look for the rpmvip link patterns
            // pattern 1: inside an iframe src
            // pattern 2: inside a script variable
            var streamMatch = movieHtml.match(/src="(https:\/\/youtube-prime\.rpmvip\.com\/[^"]+)"/i) ||
                             movieHtml.match(/["'](https:\/\/youtube-prime\.rpmvip\.com\/[^"']+)["']/i) ||
                             movieHtml.match(/file\s*:\s*["'](https:\/\/youtube-prime\.rpmvip\.com\/[^"']+)["']/i);

            if (!streamMatch) throw new Error('No rpmvip link found in page source');

            var finalUrl = streamMatch[1].replace(/\\/g, '');

            resolve([{
                name: '🎬 StreamM4U (SV Emb1)',
                title: 'Full HD • RPMVIP',
                url: finalUrl,
                quality: '1080p',
                headers: {
                    'User-Agent': UA,
                    'Referer': 'https://youtube-prime.rpmvip.com/',
                    'Origin': 'https://youtube-prime.rpmvip.com',
                    'Accept': '*/*',
                    'Connection': 'keep-alive',
                    'sec-ch-ua-platform': '"Android"',
                    'sec-ch-ua': '"Android WebView";v="147", "Not.A/Brand";v="8", "Chromium";v="147"'
                }
            }]);
        }).catch(function(err) {
            console.log('[StreamM4U Error]: ' + err.message);
            resolve([]);
        });
    });
}

module.exports = { getStreams };
