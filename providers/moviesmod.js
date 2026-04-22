// --- CONFIG ---
const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const VIDFAST_BASE = 'https://vidfast.pro';
const ENCRYPT_API = 'https://enc-dec.app/api/enc-vidfast';
const DECRYPT_API = 'https://enc-dec.app/api/dec-vidfast';
const ALLOWED_SERVERS = ['Alpha', 'Bollywood', 'Cobra', 'Max', 'Oscar', 'vEdge', 'vFast', 'vRapid'];

// --- HELPERS ---

async function parseM3U8Playlist(playlistUrl) {
    try {
        const response = await fetch(playlistUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
                'Referer': 'https://vidfast.pro/'
            }
        });
        const text = await response.text();
        if (!text.includes('#EXT-X-STREAM-INF')) return null;
        const variants = [];
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('#EXT-X-STREAM-INF')) {
                const resMatch = lines[i].match(/RESOLUTION=(\d+)x(\d+)/i);
                const urlLine = lines[i + 1]?.trim();
                if (!urlLine || urlLine.startsWith('#')) continue;
                let vUrl = urlLine.startsWith('http') ? urlLine : playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1) + urlLine;
                variants.push({ url: vUrl, quality: resMatch ? resMatch[2] + 'p' : 'Auto' });
            }
        }
        return variants;
    } catch (e) { return null; }
}

// --- PRIMARY: VIDFAST (YOUR EXACT LOGIC) ---

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

        const pageText = await (await fetch(pageUrl, { headers })).text();
        let rawData = pageText.match(/"en":"([^"]+)"/)?.[1] || pageText.match(/data\s*=\s*"([^"]+)"/)?.[1];
        if (!rawData) return [];

        const apiRes = await fetch(`${ENCRYPT_API}?text=${encodeURIComponent(rawData)}&version=1`);
        const apiData = await apiRes.json();
        if (!apiData?.result) return [];
        if (apiData.result.token) headers['X-CSRF-Token'] = apiData.result.token;

        const sEnc = await (await fetch(apiData.result.servers, { method: 'POST', headers })).text();
        const sDec = await (await fetch(DECRYPT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: sEnc, version: '1' })
        })).json();

        const serverList = (sDec?.result || []).filter(s => ALLOWED_SERVERS.includes(s.name));
        const streams = [];

        for (const sObj of serverList) {
            try {
                const stEnc = await (await fetch(`${apiData.result.stream}/${sObj.data}`, { method: 'POST', headers })).text();
                const stDec = await (await fetch(DECRYPT_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: stEnc, version: '1' })
                })).json();

                if (stDec.result?.url) {
                    const videoUrl = stDec.result.url;
                    if (videoUrl.includes('.m3u8')) {
                        const vars = await parseM3U8Playlist(videoUrl);
                        if (vars) {
                            vars.forEach(v => streams.push({ name: `VidFast ${sObj.name} ${v.quality}`, url: v.url, quality: v.quality }));
                            continue;
                        }
                    }
                    streams.push({ name: `VidFast ${sObj.name}`, url: videoUrl, quality: 'Auto' });
                }
            } catch (e) {}
        }
        return streams.map(s => ({ ...s, title: `${mediaInfo.title} (${mediaInfo.year})`, provider: 'vidfast' }));
    } catch (e) { return []; }
}

// --- FALLBACKS ---

async function scrapeVidLink(tmdbId, type, season, episode) {
    try {
        const enc = await (await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`)).json();
        const url = type === 'tv' ? `https://vidlink.pro/api/b/tv/${enc.result}/${season}/${episode}` : `https://vidlink.pro/api/b/movie/${enc.result}`;
        const data = await (await fetch(url)).json();
        return data?.stream?.playlist ? [{ name: 'VidLink Primary', url: data.stream.playlist, quality: 'Auto', provider: 'vidlink' }] : [];
    } catch (e) { return []; }
}

// --- MAIN ---

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = 1, episodeNum = 1) {
    try {
        // 1. Resolve Meta
        const tmdbUrl = `${TMDB_BASE_URL}/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const meta = await (await fetch(tmdbUrl)).json();
        const mediaInfo = {
            title: meta.name || meta.title || 'Unknown',
            year: (meta.first_air_date || meta.release_date || '').substring(0, 4),
            mediaType: mediaType
        };

        // 2. Launch Providers In Parallel (Settled prevents one crash from killing the other)
        const results = await Promise.allSettled([
            scrapeVidFast(tmdbId, mediaInfo, seasonNum, episodeNum),
            scrapeVidLink(tmdbId, mediaType, seasonNum, episodeNum)
        ]);

        const allStreams = results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value)
            .flat();

        // 3. Final Dedupe
        const seen = new Set();
        return allStreams.filter(s => {
            if (!s.url || seen.has(s.url)) return false;
            seen.add(s.url);
            return true;
        });

    } catch (e) { return []; }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
