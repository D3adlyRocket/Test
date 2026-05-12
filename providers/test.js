/**
 * Nuvio Provider for Netvlyx
 * Proxied via Cloudflare Worker: 4-grass-8071.hdbdhdh825.workers.dev
 */

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const proxyBase = "https://4-grass-8071.hdbdhdh825.workers.dev";
        const targetApi = `https://netvlyx.pages.dev/api/resolve-link?slug=${tmdbId}`;
        
        // Construct the full proxied URL
        // Usually, worker proxies expect the target as a query param or suffix
        const proxiedUrl = `${proxyBase}/${targetApi}`;

        const response = await fetch(proxiedUrl, {
            headers: {
                'User-Agent': 'Nuvio-App/1.0',
                'Origin': 'https://netvlyx.pages.dev'
            }
        });

        if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
        
        const data = await response.json();

        // Check if the API returned valid video data
        if (data && data.url) {
            return [{
                name: "Netvlyx (Cloudflare)",
                title: data.title || `${mediaType.toUpperCase()} - ${tmdbId}`,
                url: data.url,
                quality: "1080p", // Defaulting to 1080p if not specified
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Referer": "https://netvlyx.pages.dev/"
                }
            }];
        }

        return [];
    } catch (error) {
        console.error('[Netvlyx-Proxy] Error:', error.message);
        return [];
    }
}

module.exports = { getStreams };
