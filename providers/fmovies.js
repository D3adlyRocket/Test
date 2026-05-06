"use strict";

const DOMAIN = "https://uhdmovies.rip";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// --- THE REFINED BYPASS ENGINE ---

async function fetchWithHeaders(url, opts = {}) {
    const headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        ...opts.headers
    };
    return fetch(url, { ...opts, headers });
}

async function bypassSID(targetUrl) {
    try {
        // Step 1: Hit landing and grab Cookies
        const initialRes = await fetchWithHeaders(targetUrl);
        const setCookie = initialRes.headers.get("set-cookie");
        const html1 = await initialRes.text();
        
        const wp_http = html1.match(/name="_wp_http"\s+value="([^"]+)"/)?.[1];
        const action = html1.match(/id="landing"\s+action="([^"]+)"/)?.[1];
        if (!wp_http || !action) return null;

        // Step 2: Verification POST
        const res2 = await fetchWithHeaders(action, {
            method: "POST",
            headers: { 
                "Referer": targetUrl, 
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": setCookie || ""
            },
            body: new URLSearchParams({ "_wp_http": wp_http }).toString()
        });
        const html2 = await res2.text();

        const wp_http2 = html2.match(/name="_wp_http2"\s+value="([^"]+)"/)?.[1];
        const token = html2.match(/name="token"\s+value="([^"]+)"/)?.[1];
        const action2 = html2.match(/id="landing"\s+action="([^"]+)"/)?.[1];
        if (!action2) return null;

        // Step 3: Link Generation POST
        const res3 = await fetchWithHeaders(action2, {
            method: "POST",
            headers: { 
                "Referer": res2.url, 
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": setCookie || ""
            },
            body: new URLSearchParams({ "_wp_http2": wp_http2 || "", "token": token || "" }).toString()
        });
        const html3 = await res3.text();

        // Extract Dynamic Cookie 's_xxx' and the final 'href'
        const cookieData = html3.match(/s_\d+\('([^']+)',\s*'([^']+)'/);
        const linkData = html3.match(/c\.setAttribute\("href",\s*"([^"]+)"\)/);
        if (!cookieData || !linkData) return null;

        // Step 4: Final Hop with specific SID Cookie
        const finalUrl = new URL(linkData[1], new URL(targetUrl).origin).href;
        const res4 = await fetchWithHeaders(finalUrl, {
            headers: { 
                "Referer": res3.url, 
                "Cookie": `${setCookie ? setCookie.split(';')[0] + ';' : ''} ${cookieData[1]}=${cookieData[2]}` 
            }
        });
        
        const html4 = await res4.text();
        const meta = html4.match(/url=(.*)/i);
        return meta ? meta[1].replace(/"|'/g, "").trim() : null;
    } catch (e) {
        return null;
    }
}

async function resolveDrive(url) {
    try {
        const res = await fetchWithHeaders(url, { headers: { "Referer": "https://links.modpro.blog/" } });
        const html = await res.text();
        const redirect = html.match(/window\.location\.replace\("([^"]+)"\)/)?.[1];
        if (!redirect) return null;

        const bridgeUrl = redirect.startsWith('http') ? redirect : `https://driveseed.org${redirect}`;
        const bridgeHtml = await (await fetchWithHeaders(bridgeUrl, { headers: { "Referer": url } })).text();

        // Look for the Instant Download button
        const instant = bridgeHtml.match(/href="([^"]+)"[^>]*>Instant Download/i)?.[1];
        if (instant && instant.includes("url=")) {
            // DRIVESEED API HANDSHAKE (The absolute final step)
            const urlObj = new URL(instant);
            const keys = urlObj.searchParams.get("url");
            const apiRes = await fetch(`${urlObj.origin}/api`, {
                method: "POST",
                body: new URLSearchParams({ keys }),
                headers: { 
                    "Content-Type": "application/x-www-form-urlencoded", 
                    "x-token": urlObj.hostname 
                }
            });
            const json = await apiRes.json();
            return json.url || instant;
        }
        return null;
    } catch (e) {
        return null;
    }
}

// --- SEARCH & EXECUTION ---

async function getStreams(tmdbId, mediaType, season, episode) {
    const results = [];
    try {
        const isTV = mediaType === "tv" || mediaType === "series";
        const tmdbData = await (await fetch(`${TMDB_API}/${isTV ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`)).json();
        const name = isTV ? tmdbData.name : tmdbData.title;

        const searchRes = await fetchWithHeaders(`${DOMAIN}/?s=${encodeURIComponent(name)}`);
        const searchHtml = await searchRes.text();
        const postLink = searchHtml.match(/href="([^"]+)"[^>]*class="[^"]*gridlove-post/i)?.[1];
        if (!postLink) return [];

        const pageHtml = await (await fetchWithHeaders(postLink)).text();
        const btns = [...pageHtml.matchAll(/href="([^"]+)"[^>]*class="[^"]*maxbutton-1/gi)].map(m => m[1]);

        for (let rawUrl of btns) {
            let workingUrl = rawUrl;

            // Handle modrefer B64
            if (workingUrl.includes("modrefer.in")) {
                const b64 = new URL(workingUrl).searchParams.get("url");
                if (b64) workingUrl = atob(b64);
            }

            // Handle UnblockedGames/SID
            if (workingUrl.match(/unblockedgames|creativeexpressions|tech\./)) {
                workingUrl = await bypassSID(workingUrl);
            }

            // Handle Driveseed Final Link
            if (workingUrl && workingUrl.includes("driveseed")) {
                const directLink = await resolveDrive(workingUrl);
                if (directLink) {
                    results.push({
                        name: "UHDMovies",
                        title: `${name} ${isTV ? `S${season}E${episode}` : ''}`,
                        url: directLink,
                        quality: "HD / Direct"
                    });
                }
            }
        }
    } catch (e) {
        console.error("Critical Failure:", e);
    }
    return results;
}

if (typeof module !== "undefined") module.exports = { getStreams };
