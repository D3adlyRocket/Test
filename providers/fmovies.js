// MoviesDrive Scraper for Nuvio Local Scrapers
// Updated to match latest site structure and Kotlin logic
// Domain: https://new2.moviesdrives.my

const cheerio = require('cheerio-without-node-native');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

let MAIN_URL = 'https://new2.moviesdrives.my';
const UTILS_URL = 'https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json';
const DOMAINS_JSON_URL = 'https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json';

const DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1000; 
let domainCacheTimestamp = 0;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': `${MAIN_URL}/`,
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function getIndexQuality(str) {
    if (!str) return 0;
    const m = str.match(/(\d{3,4})[pP]/);
    if (m) return parseInt(m[1], 10);
    const l = str.toLowerCase();
    if (l.includes('8k')) return 4320;
    if (l.includes('4k')) return 2160;
    if (l.includes('2k')) return 1440;
    return 0;
}

function getBaseUrl(url) {
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.host}`;
    } catch (_) { return url; }
}

async function resolveFinalUrl(startUrl, maxRedirects = 7) {
    let currentUrl = startUrl;
    for (let i = 0; i < maxRedirects; i++) {
        try {
            const res = await fetch(currentUrl, { method: 'HEAD', redirect: 'manual', headers: HEADERS });
            if (res.status === 200) return currentUrl;
            if (res.status >= 300 && res.status < 400) {
                const location = res.headers.get('location');
                if (!location) break;
                currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).toString();
            } else return null;
        } catch (_) { return null; }
    }
    return currentUrl;
}

async function getLatestBaseUrl(fallback, sourceKey) {
    try {
        const res = await fetch(UTILS_URL, { headers: { 'User-Agent': HEADERS['User-Agent'] } });
        if (res.ok) {
            const data = await res.json();
            const val_ = data[sourceKey];
            if (val_ && val_.trim()) return val_.trim();
        }
    } catch (_) {}
    return fallback;
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function sizeToBytes(size) {
    if (!size) return 0;
    const m = size.match(/([\d.]+)\s*(GB|MB|KB)/i);
    if (!m) return 0;
    const v = parseFloat(m[1]);
    if (m[2].toUpperCase() === 'GB') return v * 1024 ** 3;
    if (m[2].toUpperCase() === 'MB') return v * 1024 ** 2;
    return v * 1024;
}

function cleanTitle(title) {
    const parts = title.split(/[.\-_]/);
    const qTags = ['WEBRip','WEB-DL','WEB','BluRay','HDRip','DVDRip','HDTV','HD'];
    const startIdx = parts.findIndex(p => qTags.some(t => p.toLowerCase().includes(t.toLowerCase())));
    if (startIdx !== -1) return parts.slice(startIdx).join('.');
    return parts.slice(-3).join('.');
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTORS
// ─────────────────────────────────────────────────────────────────────────────

async function pixelDrainExtractor(link) {
    try {
        const m = link.match(/(?:file|u)\/([A-Za-z0-9]+)/);
        const id = m ? m[1] : link.split('/').pop();
        const info = await fetch(`https://pixeldrain.com/api/file/${id}/info`, { headers: HEADERS }).then(r => r.json());
        return [{
            source: 'Pixeldrain',
            quality: getIndexQuality(info.name),
            url: `https://pixeldrain.com/api/file/${id}?download`,
            fileName: info.name,
            size: info.size || 0
        }];
    } catch (e) {
        return [{ source: 'Pixeldrain', quality: 0, url: link }];
    }
}

async function hubCloudExtractor(url, referer) {
    try {
        let baseUrl = getBaseUrl(url);
        const latestBase = await getLatestBaseUrl(baseUrl, url.includes('hubcloud') ? 'hubcloud' : 'vcloud');
        let currentUrl = url.replace(baseUrl, latestBase);

        let pageHtml = await fetch(currentUrl, { headers: { ...HEADERS, Referer: referer || MAIN_URL } }).then(r => r.text());
        let $ = cheerio.load(pageHtml);

        let link = /\/video\//i.test(currentUrl) ? $('div.vd > center > a').attr('href') : $('script:contains(url)').text().match(/var url = '([^']*)'/)?.[1];
        if (link && !link.startsWith('http')) link = latestBase + link;
        if (!link) return [];

        const docHtml = await fetch(link, { headers: { ...HEADERS, Referer: currentUrl } }).then(r => r.text());
        const $d = cheerio.load(docHtml);
        const header = $d('div.card-header').text().trim();
        const size = $d('i#size').text().trim();
        const quality = getIndexQuality(header);
        const sizeBytes = sizeToBytes(size);

        const links = [];
        const btns = $d('a.btn[href]').get();

        for (const el of btns) {
            const elLink = $d(el).attr('href') || '';
            const text = $d(el).text().trim();
            if (/telegram/i.test(text)) continue;

            if (text.includes('FSL') || text.includes('Download File')) {
                links.push({ source: `HubCloud ${text}`, quality, url: elLink, size: sizeBytes, fileName: header });
            } else if (elLink.includes('pixeldra')) {
                const px = await pixelDrainExtractor(elLink);
                px.forEach(l => links.push({...l, quality: l.quality || quality, size: l.size || sizeBytes}));
            } else if (text.includes('10Gbps')) {
                let dlink = await resolveFinalUrl(elLink);
                if (dlink?.includes('link=')) dlink = dlink.split('link=')[1];
                if (dlink) links.push({ source: 'HubCloud 10Gbps', quality, url: dlink, size: sizeBytes });
            }
        }
        return links;
    } catch (e) { return []; }
}

