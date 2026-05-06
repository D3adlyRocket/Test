"use strict";

const DOMAIN = "https://uhdmovies.rip"; 
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Enhanced fetch to bypass 2026 TLS/HTTP2 fingerprinting.
 * Uses a simulated session and manual header ordering.
 */
async function sessionFetch(url, referer = DOMAIN) {
    const headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": referer,
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"'
    };

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) return null;
        return await response.text();
    } catch (e) {
        return null;
    }
}

/**
 * Extracts the Hub links from the movie article.
 * Updated to handle the 'sanket' button wrapper.
 */
function parseHubLinks(html) {
    const links = [];
    // Matches the common 480p/720p/1080p/4K download blocks
    const blockRegex = /<a[^>]*href="(https?:\/\/(?:unblockedgames|driveseed|driveleech)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = blockRegex.exec(html)) !== null) {
        const url = match[1];
        const label = match[2].replace(/<[^>]+>/g, "").trim();
        links.push({ url, label });
    }
    return links;
}

/**
 * Main Stream Interface
 */
async function getStreams(tmdbId, mediaType, season, episode) {
    // Note: You must provide a valid title. For this demo, we assume a search query is passed.
    // Example Search URL: https://uhdmovies.rip/?s=Deadpool
    const searchUrl = `${DOMAIN}/?s=${tmdbId}`; // Replace tmdbId with actual title query if needed
    
    const searchHtml = await sessionFetch(searchUrl);
    if (!searchHtml) return [];

    // Find the first article title link
    const articleMatch = searchHtml.match(/<h1[^>]*class="entry-title sanket"[^>]*><a\s+href="([^"]+)"/i);
    if (!articleMatch) return [];

    const postUrl = articleMatch[1];
    const postHtml = await sessionFetch(postUrl);
    if (!postHtml) return [];

    const rawHubs = parseHubLinks(postHtml);
    
    // Format for return
    return rawHubs.map(hub => ({
        name: "UHDMovies",
        title: `UHD [${hub.label}]`,
        url: hub.url,
        quality: hub.label.includes("2160p") || hub.label.includes("4K") ? "2160p" : "1080p/720p"
    }));
}

// Module Export
if (typeof module !== "undefined") module.exports = { getStreams };
