/**
 * FlixIndia Provider for Nuvio
 * Updated: 2026-04-20
 * Status: Experimental (Cloudflare Bypass Attempt)
 */

const BASE_URL = "https://m.flixindia.xyz";
const TMDB_API_KEY = "919605fd567bbffcf76492a03eb4d527";

/**
 * Enhanced fetch to mimic a real mobile browser
 */
async function stealthFetch(url) {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://www.google.com/',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Upgrade-Insecure-Requests': '1'
        }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
}

/**
 * Main Nuvio Entry Point
 */
async function getStreams(tmdbId, mediaType, season, episode) {
    const results = [];
    
    try {
        // 1. Resolve Title from TMDB
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const tmdbData = await fetch(tmdbUrl).then(res => res.json());
        const title = mediaType === "movie" ? tmdbData.title : tmdbData.name;
        
        if (!title) return [];

        // 2. Search using GET (less protected than POST search)
        // Clean title for search (remove special chars)
        const cleanTitle = title.replace(/[^a-zA-Z0-9 ]/g, '');
        let searchQuery = encodeURIComponent(cleanTitle);
        
        if (mediaType === "tv") {
            searchQuery += `%20S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
        }

        const searchUrl = `${BASE_URL}/?s=${searchQuery}`;
        const searchHtml = await stealthFetch(searchUrl);

        // 3. Extract Post Links using Regex
        // Matches pattern: https://m.flixindia.xyz/post/slug-name
        const postRegex = /href="(https:\/\/m\.flixindia\.xyz\/post\/[^"]+)"/g;
        let match;
        const posts = [];
        while ((match = postRegex.exec(searchHtml)) !== null) {
            if (!posts.includes(match[1])) posts.push(match[1]);
        }

        // 4. Scrape the Movie/Episode Page for Video Links
        for (const postUrl of posts.slice(0, 2)) {
            try {
                const pageHtml = await stealthFetch(postUrl);

                // Look for the domains you identified earlier
                const streamRegex = /href="(https:\/\/[^"]+\.(?:pages\.dev|gdflix\.net|hubcloud\.club|gdlink\.net)[^"]+)"/g;
                let streamMatch;

                while ((streamMatch = streamRegex.exec(pageHtml)) !== null) {
                    let finalUrl = streamMatch[1];

                    // Handle the pages.dev proxy redirect
                    if (finalUrl.includes("pages.dev") && finalUrl.includes("?url=")) {
                        const urlObj = new URL(finalUrl);
                        const extracted = urlObj.searchParams.get("url");
                        if (extracted) finalUrl = extracted;
                    }

                    results.push({
                        name: "FlixIndia",
                        title: `${title} [${finalUrl.includes('googleusercontent') ? 'Fast' : 'Cloud'}]`,
                        url: finalUrl,
                        quality: "HD",
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                }
            } catch (e) {
                continue; 
            }
        }

        // 5. Deduplicate and Return
        return results.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);

    } catch (error) {
        console.error("FlixIndia Provider Error:", error.message);
        return [];
    }
}

// Ensure the module export is present for Nuvio
module.exports = { getStreams };
