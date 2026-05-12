/**
 * Nuvio Provider for Netvlyx
 * Resolves dynamic Odyssey.surf links with tokens
 */

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const proxy = "https://4-grass-8071.hdbdhdh825.workers.dev/";
        
        // Step 1: Format the slug for the API
        // For TV shows, often formatted as 'tmdb-1-1', for movies just 'tmdb'
        const slug = (mediaType === 'tv') ? `${tmdbId}-${season}-${episode}` : tmdbId;
        
        const apiUrl = `https://netvlyx.pages.dev/api/resolve-link?slug=${slug}`;

        // Step 2: Fetch via your Cloudflare worker to get the fresh tokenized URL
        const response = await fetch(proxy + apiUrl, {
            headers: {
                'Referer': 'https://netvlyx.pages.dev/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = await response.json();

        // Step 3: Extract the Odyssey URL (which should include the fresh ?token=)
        if (data && data.url) {
            return [{
                name: "Netvlyx (Odyssey)",
                title: data.title || "Video Stream",
                url: data.url, // This is the https://hub.odyssey.surf/...?token=... link
                quality: "1080p",
                headers: {
                    "Referer": "https://hub.odyssey.surf/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            }];
        }

        return [];
    } catch (error) {
        console.error('[Nuvio-Netvlyx] Stream resolution failed:', error.message);
        return [];
    }
}

module.exports = { getStreams };
