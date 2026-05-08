var PROVIDER_NAME = 'Cinezo-Advanced';
var BASE_URL = 'https://cinezo.net';

async function getStreams(tmdbId, mediaType, season, episode) {
    const targetUrl = (mediaType === 'movie') 
        ? `${BASE_URL}/watch/movie/${tmdbId}` 
        : `${BASE_URL}/watch/tv/${tmdbId}/${season}/${episode}`;

    try {
        console.log(`[${PROVIDER_NAME}] Target: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://google.com'
            }
        });
        const html = await response.text();

        // 1. Find the Player Iframe
        const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/);
        if (!iframeMatch) {
            console.error(`[${PROVIDER_NAME}] No iframe found on Cinezo page.`);
            return [];
        }

        let playerUrl = iframeMatch[1];
        if (playerUrl.startsWith('//')) playerUrl = 'https:' + playerUrl;
        console.log(`[${PROVIDER_NAME}] Found Player: ${playerUrl}`);

        // 2. Fetch the Player page to get the worker link
        const playerRes = await fetch(playerUrl, {
            headers: { 'Referer': BASE_URL }
        });
        const playerHtml = await playerRes.text();

        const streams = [];
        
        // 3. Extract the Worker Proxy Link (.m3u8)
        // This regex looks specifically for the pattern you provided
        const m3u8Regex = /https?:\/\/[^\s"'`]+\.workers\.dev\/[^\s"'`]+\.m3u8[^\s"'`]*/g;
        const matches = playerHtml.match(m3u8Regex) || [];

        matches.forEach((link) => {
            const cleanUrl = link.replace(/\\/g, '');
            if (!streams.find(s => s.url === cleanUrl)) {
                streams.push({
                    name: 'Cinezo (Proxy)',
                    title: 'Multi-Quality (HLS)',
                    url: cleanUrl,
                    quality: 'Auto',
                    // These headers are MANDATORY for the worker to return the video
                    headers: {
                        'Referer': 'https://111movies.net/',
                        'Origin': 'https://111movies.net',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
            }
        });

        console.log(`[${PROVIDER_NAME}] Found ${streams.length} stream(s)`);
        return streams;

    } catch (e) {
        console.error(`[${PROVIDER_NAME}] Fatal Error: ${e.message}`);
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
