// =========================================================================
// NUVIO PROVIDER: NETVLYX (API WORKER EDITION)
// Bypasses UI to hit the Cloudflare Worker directly.
// =========================================================================

var WORKER_URL = 'https://4-grass-8071.hdbdhdh825.workers.dev/?url=';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise(function(resolve) {
        var TMDB_KEY = '5a687352f7f95d8525b682b6e1b6f007';
        var tmdbUrl = 'https://api.themoviedb.org/3/' + (mediaType === 'movie' ? 'movie/' : 'tv/') + tmdbId + '?api_key=' + TMDB_KEY;

        console.log('[NetVlyx] API Fetch for ID: ' + tmdbId);

        fetch(tmdbUrl)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var title = data.title || data.name;
                // Format title for the movies4u source style: "Title (Year)"
                var year = (data.release_date || data.first_air_date || '').split('-')[0];
                var searchSlug = encodeURIComponent(title + (year ? ' ' + year : ''));
                
                // Construct the direct worker request
                // We are mimicking the link you provided: /api/movies4u-movie?url=...
                var targetUrl = 'https://new2.movies4u.style/' + searchSlug.toLowerCase().replace(/%20/g, '-') + '-hindi-full-movie/';
                var finalApiUrl = WORKER_URL + encodeURIComponent(targetUrl);

                console.log('[NetVlyx] Hitting Worker: ' + finalApiUrl);
                
                return fetch(finalApiUrl, {
                    headers: { 'User-Agent': UA, 'Referer': 'https://netvlyx.pages.dev/' }
                });
            })
            .then(function(res) { return res.text(); })
            .then(function(html) {
                // Now we look for the "yummy.monster" or "hailmary" hub links in the worker's response
                var hubRegex = /https:\/\/(hub\.yummy\.monster|hub\.hailmary\.lat)\/[a-zA-Z0-9\-_?=&]+/gi;
                var matches = html.match(hubRegex);

                if (!matches || matches.length === 0) {
                    console.log('[NetVlyx] No hub links found in worker response.');
                    resolve([]);
                    return;
                }

                console.log('[NetVlyx] Success! Found ' + matches.length + ' streams.');

                var streams = matches.map(function(link, i) {
                    return {
                        name: '🚀 NetVlyx Worker',
                        title: 'Server ' + (i + 1),
                        url: link,
                        quality: '1080p',
                        headers: { 'User-Agent': UA, 'Referer': 'https://netvlyx.pages.dev/' }
                    };
                });

                resolve(streams);
            })
            .catch(function(err) {
                console.error('[NetVlyx] Worker Error: ' + err.message);
                resolve([]);
            });
    });
}

module.exports = { getStreams: getStreams };
