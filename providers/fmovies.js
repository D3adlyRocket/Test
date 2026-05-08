var PROVIDER_NAME = 'Cinezo-Pro';
var BASE_URL = 'https://cinezo.net';

async function getStreams(tmdbId, mediaType, season, episode) {
    // 1. Construct the watch URL
    const watchUrl = (mediaType === 'movie') 
        ? `${BASE_URL}/watch/movie/${tmdbId}` 
        : `${BASE_URL}/watch/tv/${tmdbId}/${season}/${episode}`;

    try {
        console.log(`[${PROVIDER_NAME}] Initializing session: ${watchUrl}`);

        // Step 1: Fetch the main page to get cookies/session and the internal ID
        const pageResponse = await fetch(watchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://google.com'
            }
        });
        const html = await pageResponse.text();

        /**
         * Step 2: The "Link Grabber"
         * We are looking for the .m3u8 pattern specifically for tylerfisher55 workers
         * or the proxy relay.
         */
        const streams = [];
        
        // This regex targets the worker domain you identified
        const workerRegex = /https?:\/\/[^\s"'`]+workers\.dev\/[^\s"'`]+\.m3u8[^\s"'`]*/g;
        
        // We scan the HTML source first
        let matches = html.match(workerRegex) || [];

        // Step 3: Check for hidden JSON data if regex fails
        if (matches.length === 0) {
            console.log(`[${PROVIDER_NAME}] Link not in HTML, searching scripts...`);
            // Look for any string that looks like a base64 encoded source or a hidden API call
            const scriptRegex = /["'](https?:\/\/[^"']+)["']/g;
            let m;
            while ((m = scriptRegex.exec(html)) !== null) {
                if (m[1].includes('workers.dev') || m[1].includes('m3u8')) {
                    matches.push(m[1]);
                }
            }
        }

        matches.forEach((rawUrl) => {
            const cleanUrl = rawUrl.replace(/\\/g, ''); // Fix JSON escaping
            if (!streams.find(s => s.url === cleanUrl)) {
                streams.push({
                    name: 'Cinezo (Worker)',
                    title: 'Auto Quality',
                    url: cleanUrl,
                    quality: 'Auto',
                    headers: {
                        'Referer': 'https://111movies.net/', // Known referer for this worker
                        'Origin': 'https://111movies.net',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
            }
        });

        // Step 4: Final Fallback - If we found absolutely nothing, the site is 
        // likely using an AJAX call. We provide a manual check log.
        if (streams.length === 0) {
            console.error(`[${PROVIDER_NAME}] Security Block: Link is likely generated via POST request.`);
        }

        console.log(`[${PROVIDER_NAME}] Found ${streams.length} stream(s)`);
        return streams;

    } catch (e) {
        console.error(`[${PROVIDER_NAME}] Error: ${e.message}`);
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
