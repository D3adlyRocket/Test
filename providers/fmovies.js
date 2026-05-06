"use strict";

const DOMAIN = "https://uhdmovies.rip";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// --- CORE UTILITIES (Transplanted from MoviesMod) ---

async function makeRequest(url, options = {}) {
    const defaultHeaders = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Upgrade-Insecure-Requests": "1"
    };
    const response = await fetch(url, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers }
    });
    return response;
}

// --- SID / UNBLOCKED GAMES BYPASS (MoviesMod Logic) ---

async function resolveTechUnblockedLink(sidUrl) {
    try {
        const response = await makeRequest(sidUrl);
        const html = await response.text();

        // Step 1: Extract WP HTTP Step 1
        const wp_http_step1 = html.match(/name="_wp_http"\s+value="([^"]+)"/)?.[1];
        const action_url_step1 = html.match(/id="landing"\s+action="([^"]+)"/)?.[1];
        if (!wp_http_step1 || !action_url_step1) return null;

        const step1Data = new URLSearchParams({ "_wp_http": wp_http_step1 });
        const responseStep1 = await makeRequest(action_url_step1, {
            method: "POST",
            headers: { "Referer": sidUrl, "Content-Type": "application/x-www-form-urlencoded" },
            body: step1Data.toString()
        });

        const html2 = await responseStep1.text();

        // Step 2: Extract Step 2 Form (wp_http2 and token)
        const action_url_step2 = html2.match(/id="landing"\s+action="([^"]+)"/)?.[1];
        const wp_http2 = html2.match(/name="_wp_http2"\s+value="([^"]+)"/)?.[1];
        const token = html2.match(/name="token"\s+value="([^"]+)"/)?.[1];
        if (!action_url_step2) return null;

        const step2Data = new URLSearchParams({ "_wp_http2": wp_http2 || "", "token": token || "" });
        const responseStep2 = await makeRequest(action_url_step2, {
            method: "POST",
            headers: { "Referer": responseStep1.url, "Content-Type": "application/x-www-form-urlencoded" },
            body: step2Data.toString()
        });

        const finalHtml = await responseStep2.text();

        // Step 3: Dynamic Cookie extraction (The MoviesMod "s_343" logic)
        const cookieMatch = finalHtml.match(/s_343\('([^']+)',\s*'([^']+)'/);
        const linkMatch = finalHtml.match(/c\.setAttribute\("href",\s*"([^"]+)"\)/);
        if (!cookieMatch || !linkMatch) return null;

        const { origin } = new URL(sidUrl);
        const finalUrl = new URL(linkMatch[1], origin).href;

        const finalResponse = await makeRequest(finalUrl, {
            headers: {
                "Referer": responseStep2.url,
                "Cookie": `${cookieMatch[1].trim()}=${cookieMatch[2].trim()}`
            }
        });

        const metaHtml = await finalResponse.text();
        const metaRefresh = metaHtml.match(/url=(.*)/i);
        if (metaRefresh) {
            return metaRefresh[1].replace(/"/g, "").replace(/'/g, "").trim();
        }
        return null;
    } catch (e) {
        return null;
    }
}

// --- DRIVESEED HANDLER (MoviesMod Priority Logic) ---

async function resolveDriveseedLink(driveseedUrl) {
    try {
        const response = await makeRequest(driveseedUrl, { headers: { "Referer": "https://links.modpro.blog/" } });
        const html = await response.text();
        const redirectMatch = html.match(/window\.location\.replace\("([^"]+)"\)/);
        if (!redirectMatch) return null;

        const finalUrl = `https://driveseed.org${redirectMatch[1]}`;
        const finalRes = await makeRequest(finalUrl, { headers: { "Referer": driveseedUrl } });
        const finalHtml = await finalRes.text();

        // Priority Logic from MoviesMod: Instant -> Resume Cloud -> Generic
        const instantMatch = finalHtml.match(/href="([^"]+)"[^>]*>Instant Download/i);
        if (instantMatch) {
            // VideoSeed API resolver (Direct logic from template)
            const videoSeedUrl = instantMatch[1];
            const keys = new URL(videoSeedUrl).searchParams.get("url");
            if (keys) {
                const apiRes = await fetch(`${new URL(videoSeedUrl).origin}/api`, {
                    method: "POST",
                    body: new URLSearchParams({ keys }),
                    headers: { "Content-Type": "application/x-www-form-urlencoded", "x-token": new URL(videoSeedUrl).hostname }
                });
                const apiJson = await apiRes.json();
                if (apiJson.url) return apiJson.url;
            }
            return videoSeedUrl;
        }

        const resumeMatch = finalHtml.match(/href="([^"]+)"[^>]*>Resume Cloud/i);
        if (resumeMatch) {
            const resHtml = await (await makeRequest(`https://driveseed.org${resumeMatch[1]}`, { headers: { "Referer": "https://driveseed.org/" } })).text();
            const cloudLink = resHtml.match(/href="([^"]+)"[^>]*>Cloud Resume Download/i);
            if (cloudLink) return cloudLink[1];
        }

        return null;
    } catch (e) {
        return null;
    }
}

// --- MAIN SCRAPER FLOW ---

async function getStreams(tmdbId, mediaType, season, episode) {
    const allStreams = [];
    try {
        const isSeries = mediaType === "tv" || mediaType === "series";
        const tmdbUrl = `${TMDB_API}/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
        const tmdbData = await (await fetch(tmdbUrl)).json();
        
        const title = isSeries ? tmdbData.name : tmdbData.title;
        const year = (isSeries ? tmdbData.first_air_date : tmdbData.release_date || "").slice(0, 4);

        // UHDMovies Search
        const searchHtml = await (await makeRequest(`${DOMAIN}/?s=${encodeURIComponent(title + " " + year)}`)).text();
        const articleMatch = searchHtml.match(/href="([^"]+)"[^>]*class="[^"]*gridlove-post/i);
        if (!articleMatch) return [];

        const pageHtml = await (await makeRequest(articleMatch[1])).text();
        
        // Extract links based on UHDMovies class "maxbutton-1"
        const btnRegex = /href="([^"]+)"[^>]*class="[^"]*maxbutton-1/gi;
        let match;
        
        while ((match = btnRegex.exec(pageHtml)) !== null) {
            let url = match[1];

            // If it's a modrefer link, decode it via atob (Template Logic)
            if (url.includes("modrefer.in")) {
                const encodedUrl = new URL(url).searchParams.get("url");
                if (encodedUrl) url = atob(encodedUrl);
            }

            // Resolve SID Protection
            if (url && (url.includes("unblockedgames") || url.includes("creativeexpressions") || url.includes("tech."))) {
                url = await resolveTechUnblockedLink(url);
            }

            // Resolve Driveseed final video link
            if (url && (url.includes("driveseed") || url.includes("driveleech"))) {
                const finalUrl = await resolveDriveseedLink(url);
                if (finalUrl) {
                    allStreams.push({
                        name: "UHDMovies",
                        title: title + (isSeries ? ` S${season}E${episode}` : ""),
                        url: finalUrl,
                        quality: "HD",
                        headers: { "Referer": "https://driveseed.org/" }
                    });
                }
            }
        }
    } catch (e) {
        console.error("[UHDMovies] Final Logic Error: " + e.message);
    }
    return allStreams;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
