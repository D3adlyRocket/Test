// StreamM4U Provider for Nuvio
// Final refinement with /home context and broad link sniffing

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE = 'https://streamm4u.com.co'; // Root domain
var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36';

function httpGet(url, headers) {
    return fetch(url, {
        headers: Object.assign({ 
            'User-Agent': UA,
            'Referer': BASE + '/home',
            'Accept': '*/*'
        }, headers || {})
    }).then(function(r) { return r.text(); });
}

function getStreams(tmdbId, mediaType) {
    return new Promise(function(resolve) {
        var tmdbUrl = 'https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '?api_key=' + TMDB_KEY;

        fetch(tmdbUrl).then(function(r) { return r.json(); }).then(function(data) {
            var title = data.title || data.name;
            // Use the direct search endpoint
            var searchUrl = BASE + '/search/' + encodeURIComponent(title).replace(/%20/g, '+');
            return httpGet(searchUrl);
        }).then(function(html) {
            // Find movie link - targeting the specific structure you provided
            var linkMatch = html.match(/href="(https:\/\/streamm4u\.com\.co\/(?:movies|tv)\/[^"]+)"/);
            if (!linkMatch) throw new Error('Search failed');
            
            return httpGet(linkMatch[1], { 'Referer': BASE + '/home' });
        }).then(function(moviePage) {
            var results = [];

            // Universal regex to catch any HLS stream from your known sources
            var hlsRegex = /(https:\/\/[^"']+\.(?:rpmvip|neonhorizonworkshops|ppzj-youtube|cfd)[^"']+\.m3u8[^"']*)/gi;
            var match;
            
            while ((match = hlsRegex.exec(moviePage)) !== null) {
                var streamUrl = match[1].replace(/\\/g, '');
                
                // Determine headers based on domain
                var ref = 'https://streamm4u.com.co/';
                var org = 'https://streamm4u.com.co';

                if (streamUrl.includes('neonhorizon')) {
                    ref = 'https://cloudnestra.com/';
                    org = 'https://cloudnestra.com';
                } else if (streamUrl.includes('rpmvip')) {
                    ref = 'https://youtube-prime.rpmvip.com/';
                    org = 'https://youtube-prime.rpmvip.com';
                } else if (streamUrl.includes('ppzj')) {
                    ref = 'https://streamm4u.com.co/';
                    org = 'https://if9.ppzj-youtube.cfd';
                }

                results.push({
                    name: '🎬 StreamM4U Source',
                    title: '1080p • Multi-Server',
                    url: streamUrl,
                    quality: '1080p',
                    headers: {
                        'User-Agent': UA,
                        'Referer': ref,
                        'Origin': org,
                        'Accept': '*/*',
                        'sec-ch-ua-platform': '"Android"',
                        'sec-ch-ua': '"Android WebView";v="147", "Not.A/Brand";v="8", "Chromium";v="147"'
                    }
                });
            }

            if (results.length === 0) throw new Error('No stream found');
            resolve(results);

        }).catch(function(err) {
            console.error('[StreamM4U] Error: ' + err.message);
            resolve([]);
        });
    });
}

module.exports = { getStreams };
