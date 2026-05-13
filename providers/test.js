// VegaMovies Scraper for Nuvio Local Scrapers
// Final Patch: Corrected Headers, 4KHDHub UI Match, and TV Compatibility

console.log('[VegaMovies] Initializing VegaMovies scraper');

const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const BASE_URL = 'https://vegamovies.market';
const TIMEOUT = 25000;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

const qualityOrder = { '2160p': 6, '4K': 6, '1080p': 4, '720p': 3, 'Unknown': 0 };

function makeRequest(url, options = {}) {
    return fetch(url, {
        timeout: TIMEOUT,
        headers: { ...HEADERS, ...options.headers },
        redirect: 'follow',
        ...options
    }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
    });
}

function getTMDBEpisodeName(tmdbId, season, episode) {
    if (!season || !episode) return Promise.resolve("");
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`;
    return makeRequest(url).then(res => res.json()).then(data => data.name || "").catch(() => "");
}

// --- FIX 2: MATCHING Screenshot_20260513_055549_com_nuvio_app_MainActivity.jpg ---
function buildPremiumMeta(meta, quality, size, filename) {
    const isSeries = !!(meta.season || meta.episode);
    const yearPart = meta.year ? ` - ${meta.year}` : "";
    
    // Clean filename for TV rendering
    const cleanFile = filename.replace(/[^\x20-\x7E]/g, '').slice(0, 55);

    let line1;
    if (isSeries) {
        const epTitle = meta.episodeTitle ? ` - ${meta.episodeTitle}` : "";
        line1 = `📺 S${meta.season}E${meta.episode}${epTitle} | ${meta.title}${yearPart}`;
    } else {
        line1 = `🎬 ${meta.title}${yearPart}`;
    }

    const qIcon = (quality.includes('2160') || quality.includes('4K')) ? '💎' : '📺';
    const line2 = `${qIcon} ${quality} | 🌍 EN | 💾 ${size || 'Unknown'}`;
    const line3 = `🎞️ MKV | ℹ️ ${cleanFile}...`;

    return line1 + "\n" + line2 + "\n" + line3;
}

function getTMDBDetails(tmdbId, mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    return makeRequest(url).then(res => res.json()).then(data => {
        const isTv = mediaType === 'tv';
        return {
            title: isTv ? data.name : data.title,
            year: (isTv ? data.first_air_date : data.release_date)?.substring(0, 4) || '',
        };
    }).catch(() => null);
}

function searchVegaMovies(title, year) {
    const query = encodeURIComponent(`${title} ${year}`);
    const searchUrl = `${BASE_URL}/search.php?q=${query}`;
    return makeRequest(searchUrl).then(res => res.json()).then(data => {
        if (!data.hits || data.hits.length === 0) throw new Error('No results');
        let permalink = data.hits[0].document.permalink;
        return permalink.startsWith('http') ? permalink : BASE_URL + permalink;
    });
}

function extractQuality(text) {
    const resMatch = text.match(/(\d{3,4})[pP]/);
    if (resMatch) return resMatch[1] + 'p';
    if (/4K/i.test(text)) return '4K';
    return 'Unknown';
}

function extractFileSize(text) {
    const sizeMatch = text.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
    return sizeMatch ? sizeMatch[1] + ' ' + sizeMatch[2].toUpperCase() : null;
}

function extractNexdriveLinks(vegaPageUrl) {
    return makeRequest(vegaPageUrl).then(res => res.text()).then(html => {
        const nexLinks = [];
        const qualityBlocks = html.split(/<h[1-6]/i);
        for (let block of qualityBlocks) {
            const quality = extractQuality(block);
            const size = extractFileSize(block);
            const linkMatch = block.match(/<a[^>]+href="([^"]*(?:nexdrive|genxfm)[^"]*)"[^>]*>/i);
            if (linkMatch) {
                let link = linkMatch[1];
                nexLinks.push({ url: link.startsWith('http') ? link : BASE_URL + link, quality, size });
            }
        }
        return nexLinks;
    });
}

function extractVCloudFromNexdrive(nexdriveUrl) {
    return makeRequest(nexdriveUrl).then(res => res.text()).then(html => {
        const vcloudMatch = html.match(/<a[^>]+href="([^"]*vcloud[^"]*)"[^>]*>[\s\S]*?V-Cloud/i);
        if (!vcloudMatch) throw new Error('No VCloud');
        return vcloudMatch[1];
    });
}

function extractServersFromVCloud(vcloudUrl, quality, size, meta) {
    return makeRequest(vcloudUrl).then(res => res.text()).then(html => {
        const sizeMatch = html.match(/<i[^>]*id="size"[^>]*>([^<]+)<\/i>/);
        const fileSize = sizeMatch ? sizeMatch[1].trim() : size;
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        const filename = titleMatch ? titleMatch[1].trim() : `Video File ${quality}`;
        const tokenMatch = html.match(/token[=:][\s'"]*([A-Za-z0-9+/=]+)/);
        
        let dlPage = vcloudUrl;
        if (tokenMatch) dlPage = vcloudUrl.replace(/\/$/, '') + '?token=' + tokenMatch[1];

        return makeRequest(dlPage).then(res => res.text()).then(downloadHtml => {
            let serverUrl = null;
            let srvType = '10Gbps'; 
            
            const gbpsRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(?:[^<]|<(?!\/a>))*Download[^<]*10\s?Gbps/gi;
            let match = gbpsRegex.exec(downloadHtml);
            if (match) serverUrl = match[1];

            if (!serverUrl) {
                const fslRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(?:[^<]|<(?!\/a>))*Download[^<]*FSL/gi;
                match = fslRegex.exec(downloadHtml);
                if (match) { serverUrl = match[1]; srvType = 'FSL'; }
            }

            if (!serverUrl) throw new Error('No server');

            return makeRequest(serverUrl, { redirect: 'follow' }).then(response => {
                let finalUrl = response.url;
                if (finalUrl.includes('gamerxyt.com/dl.php')) {
                    const lMatch = finalUrl.match(/[?&]link=([^&]+)/);
                    if (lMatch) finalUrl = decodeURIComponent(lMatch[1]);
                }

                // --- FIX 1 & 3: HEADER AND TV COMPATIBILITY ---
                return {
                    name: `VegaMovies | ${srvType} | ${quality}`, 
                    title: buildPremiumMeta(meta, quality, fileSize, filename),
                    url: finalUrl,
                    quality: quality,
                    size: fileSize,
                    headers: { 'User-Agent': HEADERS['User-Agent'] },
                    behaviorHints: { 
                        notWebReady: false,
                        proxyHeaders: { "User-Agent": HEADERS['User-Agent'] }
                    },
                    provider: 'vegamovies'
                };
            });
        });
    });
}

async function invokeVegaMovies(tmdbId, mediaType, seasonNum = null, episodeNum = null) {
    try {
        const mediaInfo = await getTMDBDetails(tmdbId, mediaType);
        if (!mediaInfo) return [];

        const episodeTitle = (mediaType === 'tv') ? await getTMDBEpisodeName(tmdbId, seasonNum, episodeNum) : "";
        const meta = { title: mediaInfo.title, year: mediaInfo.year, season: seasonNum, episode: episodeNum, episodeTitle };

        const vegaPageUrl = await searchVegaMovies(mediaInfo.title, mediaInfo.year);
        const nexdriveLinks = await extractNexdriveLinks(vegaPageUrl);
        if (nexdriveLinks.length === 0) return [];

        const streamPromises = nexdriveLinks.map(nex => {
            return extractVCloudFromNexdrive(nex.url)
                .then(vcloud => extractServersFromVCloud(vcloud, nex.quality, nex.size, meta))
                .catch(() => null);
        });

        const streams = (await Promise.all(streamPromises)).filter(s => s !== null);
        return streams.sort((a, b) => (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0));

    } catch (e) {
        return [];
    }
}

function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    return invokeVegaMovies(tmdbId, mediaType, seasonNum, episodeNum);
}

module.exports = { getStreams };
