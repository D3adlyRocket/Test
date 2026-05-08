/**
 * Cinezo Provider for Nuvio
 * Target: https://cinezo.net/watch/movie/[TMDB_ID]
 */

var PROVIDER_NAME = 'Cinezo';
var BASE_URL = 'https://cinezo.net';

async function getStreams(tmdbId, mediaType, season, episode) {
    // 1. Construct the URL based on your provided example
    var targetUrl;
    if (mediaType === 'movie') {
        // Example: https://cinezo.net/watch/movie/1226863
        targetUrl = BASE_URL + '/watch/movie/' + tmdbId;
    } else {
        // Standard TV format for this site
        targetUrl = BASE_URL + '/watch/tv/' + tmdbId + '/' + season + '/' + episode;
    }

    console.log('[' + PROVIDER_NAME + '] Fetching Target: ' + targetUrl);

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': BASE_URL + '/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            console.error('[' + PROVIDER_NAME + '] Page access failed: ' + response.status);
            return [];
        }

        const html = await response.text();
        
        // Safety check: if the page is too small, we likely hit a Cloudflare block
        if (html.length < 1000) {
            console.warn('[' + PROVIDER_NAME + '] Warning: Page response very short. Might be blocked by Cloudflare.');
        }

        const streams = [];

        /**
         * 2. The Extraction Logic
         * Cinezo often stores stream data in a JSON object or a script block.
         * We search for .m3u8 (HLS) and .mp4 (Direct) links.
         */
        
        // Regex for links, including those with JSON backslash escaping (\/)
        var streamRegex = /https?[:\/\\]+[^"']+\.(m3u8|mp4)[^"']*/g;
        var matches = html.match(streamRegex) || [];

        matches.forEach((rawLink) => {
            // Clean the link: remove backslashes and quotes
            var cleanLink = rawLink.replace(/\\/g, '').replace(/"/g, '').replace(/'/g, '');
            
            // Avoid duplicates
            if (!streams.find(s => s.url === cleanLink)) {
                var isM3u8 = cleanLink.includes('m3u8');
                
                streams.push({
                    name: PROVIDER_NAME,
                    title: isM3u8 ? 'Cinezo HLS (Auto)' : 'Cinezo Direct MP4',
                    url: cleanLink,
                    quality: isM3u8 ? 'Auto' : '1080p',
                    headers: {
                        'Referer': BASE_URL + '/',
                        'Origin': BASE_URL,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
            }
        });

        console.log('[' + PROVIDER_NAME + '] Successfully found ' + streams.length + ' stream(s)');
        return streams;

    } catch (error) {
        console.error('[' + PROVIDER_NAME + '] Fatal Error: ' + error.message);
        return [];
    }
}

// Nuvio compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
