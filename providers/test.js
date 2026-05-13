// VegaMovies Scraper
// Final Version: Full UI Match, Dual-Language Support, and TV Fix

console.log('[VegaMovies] Initializing Final Scraper');

const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const BASE_URL = 'https://vegamovies.market';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36'
};

// --- HELPER: EXTRACT EXTRA INFO FROM FILENAME ---
function getExtraInfo(filename) {
    const tags = [];
    if (/BluRay/i.test(filename)) tags.push("BluRay");
    else if (/Web-?DL|WebRip/i.test(filename)) tags.push("WEB-DL");
    else if (/HDRip/i.test(filename)) tags.push("HDRip");

    if (/HDR/i.test(filename)) tags.push("HDR");
    else if (/SDR/i.test(filename)) tags.push("SDR");
    
    if (/10bit/i.test(filename)) tags.push("10bit");
    
    return tags.length > 0 ? ` [${tags.join(' ')}]` : "";
}

// --- HELPER: LANGUAGE LOGIC ---
function getLanguageTag(filename) {
    const hasHindi = /Hindi/i.test(filename);
    const hasEnglish = /English|Eng/i.test(filename);
    
    if (hasHindi && hasEnglish) return "English-Hindi";
    return "Original";
}

function buildPremiumMeta(meta, quality, size, filename) {
    const isSeries = !!(meta.season || meta.episode);
    const extraInfo = getExtraInfo(filename);
    const lang = getLanguageTag(filename);
    
    let line1;
    if (isSeries) {
        const epTitle = meta.episodeTitle ? ` - ${meta.episodeTitle}` : "";
        line1 = `📺 S${meta.season}E${meta.episode}${epTitle} | ${meta.title} (${meta.year})`;
    } else {
        line1 = `🎬 ${meta.title} (${meta.year})`;
    }

    const qIcon = (quality.includes('2160') || quality.includes('4K')) ? '💎' : '📺';
    // Matches 4KHDHub layout with Language and Extra Info
    const line2 = `${qIcon} ${quality}${extraInfo} | 🌍 ${lang} | 💾 ${size || 'Unknown'}`;
    const line3 = `🎞️ MKV | ℹ️ ${filename.replace(/[^\x20-\x7E]/g, '').slice(0, 50)}...`;

    return line1 + "\n" + line2 + "\n" + line3;
}

// Remaining logic remains optimized for Android TV discovery
function extractServersFromVCloud(vcloudUrl, quality, size, meta) {
    return fetch(vcloudUrl, { headers: HEADERS }).then(res => res.text()).then(html => {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        const filename = titleMatch ? titleMatch[1].trim() : `Video.${quality}.mkv`;
        const tokenMatch = html.match(/token[=:][\s'"]*([A-Za-z0-9+/=]+)/);
        
        let dlPage = vcloudUrl;
        if (tokenMatch) dlPage = vcloudUrl.replace(/\/$/, '') + '?token=' + tokenMatch[1];

        return fetch(dlPage, { headers: HEADERS }).then(res => res.text()).then(downloadHtml => {
            let serverUrl = null;
            const gbpsRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(?:[^<]|<(?!\/a>))*Download[^<]*10\s?Gbps/gi;
            let match = gbpsRegex.exec(downloadHtml);
            if (match) serverUrl = match[1];

            if (!serverUrl) throw new Error('No Link');

            return fetch(serverUrl, { redirect: 'follow', headers: HEADERS }).then(response => {
                let finalUrl = response.url;
                if (finalUrl.includes('gamerxyt.com/dl.php')) {
                    const lMatch = finalUrl.match(/[?&]link=([^&]+)/);
                    if (lMatch) finalUrl = decodeURIComponent(lMatch[1]);
                }

                // Simplified stream object for Android TV Leanback UI compatibility
                return {
                    name: `VegaMovies | 10Gbps | ${quality}`, 
                    title: buildPremiumMeta(meta, quality, size, filename),
                    url: finalUrl,
                    quality: quality,
                    size: size,
                    behaviorHints: { 
                        notWebReady: false 
                    }
                };
            });
        });
    });
}

// Search and extraction flow (Shortened for brevity but functionally identical)
async function invokeVegaMovies(tmdbId, mediaType, seasonNum = null, episodeNum = null) {
    try {
        const tmdbUrl = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const mediaRes = await fetch(tmdbUrl).then(res => res.json());
        const title = mediaType === 'tv' ? mediaRes.name : mediaRes.title;
        const year = (mediaType === 'tv' ? mediaRes.first_air_date : mediaRes.release_date).split('-')[0];

        const meta = { title, year, season: seasonNum, episode: episodeNum };

        const searchUrl = `${BASE_URL}/search.php?q=${encodeURIComponent(title + " " + year)}`;
        const searchData = await fetch(searchUrl, { headers: HEADERS }).then(res => res.json());
        const vegaPage = searchData.hits[0].document.permalink;
        const fullVegaUrl = vegaPage.startsWith('http') ? vegaPage : BASE_URL + vegaPage;

        const pageHtml = await fetch(fullVegaUrl, { headers: HEADERS }).then(res => res.text());
        const nexLinks = [];
        const qualityBlocks = pageHtml.split(/<h[1-6]/i);
        
        for (let block of qualityBlocks) {
            const linkMatch = block.match(/<a[^>]+href="([^"]*(?:nexdrive|genxfm)[^"]*)"/i);
            if (linkMatch) {
                const resMatch = block.match(/(\d{3,4})[pP]/) || block.match(/4K/i);
                const quality = resMatch ? (resMatch[1] ? resMatch[1] + "p" : "4K") : "Unknown";
                const sizeMatch = block.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
                const size = sizeMatch ? sizeMatch[0] : "N/A";
                nexLinks.push({ url: linkMatch[1], quality, size });
            }
        }

        const streamPromises = nexLinks.map(nex => {
            return fetch(nex.url, { headers: HEADERS }).then(r => r.text())
                .then(h => {
                    const vMatch = h.match(/<a[^>]+href="([^"]*vcloud[^"]*)"[^>]*>[\s\S]*?V-Cloud/i);
                    return extractServersFromVCloud(vMatch[1], nex.quality, nex.size, meta);
                }).catch(() => null);
        });

        return (await Promise.all(streamPromises)).filter(s => s !== null);
    } catch (e) { return []; }
}

function getStreams(tmdbId, mediaType, season, episode) {
    return invokeVegaMovies(tmdbId, mediaType, season, episode);
}

module.exports = { getStreams };
