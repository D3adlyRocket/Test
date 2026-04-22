// Master Integrated Scraper: VidFast, VidLink, VidMody, VidSrc, VidEasy
// Optimized for Mobile and Android TV

const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const VIDFAST_BASE = 'https://vidfast.pro';
const ENCRYPT_API = 'https://enc-dec.app/api/enc-vidfast';
const DECRYPT_API = 'https://enc-dec.app/api/dec-vidfast';
const ALLOWED_SERVERS = ['Alpha', 'Cobra', 'Max', 'Oscar', 'vEdge', 'vFast', 'vRapid'];

// --- UTILS & PARSERS ---

async function parseM3U8Playlist(playlistUrl) {
    try {
        const response = await fetch(playlistUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
                'Referer': 'https://vidfast.pro/'
            }
        });
        if (!response.ok) return null;
        const playlistText = await response.text();
        if (!playlistText.includes('#EXT-X-STREAM-INF')) return null;

        const variants = [];
        const lines = playlistText.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXT-X-STREAM-INF')) {
                const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
                const urlLine = lines[i + 1]?.trim();
                if (!urlLine || urlLine.startsWith('#')) continue;

                let variantUrl = urlLine.startsWith('http') ? urlLine : playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1) + urlLine;
                let quality = 'Unknown';
                if (resolutionMatch) {
                    const height = parseInt(resolutionMatch[2]);
                    if (height >= 2160) quality = '2160p';
                    else if (height >= 1080) quality = '1080p';
                    else if (height >= 720) quality = '720p';
                    else quality = `${height}p`;
                }
                variants.push({ url: variantUrl, quality: quality });
            }
        }
        return variants.length > 0 ? variants : null;
    } catch (error) { return null; }
}

async function getTMDBDetails(tmdbId, mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        const isTv = mediaType === 'tv';
        return {
            title: isTv ? data.name : data.title,
            year: (isTv ? data.first_air_date : data.release_date)?.substring(0, 4) || '',
            mediaType: isTv ? 'tv' : 'movie'
        };
    } catch (e) { return { title: "Unknown", year: "", mediaType }; }
}

// --- PROVIDER: VIDFAST ---

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

        const pageResponse = await fetch(pageUrl, { headers });
        const pageText = await pageResponse.text();

        let rawData = null;
        const nextDataMatch = pageText.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        if (nextDataMatch) {
            try {
                const jsonData = JSON.parse(nextDataMatch[1]);
                rawData = JSON.stringify(jsonData).match(/"en":"([^"]+)"/)?.[1];
            } catch (e) {}
        }
        if (!rawData) {
            rawData = pageText.match(/"en":"([^"]+)"/)?.[1] || pageText.match(/data\s*=\s*"([^"]+)"/)?.[1];
        }
        if (!rawData) return [];

        const apiData = await (await fetch(`${ENCRYPT_API}?text=${encodeURIComponent(rawData)}&version=1`)).json();
        if (apiData.status !== 200 || !apiData.result) return [];

        if (apiData.result.token) headers['X-CSRF-Token'] = apiData.result.token;

        const serversEncrypted = await (await fetch(apiData.result.servers, { method: 'POST', headers })).text();
        const decryptData = await (await fetch(DECRYPT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: serversEncrypted, version: '1' })
        })).json();

        let serverList = (decryptData.result || []).filter(s => ALLOWED_SERVERS.includes(s.name));
        const streams = [];

        for (const sObj of serverList) {
            try {
                const streamEnc = await (await fetch(`${apiData.result.stream}/${sObj.data}`, { method: 'POST', headers })).text();
                const sDec = await (await fetch(DECRYPT_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: streamEnc, version: '1' })
                })).json();

                const data = sDec.result;
                if (!data?.url) continue;

                if (data.url.includes('.m3u8')) {
                    const variants = await parseM3U8Playlist(data.url);
                    if (variants) {
                        variants.forEach(v => {
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
                    url: data.url,
                    quality: data.quality || 'Auto',
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidfast.pro/' },
                    provider: 'vidfast'
                });
            } catch (e) {}
        }
        return streams;
    } catch (error) { return []; }
}

// --- PROVIDER: VIDLINK ---

async function scrapeVidLink(tmdbId, mediaType, season, episode, mediaInfo) {
    try {
        const vlEncRes = await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`);
        const vlEnc = await vlEncRes.json();
        const vlUrl = mediaType === 'tv' ? `https://vidlink.pro/api/b/tv/${vlEnc.result}/${season}/${episode}` : `https://vidlink.pro/api/b/movie/${vlEnc.result}`;
        const vlRes = await fetch(vlUrl);
        const vlData = await vlRes.json();
        if (vlData?.stream?.playlist) {
            return [{
                name: 'VidLink Primary',
                title: `${mediaInfo.title} (${mediaInfo.year})`,
                url: vlData.stream.playlist,
                quality: 'Auto',
                provider: 'vidlink'
            }];
        }
    } catch (e) {}
    return [];
}

// --- MAIN FUNCTION ---

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = 1, episodeNum = 1) {
    console.log(`[Scraper] Starting for TMDB: ${tmdbId}`);
    
    // 1. Get Metadata
    const mediaInfo = await getTMDBDetails(tmdbId, mediaType);
    
    // 2. Run Scrapers
    const [vidfastResults, vidlinkResults] = await Promise.all([
        scrapeVidFast(tmdbId, mediaInfo, seasonNum, episodeNum),
        scrapeVidLink(tmdbId, mediaType, seasonNum, episodeNum, mediaInfo)
    ]);

    const combined = [...vidfastResults, ...vidlinkResults];

    // 3. Deduplicate and Sort
    const uniqueStreams = [];
    const seenUrls = new Set();
    combined.forEach(s => {
        if (!seenUrls.has(s.url)) {
            seenUrls.add(s.url);
            uniqueStreams.push(s);
        }
    });

    return uniqueStreams.sort((a, b) => {
        const q = { '2160p': 2160, '1080p': 1080, '720p': 720, '480p': 480, '360p': 360, 'Auto': 0, 'Unknown': 0 };
        return (q[b.quality] || 0) - (q[a.quality] || 0);
    });
}

// --- EXPORT ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
