"use strict";

const DOMAIN = "https://uhdmovies.rip";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// --- THE MOVIESMOD ENGINE ---

async function makeRequest(url, options = {}) {
    const headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Connection": "keep-alive",
        ...options.headers
    };
    return fetch(url, { ...options, headers });
}

async function bypassUnblockedGames(targetUrl) {
    try {
        // Step 1: Landing Page
        const res1 = await makeRequest(targetUrl);
        const html1 = await res1.text();
        
        const wp_http = html1.match(/name="_wp_http"\s+value="([^"]+)"/)?.[1];
        const action = html1.match(/id="landing"\s+action="([^"]+)"/)?.[1];
        if (!wp_http || !action) return null;

        // Step 2: First Post (Verification)
        const res2 = await makeRequest(action, {
            method: "POST",
            headers: { "Referer": targetUrl, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ "_wp_http": wp_http }).toString()
        });
        const html2 = await res2.text();

        const wp_http2 = html2.match(/name="_wp_http2"\s+value="([^"]+)"/)?.[1];
        const token = html2.match(/name="token"\s+value="([^"]+)"/)?.[1];
        const action2 = html2.match(/id="landing"\s+action="([^"]+)"/)?.[1];
        if (!action2) return null;

        // Step 3: Second Post (Generation)
        const res3 = await makeRequest(action2, {
            method: "POST",
            headers: { "Referer": res2.url, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ "_wp_http2": wp_http2 || "", "token": token || "" }).toString()
        });
        const html3 = await res3.text();

        // Step 4: Extract the dynamic cookie and the hidden link
        const cookieInfo = html3.match(/s_343\('([^']+)',\s*'([^']+)'/);
        const linkInfo = html3.match(/c\.setAttribute\("href",\s*"([^"]+)"\)/);
        if (!cookieInfo || !linkInfo) return null;

        const finalRedirectUrl = new URL(linkInfo[1], new URL(targetUrl).origin).href;
        
        // Step 5: Final Hop with the SID Cookie
        const res4 = await makeRequest(finalRedirectUrl, {
            headers: { 
                "Referer": res3.url, 
                "Cookie": `${cookieInfo[1]}=${cookieInfo[2]}` 
            }
        });
        const html4 = await res4.text();
        const metaUrl = html4.match(/url=(.*)/i);
        return metaUrl ? metaUrl[1].replace(/"|'/g, "").trim() : null;
    } catch (e) {
        return null;
    }
}

async function resolveDriveseed(url) {
    try {
        const res = await makeRequest(url, { headers: { "Referer": "https://links.modpro.blog/" } });
        const html = await res.text();
        const loc = html.match(/window\.location\.replace\("([^"]+)"\)/)?.[1];
        if (!loc) return null;

        const fullLoc = loc.startsWith('http') ? loc : `https://driveseed.org${loc}`;
        const finalHtml = await (await makeRequest(fullLoc, { headers: { "Referer": url } })).text();

        // Try Instant Download first (uses VideoSeed API logic from moviesmod)
        const instant = finalHtml.match(/href="([^"]+)"[^>]*>Instant Download/i)?.[1];
        if (instant && instant.includes("url=")) {
            const keys = new URL(instant).searchParams.get("url");
            const api = await fetch(`${new URL(instant).origin}/api`, {
                method: "POST",
                body: new URLSearchParams({ keys }),
                headers: { "Content-Type": "application/x-www-form-urlencoded", "x-token": new URL(instant).hostname }
            });
            const json = await api.json();
            if (json.url) return json.url;
        }

        // Fallback to Resume Cloud
        const resume = finalHtml.match(/href="([^"]+)"[^>]*>Resume Cloud/i)?.[1];
        if (resume) {
            const resUrl = resume.startsWith('http') ? resume : `https://driveseed.org${resume}`;
            const cloudHtml = await (await makeRequest(resUrl, { headers: { "Referer": "https://driveseed.org/" } })).text();
            return cloudHtml.match(/href="([^"]+)"[^>]*>Cloud Resume Download/i)?.[1];
        }
        return null;
    } catch (e) {
        return null;
    }
}

// --- UHDMOVIES ADAPTATION ---

async function getStreams(tmdbId, mediaType, season, episode) {
    const streams = [];
    try {
        const isSeries = mediaType === "tv" || mediaType === "series";
        const tmdbData = await (await fetch(`${TMDB_API}/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`)).json();
        const searchTitle = isSeries ? tmdbData.name : tmdbData.title;
        
        const searchHtml = await (await makeRequest(`${DOMAIN}/?s=${encodeURIComponent(searchTitle)}`)).text();
        const postLink = searchHtml.match(/href="([^"]+)"[^>]*class="[^"]*gridlove-post/i)?.[1];
        if (!postLink) return [];

        const pageHtml = await (await makeRequest(postLink)).text();
        const buttons = [...pageHtml.matchAll(/href="([^"]+)"[^>]*class="[^"]*maxbutton-1/gi)].map(m => m[1]);

        for (let url of buttons) {
            // Logic Injection: Decode modrefer if found
            if (url.includes("modrefer.in")) {
                const b64 = new URL(url).searchParams.get("url");
                if (b64) url = atob(b64);
            }

            // Logic Injection: Bypass SID/Unblocked
            if (url.match(/unblockedgames|creativeexpressions|tech\./)) {
                url = await bypassUnblockedGames(url);
            }

            // Logic Injection: Resolve Driveseed
            if (url && url.includes("driveseed")) {
                const finalLink = await resolveDriveseed(url);
                if (finalLink) {
                    streams.push({
                        name: "UHD (Via MoviesMod Logic)",
                        title: searchTitle,
                        url: finalLink,
                        quality: "HD"
                    });
                }
            }
        }
    } catch (e) {
        console.error("Scraper Error:", e);
    }
    return streams;
}

if (typeof module !== "undefined") module.exports = { getStreams };
