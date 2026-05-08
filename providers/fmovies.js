var PROVIDER_NAME = 'Cinezo-Direct';
var BASE_URL = 'https://cinezo.net';

async function getStreams(tmdbId, mediaType, season, episode) {
    const targetUrl = (mediaType === 'movie') 
        ? `${BASE_URL}/watch/movie/${tmdbId}` 
        : `${BASE_URL}/watch/tv/${tmdbId}/${season}/${episode}`;

    try {
        console.log(`[${PROVIDER_NAME}] Searching: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await response.text();

        const streams = [];

        /**
         * STRATEGY: Look for the Spencer Proxy or Videasy patterns.
         * The URL you found contains: proxy.spencerdevs.xyz
         * It also mentions: player.videasy.net
         */
        
        // Regex to find the encoded proxy URL
        const proxyRegex = /https?:\/\/proxy\.spencerdevs\.xyz\/proxy\?url=[^"']+/g;
        const matches = html.match(proxyRegex) || [];

        // If no matches in main HTML, look for the iframe and fetch it
        if (matches.length === 0) {
            const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/);
            if (iframeMatch) {
                let playerUrl = iframeMatch[1];
                if (playerUrl.startsWith('//')) playerUrl = 'https:' + playerUrl;
                
                console.log(`[${PROVIDER_NAME}] Digging into iframe: ${playerUrl}`);
                const playerRes = await fetch(playerUrl, { headers: { 'Referer': BASE_URL } });
                const playerHtml = await playerRes.text();
                
                const subMatches = playerHtml.match(proxyRegex) || [];
                subMatches.forEach(m => matches.push(m));
            }
        }

        matches.forEach((rawUrl) => {
            // Unescape the URL (converts %3A to :, %2F to /, etc.)
            const decodedUrl = decodeURIComponent(rawUrl.replace(/\\/g, ''));
            
            if (!streams.find(s => s.url === decodedUrl)) {
                streams.push({
                    name: 'Cinezo (Premium)',
                    title: 'Server Spencer (Multi-Res)',
                    url: decodedUrl,
                    quality: 'Auto',
                    headers: {
                        'Referer': 'https://player.videasy.net/',
                        'Origin': 'https://player.videasy.net',
                        'User-Agent': 'Mozilla/5.0'
                    }
                });
            }
        });

        // Fallback: If we still have nothing, search for the 'easy.speedsterwave' part
        if (streams.length === 0) {
            const fallbackRegex = /https?:\/\/easy\.speedsterwave\.app\/[^"']+/g;
            const fallbackMatches = html.match(fallbackRegex) || [];
            fallbackMatches.forEach(m => {
                streams.push({
                    name: 'Cinezo (Backup)',
                    title: 'Speedster Mirror',
                    url: m.replace(/\\/g, ''),
                    quality: 'Auto',
                    headers: { 'Referer': 'https://player.videasy.net/' }
                });
            });
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
