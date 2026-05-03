// =========================================================================
// NUVIO PROVIDER: NETVLYX (COMBINED & VERIFIED)
// Uses User-Provided TMDB Key: d80ba92bc7cefe3359668d30d06f3305
// =========================================================================

var WORKER_BASE = 'https://4-grass-8071.hdbdhdh825.workers.dev/?url=';

function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise(function(resolve) {
        // Updated with your provided key
        var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
        var tmdbUrl = 'https://api.themoviedb.org/3/' + (mediaType === 'movie' ? 'movie/' : 'tv/') + tmdbId + '?api_key=' + TMDB_KEY;

        console.log('[NetVlyx] Fetching TMDB data...');

        fetch(tmdbUrl)
            .then(function(res) { return res.json(); })
            .then(function(data) {
                var title = data.title || data.name;
                if (!title) throw new Error('Invalid TMDB Response');

                // Logic to match the "They Will Kill You" URL structure you provided
                // Clean title: remove special chars, replace spaces with hyphens
                var cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                var year = (data.release_date || data.first_air_date || '').split('-')[0];
                
                // Construct the target Movies4U URL that the worker expects
                var targetUrl = 'https://new2.movies4u.style/' + cleanTitle + '-' + year + '-hindi-full-movie/';
                var finalWorkerUrl = WORKER_BASE + encodeURIComponent(targetUrl);

                console.log('[NetVlyx] Calling Worker: ' + finalWorkerUrl);
                return fetch(finalWorkerUrl);
            })
            .then(function(response) { return response.text(); })
            .then(function(html) {
                // Regex updated to include the 'maverick' hub you found
                var hubRegex = /https:\/\/(hub\.maverick\.lat|hub\.yummy\.monster|hub\.hailmary\.lat)\/[a-zA-Z0-9\-_?=&]+/gi;
                var matches = html.match(hubRegex);

                if (!matches || matches.length === 0) {
                    console.log('[NetVlyx] No playable hub links found.');
                    return resolve([]);
                }

                console.log('[NetVlyx] Found ' + matches.length + ' playable links!');

                // Map results to Nuvio stream format
                var streams = [];
                for (var i = 0; i < matches.length; i++) {
                    streams.push({
                        name: '🚀 NetVlyx Hub',
                        title: 'Server ' + (i + 1) + ' (Verified)',
                        url: matches[i],
                        quality: '1080p',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Referer': 'https://netvlyx.pages.dev/'
                        }
                    });
                }
                resolve(streams);
            })
            .catch(function(err) {
                console.error('[NetVlyx] Critical Error: ' + err.message);
                resolve([]);
            });
    });
}

// Ensure module.exports is at the very bottom
module.exports = {
    getStreams: getStreams
};