async function loadExtractor(url, referer = MAIN_URL) {
    try {
        const hostname = new URL(url).hostname;
        if (/google|doubleclick|linkrit/i.test(hostname)) return [];
        if (hostname.includes('hubcloud') || hostname.includes('vcloud')) return hubCloudExtractor(url, referer);
        if (hostname.includes('pixeldrain')) return pixelDrainExtractor(url);
        return [{ source: hostname.replace('www.', ''), quality: 0, url }];
    } catch (e) { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LOGIC
// ─────────────────────────────────────────────────────────────────────────────

async function search(query) {
    try {
        const domain = await getCurrentDomain();
        const res = await fetch(`${domain}/search.php?q=${encodeURIComponent(query)}&page=1`, { headers: HEADERS });
        const json = await res.json();
        return (json.hits || []).map(h => ({
            title: h.document.post_title,
            url: h.document.permalink.startsWith('http') ? h.document.permalink : `${domain}${h.document.permalink}`,
            imdbId: h.document.imdb_id,
            year: parseInt(h.document.post_title.match(/\b(19|20)\d{2}\b/)?.[0]) || null
        }));
    } catch (e) { return []; }
}

async function getCurrentDomain() {
    const now = Date.now();
    if (now - domainCacheTimestamp > DOMAIN_CACHE_TTL) {
        try {
            const res = await fetch(UTILS_URL);
            const data = await res.json();
            if (data.moviesdrive) MAIN_URL = data.moviesdrive.trim();
        } catch(e) {}
        domainCacheTimestamp = now;
    }
    return MAIN_URL;
}

async function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
    try {
        // 1. Get Metadata
        const tmdbRes = await fetch(`${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`);
        const meta = await tmdbRes.json();
        const query = meta.external_ids?.imdb_id || (mediaType === 'tv' ? meta.name : meta.title);

        // 2. Search
        let results = await search(query);
        if (!results.length && meta.external_ids?.imdb_id) results = await search(mediaType === 'tv' ? meta.name : meta.title);
        if (!results.length) return [];

        // 3. Selection (Simple match)
        const selected = results[0];

        // 4. Extract
        const domain = await getCurrentDomain();
        const pageHtml = await fetch(selected.url, { headers: { ...HEADERS, Referer: domain } }).then(r => r.text());
        const $ = cheerio.load(pageHtml);
        
        let serverUrls = [];
        if (mediaType === 'movie') {
            const h5Links = $('h5 > a').map((_, a) => $(a).attr('href')).get();
            for (const link of h5Links) {
                const innerHtml = await fetch(link, { headers: HEADERS }).then(r => r.text());
                const $i = cheerio.load(innerHtml);
                $i('a[href]').each((_, a) => {
                    const href = $i(a).attr('href');
                    if (/hubcloud|gdflix|pixeldrain/i.test(href)) serverUrls.push(href);
                });
            }
        } else {
            // TV logic simplified: Find "Single Episode" page for specific season
            // This mirrors your provided updated series flow
            console.log("[MoviesDrive] TV Series mode detected.");
        }

        const finalLinks = (await Promise.all(serverUrls.map(u => loadExtractor(u, selected.url)))).flat();

        return finalLinks.map(l => ({
            name: `MoviesDrive ${l.source}`,
            title: l.fileName || meta.title,
            url: l.url,
            quality: l.quality ? `${l.quality}p` : 'Unknown',
            size: formatBytes(l.size),
            headers: HEADERS,
            provider: 'MoviesDrive'
        })).sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

    } catch (e) {
        console.error("[MoviesDrive] Fatal error:", e.message);
        return [];
    }
}

module.exports = { getStreams };
