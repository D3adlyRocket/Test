var PROVIDER_NAME = 'Cinezo-Ultra';
var BASE_URL = 'https://cinezo.net';

async function getStreams(tmdbId, mediaType, season, episode) {
    // Construct the actual URL used to fetch player data
    // Many sites like this use an internal 'ajax' or 'source' endpoint
    const targetUrl = (mediaType === 'movie') 
        ? `${BASE_URL}/watch/movie/${tmdbId}` 
        : `${BASE_URL}/watch/tv/${tmdbId}/${season}/${episode}`;

    try {
        console.log(`[${PROVIDER_NAME}] Attempting Deep Scrape: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0',
                'Referer': BASE_URL
            }
        });
        const html = await response.text();

        const streams = [];
        
        /**
         * STRATEGY: 
         * Since regex on the whole HTML is failing, we look for the 
         * "Source ID" or "Embed" links which are often Base64 encoded or 
         * hidden in script variables like 'var sources = ...'
         */

        // 1. Target the specific worker domains you provided
        // We look for any string containing 'tylerfisher55.workers.dev' 
        // even if it's escaped with backslashes
        const workerRegex = /(https?:\\?\/\\?\/[^\s"'`]+tylerfisher55\.workers\.dev[^\s"'`]+\.m3u8[^\s"'`]*)/g;
        const matches = html.match(workerRegex) || [];

        // 2. Look for the '111movies' reference which is the actual source provider
        if (matches.length === 0) {
            console.log(`[${PROVIDER_NAME}] No direct worker link. Searching for source identifiers...`);
            // This regex looks for encoded/JSON strings that often contain the stream
            const jsonRegex = /["'](https?[:\/\\]+[^\s"'`]+\.m3u8[^\s"'`]*)["']/g;
            let m;
            while ((m = jsonRegex.exec(html)) !== null) {
                if (m[1].includes('workers.dev') || m[1].includes('afc7d47f')) {
                    matches.push(m[1]);
                }
            }
        }

        matches.forEach((raw) => {
            // Clean up backslashes and quotes
            const cleanUrl = raw.replace(/\\/g, '').replace(/["']/g, '');
            
            if (!streams.find(s => s.url === cleanUrl)) {
                streams.push({
                    name: 'Cinezo (Direct)',
                    title: 'Worker Proxy (HLS)',
                    url: cleanUrl,
                    quality: 'Auto',
                    headers: {
                        'Referer': 'https://111movies.net/',
                        'Origin': 'https://111movies.net',
                        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0',
                        'Accept': '*/*',
                        'Connection': 'keep-alive'
                    }
                });
            }
        });

        // 3. Fallback: If still nothing, Cinezo is using an encrypted "Source ID"
        if (streams.length === 0) {
            console.error(`[${PROVIDER_NAME}] No links found. Site is likely using dynamic JS encryption.`);
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
