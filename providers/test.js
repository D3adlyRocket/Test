// Moviesdrive Scraper for Nuvio Local Scrapers - Full Integrated Version
// React Native compatible version with full original functionality and bridge-fix

const cheerio = require('cheerio-without-node-native');

// --- Configuration ---
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
let MAIN_URL = "https://new1.moviesdrives.my";
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1000;
let domainCacheTimestamp = 0;

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": `${MAIN_URL}/`,
};

// =================================================================================
// UTILITY FUNCTIONS
// =================================================================================

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function extractServerName(source) {
    if (!source) return 'Unknown';
    const src = source.trim();
    if (/HubCloud/i.test(src)) return 'HubCloud';
    if (/Pixeldrain/i.test(src)) return 'Pixeldrain';
    if (/GDFlix/i.test(src)) return 'GDFlix';
    if (/GoFile/i.test(src)) return 'GoFile';
    return src.replace(/^www\./i, '').split(/[.\s]/)[0];
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
function atob(value) {
    if (!value) return '';
    let input = String(value).replace(/=+$/, '');
    let output = '';
    let bc = 0, bs, buffer, idx = 0;
    while ((buffer = input.charAt(idx++))) {
        buffer = BASE64_CHARS.indexOf(buffer);
        if (~buffer) {
            bs = bc % 4 ? bs * 64 + buffer : buffer;
            if (bc++ % 4) {
                output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
            }
        }
    }
    return output;
}

function cleanTitle(title) {
    const parts = title.split(/[.\-_]/);
    const qualityTags = ["WEBRip", "WEB-DL", "WEB", "BluRay", "HDRip", "DVDRip", "HD", "2160p", "1080p", "720p"];
    const startIndex = parts.findIndex(part => qualityTags.some(tag => part.toLowerCase().includes(tag.toLowerCase())));
    return startIndex !== -1 ? parts.slice(startIndex).join(".") : parts.slice(-3).join(".");
}

// =================================================================================
// DOMAIN & BRIDGE LOGIC
// =================================================================================

async function fetchAndUpdateDomain() {
    const now = Date.now();
    if (now - domainCacheTimestamp < DOMAIN_CACHE_TTL) return;
    try {
        const response = await fetch(DOMAINS_URL);
        const data = await response.json();
        if (data && data.Moviesdrive) {
            MAIN_URL = data.Moviesdrive;
            HEADERS.Referer = `${MAIN_URL}/`;
            domainCacheTimestamp = now;
        }
    } catch (e) { console.error(`[Moviesdrive] Domain fetch failed: ${e.message}`); }
}

/**
 * Resolves the intermediate redirect pages (Bridge Pages)
 * This is the crucial step that was missing.
 */
async function resolveBridge(url) {
    try {
        const res = await fetch(url, { headers: HEADERS });
        const html = await res.text();
        const $ = cheerio.load(html);
        const results = [];

        // Look for buttons that lead to real hosters
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (href && /hubcloud|gdflix|pixeldrain|gofile|sharer|drivebot/i.test(href)) {
                results.push(href);
            }
        });

        // Some bridges use JS redirects
        const jsMatch = html.match(/window\.location\.(?:replace|href)\s*=\s*["']([^"']+)["']/);
        if (jsMatch) results.push(jsMatch[1]);

        return [...new Set(results)];
    } catch (e) { return []; }
}

// =================================================================================
// EXTRACTORS
// =================================================================================

async function hubCloudExtractor(url, referer) {
    try {
        // Handle hubcloud domain changes
        let targetUrl = url.replace("hubcloud.ink", "hubcloud.dad").replace("hubcloud.foo", "hubcloud.dad");
        
        const res = await fetch(targetUrl, { headers: { ...HEADERS, Referer: referer } });
        const html = await res.text();
        const $ = cheerio.load(html);
        const links = [];

        const size = $('#size').text().trim();
        const header = $('.card-header').text().trim() || 'HubCloud';

        // Find the "Download" or "Direct Link" buttons
        $('a.btn').each((_, el) => {
            const text = $(el).text().toLowerCase();
            const href = $(el).attr('href');
            if (href && (text.includes('download') || text.includes('direct') || text.includes('fsl'))) {
                links.push({
                    source: `HubCloud [${text.trim()}]`,
                    quality: (header.match(/(\d{3,4})p/i) || [0, "1080p"])[1],
                    url: href,
                    size: 0, 
                    fileName: header
                });
            }
        });
        return links;
    } catch (e) { return []; }
}

