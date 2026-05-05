/**
 * MoviesDrive Scraper for Nuvio - Full Implementation
 * Based on MoviesDrive.kt and Extractors.kt source logic.
 * Features: Domain Auto-Rotation, IMDB-Primary Searching, HubCloud/GDFlix Support.
 */

const cheerio = require('cheerio-without-node-native');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION & CONSTANTS
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
// CORE UTILITIES (Math & Formatting)
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

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

async function getCurrentDomain() {
    const now = Date.now();
    if (now - domainCacheTimestamp > DOMAIN_CACHE_TTL) {
        try {
            const res = await fetch(UTILS_URL);
            if (res.ok) {
                const data = await res.json();
                if (data.moviesdrive) {
                    MAIN_URL = data.moviesdrive.trim();
                    HEADERS.Referer = `${MAIN_URL}/`;
                }
            }
        } catch(e) {
            console.log("[MoviesDrive] Domain fetch failed, using fallback.");
        }
        domainCacheTimestamp = now;
    }
    return MAIN_URL;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTORS (The Link Solvers)
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
        const baseUrl = getBaseUrl(url);
        const latestBase = url.includes('hubcloud') ? (await fetch(UTILS_URL).then(r => r.json()).then(j => j.hubcloud) || baseUrl) : baseUrl;
        let currentUrl = url.replace(baseUrl, latestBase);

        const pageHtml = await fetch(currentUrl, { headers: { ...HEADERS, Referer: referer || MAIN_URL } }).then(r => r.text());
        const $ = cheerio.load(pageHtml);

        let nextLink = /\/video\//i.test(currentUrl) ? $('div.vd > center > a').attr('href') : $('script:contains(url)').text().match(/var url = '([^']*)'/)?.[1];
        if (nextLink && !nextLink.startsWith('http')) nextLink = latestBase + nextLink;
        if (!nextLink) return [];

        const docHtml = await fetch(nextLink, { headers: { ...HEADERS, Referer: currentUrl } }).then(r => r.text());
        const $d = cheerio.load(docHtml);
        const header = $d('div.card-header').text().trim();
        const size = $d('i#size').text().trim();
        const quality = getIndexQuality(header);
        const sizeBytes = sizeToBytes(size);

        const links = [];
        const buttons = $d('a.btn[href]').get();

        for (const el of buttons) {
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
                if (dlink) links.push({ source: 'HubCloud 10Gbps', quality, url: dlink, size: sizeBytes, fileName: header });
            }
        }
        return links;
    } catch (e) { return []; }
}

async function loadExtractor(url, referer = MAIN_URL) {
    try {
        const hostname = new URL(url).hostname;
        if (hostname.includes('hubcloud') || hostname.includes('vcloud')) return hubCloudExtractor(url, referer);
        if (hostname.includes('pixeldrain')) return pixelDrainExtractor(url);
        return [{ source: hostname.replace('www.', ''), quality: 0, url }];
    } catch (e) { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH & METADATA
// ─────────────────────────────────────────────────────────────────────────────

async function search(query) {
    const domain = await getCurrentDomain();
    const apiUrl = `${domain}/search.php?q=${encodeURIComponent(query)}&page=1`;
    try {
        const res = await fetch(apiUrl, { headers: HEADERS });
        const json = await res.json();
        return (json.hits || []).map(h => ({
            title: h.document.post_title,
            url: h.document.permalink.startsWith('http') ? h.document.permalink : `${domain}${h.document.permalink}`,
            imdbId: h.document.imdb_id,
            year: parseInt(h.document.post_title.match(/\b(19|20)\d{2}\b/)?.[0]) || null
        }));
    } catch (e) { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────

async function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
    console.log(`[MoviesDrive] Initializing for TMDB: ${tmdbId}`);
    try {
        // 1. Fetch TMDB Metadata for accurate title/IMDB ID
        const tmdbRes = await fetch(`${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`);
        const meta = await tmdbRes.json();
        const searchQuery = meta.external_ids?.imdb_id || (mediaType === 'tv' ? meta.name : meta.title);

        // 2. Search Provider
        let results = await search(searchQuery);
        if (!results.length && meta.external_ids?.imdb_id) {
            results = await search(mediaType === 'tv' ? meta.name : meta.title);
        }
        if (!results.length) return [];

        // 3. Selection
        const selected = results.find(r => r.imdbId === meta.external_ids?.imdb_id) || results[0];
        console.log(`[MoviesDrive] Selected: ${selected.title}`);

        // 4. Scrape the landing page
        const pageHtml = await fetch(selected.url, { headers: { ...HEADERS, Referer: await getCurrentDomain() } }).then(r => r.text());
        const $ = cheerio.load(pageHtml);
        
        let serverUrls = [];
        if (mediaType === 'movie') {
            const landingLinks = $('h5 > a').map((_, a) => $(a).attr('href')).get();
            for (const link of landingLinks) {
                const intermediate = await fetch(link, { headers: HEADERS }).then(r => r.text());
                const $i = cheerio.load(intermediate);
                $i('a[href]').each((_, a) => {
                    const href = $i(a).attr('href');
                    if (/hubcloud|gdflix|pixeldrain|vcloud/i.test(href)) serverUrls.push(href);
                });
            }
        } else {
            // TV Flow: Identify Season and Episode
            const seasonPattern = new RegExp(`(?:Season|S)\\s*0?${season}\\b`, 'i');
            const epPattern = new RegExp(`Ep\\s*0?${episode}\\b`, 'i');
            
            let epPageUrl = null;
            $('h5').each((_, h5) => {
                if (seasonPattern.test($(h5).text())) {
                    $(h5).nextAll('h5').each((_, next) => {
                        const a = $(next).find('a');
                        if (/single\s*episode/i.test(a.text())) epPageUrl = a.attr('href');
                    });
                }
            });

            if (epPageUrl) {
                const epPageHtml = await fetch(epPageUrl, { headers: HEADERS }).then(r => r.text());
                const $e = cheerio.load(epPageHtml);
                $e('h5').each((_, h) => {
                    if (epPattern.test($(h).text())) {
                        $(h).nextUntil('hr', 'a[href]').each((_, a) => {
                            serverUrls.push($(a).attr('href'));
                        });
                    }
                });
            }
        }

        // 5. Final Extraction
        const streamBundles = await Promise.all(serverUrls.map(u => loadExtractor(u, selected.url)));
        const finalStreams = streamBundles.flat().filter(s => s && s.url);

        return finalStreams.map(s => ({
            name: `MoviesDrive ${s.source}`,
            title: s.fileName || selected.title,
            url: s.url,
            quality: s.quality ? `${s.quality}p` : 'Unknown',
            size: formatBytes(s.size),
            headers: HEADERS,
            provider: 'MoviesDrive'
        })).sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

    } catch (e) {
        console.error("[MoviesDrive] Scraping failed:", e.message);
        return [];
    }
}

module.exports = { getStreams };
