/**
 * FlixIndia Provider for Nuvio
 * Fully self-contained with getStreams export
 */

const BASE_URL = "https://m.flixindia.xyz/";
const TMDB_API_KEY = "919605fd567bbffcf76492a03eb4d527";

// Helper to handle the "Instant" proxy links you found
function resolveInstant(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get("url");
    } catch (e) {
        return null;
    }
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const results = [];
    try {
        // 1. Get Title from TMDB
        const tmdbResp = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const tmdbData = await tmdbResp.json();
        const title = mediaType === "movie" ? tmdbData.title : tmdbData.name;
        
        if (!title) return [];

        // 2. Format Query for Nuvio
        let searchPath = `${BASE_URL}?s=${encodeURIComponent(title)}`;
        if (mediaType === "tv") {
            searchPath += `+S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
        }

        // 3. Fetch Search Page
        const response = await fetch(searchPath);
        const html = await response.text();

        // 4. Extract Post Links (Simple regex for Nuvio/Hermes compatibility)
        const postRegex = /href="(https:\/\/m\.flixindia\.xyz\/post\/[^"]+)"/g;
        let match;
        const postUrls = [];
        while ((match = postRegex.exec(html)) !== null) {
            if (!postUrls.includes(match[1])) postUrls.push(match[1]);
        }

        // 5. Scrape found posts for Stream Links (FastCloud/GDFlix/Pages.dev)
        for (const postUrl of postUrls.slice(0, 3)) {
            const postRes = await fetch(postUrl);
            const postHtml = await postRes.text();

            // Look for the specific patterns you shared
            const linkRegex = /href="(https:\/\/[^"]+\.(?:pages\.dev|gdflix\.net|gdlink\.net)[^"]+)"/g;
            let linkMatch;
            
            while ((linkMatch = linkRegex.exec(postHtml)) !== null) {
                let streamUrl = linkMatch[1];
                
                // If it's the pages.dev link, extract the direct URL immediately
                if (streamUrl.includes("pages.dev")) {
                    const direct = resolveInstant(streamUrl);
                    if (direct) streamUrl = direct;
                }

                results.push({
                    name: "FlixIndia",
                    title: `${title} - ${streamUrl.includes('googleusercontent') ? 'Direct' : 'Cloud'}`,
                    url: streamUrl,
                    quality: "HD"
                });
            }
        }

        return results;

    } catch (error) {
        console.error("FlixIndia Error: ", error);
        return [];
    }
}

// CRITICAL FOR NUVIO: Export the function
module.exports = { getStreams };
