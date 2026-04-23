// StreamM4U Provider for Nuvio
// Focus: ID Extraction + RPMVIP Header Fix

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE = 'https://streamm4u.com.co';
var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36';

function httpGet(url, headers) {
    return fetch(url, {
        headers: Object.assign({ 'User-Agent': UA, 'Referer': BASE + '/' }, headers || {})
    }).then(function(r) { return r.text(); });
}

function searchSite(title) {
    var url = BASE + '/search/' + encodeURIComponent(title).replace(/%20/g, '+');
    return httpGet(url).then(function(html) {
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
    return httpGet(movieUrl).then(function(html) {
        // Step 1: Find the Movie ID (Post ID)
        var idMatch = html.match(/data-id="(\d+)"/) || html.match(/id\s*=\s*["'](\d+)["']/);
        if (!idMatch) {
            // Step 2: Fallback - try to find the rpmvip link directly in the page source
            var directMatch = html.match(/src="(https:\/\/youtube-prime\.rpmvip\.com\/[^"]+)"/i);
            if (directMatch) return directMatch[1];
            return null;
        }

        var movieId = idMatch[1];
        
        // Step 3: Call the source fetcher (Simulating the 'SV Emb1' click)
        // StreamM4U often uses this endpoint for its server list
        return fetch(BASE + '/ajax/movie/get_sources/' + movieId, {
            method: 'POST',
            headers: {
                'User-Agent': UA,
                'Referer': movieUrl,
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'id=' + movieId + '&type=movie'
        }).then(function(r) { return r.json(); }).then(function(json) {
            // Look for the rpmvip URL in the JSON response
            var src = json.src || json.embed_url || '';
            if (src.includes('rpmvip.com')) return src;
            return null;
        }).catch(function() { return null; });
    });
}

function getStreams(tmdbId, mediaType) {
    return new Promise(function(resolve) {
        var tmdbUrl = 'https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '?api_key=' + TMDB_KEY;

        fetch(tmdbUrl).then(function(r) { return r.json(); }).then(function(data) {
            var title = data.title || data.name;
            return searchSite(title);
        }).then(function(results) {
            if (!results || results.length === 0) throw new Error('No results');
            // Select the most relevant search result
            return extractStream(results[0].url);
        }).then(function(finalUrl) {
            if (!finalUrl) { resolve([]); return; }

            // Ensure the URL is clean (no escaped slashes)
            var cleanUrl = finalUrl.replace(/\\/g, '');

            resolve([{
                name: '🎬 StreamM4U (SV Emb1)',
                title: 'Multi-Server • 1080p',
                url: cleanUrl,
                quality: '1080p',
                headers: {
                    'User-Agent': UA,
                    'Referer': 'https://youtube-prime.rpmvip.com/',
                    'Origin': 'https://youtube-prime.rpmvip.com',
                    'Accept': '*/*',
                    'Sec-Fetch-Dest': 'video',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'cross-site'
                }
            }]);
        }).catch(function(err) {
            console.error('[StreamM4U] Failed: ' + err.message);
            resolve([]);
        });
    });
}

module.exports = { getStreams };
