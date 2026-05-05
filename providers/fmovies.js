"use strict";

/**
 * MoviesMod Provider for Nuvio App
 * Optimized with robust form bypass and stream scoring
 */

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const FALLBACK_DOMAIN = "https://moviesmod.farm";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// --- Utilities ---

function fetchText(url, options = {}) {
    const headers = Object.assign({ "User-Agent": USER_AGENT }, options.headers || {});
    return fetch(url, { ...options, headers }).then(res => res.text());
}

function toFormEncoded(obj) {
    return Object.keys(obj).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(obj[k] || "")).join("&");
}

function extractFormInputs(html) {
    const obj = {};
    const re = /<input[^>]+>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const nameM = m[0].match(/name="([^"]+)"/i);
        const valueM = m[0].match(/value="([^"]*)"/i);
        if (nameM) obj[nameM[1]] = valueM ? valueM[1] : "";
    }
    return obj;
}

function extractQuality(text) {
    const m = text.match(/(\d{3,4})[pP]/);
    if (m) return m[1] + "p";
    if (/\b4[kK]\b/i.test(text)) return "2160p";
    return "720p";
}

// --- Scraper Logic ---

async function getLatestDomain() {
    try {
        const res = await fetch("https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json");
        const data = await res.json();
        return data.moviesmod || FALLBACK_DOMAIN;
    } catch (e) {
        return FALLBACK_DOMAIN;
    }
}

async function bypassStep(url, referer) {
    try {
        let html = await fetchText(url, { headers: { "Referer": referer } });
        
        // Step 1: Initial Form Submit
        let inputs = extractFormInputs(html);
        let action = html.match(/<form[^>]*action="([^"]+)"/i)?.[1] || url;
        
        if (inputs["_wp_http"]) {
            html = await fetch(action, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded", "Referer": url, "User-Agent": USER_AGENT },
                body: toFormEncoded(inputs)
            }).then(res => res.text());
        }

        // Step 2: Verification / Token Step
        inputs = extractFormInputs(html);
        action = html.match(/<form[^>]*action="([^"]+)"/i)?.[1] || action;
        
        if (inputs["token"] || inputs["_wp_http2"]) {
            html = await fetch(action, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded", "Referer": action, "User-Agent": USER_AGENT },
                body: toFormEncoded(inputs)
            }).then(res => res.text());
        }

        // Extract final redirect (Meta refresh or JS)
        const meta = html.match(/url=(https?:\/\/[^"]+)/i)?.[1];
        if (meta) return meta;

        const jsRedir = html.match(/replace\("([^"]+)"\)/)?.[1];
        if (jsRedir) return jsRedir.startsWith("http") ? jsRedir : new URL(jsRedir, url).href;

        return null;
    } catch (e) {
        return null;
    }
}

async function resolveDriveseed(url) {
    try {
        const html = await fetchText(url);
        const streams = [];
        
        // Extract Size and Name
        const size = html.match(/Size\s*:\s*([^<]+)/i)?.[1]?.trim() || "";
        const quality = extractQuality(html);

        // Find standard Driveseed buttons
        const linkMatches = html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
        for (const match of linkMatches) {
            const href = match[1];
            const text = match[2].toLowerCase();
            
            let finalUrl = null;
            if (text.includes("instant") || text.includes("direct")) {
                finalUrl = href; // Often needs further API call, but Nuvio handles some redirects
            } else if (text.includes("resume cloud")) {
                finalUrl = href.startsWith("http") ? href : new URL(href, url).href;
            }

            if (finalUrl && finalUrl.includes("http")) {
                streams.push({
                    name: "MoviesMod",
                    title: `[Direct] ${size}`,
                    url: finalUrl,
                    quality: quality,
                    headers: { "Referer": url, "User-Agent": USER_AGENT }
                });
            }
        }
        return streams;
    } catch (e) {
        return [];
    }
}

// --- Main Source Object ---

const source = {
    name: "MoviesMod",

    getStreams: async function(input) {
        const { tmdbId, type, season, episode } = input;
        const isTv = type === "tv" || type === "series";
        const domain = await getLatestDomain();
        
        // 1. Get TMDB Details
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const tmdbData = await tmdbRes.json();
        const title = isTv ? tmdbData.name : tmdbData.title;
        const year = (isTv ? tmdbData.first_air_date : tmdbData.release_date)?.split("-")[0];

        // 2. Search MoviesMod
        const searchQuery = encodeURIComponent(`${title} ${isTv ? 'Season ' + season : year}`);
        const searchHtml = await fetchText(`${domain}/?s=${searchQuery}`);
        
        // Parse search results
        const results = [];
        const resultMatches = searchHtml.matchAll(/<h1[^>]*><a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi);
        for (const match of resultMatches) {
            results.push({ url: match[1], title: match[2] });
        }

        if (results.length === 0) return [];

        // 3. Process the best result
        const pageHtml = await fetchText(results[0].url);
        const allStreams = [];

        // Find download buttons (maxbutton-download-links)
        const downloadPageLinks = [...pageHtml.matchAll(/href="([^"]+modpro\.blog[^"]+)"/gi)].map(m => m[1]);

        for (const link of downloadPageLinks) {
            // Bypass the intermediate "modpro" or "unblockedgames" page
            const driveseedUrl = await bypassStep(link, results[0].url);
            
            if (driveseedUrl && driveseedUrl.includes("driveseed")) {
                const driveseedStreams = await resolveDriveseed(driveseedUrl);
                allStreams.push(...driveseedStreams);
            }
        }

        // 4. Scoring and Sorting
        return allStreams.sort((a, b) => {
            const qA = parseInt(a.quality) || 0;
            const qB = parseInt(b.quality) || 0;
            return qB - qA;
        });
    }
};

// Export for Nuvio
if (typeof module !== "undefined" && module.exports) {
    module.exports = source;
} else {
    global.source = source;
}
