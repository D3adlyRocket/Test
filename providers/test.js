/**
 * Nuvio Provider for Netvlyx
 * This script resolves video streams from the Netvlyx API.
 */

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[Netvlyx] Fetching streams for ${mediaType} (ID: ${tmdbId})`);

        // 1. Logic to determine your Netvlyx slug based on tmdbId
        // This is a placeholder; you may need to fetch the slug from your site first
        const slug = tmdbId; 

        // 2. Call the Netvlyx resolve-link API found in the GitHub source
        const apiUrl = `https://netvlyx.pages.dev/api/resolve-link?slug=${slug}`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Failed to fetch from Netvlyx API');
        
        const data = await response.json();

        // 3. Format the response for Nuvio
        // Nuvio expects an array of objects: { name, title, url, quality }
        if (data && data.url) {
            return [{
                name: "Netvlyx",
                title: data.title || "Direct Link",
                url: data.url,
                quality: data.quality || "HD"
            }];
        }

        return [];
    } catch (error) {
        console.error('[Netvlyx] Error:', error.message);
        return [];
    }
}

// Nuvio requires the getStreams function to be exported at the bottom
module.exports = { getStreams };
