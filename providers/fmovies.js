"use strict";

const DOMAIN = "https://uhdmovies.rip";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// --- Helper Functions from MoviesMod Logic ---

async function makeRequest(url, options = {}) {
    const defaultHeaders = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Referer": DOMAIN
    };
    const response = await fetch(url, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers }
    });
    return response;
}

function stripTags(html) {
    return (html || "").replace(/<[^>]+>/g, "").trim();
}

// --- The Core SID Bypass (Injected from MoviesMod) ---

async function resolveTechUnblockedLink(sidUrl) {
    try {
        const response = await makeRequest(sidUrl);
        const html = await response.text();
        
        // Step 1: Initial Form Extraction
        const wp_http_step1 = html.match(/name="_wp_http"\s+value="([^"]+)"/)?.[1];
        const action_url_step1 = html.match(/id="landing"\s+action="([^"]+)"/)?.[1];

        if (!wp_http_step1 || !action_url_step1) return null;

        const step1Data = new URLSearchParams({ "_wp_http": wp_http_step1 });
        const responseStep1 = await makeRequest(action_url_step1, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "Referer": sidUrl },
            body: step1Data.toString()
        });

        const html2 = await responseStep1.text();
        
        // Step 2: Verification Form Extraction
        const action_url_step2 = html2.match(/id="landing"\s+action="([^"]+)"/)?.[1];
        const wp_http2 = html2.match(/name="_wp_http2"\s+value="([^"]+)"/)?.[1];
        const token = html2.match(/name="token"\s+value="([^"]+)"/)?.[1];

        if (!action_url_step2) return null;

        const step2Data = new URLSearchParams({ "_wp_http2": wp_http2 || "", "token": token || "" });
        const responseStep2 = await makeRequest(action_url_step2, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "Referer": responseStep1.url },
            body: step2Data.toString()
        });

        const finalHtml = await responseStep2.text();
        
        // Step 3: Dynamic Cookie & Link Extraction
        const cookieMatch = finalHtml.match(/s_343\('([^']+)',\s*'([^']+)'/);
        const linkMatch = finalHtml.match(/c\.setAttribute\("href",\s*"([^"]+)"\)/);

        if (!cookieMatch || !linkMatch) return null;

        const { origin } = new URL(sidUrl);
        const finalUrl = new URL(linkMatch[1], origin).href;

        const finalResponse = await makeRequest(finalUrl, {
            headers: {
                "Referer": responseStep2.url,
                "Cookie": `${cookieMatch[1]}=${cookieMatch[2]}`
            }
        });

        const metaHtml = await finalResponse.text();
        const urlMatch = metaHtml.match(/url=(.*)/i);
        if (urlMatch) {
            return urlMatch[1].replace(/"/g, "").replace(/'/g, "").trim();
        }
        return null;
    } catch (error) {
        console.error("[UHDMovies] SID Error: " + error.message);
        return null;
    }
}

// --- Driveseed Resolver (Injected from MoviesMod) ---

async function resolveDriveseedLink(driveseedUrl) {
    try {
        const response = await makeRequest(driveseedUrl);
        const html = await response.text();
        const redirectMatch = html.match(/window\.location\.replace\("([^"]+)"\)/);
        
        if (!redirectMatch) return null;

        const finalUrl = `https://driveseed.org${redirectMatch[1]}`;
        const finalRes = await makeRequest(finalUrl, { headers: { "Referer": driveseedUrl } });
        const finalHtml = await finalRes.text();

        // Extract File Info
        const size = finalHtml.match(/Size\s*:\s*([^<]+)/i)?.[1].trim();
        const fileName = finalHtml.match(/Name\s*:\s*([^<]+)/i)?.[1].trim();

        // Extract Instant/Resume links
        const instantMatch = finalHtml.match(/href="([^"]+)"[^>]*>Instant Download/i);
        const resumeMatch = finalHtml.match(/href="([^"]+)"[^>]*>Resume Cloud/i);

        let downloadUrl = instantMatch ? instantMatch[1] : (resumeMatch ? `https://driveseed.org${resumeMatch[1]}` : null);
        
        return { downloadUrl, size, fileName };
    } catch (e) {
        return null;
    }
}

// --- UHDMovies Search Logic (Original) ---

function buildQualityLabel(str) {
    const res = str.match(/(\d{3,4})[pP]/)?.[1] || "Unknown";
    return res + "p";
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const streams = [];
    try {
        const isSeries = mediaType === "tv" || mediaType === "series";
        const tmdbUrl = `${TMDB_API}/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const tmdbRes = await fetch(tmdbUrl);
        const tmdbData = await tmdbRes.json();
        
        const query = (isSeries ? tmdbData.name : tmdbData.title) + " " + (isSeries ? "" : tmdbData.release_date.slice(0, 4));
        const searchHtml = await (await makeRequest(`${DOMAIN}/?s=${encodeURIComponent(query)}`)).text();

        const results = [];
        const chunks = searchHtml.split(/<article\b/i);
        for (let i = 1; i < chunks.length; i++) {
            const link = chunks[i].match(/href="([^"]+)"/)?.[1];
            const title = chunks[i].match(/class="sanket[^>]*>([\s\S]*?)<\/h1>/)?.[1];
            if (link) results.push({ url: link, title: stripTags(title) });
        }

        for (const res of results) {
            const pageHtml = await (await makeRequest(res.url)).text();
            const btnRegex = /<a[^>]*maxbutton-1[^>]*href="([^"]+)"/gi;
            let m;
            
            while ((m = btnRegex.exec(pageHtml)) !== null) {
                let currentUrl = m[1];

                // Inject MoviesMod Bypass Logic
                if (currentUrl.includes("unblockedgames") || currentUrl.includes("creativeexpressionsblog") || currentUrl.includes("tech.examzculture")) {
                    currentUrl = await resolveTechUnblockedLink(currentUrl);
                }

                if (currentUrl && (currentUrl.includes("driveseed") || currentUrl.includes("driveleech"))) {
                    const driveInfo = await resolveDriveseedLink(currentUrl);
                    if (driveInfo && driveInfo.downloadUrl) {
                        streams.push({
                            name: "UHDMovies",
                            title: `${driveInfo.fileName || res.title}\n[${driveInfo.size || "Size unknown"}]`,
                            url: driveInfo.downloadUrl,
                            quality: buildQualityLabel(driveInfo.fileName || res.title)
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error("[UHDMovies] Final Error: " + err.message);
    }
    return streams;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
