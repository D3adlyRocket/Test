// Master Integrated Scraper for Nuvio
// Optimized for Android TV and Mobile
// This version strictly uses your working VidFast logic as the primary source.

const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const VIDFAST_BASE = 'https://vidfast.pro';
const ENCRYPT_API = 'https://enc-dec.app/api/enc-vidfast';
const DECRYPT_API = 'https://enc-dec.app/api/dec-vidfast';
const ALLOWED_SERVERS = ['Alpha', 'Bollywood', 'Cobra', 'Max', 'Oscar', 'vEdge', 'vFast', 'vRapid'];

// --- PRIMARY RESOLVER: VIDFAST (YOUR WORKING CODE) ---

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
            const line = lines[i].trim();
            if (line.startsWith('#EXT-X-STREAM-INF')) {
                const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
                const urlLine = lines[i + 1]?.trim();
                if (!urlLine || urlLine.startsWith('#')) continue;
                let vUrl = urlLine.startsWith('http') ? urlLine : playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1) + urlLine;
                let quality = 'Unknown';
                if (resMatch) {
                    const h = parseInt(resMatch[2]);
                    if (h >= 2160) quality = '4K';
                    else if (h >= 1080) quality = '1080p';
                    else if (h >= 720) quality = '720p';
                    else quality = h + 'p';
                }
                variants.push({ url: vUrl, quality: quality });
            }
        }
        return variants.length > 0 ? variants : null;
    } catch (e) { return null; }
}

async function scrapeVidFast(tmdbId, mediaInfo, seasonNum, episodeNum) {
    try {
        const pageUrl = mediaInfo.mediaType === 'tv' 
            ? `${VIDFAST_BASE}/tv/${tmdbId}/${seasonNum}/${episodeNum}` 
            : `${VIDFAST_BASE}/movie/${tmdbId}`;

        const headers = {
            'Accept': '*/*',
            'Origin': 'https://vidfast.pro',
            'Referer': pageUrl,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15',
            'X-Requested-With': 'XMLHttpRequest'
        };

        const pageRes = await fetch(pageUrl, { headers });
        const pageText = await pageRes.text();
        
        let rawData = null;
        const nextDataMatch = pageText.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        if (nextDataMatch) {
            const dataMatch = nextDataMatch[1].match(/"en":"([^"]+)"/);
            if (dataMatch) rawData = dataMatch[1];
        }
        if (!rawData) {
            const patterns = [/"en":"([^"]+)"/, /'en':'([^']+)'/, /data\s*=\s*"([^"]+)"/];
            for (const p of patterns) {
                const m = pageText.match(p);
                if (m) { rawData = m[1]; break; }
            }
        }
        if (!rawData) return [];

        const apiRes = await fetch(`${ENCRYPT_API}?text=${encodeURIComponent(rawData)}&version=1`);
        const apiData = await apiRes.json();
        if (apiData.result?.token) headers['X-CSRF-Token'] = apiData.result.token;

        const sRes = await fetch(apiData.result.servers, { method: 'POST', headers });
        const sEnc = await sRes.text();
        const decRes = await fetch(DECRYPT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: sEnc, version: '1' })
        });
        const decData = await decRes.json();

        const serverList = (decData.result || []).filter(s => ALLOWED_SERVERS.includes(s.name));
        const streams = [];

        for (const sObj of serverList) {
            try {
                const stRes = await fetch(`${apiData.result.stream}/${sObj.data}`, { method: 'POST', headers });
                const stEnc = await stRes.text();
                const stDecRes = await fetch(DECRYPT_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: stEnc, version: '1' })
                });
                const stDec = await stDecRes.json();

                if (stDec.result?.url) {
                    const videoUrl = stDec.result.url;
                    if (videoUrl.includes('.m3u8')) {
                        const vars = await parseM3U8Playlist(videoUrl);
                        if (vars) {
                            vars.forEach(v => {
                                streams.push({
                                    name: `VidFast ${sObj.name} - ${v.quality}`,
                                    title: `${mediaInfo.title} (${mediaInfo.year})`,
                                    url: v.url,
                                    quality: v.quality,
                                    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidfast.pro/' },
                                    provider: 'vidfast'
                                });
                            });
                            continue;
                        }
                    }
                    streams.push({
                        name: `VidFast ${sObj.name}`,
                        title: `${mediaInfo.title} (${mediaInfo.year})`,
                        url: videoUrl,
                        quality: 'Auto',
                        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidfast.pro/' },
                        provider: 'vidfast'
                    });
                }
            } catch (e) {}
        }
        return streams;
    } catch (e) { return []; }
}

// --- MAIN INTEGRATION ---

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = 1, episodeNum = 1) {
    try {
        // 1. Get TMDB Meta
        const metaRes = await fetch(`${TMDB_BASE_URL}/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const meta = await metaRes.json();
        const mediaInfo = {
            title: mediaType === 'tv' ? meta.name : meta.title,
            year: (mediaType === 'tv' ? meta.first_air_date : meta.release_date)?.substring(0, 4) || '',
            mediaType: mediaType
        };

        // 2. Execute Primary VidFast Scraper
        const vidFastResults = await scrapeVidFast(tmdbId, mediaInfo, seasonNum, episodeNum);
        
        // 3. Fallback for other providers (Only if VidFast returns nothing or to supplement)
        let otherResults = [];
        try {
            // Simplified VidLink for TV
            const linkEncRes = await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`);
            const linkEnc = await linkEncRes.json();
            const linkUrl = mediaType === 'tv' ? `https://vidlink.pro/api/b/tv/${linkEnc.result}/${seasonNum}/${episodeNum}` : `https://vidlink.pro/api/b/movie/${linkEnc.result}`;
            const linkRes = await fetch(linkUrl);
            const linkData = await linkRes.json();
            if (linkData?.stream?.playlist) {
                otherResults.push({
                    name: 'VidLink Primary',
                    title: `${mediaInfo.title} (${mediaInfo.year})`,
                    url: linkData.stream.playlist,
                    quality: 'Auto',
                    provider: 'vidlink'
                });
            }
        } catch (e) {}

        const merged = [...vidFastResults, ...otherResults];
        
        // 4. Final Deduplication
        const seen = new Set();
        return merged.filter(s => {
            if (!s.url || seen.has(s.url)) return false;
            seen.add(s.url);
            return true;
        }).slice(0, 40);

    } catch (e) {
        return [];
    }
}

if (typeof module !== 'undefined') {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
