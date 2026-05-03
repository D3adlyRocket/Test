// =========================================================================
// NUVIO PROVIDER: NETVLYX (HERMES COMPATIBLE)
// =========================================================================

var WORKER_ENDPOINT = 'https://4-grass-8071.hdbdhdh825.workers.dev/?url=';

function getStreams(tmdbId, mediaType, season, episode) {
    console.log('[NetVlyx] Starting engine for ID: ' + tmdbId);
    
    return new Promise(function(resolve) {
        var TMDB_KEY = '5a687352f7f95d8525b682b6e1b6f007';
        var tmdbUrl = 'https://api.themoviedb.org/3/' + (mediaType === 'movie' ? 'movie/' : 'tv/') + tmdbId + '?api_key=' + TMDB_KEY;

        fetch(tmdbUrl)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                var title = data.title || data.name;
                var year = (data.release_date || data.first_air_date || '2024').split('-')[0];
                
                // Construct the specific slug used by the movies4u source
                var slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + year + '-hindi-full-movie';
                var targetUrl = 'https://new2.movies4u.style/' + slug + '/';
                var finalApiUrl = WORKER_ENDPOINT + encodeURIComponent(targetUrl);

                console.log('[NetVlyx] Requesting: ' + finalApiUrl);
                
                return fetch(finalApiUrl);
            })
            .then(function(response) { return response.text(); })
            .then(function(html) {
                // Search for the yummy.monster or hailmary links in the raw worker response
                var regex = /https:\/\/(hub\.yummy\.monster|hub\.hailmary\.lat)\/[a-zA-Z0-9\-_?=&]+/gi;
                var matches = html.match(regex);

                if (!matches || matches.length === 0) {
                    console.log('[NetVlyx] No direct hub links found.');
                    return resolve([]);
                }

                var results = [];
                for (var i = 0; i < matches.length; i++) {
                    results.push({
                        name: '🚀 NetVlyx API',
                        title: 'Server ' + (i + 1),
                        url: matches[i],
                        quality: '1080p',
                        headers: {
                            'User-Agent': 'Mozilla/5.0',
                            'Referer': 'https://netvlyx.pages.dev/'
                        }
                    });
                }
                resolve(results);
            })
            .catch(function(err) {
                console.error('[NetVlyx] Error: ' + err.message);
                resolve([]);
            });
    });
}

// Strictly required for Nuvio
module.exports = {
    getStreams: getStreams
};
