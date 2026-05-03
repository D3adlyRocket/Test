const cheerio = require('cheerio-without-node-native');

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
let MAIN_URL = "https://new1.moviesdrives.my"; // Fallback URL
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
};

// --- Helper: Format Size ---
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// --- Helper: Extract Server Name ---
function getServerName(url, sourceText) {
    if (/hubcloud/i.test(url) || /hubcloud/i.test(sourceText)) return "HubCloud";
    if (/gdflix/i.test(url) || /gdflix/i.test(sourceText)) return "GDFlix";
    if (/pixeldrain/i.test(url)) return "Pixeldrain";
    if (/gofile/i.test(url)) return "GoFile";
    return "Premium Server";
}

// --- Logic: Resolve Domain ---
async function syncDomain() {
    try {
        const res = await fetch(DOMAINS_URL, { timeout: 5000 });
        const data = await res.json();
        if (data && data.Moviesdrive) {
            MAIN_URL = data.Moviesdrive.replace(/\/$/, "");
            HEADERS.Referer = MAIN_URL + "/";
        }
    } catch (e) {
        console.log("[Moviesdrive] Using fallback domain.");
    }
}

// --- Logic: The Bridge/Redirect Resolver ---
// This follows the link through MDrive's protection layers to find the hoster.
async function bypassBridge(url) {
    try {
        const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
        const html = await res.text();
        const $ = cheerio.load(html);
        const candidates = [];

        // 1. Check for standard hoster buttons
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (href && /hubcloud|gdflix|pixeldrain|gofile|sharer|drivebot/i.test(href)) {
                candidates.push(href);
            }
        });

        // 2. Check for hidden script redirects (Common in 2026)
        const jsRedirect = html.match(/window\.location\.(?:replace|href)\s*=\s*["']([^"']+)["']/);
        if (jsRedirect) candidates.push(jsRedirect[1]);

        return [...new Set(candidates)];
    } catch (e) { return []; }
}

// --- Extractor: HubCloud (Recursive) ---
async function hubCloudExtractor(url, referer) {
    try {
        const res = await fetch(url, { headers: { ...HEADERS, Referer: referer } });
        const html = await res.text();
        const $ = cheerio.load(html);
        const links = [];

        const size = $('#size').text().trim() || "";
        const title = $('.card-header').text().trim() || "File";
        
        // Find buttons containing "Download" or "FSL"
        $('a.btn').each((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text();
            if (href && /download|fsl|direct|link/i.test(text)) {
                links.push({
                    source: `HubCloud (${text.trim()})`,
                    url: href,
                    size: size,
                    quality: (title.match(/(\d{3,4})p/i) || [null, "1080p"])[1]
                });
            }
        });
        return links;
    } catch (e) { return []; }
}

// --- Main Provider Function ---
async function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
    try {
        await syncDomain();

        // 1. Get IMDB ID & Title from TMDB
        const tmdbRes = await fetch(`${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`);
        const tmdb = await tmdbRes.json();
        const query = tmdb.external_ids?.imdb_id || (mediaType === 'tv' ? tmdb.name : tmdb.title);

        // 2. Query Moviesdrive Search API
        const searchRes = await fetch(`${MAIN_URL}/search.php?q=${encodeURIComponent(query)}`, { headers: HEADERS });
        const searchData = await searchRes.json();
        
        if (!searchData?.hits?.length) return [];
        
        // Pick best hit (usually the first)
        const hit = searchData.hits[0].document;
        const postUrl = hit.permalink.startsWith('http') ? hit.permalink : `${MAIN_URL}${hit.permalink}`;

        // 3. Parse Post Page for "Download" buttons
        const postRes = await fetch(postUrl, { headers: HEADERS });
        const postHtml = await postRes.text();
        const $ = cheerio.load(postHtml);

        const bridgeLinks = [];
        $('h5 a').each((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().toLowerCase();

            if (mediaType === 'tv') {
                // Precise match for Episode Number
                const epCheck = new RegExp(`Ep(?:isode)?\\s*0?${episode}\\b`, 'i');
                if (epCheck.test(text) || text.includes(`ep ${episode}`)) {
                    bridgeLinks.push(href);
                }
            } else {
                if (href && !href.includes('telegram')) bridgeLinks.push(href);
            }
        });

        // 4. Resolve Bridges and Extract Final URLs
        const streams = [];
        for (const bLink of bridgeLinks) {
            const hosterUrls = await bypassBridge(bLink);
            
            for (const hUrl of hosterUrls) {
                if (hUrl.includes('hubcloud')) {
                    const hcResults = await hubCloudExtractor(hUrl, bLink);
                    hcResults.forEach(r => streams.push({
                        name: `Moviesdrive ${r.source}`,
                        title: tmdb.title || tmdb.name,
                        url: r.url,
                        quality: r.quality,
                        size: r.size,
                        headers: HEADERS,
                        provider: 'Moviesdrive'
                    }));
                } else if (hUrl.includes('gdflix') || hUrl.includes('pixeldrain')) {
                    // Direct or near-direct fallback
                    streams.push({
                        name: `Moviesdrive ${getServerName(hUrl, "")}`,
                        title: tmdb.title || tmdb.name,
                        url: hUrl,
                        quality: "1080p",
                        size: "N/A",
                        headers: HEADERS,
                        provider: 'Moviesdrive'
                    });
                }
            }
        }

        // Deduplicate and return
        const unique = Array.from(new Set(streams.map(a => a.url)))
            .map(url => streams.find(a => a.url === url));

        return unique;

    } catch (error) {
        console.error("[Moviesdrive] Critical Error:", error.message);
        return [];
    }
}

// Export for Nuvio/React Native
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = { getStreams };
}
