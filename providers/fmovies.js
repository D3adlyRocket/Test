"use strict";

const DOMAIN = "https://uhdmovies.rip"; // Current active domain
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Enhanced Fetch with spoofed headers to bypass basic bot detection
 */
async function smartFetch(url, referer = DOMAIN) {
    const headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": referer,
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin"
    };
    try {
        const response = await fetch(url, { headers });
        return await response.text();
    } catch (e) {
        console.error(`[UHD] Fetch error for ${url}:`, e.message);
        return null;
    }
}

/**
 * Updated Article Extraction
 * The site now uses specific CSS classes for the "sanket" title area
 */
function extractArticles(html) {
    const results = [];
    const regex = /<h1[^>]*class="[^"]*sanket[^"]*"[^>]*><a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
        results.push({
            url: match[1],
            title: match[2].replace(/<[^>]+>/g, "").trim()
        });
    }
    return results;
}

/**
 * Main stream getter
 */
async function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[UHD] Initializing search for ID: ${tmdbId}`);
    
    // 1. Resolve Title (Mocked for brevity, use your TMDB logic here)
    const query = "Deadpool 2024"; // Example query
    const searchUrl = `${DOMAIN}/?s=${encodeURIComponent(query)}`;
    
    const searchHtml = await smartFetch(searchUrl);
    if (!searchHtml) return [];

    const articles = extractArticles(searchHtml);
    if (articles.length === 0) {
        console.log("[UHD] No articles found. Domain might have changed structure.");
        return [];
    }

    // 2. Pick the first article and look for download buttons
    const postHtml = await smartFetch(articles[0].url);
    if (!postHtml) return [];

    // Look for button links (maxbutton-1 is the current standard)
    const streamLinks = [];
    const btnRegex = /href="(https?:\/\/(?:unblockedgames|driveseed|driveleech)[^"]+)"/gi;
    let btnMatch;
    while ((btnMatch = btnRegex.exec(postHtml)) !== null) {
        streamLinks.push({
            name: "UHDMovies",
            url: btnMatch[1],
            title: articles[0].title,
            quality: "HD/4K (Check Hub)"
        });
    }

    console.log(`[UHD] Found ${streamLinks.length} potential hub links.`);
    return streamLinks;
}

// Global exposure
if (typeof module !== "undefined") module.exports = { getStreams };
else window.getStreams = getStreams;
