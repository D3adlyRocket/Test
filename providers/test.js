// Moviesdrive Scraper for Nuvio
// Version: 2.1 (Fixed Redirections & Extractor Logic)

const cheerio = require('cheerio-without-node-native');

// --- Configuration ---
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
let MAIN_URL = "https://new2.moviesdrives.my";
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1000;
let domainCacheTimestamp = 0;

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": `${MAIN_URL}/`,
};

// =================================================================================
// UTILITIES (Base64, ROT13, Title Cleaning)
// =================================================================================

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
function atob(value) {
    let input = String(value).replace(/=+$/, '');
    let output = '';
    let bc = 0, bs, buffer, idx = 0;
    while ((buffer = input.charAt(idx++))) {
        buffer = BASE64_CHARS.indexOf(buffer);
        if (~buffer) {
            bs = bc % 4 ? bs * 64 + buffer : buffer;
            if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
        }
    }
    return output;
}

function cleanTitle(title) {
    const parts = title.split(/[.\-_]/);
    const qualityTags = ["WEBRip", "WEB-DL", "BluRay", "HDRip", "DVDRip", "HDTV", "BRRip"];
    const startIndex = parts.findIndex(p => qualityTags.some(t => p.toLowerCase().includes(t.toLowerCase())));
    return startIndex !== -1 ? parts.slice(startIndex).join(".") : parts.slice(-3).join(".");
}

// =================================================================================
// DOMAIN MANAGEMENT
// =================================================================================

async function getCurrentDomain() {
    const now = Date.now();
    if (now - domainCacheTimestamp < DOMAIN_CACHE_TTL) return MAIN_URL;

    try {
        const response = await fetch(DOMAINS_URL);
        const data = await response.json();
        if (data && data.Moviesdrive) {
            MAIN_URL = data.Moviesdrive;
            HEADERS.Referer = `${MAIN_URL}/`;
            domainCacheTimestamp = now;
        }
    } catch (e) {
        console.error("[Moviesdrive] Domain fetch failed:", e.message);
    }
    return MAIN_URL;
}

// =================================================================================
// EXTRACTORS (GDFlix, HubCloud, Pixeldrain)
// =================================================================================

async function pixelDrainExtractor(link) {
    const fileId = link.match(/(?:file|u)\/([A-Za-z0-9]+)/)?.[1] || link.split('/').pop();
    const infoUrl = `https://pixeldrain.com/api/file/${fileId}/info`;
    try {
        const res = await fetch(infoUrl);
        const info = await res.json();
        return [{
            source: 'Pixeldrain',
            quality: info.name.match(/(\d{3,4})p/)?.[0] || 'Unknown',
            url: `https://pixeldrain.com/api/file/${fileId}?download`,
            size: info.size,
            fileName: info.name
        }];
    } catch {
        return [{ source: 'Pixeldrain', quality: 'Unknown', url: `https://pixeldrain.com/api/file/${fileId}?download` }];
    }
}

async function gdFlixExtractor(url, referer) {
    try {
        const res = await fetch(url, { headers: { ...HEADERS, Referer: referer } });
        const html = await res.text();
        const $ = cheerio.load(html);
        
        const fileName = $('li:contains("Name")').text().replace('Name :', '').trim();
        const sizeText = $('li:contains("Size")').text().replace('Size :', '').trim();
        
        // Priority: Instant Download (busycdn)
        const instantLink = $('a:contains("Instant"), a[href*="busycdn"]').attr('href');
        if (instantLink) {
            return [{
                source: 'GDFlix [Instant]',
                quality: fileName.match(/(\d{3,4})p/)?.[0] || '1080p',
                url: instantLink,
                fileName: fileName
            }];
        }
    } catch (e) { console.error("[GDFlix Error]", e.message); }
    return [];
}

async function hubCloudExtractor(url, referer) {
    try {
        const res = await fetch(url, { headers: { ...HEADERS, Referer: referer } });
        const html = await res.text();
        const $ = cheerio.load(html);
        const links = [];

        const dlBtn = $('.btn-success, .btn-primary').filter((i, el) => $(el).text().includes('Download')).attr('href');
        if (dlBtn) {
            links.push({ source: 'HubCloud', quality: '720p', url: dlBtn });
        }
        return links;
    } catch { return []; }
}

async function loadExtractor(url, referer) {
    if (!url) return [];
    const hostname = new URL(url).hostname;
    if (hostname.includes('gdflix')) return await gdFlixExtractor(url, referer);
    if (hostname.includes('hubcloud')) return await hubCloudExtractor(url, referer);
    if (hostname.includes('pixeldrain')) return await pixelDrainExtractor(url);
    return [];
}

// =================================================================================
// CORE PROVIDER LOGIC
// =================================================================================

async function getDownloadLinks(mediaUrl, season, episode) {
    const domain = await getCurrentDomain();
    const res = await fetch(mediaUrl, { headers: HEADERS });
    const html = await res.text();
    const $ = cheerio.load(html);
    const finalLinks = [];

    // STEP 1: Find all Mdrive archive links on the post
    const archives = $('a[href*="mdrive.lol/archives"]').map((i, el) => $(el).attr('href')).get();

    for (const archiveUrl of archives) {
        try {
            // STEP 2: Visit each mdrive link to find actual hosters
            const aRes = await fetch(archiveUrl, { headers: { ...HEADERS, Referer: mediaUrl } });
            const aHtml = await aRes.text();
            const $$ = cheerio.load(aHtml);

            const hosterUrls = $$('a[href*="gdflix"], a[href*="hubcloud"], a[href*="pixeldrain"]')
                .map((i, el) => $$(el).attr('href')).get();

            for (const hUrl of hosterUrls) {
                const extracted = await loadExtractor(hUrl, archiveUrl);
                finalLinks.push(...extracted);
            }
        } catch (e) { console.error("[Mdrive Step Failed]", e.message); }
    }

    return { finalLinks, isMovie: !season };
}

async function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
    try {
        const domain = await getCurrentDomain();
        
        // Get details from TMDB
        const tmdbUrl = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
        const tmdbRes = await fetch(tmdbUrl);
        const tmdbData = await tmdbRes.json();
        const title = tmdbData.name || tmdbData.title;
        const imdbId = tmdbData.external_ids?.imdb_id;

        // Search Moviesdrive
        const searchUrl = `${domain}/searchapi.php?q=${encodeURIComponent(imdbId || title)}&page=1`;
        const sRes = await fetch(searchUrl, { headers: HEADERS });
        const sJson = await sRes.json();
        
        if (!sJson?.hits?.length) return [];

        // Match result (prefer exact IMDB ID match)
        const match = sJson.hits.find(h => h.document.imdb_id === imdbId) || sJson.hits[0];
        const mediaUrl = match.document.permalink.startsWith('http') ? match.document.permalink : `${domain}${match.document.permalink}`;

        // Extract links
        const { finalLinks } = await getDownloadLinks(mediaUrl, season, episode);

        return finalLinks.map(link => ({
            name: `Moviesdrive [${link.source}]`,
            title: link.fileName || title,
            url: link.url,
            quality: link.quality || '720p',
            size: formatBytes(link.size),
            headers: HEADERS,
            provider: 'Moviesdrive'
        }));

    } catch (e) {
        console.error("[Moviesdrive Main Error]", e.message);
        return [];
    }
}

module.exports = { getStreams };
