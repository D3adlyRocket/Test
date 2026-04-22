// Multi-Provider Scraper Integrated for Mobile and Android TV
// Priority: VidFast (Full Implementation)

// --- CONFIG & CONSTANTS ---
const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const VIDFAST_BASE = 'https://vidfast.pro';
const ENCRYPT_API = 'https://enc-dec.app/api/enc-vidfast';
const DECRYPT_API = 'https://enc-dec.app/api/dec-vidfast';
const ALLOWED_SERVERS = ['Alpha', 'Bollywood', 'Cobra', 'Max', 'Oscar', 'vEdge', 'vFast', 'vRapid'];

// --- UTILS ---

async function getJson(url, options) {
    const response = await fetch(url, options || {});
    if (!response.ok) throw new Error('J-Fail');
    return await response.json();
}

async function getText(url, options) {
    const response = await fetch(url, options || {});
    if (!response.ok) throw new Error('T-Fail');
    return await response.text();
}

// Parse HLS master playlist for quality variants (TV Compatible)
async function parseM3U8Playlist(playlistUrl) {
    try {
        const response = await fetch(playlistUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
                'Referer': 'https://vidfast.pro/'
            }
        });
        if (!response.ok) return null;
        const text = await response.text();
        if (!text.includes('#EXT-X-STREAM-INF')) return null;
        
        const variants = [];
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('#EXT-X-STREAM-INF')) {
                const resMatch = lines[i].match(/RESOLUTION=(\d+)x(\d+)/i);
                const urlLine = lines[i + 1]?.trim();
                if (!urlLine || urlLine.startsWith('#')) continue;
                let vUrl = urlLine.startsWith('http') ? urlLine : playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1) + urlLine;
                let quality = 'Unknown';
                if (resMatch) {
                    const h = parseInt(resMatch[2]);
                    quality = h >= 2160 ? '4K' : h >= 1080 ? '1080p' : h >= 720 ? '720p' : h >= 480 ? '480p' : h >= 360 ? '360p' : h + 'p';
                }
                variants.push({ url: vUrl, quality: quality });
            }
        }
        return variants.length > 0 ? variants : null;
    } catch (e) { return null; }
}

async function getTMDBDetails(tmdbId, mediaType) {
    const url = `${TMDB_BASE_URL}/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const data = await getJson(url);
    return {
        title: mediaType === 'tv' ? data.name : data.title,
        year: (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4) || '',
        mediaType: mediaType === 'tv' ? 'tv' : 'movie'
    };
}

// --- RESOLVERS ---

async function resolveVidFast(tmdbId, mediaInfo, season, episode) {
    try {
        const pageUrl = mediaInfo.mediaType === 'tv' 
            ? `${VIDFAST_BASE}/tv/${tmdbId}/${season || 1}/${episode || 1}` 
            : `${VIDFAST_BASE}/movie/${tmdbId}`;

        const headers = {
            'Accept': '*/*',
            'Origin': 'https://vidfast.pro',
            'Referer': pageUrl,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15',
            'X-Requested-With': 'XMLHttpRequest'
        };

        const pageText = await getText(pageUrl, { headers });
        let rawData = null;
        const nextDataMatch = pageText.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        if (nextDataMatch) {
            const dataMatch = nextDataMatch[1].match(/"en":"([^"]+)"/);
            if (dataMatch) rawData = dataMatch[1];
        }
        if (!rawData) {
            const pats = [/"en":"([^"]+)"/, /'en':'([^']+)'/, /data\s*=\s*"([^"]+)"/];
            for (const p of pats) {
                const m = pageText.match(p);
                if (m) { rawData = m[1]; break; }
            }
        }
        if (!rawData) return [];

        const apiData = await getJson(`${ENCRYPT_API}?text=${encodeURIComponent(rawData)}&version=1`);
        if (apiData.result.token) headers['X-CSRF-Token'] = apiData.result.token;

        const sEnc = await getText(apiData.result.servers, { method: 'POST', headers });
        const sDec = await getJson(DECRYPT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: sEnc, version: '1' })
        });

        const serverList = (sDec.result || []).filter(s => ALLOWED_SERVERS.includes(s.name));
        const rawStreams = [];

        for (const sObj of serverList) {
            try {
                const stEnc = await getText(`${apiData.result.stream}/${sObj.data}`, { method: 'POST', headers });
                const stDec = await getJson(DECRYPT_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: stEnc, version: '1' })
                });
                if (stDec.result?.url) {
                    rawStreams.push({ serverName: sObj.name, url: stDec.result.url, isM3U8: stDec.result.url.includes('.m3u8') });
                }
            } catch (e) {}
        }

        const parsePromises = rawStreams.map(async (rs) => {
            if (rs.isM3U8) {
                const vars = await parseM3U8Playlist(rs.url);
                if (vars) return vars.map(v => ({ name: `VidFast ${rs.serverName} - ${v.quality}`, url: v.url, quality: v.quality }));
            }
            return [{ name: `VidFast ${rs.serverName}`, url: rs.url, quality: 'Auto' }];
        });

        const results = await Promise.all(parsePromises);
        return results.flat().map(s => ({
            ...s,
            title: `${mediaInfo.title} (${mediaInfo.year})`,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://vidfast.pro/' },
            provider: 'vidfast'
        }));
    } catch (e) { return []; }
}

async function resolveVidEasy(tmdbId, mediaType, season, episode) {
    try {
        const enc = await getText(`https://api.videasy.net/cdn/sources-with-title?tmdbId=${tmdbId}&mediaType=${mediaType}&seasonId=${season || 1}&episodeId=${episode || 1}`);
        const dec = await getJson('https://enc-dec.app/api/dec-videasy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: enc, id: String(tmdbId) })
        });
        return (dec.result?.sources || []).map(s => ({
            name: `VidEasy ${s.quality}`,
            url: s.url,
            quality: s.quality,
            provider: 'videasy'
        }));
    } catch (e) { return []; }
}

// --- MAIN ---

async function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
    try {
        const mediaInfo = await getTMDBDetails(tmdbId, mediaType);
        const resolvers = [
            resolveVidFast(tmdbId, mediaInfo, season, episode),
            resolveVidEasy(tmdbId, mediaType, season, episode)
        ];
        
        const results = await Promise.all(resolvers);
        const merged = results.flat();
        
        const seen = new Set();
        return merged.filter(s => {
            if (!s.url || seen.has(s.url)) return false;
            seen.add(s.url);
            return true;
        }).slice(0, 40);
    } catch (e) { return []; }
}

module.exports = { getStreams };
