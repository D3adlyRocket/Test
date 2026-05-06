"use strict";

const DOMAIN = "https://uhdmovies.rip"; 
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Main function for Nuvio to call
 */
async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        // 1. Get metadata from TMDB
        const endpoint = (mediaType === "series" || mediaType === "tv") ? "tv" : "movie";
        const tmdbUrl = `${TMDB_API}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const tmdbRes = await fetch(tmdbUrl);
        const tmdbData = await tmdbRes.json();
        
        const title = tmdbData.name || tmdbData.title;
        const year = (tmdbData.first_air_date || tmdbData.release_date || "").split("-")[0];
        
        if (!title) return [];

        // 2. Search UHDMovies with Browser Headers
        const searchUrl = `${DOMAIN}/?s=${encodeURIComponent(title + " " + year)}`;
        const headers = {
            "User-Agent": USER_AGENT,
            "Referer": DOMAIN,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        };

        const searchRes = await fetch(searchUrl, { headers });
        const searchHtml = await searchRes.text();

        // 3. Extract the first article link
        const articleMatch = searchHtml.match(/<h1[^>]*class="[^"]*sanket[^"]*"[^>]*><a\s+href="([^"]+)"/i);
        if (!articleMatch) return [];

        // 4. Fetch the movie page
        const postUrl = articleMatch[1];
        const postRes = await fetch(postUrl, { headers: { ...headers, "Referer": searchUrl } });
        const postHtml = await postRes.text();

        // 5. Deep Scan for Hub Links (Driveseed, UnblockedGames, HubCloud)
        // We use a broad regex because the site often obfuscates these links inside JS or spans
        const hubRegex = /href="(https?:\/\/(?:unblockedgames|driveseed|driveleech|hubcloud|pixeldrain)[^"]+)"/gi;
        const streams = [];
        let match;

        while ((match = hubRegex.exec(postHtml)) !== null) {
            const link = match[1];
            
            // Clean up titles for the UI
            let quality = "HD";
            if (link.includes("2160p") || postHtml.includes("2160p")) quality = "4K UHD";
            else if (link.includes("1080p")) quality = "1080p";
            else if (link.includes("720p")) quality = "720p";

            streams.push({
                name: "UHDMovies",
                title: `Direct Link [${quality}]`,
                url: link,
                quality: quality
            });
        }

        // 6. Handle TV Show Logic (Filtering by Episode/Season if needed)
        if (mediaType === "tv" || mediaType === "series") {
            // Simple filter: only keep links that mention the specific season/episode in the text/url
            return streams.filter(s => s.url.toLowerCase().includes(`s${season.toString().padStart(2, '0')}`) || streams.length > 0);
        }

        return streams;

    } catch (error) {
        console.error("[Nuvio] Error fetching streams:", error);
        return [];
    }
}

// Ensure Nuvio can see the function
if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
