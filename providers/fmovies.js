var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE = 'https://streamm4u.com.co';
// Exact UA string from a real Chrome Android session
var UA = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';

function getStreams(tmdbId, mediaType) {
    return new Promise(function(resolve) {
        var tmdbUrl = 'https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '?api_key=' + TMDB_KEY;

        fetch(tmdbUrl)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                var title = data.title || data.name;
                // StreamM4U Search with exact headers to try and bypass the initial bot check
                var searchUrl = BASE + '/search/' + encodeURIComponent(title).replace(/%20/g, '+');
                return fetch(searchUrl, {
                    headers: {
                        'User-Agent': UA,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1'
                    }
                });
            })
            .then(function(res) { return res.text(); })
            .then(function(html) {
                // Step 2: Extract Movie Page
                var movieMatch = html.match(/href="(https:\/\/streamm4u\.com\.co\/(?:movies|tv)\/[^"]+)"/);
                if (!movieMatch) {
                    console.log("[StreamM4U] Search failed - might be blocked by Cloudflare.");
                    throw new Error('BLOCKED');
                }
                
                // Step 3: Fetch Movie Page to get the "Secret ID"
                return fetch(movieMatch[1], { 
                    headers: { 'User-Agent': UA, 'Referer': BASE + '/home' } 
                });
            })
            .then(function(res) { return res.text(); })
            .then(function(movieHtml) {
                var idMatch = movieHtml.match(/data-id="([^"]+)"/) || movieHtml.match(/var\s+id\s*=\s*['"]([^'"]+)['"]/);
                if (!idMatch) throw new Error('NO_ID');
                
                // Step 4: The AJAX Call that actually generates the link
                return fetch(BASE + '/ajax/movie/get_sources/' + idMatch[1], {
                    method: 'POST',
                    headers: {
                        'User-Agent': UA,
                        'Referer': BASE + '/',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: 'id=' + idMatch[1] + '&type=movie'
                });
            })
            .then(function(res) { return res.json(); })
            .then(function(json) {
                // Step 5: Clean the URL and apply your specific working headers
                var raw = (json.src || json.embed_url || "").replace(/\\/g, '');
                if (!raw) return resolve([]);

                var isNeon = raw.indexOf('neonhorizon') > -1;
                var domainRef = isNeon ? 'https://cloudnestra.com/' : 'https://youtube-prime.rpmvip.com/';

                resolve([{
                    name: '🎬 StreamM4U',
                    title: isNeon ? 'SV-Vr' : 'SV-Emb1',
                    url: raw,
                    quality: '1080p',
                    headers: {
                        'User-Agent': UA,
                        'Referer': domainRef,
                        'Origin': domainRef.replace(/\/$/, ''),
                        'Accept': '*/*',
                        'sec-ch-ua': '"Android WebView";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
                        'sec-ch-ua-platform': '"Android"'
                    }
                }]);
            })
            .catch(function(err) {
                console.error("[StreamM4U]", err.message);
                resolve([]);
            });
    });
}

module.exports = { getStreams: getStreams };
