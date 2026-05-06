"use strict";

const DOMAIN = "https://uhdmovies.rip"; 
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function deepFetch(url, referer = DOMAIN) {
    const headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Referer": referer,
        "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124"',
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin"
    };

    try {
        const res = await fetch(url, { headers });
        const text = await res.text();
        if (text.includes("Just a moment")) {
            console.error("[UHD] Blocked by Cloudflare Turnstile.");
            return null;
        }
        return text;
    } catch (e) {
        return null;
    }
}

async function getStreams(tmdbId, mediaType) {
    // 1. Search (using ID as title for this example)
    const searchUrl = `${DOMAIN}/?s=${encodeURIComponent(tmdbId)}`;
    const searchHtml = await deepFetch(searchUrl);
    if (!searchHtml) return [];

    // 2. Extract First Post Link (Now uses a more robust search)
    const postMatch = searchHtml.match(/<h1[^>]*><a\s+href="([^"]+)"/i);
    if (!postMatch) return [];

    const postUrl = postMatch[1];
    const postHtml = await deepFetch(postUrl);
    if (!postHtml) return [];

    // 3. Extract Hubs (Scans for unblockedgames and driveseed links)
    const hubs = [];
    const hubRegex = /href="(https?:\/\/(?:unblockedgames|driveseed|driveleech|hubcloud)[^"]+)"/gi;
    let match;
    
    while ((match = hubRegex.exec(postHtml)) !== null) {
        hubs.push({
            name: "UHDMovies",
            url: match[1],
            title: "Download Link",
            quality: "Multi-Quality"
        });
    }

    // 4. Fallback - Scan for hidden script-based links
    if (hubs.length === 0) {
        const scriptLinks = postHtml.match(/https?:\/\/[^\s"'<>]+(?:unblocked|driveseed)[^\s"'<>]*/gi);
        if (scriptLinks) {
            scriptLinks.forEach(link => {
                hubs.push({ name: "UHDMovies", url: link, title: "Hidden Link Found", quality: "Unknown" });
            });
        }
    }

    return hubs;
}

if (typeof module !== "undefined") module.exports = { getStreams };
