"use strict";

var DOMAIN = "https://uhdmovies.pink"; // Update this to .pink or .rip as needed
var TMDB_API = "https://api.themoviedb.org/3";
var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// --- Utility Functions ---

function getBaseUrl(url) {
    if (!url) return DOMAIN;
    var match = url.match(/^(https?:\/\/[^\/]+)/);
    return match ? match[1] : DOMAIN;
}

function fixUrl(url, domain) {
    if (!url) return "";
    if (url.indexOf("http") === 0) return url;
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url.indexOf("/") === 0) return domain + url;
    return domain + "/" + url;
}

function toFormEncoded(obj) {
    return Object.keys(obj).map(function(k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(obj[k] || "");
    }).join("&");
}

function stripTags(html) {
    return (html || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
}

// Improved Input Extraction to handle hidden tokens
function extractFormInputs(html) {
    var obj = {};
    var re = /<input[^>]+(?:name|id)="([^"]+)"[^>]*(?:value="([^"]*)")?[^>]*>/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
        var key = m[1];
        var val = m[2] || "";
        obj[key] = val;
    }
    return obj;
}

// --- Extraction Logic ---

async function bypassHrefli(url) {
    console.log("[UHDMovies] Bypassing: " + url);
    try {
        let response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        let html = await response.text();
        
        let formAction = html.match(/<form[^>]*action="([^"]+)"/i)?.[1];
        let inputs = extractFormInputs(html);

        if (!formAction) return null;

        // First POST to landing
        let postRes = await fetch(formAction, {
            method: "POST",
            headers: { 
                "User-Agent": USER_AGENT, 
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": url 
            },
            body: toFormEncoded(inputs)
        });

        let postHtml = await postRes.text();
        
        // Look for the "Generate Link" or "Go" script
        let skToken = postHtml.match(/\?go=([a-zA-Z0-9]+)/)?.[1];
        if (!skToken) {
            // Fallback: Check for meta refresh
            let refresh = postHtml.match(/content="\d+;url=([^"]+)"/i)?.[1];
            if (refresh) return refresh;
            return null;
        }

        let finalRedirectUrl = getBaseUrl(url) + "/?go=" + skToken;
        let finalRes = await fetch(finalRedirectUrl, { 
            headers: { "User-Agent": USER_AGENT, "Referer": formAction } 
        });
        
        return finalRes.url;
    } catch (e) {
        console.error("[UHDMovies] Bypass failed: ", e);
        return null;
    }
}

async function extractDriveseedPage(url) {
    console.log("[UHDMovies] Driveseed: " + url);
    try {
        let res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        let html = await res.text();
        
        let streams = [];
        let fileName = stripTags(html.match(/<li[^>]*class="list-group-item"[^>]*>Name : (.*?)<\/li>/i)?.[1] || "Unknown");
        let size = stripTags(html.match(/<li[^>]*class="list-group-item"[^>]*>Size : (.*?)<\/li>/i)?.[1] || "");
        
        // Search for specific action buttons
        let links = [];
        let linkMatches = html.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi);
        for (const match of linkMatches) {
            links.push({ href: match[1], text: stripTags(match[2]).toLowerCase() });
        }

        for (let link of links) {
            if (link.text.includes("instant") || link.text.includes("direct")) {
                let absoluteUrl = fixUrl(link.href, getBaseUrl(url));
                streams.push({
                    name: "UHDMovies",
                    title: `Direct [${size}] ${fileName}`,
                    url: absoluteUrl,
                    quality: "Direct"
                });
            }
        }
        return streams;
    } catch (e) {
        return [];
    }
}

// --- Main Stream Provider ---

async function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[UHDMovies] Searching for ${mediaType} ${tmdbId}`);
    
    // 1. Get Title from TMDB
    let endpoint = (mediaType === "series" || mediaType === "tv") ? "tv" : "movie";
    let tmdbRes = await fetch(`${TMDB_API}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`);
    let tmdbData = await tmdbRes.json();
    let title = tmdbData.name || tmdbData.title;
    let year = (tmdbData.first_air_date || tmdbData.release_date || "").split("-")[0];

    // 2. Search UHDMovies
    let searchUrl = `${DOMAIN}/?s=${encodeURIComponent(title + " " + year)}`;
    let searchRes = await fetch(searchUrl, { headers: { "User-Agent": USER_AGENT } });
    let searchHtml = await searchRes.text();
    
    // Parse results (Looking for the post links)
    let results = [];
    let articleRegex = /<h1 class="entry-title sanket"><a href="([^"]+)">([^<]+)<\/a>/gi;
    let match;
    while ((match = articleRegex.exec(searchHtml)) !== null) {
        results.push({ url: match[1], title: match[2] });
    }

    if (results.length === 0) return [];

    // 3. Process the first relevant result
    let pageRes = await fetch(results[0].url, { headers: { "User-Agent": USER_AGENT } });
    let pageHtml = await pageRes.text();

    // 4. Extract Hub Links (unblockedgames/driveseed)
    let hubLinks = [];
    let hubRegex = /href="(https?:\/\/(?:unblockedgames|driveseed|driveleech)[^"]+)"/gi;
    while ((match = hubRegex.exec(pageHtml)) !== null) {
        hubLinks.push(match[1]);
    }

    // 5. Bypass and get final streams
    let allStreams = [];
    for (let link of hubLinks.slice(0, 5)) { // Limit to top 5 links for speed
        let bypassed = await bypassHrefli(link);
        if (bypassed && bypassed.includes("driveseed")) {
            let finalLinks = await extractDriveseedPage(bypassed);
            allStreams = allStreams.concat(finalLinks);
        }
    }

    return allStreams;
}

// Export for use
if (typeof module !== "undefined") {
    module.exports = { getStreams };
}
