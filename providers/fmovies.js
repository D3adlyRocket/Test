/**
 * PlayIMDb - Enhanced with Every Proxy Bypass for UK ISPs
 * Environment: Nuvio (Android TV / Nvidia Shield)
 */

const HOST = "https://vsembed.ru";
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE = 'https://api.themoviedb.org/3';

/**
 * Updated safeFetch to route through your Android Phone (Every Proxy)
 * to bypass UK ISP blocking on Nvidia Shield.
 */
async function safeFetch(url, options = {}) {
    // 1. Get this IP from the 'Every Proxy' app on your Android phone
    const phoneProxy = "http://127.0.0.1:8080/"; 
    
    // 2. We prefix the URL to route it through your phone's connection
    const proxiedUrl = phoneProxy + url;

    if (typeof fetchv2 === 'function') {
        const headers = options.headers || {};
        const method = options.method || 'GET';
        const body = options.body || null;
        try {
            // Nuvio's internal fetchv2 using the proxied path
            return await fetchv2(proxiedUrl, headers, method, body, true, options.encoding || 'utf-8');
        } catch (e) {
            console.error("Proxy Fetch failed:", url, e);
        }
    }
    return fetch(proxiedUrl, options);
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
    const playUrl = `${baseUrl}/embed/${imdbId}/`;
    const seStr = type === 'tv' ? ` S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}` : "";

    const res = await safeFetch(playUrl);
    const html = res && res.ok ? await res.text() : '';
    
    let movieTitle = media.title;
    if (!movieTitle || movieTitle === "Unknown") {
        const docTitle = (html.match(/<title>([^<]+)<\/title>/i) || [])[1];
        if (docTitle) movieTitle = docTitle.split('(')[0].trim();
    }
    if (!movieTitle) movieTitle = "Unknown";

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

    const pageRes = await safeFetch(targetUrl, { headers: { Referer: baseUrl + '/' } });
    const pageHtml = pageRes && pageRes.ok ? await pageRes.text() : '';
    
    const iframeMatch = pageHtml.match(/iframe id="player_iframe" src="([^"]+)"/);
    let iframeSrc = iframeMatch ? iframeMatch[1] : (pageHtml.match(/<iframe[^>]+src=["']([^"']+)["']/) || [])[1];
    
    if (iframeSrc) {
        const cloudBase = (iframeSrc.startsWith('//') ? "https:" + iframeSrc : (iframeSrc.startsWith('/') ? baseUrl + iframeSrc : iframeSrc));
        const cloudRes = await safeFetch(cloudBase, { headers: { Referer: targetUrl } });
        const cloudHtml = cloudRes && cloudRes.ok ? await cloudRes.text() : '';
        let prorcpPath = (cloudHtml.match(/src\s*:\s*['"](\/prorcp\/[^'"]+)['"]/) || [])[1];
        
        if (prorcpPath) {
            const prorcpUrl = new URL(cloudBase).origin + prorcpPath;
            const finalRes = await safeFetch(prorcpUrl, { headers: { Referer: cloudBase } });
            const finalHtml = finalRes && finalRes.ok ? await finalRes.text() : '';

            const hidden = finalHtml.match(/<div id="([^"]+)"[^>]*style=["']display\s*:\s*none;?["'][^>]*>([a-zA-Z0-9:\/.,{}\-_=+ ]+)<\/div>/);
            if (hidden) {
                const divId = hidden[1];
                const divText = hidden[2];
                const decRes = await safeFetch('https://enc-dec.app/api/dec-cloudnestra', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: divText, div_id: divId })
                });
                const decJson = decRes && decRes.ok ? await decRes.json() : null;
                const urls = decJson && Array.isArray(decJson.result) ? [...new Set(decJson.result)] : [];

                if (urls.length > 0) {
                    const streams = [];
                    const seenKeys = new Set();
                    
                    for (const url of urls) {
                        const quality = toQualityLabel(url);
                        const lang = detectLanguage(url);
                        
                        const dedupKey = `${quality}-${lang}`;
                        if (!seenKeys.has(dedupKey)) {
                            seenKeys.add(dedupKey);
                            streams.push({
                                name: `${movieTitle} | ${quality} | Server ${streams.length + 1}`,
                                title: `${mediaTitle}\n[${lang}] Direct Stream`,
                                url: url,
                                quality: quality,
                                headers: { Referer: 'https://cloudnestra.com/' },
                                provider: 'playimdb'
                            });
                        }
                    }
                    return streams;
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
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
