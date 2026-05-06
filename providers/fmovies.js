"use strict";

const DOMAIN = "https://uhdmovies.rip";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function makeRequest(url, options = {}) {
    const defaultHeaders = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Upgrade-Insecure-Requests": "1"
    };
    return fetch(url, { ...options, headers: { ...defaultHeaders, ...options.headers } });
}

// --- EXACT BYPASS LOGIC FROM MOVIESMOD ---

async function resolveSidBypass(sidUrl) {
    try {
        // Step 1: Initial Landing
        const res1 = await makeRequest(sidUrl);
        const html1 = await res1.text();
        
        const wp_http_step1 = html1.match(/name="_wp_http"\s+value="([^"]+)"/)?.[1];
        const action_url_step1 = html1.match(/id="landing"\s+action="([^"]+)"/)?.[1];
        if (!wp_http_step1 || !action_url_step1) return null;

        // Step 2: Verification Form
        const res2 = await makeRequest(action_url_step1, {
            method: "POST",
            headers: { "Referer": sidUrl, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ "_wp_http": wp_http_step1 }).toString()
        });
        const html2 = await res2.text();
        
        const action_url_step2 = html2.match(/id="landing"\s+action="([^"]+)"/)?.[1];
        const wp_http2 = html2.match(/name="_wp_http2"\s+value="([^"]+)"/)?.[1];
        const token = html2.match(/name="token"\s+value="([^"]+)"/)?.[1];
        if (!action_url_step2) return null;

        // Step 3: Extract Dynamic Cookie & Final Link
        const res3 = await makeRequest(action_url_step2, {
            method: "POST",
            headers: { "Referer": res2.url, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ "_wp_http2": wp_http2 || "", "token": token || "" }).toString()
        });
        const html3 = await res3.text();
        
        // This is the "MoviesMod Secret": Extracting the JS-generated cookie
        const cookieMatch = html3.match(/s_343\('([^']+)',\s*'([^']+)'/);
        const linkMatch = html3.match(/c\.setAttribute\("href",\s*"([^"]+)"\)/);
        if (!cookieMatch || !linkMatch) return null;

        const { origin } = new URL(sidUrl);
        const finalUrl = new URL(linkMatch[1], origin).href;

        // Step 4: Final Hop with Cookie
        const res4 = await makeRequest(finalUrl, {
            headers: { "Referer": res3.url, "Cookie": `${cookieMatch[1]}=${cookieMatch[2]}` }
        });
        const html4 = await res4.text();
        
        // Extract Meta Refresh
        const refreshMatch = html4.match(/url=(.*)/i);
        return refreshMatch ? refreshMatch[1].replace(/"|'/g, "").trim() : null;
    } catch (e) {
        return null;
    }
}

async function resolveDriveseed(url) {
    try {
        const res = await makeRequest(url, { headers: { "Referer": "https://links.modpro.blog/" } });
        const html = await res.text();
        const redirect = html.match(/window\.location\.replace\("([^"]+)"\)/)?.[1];
        if (!redirect) return null;

        const finalUrl = `https://driveseed.org${redirect}`;
        const finalHtml = await (await makeRequest(finalUrl, { headers: { "Referer": url } })).text();

        // Priority logic from MoviesMod
        const instant = finalHtml.match(/href="([^"]+)"[^>]*>Instant Download/i)?.[1];
        if (instant) {
            // Handle VideoSeed API POST
            const keys = new URL(instant).searchParams.get("url");
            const apiRes = await fetch(`${new URL(instant).origin}/api`, {
                method: "POST",
                body: new URLSearchParams({ keys }),
                headers: { "Content-Type": "application/x-www-form-urlencoded", "x-token": new URL(instant).hostname }
            });
            const data = await apiRes.json();
            return data.url || instant;
        }
        
        const resume = finalHtml.match(/href="([^"]+)"[^>]*>Resume Cloud/i)?.[1];
        if (resume) {
            const resumeHtml = await (await makeRequest(`https://driveseed.org${resume}`, { headers: { "Referer": "https://driveseed.org/" } })).text();
            return resumeHtml.match(/href="([^"]+)"[^>]*>Cloud Resume Download/i)?.[1];
        }
        return null;
    } catch (e) {
        return null;
    }
}

// --- MAIN SEARCH ---

async function getStreams(tmdbId, mediaType, season, episode) {
    const streams = [];
    try {
        const isSeries = mediaType === "tv" || mediaType === "series";
        const tmdbData = await (await fetch(`${TMDB_API}/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`)).json();
        const query = (isSeries ? tmdbData.name : tmdbData.title) + " " + (isSeries ? "" : tmdbData.release_date.slice(0, 4));

        const searchHtml = await (await makeRequest(`${DOMAIN}/?s=${encodeURIComponent(query)}`)).text();
        const postUrl = searchHtml.match(/href="([^"]+)"[^>]*class="[^"]*gridlove-post/i)?.[1];
        if (!postUrl) return [];

        const pageHtml = await (await makeRequest(postUrl)).text();
        const links = [...pageHtml.matchAll(/href="([^"]+)"[^>]*class="[^"]*maxbutton-1/gi)].map(m => m[1]);

        for (let url of links) {
            // 1. Decode modrefer if present (Exact MoviesMod Step)
            if (url.includes("modrefer.in")) {
                const encoded = new URL(url).searchParams.get("url");
                if (encoded) url = atob(encoded);
            }

            // 2. Bypass SID
            if (url.includes("unblockedgames") || url.includes("creativeexpressions") || url.includes("tech.")) {
                url = await resolveSidBypass(url);
            }

            // 3. Resolve Driveseed
            if (url && (url.includes("driveseed") || url.includes("driveleech"))) {
                const streamUrl = await resolveDriveseed(url);
                if (streamUrl) {
                    streams.push({
                        name: "UHDMovies",
                        title: tmdbData.name || tmdbData.title,
                        url: streamUrl,
                        quality: "Direct"
                    });
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
    return streams;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