async function gdFlixExtractor(url, referer) {
    try {
        const res = await fetch(url, { headers: HEADERS });
        const html = await res.text();
        const $ = cheerio.load(html);
        const links = [];

        // Check for common GDFlix patterns: Direct, Index, or DriveBot
        $('a.btn').each((_, el) => {
            const text = $(el).text().toLowerCase();
            const href = $(el).attr('href');
            if (href && (text.includes('direct') || text.includes('drivebot') || text.includes('instant'))) {
                links.push({
                    source: 'GDFlix',
                    quality: '1080p',
                    url: href
                });
            }
        });
        return links;
    } catch (e) { return []; }
}

async function pixelDrainExtractor(link) {
    const fileId = link.match(/(?:file|u)\/([A-Za-z0-9]+)/)?.[1];
    if (!fileId) return [];
    return [{
        source: 'Pixeldrain',
        quality: '1080p',
        url: `https://pixeldrain.com/api/file/${fileId}?download`
    }];
}

async function loadExtractor(url, referer = MAIN_URL) {
    if (!url) return [];
    const hostname = new URL(url).hostname;

    if (hostname.includes('hubcloud')) return hubCloudExtractor(url, referer);
    if (hostname.includes('gdflix')) return gdFlixExtractor(url, referer);
    if (hostname.includes('pixeldrain')) return pixelDrainExtractor(url);
    
    return [{ source: hostname, quality: 'Unknown', url }];
}

// =================================================================================
// MAIN PROVIDER LOGIC
// =================================================================================

async function search(imdbId, title) {
    await fetchAndUpdateDomain();
    const query = imdbId || title;
    const apiUrl = `${MAIN_URL}/search.php?q=${encodeURIComponent(query)}`;
    
    try {
        const res = await fetch(apiUrl, { headers: HEADERS });
        const json = await res.json();
        if (!json?.hits?.length) return [];

        return json.hits.map(hit => ({
            title: hit.document.post_title,
            url: hit.document.permalink.startsWith('http') ? hit.document.permalink : `${MAIN_URL}${hit.document.permalink}`,
            year: (hit.document.post_title.match(/\b(19|20)\d{2}\b/) || [])[0],
            imdbId: hit.document.imdb_id
        }));
    } catch (e) { return []; }
}

async function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
    try {
        // 1. Get Details from TMDB
        const tmdbUrl = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
        const tmdbRes = await fetch(tmdbUrl);
        const tmdbData = await tmdbRes.json();
        const title = mediaType === 'tv' ? tmdbData.name : tmdbData.title;
        const imdbId = tmdbData.external_ids?.imdb_id;

        // 2. Search Moviesdrive
        let results = await search(imdbId, title);
        if (results.length === 0 && imdbId) results = await search(null, title);
        if (results.length === 0) return [];

        // 3. Pick the best result (Simplified match)
        const selected = results[0]; 

        // 4. Fetch the Page
        const pRes = await fetch(selected.url, { headers: HEADERS });
        const pHtml = await pRes.text();
        const $ = cheerio.load(pHtml);

        const bridgeLinks = [];
        // Extract all <h5> links (standard for MDrive)
        $('h5 a').each((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().toLowerCase();
            
            if (mediaType === 'tv') {
                const epRegex = new RegExp(`Ep\\s*0?${episode}\\b`, 'i');
                if (epRegex.test(text) || text.includes('episode')) bridgeLinks.push(href);
            } else {
                if (href && !href.includes('telegram')) bridgeLinks.push(href);
            }
        });

        // 5. Resolve Bridges and Extract
        const finalStreams = [];
        for (const bLink of bridgeLinks) {
            const hosterUrls = await resolveBridge(bLink);
            for (const hUrl of hosterUrls) {
                const extracted = await loadExtractor(hUrl, bLink);
                finalStreams.push(...extracted);
            }
        }

        return finalStreams.map(s => ({
            name: `Moviesdrive ${extractServerName(s.source)}`,
            title: s.fileName || title,
            url: s.url,
            quality: s.quality || '1080p',
            size: formatBytes(s.size),
            headers: HEADERS,
            provider: 'Moviesdrive'
        }));

    } catch (err) {
        console.error(`[Moviesdrive] Fatal Error: ${err.message}`);
        return [];
    }
}

// Export for Nuvio
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = { getStreams };
}
