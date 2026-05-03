// Moviesdrive Scraper for Nuvio - Full Integrated Version
const cheerio = require('cheerio-without-node-native');

// --- Configuration ---
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
let MAIN_URL = "https://new1.moviesdrives.my";
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1000;

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": `${MAIN_URL}/`,
};

// --- Base64 Polyfill (React Native Friendly) ---
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
function atob(v) {
    let input = String(v).replace(/=+$/, ''), output = '', bc = 0, bs, buffer, idx = 0;
    while ((buffer = input.charAt(idx++))) {
        buffer = BASE64_CHARS.indexOf(buffer);
        if (~buffer) {
            bs = bc % 4 ? bs * 64 + buffer : buffer;
            if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
        }
    }
    return output;
}

// --- Utilities ---
function formatBytes(bytes) {
    if (!bytes) return 'Unknown';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + ['Bytes', 'KB', 'MB', 'GB', 'TB'][i];
}

function extractServerName(source) {
    if (/HubCloud/i.test(source)) return 'HubCloud';
    if (/GDFlix/i.test(source)) return 'GDFlix';
    if (/Pixeldrain/i.test(source)) return 'Pixeldrain';
    return source.split('.')[0];
}

// --- Domain Management ---
async function getCurrentDomain() {
    try {
        const res = await fetch(DOMAINS_URL);
        const data = await res.json();
        if (data?.Moviesdrive) {
            MAIN_URL = data.Moviesdrive;
            HEADERS.Referer = `${MAIN_URL}/`;
        }
    } catch (e) {}
    return MAIN_URL;
}

// --- Extractors ---

/**
 * Bridge Page Resolver:
 * Resolves intermediate "Please Wait" pages to find the actual hoster URL.
 */
async function resolveBridge(url) {
    try {
        const res = await fetch(url, { headers: HEADERS });
        const html = await res.text();
        const $$ = cheerio.load(html);
        const found = [];

        $$('a[href]').each((_, el) => {
            const href = $$(el).attr('href');
            if (href && /hubcloud|gdflix|pixeldrain|gofile|drivebot/i.test(href)) {
                found.push(href);
            }
        });

        // Some use JS redirect
        const jsMatch = html.match(/window\.location\.(?:replace|href)\s*=\s*["']([^"']+)["']/);
        if (jsMatch) found.push(jsMatch[1]);

        return [...new Set(found)];
    } catch (e) { return []; }
}

async function loadExtractor(url, referer) {
    if (url.includes('hubcloud')) return hubCloudExtractor(url, referer);
    if (url.includes('gdflix')) return gdFlixExtractor(url, referer);
    if (url.includes('pixeldrain')) return pixelDrainExtractor(url);
    return [{ source: 'Unknown', quality: '1080p', url }];
}

async function pixelDrainExtractor(link) {
    const fileId = link.match(/(?:file|u)\/([A-Za-z0-9]+)/)?.[1];
    if (!fileId) return [];
    return [{
        source: 'Pixeldrain',
        quality: '1080p',
        url: `https://pixeldrain.com/api/file/${fileId}?download`,
        size: 0
    }];
}

async function gdFlixExtractor(url, referer) {
    try {
        const res = await fetch(url, { headers: HEADERS });
        const html = await res.text();
        const $ = cheerio.load(html);
        const links = [];
        
        // Find direct download button or DriveBot link
        $('a[href*="drivebot"], a:contains("Direct")').each((_, el) => {
            links.push({
                source: 'GDFlix',
                quality: '1080p',
                url: $(el).attr('href')
            });
        });
        return links;
    } catch (e) { return []; }
}

async function hubCloudExtractor(url, referer) {
    try {
        const res = await fetch(url, { headers: { ...HEADERS, Referer: referer } });
        const html = await res.text();
        const $ = cheerio.load(html);
        const results = [];

        const sizeText = $('#size').text();
        const downloadBtn = $('.btn-success, .btn-primary').filter((_, el) => $(el).text().includes('Download')).first();
        
        if (downloadBtn.length) {
            results.push({
                source: 'HubCloud',
                quality: '1080p',
                url: downloadBtn.attr('href'),
                size: 0
            });
        }
        return results;
    } catch (e) { return []; }
}

// --- Main Scraper Logic ---

async function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
    try {
        await getCurrentDomain();
        
        // 1. Get TMDB Data
        const tmdbRes = await fetch(`${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`);
        const tmdbData = await tmdbRes.json();
        const title = mediaType === 'tv' ? tmdbData.name : tmdbData.title;
        const imdbId = tmdbData.external_ids?.imdb_id;

        // 2. Search Moviesdrive
        const searchUrl = `${MAIN_URL}/search.php?q=${encodeURIComponent(imdbId || title)}`;
        const sRes = await fetch(searchUrl, { headers: HEADERS });
        const sJson = await sRes.json();
        
        if (!sJson?.hits?.length) return [];
        const bestMatch = sJson.hits[0].document;
        const mediaPageUrl = bestMatch.permalink.startsWith('http') ? bestMatch.permalink : `${MAIN_URL}${bestMatch.permalink}`;

        // 3. Load Post Page
        const pRes = await fetch(mediaPageUrl, { headers: HEADERS });
        const pHtml = await pRes.text();
        const $ = cheerio.load(pHtml);
        
        const streamLinks = [];
        const buttonLinks = [];

        // Collect all H5 links (standard for Moviesdrive)
        $('h5 a').each((_, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('telegram')) buttonLinks.push(href);
        });

        // 4. Resolve Links
        for (let bUrl of buttonLinks) {
            const hosterUrls = await resolveBridge(bUrl);
            for (let hUrl of hosterUrls) {
                const extracted = await loadExtractor(hUrl, bUrl);
                streamLinks.push(...extracted);
            }
        }

        return streamLinks.map(s => ({
            name: `Moviesdrive ${extractServerName(s.source)}`,
            title: title,
            url: s.url,
            quality: s.quality || '1080p',
            size: formatBytes(s.size),
            headers: HEADERS,
            provider: 'Moviesdrive'
        }));

    } catch (err) {
        console.error("Scraper failed:", err);
        return [];
    }
}

// Export for Nuvio
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = { getStreams };
}
