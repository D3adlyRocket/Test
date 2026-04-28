/**
 * PlayIMDb - Updated for streamimdb.ru & Brightpath/Strategic
 * Targets: streamimdb.ru, brightpathsignals.com
 */

const HOST = "https://streamimdb.ru";
const TMDB_API_KEY = '1b3113663c9004682ed61086cf967c44';
const TMDB_BASE = 'https://api.themoviedb.org/3';

// The specific headers required by the new provider
const STREAM_HEADERS = {
    'Origin': 'https://brightpathsignals.com',
    'Referer': 'https://brightpathsignals.com/',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36',
    'Accept': '*/*'
};

async function safeFetch(url, options = {}) {
    if (typeof fetchv2 === 'function') {
        const headers = options.headers || {};
        const method = options.method || 'GET';
        const body = options.body || null;
        try {
            return await fetchv2(url, headers, method, body, true, options.encoding || 'utf-8');
        } catch (e) {
            console.error("Fetch failed:", url, e);
        }
    }
    return fetch(url, options);
}

function toQualityLabel(text) {
    const val = String(text || '').toLowerCase();
    if (val.includes('2160') || val.includes('4k')) return '2160p';
    if (val.includes('1440')) return '1440p';
    if (val.includes('1080')) return '1080p';
    if (val.includes('720')) return '720p';
    return 'HD';
}

async function getTMDBInfo(id, type) {
    let url = `${TMDB_BASE}/${type === 'tv' ? 'tv' : 'movie'}/${id}?api_key=${TMDB_API_KEY}`;
    
    if (String(id).startsWith('tt')) {
        url = `${TMDB_BASE}/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const res = await safeFetch(url);
        const data = res && res.ok ? await res.json() : null;
        if (data) {
            const result = (type === 'tv' ? data.tv_results[0] : data.movie_results[0]);
            if (result) {
                return {
                    title: result.title || result.name,
                    year: (result.release_date || result.first_air_date || "").split("-")[0],
                    imdbId: id
                };
            }
        }
    }

    const res = await safeFetch(url);
    const data = res && res.ok ? await res.json() : null;
    if (!data) return null;

    const info = {
        title: data.title || data.name,
        year: (data.release_date || data.first_air_date || "").split("-")[0],
        imdbId: data.imdb_id || id
    };

    if (!info.imdbId && type === 'tv') {
        const extRes = await safeFetch(`${TMDB_BASE}/tv/${id}/external_ids?api_key=${TMDB_API_KEY}`);
        const ext = extRes && extRes.ok ? await extRes.json() : null;
        if (ext) info.imdbId = ext.imdb_id;
    }
    return info;
}

function detectLanguage(url) {
    const lowUrl = url.toLowerCase();
    if (lowUrl.includes('_hi') || lowUrl.includes('hindi')) return 'HN';
    if (lowUrl.includes('_ta') || lowUrl.includes('tamil')) return 'TM';
    if (lowUrl.includes('_te') || lowUrl.includes('telugu')) return 'TL';
    return 'EN';
}

async function resolveDirectStreams(media, type, season, episode) {
    const imdbId = media.imdbId;
    const baseUrl = HOST;
    
    // Updated path logic for streamimdb.ru/embed/movie/tt...
    const playUrl = `${baseUrl}/embed/${type === 'tv' ? 'tv' : 'movie'}/${imdbId}`;
    const seStr = type === 'tv' ? ` S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}` : "";

    const res = await safeFetch(playUrl);
    const html = res && res.ok ? await res.text() : '';
    
    let movieTitle = media.title || "Unknown";
    const mediaTitle = `${movieTitle} (${media.year || "N/A"})${seStr}`;

    let targetUrl = playUrl;
    if (type === 'tv') {
        const epDivs = html.match(/<div[^>]+class=["']ep[^>]*>.*?<\/div>/gi) || [];
        for (const div of epDivs) {
            if (div.includes(`data-s="${season}"`) && div.includes(`data-e="${episode}"`)) {
                const iMatch = div.match(/data-iframe=["']([^"']+)["']/i);
                if (iMatch) {
                    targetUrl = iMatch[1].startsWith('/') ? `${baseUrl}${iMatch[1]}` : iMatch[1];
                }
                break;
            }
        }
    }

    // Extract the brightpath/strategicgrowth iframe
    const pageRes = await safeFetch(targetUrl, { headers: { Referer: baseUrl + '/' } });
    const pageHtml = pageRes && pageRes.ok ? await pageRes.text() : '';
    
    const iframeMatch = pageHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    let iframeSrc = iframeMatch ? iframeMatch[1] : null;
    
    if (iframeSrc) {
        if (iframeSrc.startsWith('//')) iframeSrc = "https:" + iframeSrc;
        
        const cloudRes = await safeFetch(iframeSrc, { headers: { Referer: targetUrl } });
        const cloudHtml = cloudRes && cloudRes.ok ? await cloudRes.text() : '';
        
        // Find the encrypted data path (prorcp)
        let prorcpPath = (cloudHtml.match(/src\s*:\s*['"](\/prorcp\/[^'"]+)['"]/) || [])[1];
        
        if (prorcpPath) {
            const prorcpUrl = new URL(iframeSrc).origin + prorcpPath;
            const finalRes = await safeFetch(prorcpUrl, { headers: { Referer: iframeSrc } });
            const finalHtml = finalRes && finalRes.ok ? await finalRes.text() : '';

            const hidden = finalHtml.match(/<div id="([^"]+)"[^>]*style=["']display\s*:\s*none;?["'][^>]*>([a-zA-Z0-9:\/.,{}\-_=+ ]+)<\/div>/);
            
            if (hidden) {
                const divId = hidden[1];
                const divText = hidden[2];
                
                // Call external decryption for the new cloudnestra/brightpath patterns
                const decRes = await safeFetch('https://enc-dec.app/api/dec-cloudnestra', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: divText, div_id: divId })
                });
                
                const decJson = decRes && decRes.ok ? await decRes.json() : null;
                const urls = decJson && Array.isArray(decJson.result) ? [...new Set(decJson.result)] : [];

                if (urls.length > 0) {
                    return urls.map((url, idx) => {
                        const quality = toQualityLabel(url);
                        const lang = detectLanguage(url);
                        return {
                            name: `${movieTitle} | ${quality} | Server ${idx + 1}`,
                            title: `${mediaTitle}\n[${lang}] Direct Stream`,
                            url: url,
                            quality: quality,
                            headers: STREAM_HEADERS,
                            provider: 'playimdb'
                        };
                    });
                }
            }
        }
    }

    return [];
}

async function getStreams(tmdbId, type, season, episode) {
    try {
        const media = await getTMDBInfo(tmdbId, type);
        const finalMedia = media || { title: "Unknown", year: "N/A", imdbId: tmdbId };
        return await resolveDirectStreams(finalMedia, type, season, episode);
    } catch (e) {
        console.error("Stream resolution error:", e);
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
