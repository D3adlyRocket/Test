"use strict";

const DOMAIN = "https://uhdmovies.in"; // Switched to the more stable .in domain for 2026
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        // 1. Get Title from TMDB (Critical for search accuracy)
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=1865f43a0549ca50d341dd9ab8b29f49`;
        const tmdbRes = await fetch(tmdbUrl);
        const tmdbData = await tmdbRes.json();
        const title = tmdbData.name || tmdbData.title;

        // 2. Search UHDMovies using "Direct Headers"
        const searchUrl = `${DOMAIN}/?s=${encodeURIComponent(title)}`;
        const searchRes = await fetch(searchUrl, {
            headers: { "User-Agent": USER_AGENT, "Referer": DOMAIN }
        });
        const searchHtml = await searchRes.text();

        // 3. Find the Article (Uses a broader regex to catch updated class names)
        const articleMatch = searchHtml.match(/<h1[^>]*class="[^"]*sanket[^"]*"[^>]*><a\s+href="([^"]+)"/i) || 
                           searchHtml.match(/<h1[^>]*class="entry-title"[^>]*><a\s+href="([^"]+)"/i);
        if (!articleMatch) return [];

        const postUrl = articleMatch[1];
        const postRes = await fetch(postUrl, {
            headers: { "User-Agent": USER_AGENT, "Referer": searchUrl }
        });
        const postHtml = await postRes.text();

        // 4. THE FIX: Link Pattern Hunting
        // Instead of searching for buttons, we scan for the raw redirector URLs
        const streams = [];
        const pattern = /(https?:\/\/(?:unblockedgames|driveseed|driveleech|hubcloud|linkstaker)[^\s"'<>]+)/gi;
        const matches = postHtml.match(pattern) || [];
        const uniqueLinks = [...new Set(matches)];

        uniqueLinks.forEach(link => {
            let label = "Direct Stream";
            if (link.includes("2160p")) label = "4K UHD Link";
            else if (link.includes("1080p")) label = "1080p HD Link";
            else if (link.includes("720p")) label = "720p Link";

            // For TV shows, we filter to ensure the link matches the requested episode
            if (mediaType === "tv") {
                const epTag = `E${episode.toString().padStart(2, '0')}`;
                if (!postHtml.toLowerCase().includes(epTag.toLowerCase())) {
                    // Skip if the page doesn't seem to contain this episode
                    return;
                }
            }

            streams.push({
                name: "UHDMovies",
                title: label,
                url: link,
                quality: label.split(' ')[0]
            });
        });

        return streams;

    } catch (e) {
        console.error("UHD Scraper Failed:", e);
        return [];
    }
}

// Global Export
if (typeof module !== "undefined") module.exports = { getStreams };
else global.getStreams = getStreams;
