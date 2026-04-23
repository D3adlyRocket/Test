// StreamM4U Provider for Nuvio
// Final Technical Fix: AJAX Source Injection

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE = 'https://streamm4u.com.co';
var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/147.0.7727.55';

function getStreams(tmdbId, mediaType) {
    return new Promise(function(resolve) {
        // 1. Get Title from TMDB
        fetch('https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '?api_key=' + TMDB_KEY)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var title = data.title || data.name;
                var searchUrl = BASE + '/search/' + encodeURIComponent(title).replace(/%20/g, '+');
                return fetch(searchUrl, { headers: { 'User-Agent': UA, 'Referer': BASE + '/home' } });
            })
            .then(function(r) { return r.text(); })
            .then(function(html) {
                // 2. Find the Movie Page URL
                var linkMatch = html.match(/href="(https:\/\/streamm4u\.com\.co\/(?:movies|tv)\/[^"]+)"/);
                if (!linkMatch) throw new Error('Search failed');
                return fetch(linkMatch[1], { headers: { 'User-Agent': UA, 'Referer': BASE + '/home' } });
            })
            .then(function(r) { return r.text(); })
            .then(function(movieHtml) {
                // 3. Extract the hidden POST ID (This is the key step)
                var idMatch = movieHtml.match(/data-id="([^"]+)"/) || movieHtml.match(/var\s+id\s*=\s*['"]([^'"]+)['"]/);
                if (!idMatch) throw new Error('ID extraction failed');
                var postId = idMatch[1];

                // 4. Request the sources via AJAX (This mimics the "Server Click")
                return fetch(BASE + '/ajax/movie/get_sources/' + postId, {
                    method: 'POST',
                    headers: {
                        'User-Agent': UA,
                        'Referer': BASE + '/',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: 'id=' + postId + '&type=movie'
                });
            })
            .then(function(r) { return r.json(); })
            .then(function(json) {
                // 5. Extract the source from the JSON response
                var rawUrl = json.src || json.embed_url || '';
                if (!rawUrl) throw new Error('No source in JSON');

                var streamUrl = rawUrl.replace(/\\/g, ''); // Clean escaped slashes
                
                // Determine headers based on the domain returned
                var isNeon = streamUrl.includes('neonhorizonworkshops');
                var referer = isNeon ? 'https://cloudnestra.com/' : 'https://youtube-prime.rpmvip.com/';
                var origin = isNeon ? 'https://cloudnestra.com' : 'https://youtube-prime.rpmvip.com';

                resolve([{
                    name: isNeon ? '🎬 SV-Vr' : '🎬 SV-Emb1',
                    title: '1080p • StreamM4U',
                    url: streamUrl,
                    quality: '1080p',
                    headers: {
                        'User-Agent': UA,
                        'Referer': referer,
                        'Origin': origin,
                        'Accept': '*/*',
                        'sec-ch-ua-platform': '"Android"',
                        'sec-ch-ua': '"Android WebView";v="147", "Not.A/Brand";v="8", "Chromium";v="147"'
                    }
                }]);
            })
            .catch(function(err) {
                console.error('[StreamM4U Error]', err.message);
                resolve([]);
            });
    });
}

module.exports = { getStreams };
