// --- CONSTANTS ---
const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const VIDFAST_BASE = 'https://vidfast.pro';
const ENCRYPT_API = 'https://enc-dec.app/api/enc-vidfast';
const DECRYPT_API = 'https://enc-dec.app/api/dec-vidfast';
const ALLOWED_SERVERS = ['Alpha', 'Bollywood', 'Cobra', 'Max', 'Oscar', 'vEdge', 'vFast', 'vRapid'];

// --- HELPERS ---

async function safeFetchJson(url, options = {}) {
    try {
        const res = await fetch(url, options);
        return res.ok ? await res.json() : null;
    } catch (e) { return null; }
}

async function safeFetchText(url, options = {}) {
    try {
        const res = await fetch(url, options);
        return res.ok ? await res.text() : null;
    } catch (e) { return null; }
}

async function parseM3U8(playlistUrl) {
    const text = await safeFetchText(playlistUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
            'Referer': 'https://vidfast.pro/'
        }
    });
    if (!text || !text.includes('#EXT-X-STREAM-INF')) return null;
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
}

// --- PROVIDERS ---

async function getVidFast(tmdbId, type, season, episode, title, year) {
    const pageUrl = type === 'tv' ? `${VIDFAST_BASE}/tv/${tmdbId}/${season}/${episode}` : `${VIDFAST_BASE}/movie/${tmdbId}`;
    const headers = {
        'Origin': 'https://vidfast.pro',
        'Referer': pageUrl,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15',
        'X-Requested-With': 'XMLHttpRequest'
    };

    const pageText = await safeFetchText(pageUrl, { headers });
    if (!pageText) return [];

    let rawData = pageText.match(/"en":"([^"]+)"/)?.[1] || pageText.match(/data\s*=\s*"([^"]+)"/)?.[1];
    if (!rawData) return [];

    const apiData = await safeFetchJson(`${ENCRYPT_API}?text=${encodeURIComponent(rawData)}&version=1`);
    if (!apiData?.result) return [];
    if (apiData.result.token) headers['X-CSRF-Token'] = apiData.result.token;

    const sEnc = await safeFetchText(apiData.result.servers, { method: 'POST', headers });
    const sDec = await safeFetchJson(DECRYPT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sEnc, version: '1' })
    });

    const serverList = (sDec?.result || []).filter(s => ALLOWED_SERVERS.includes(s.name));
    let streams = [];

    for (const sObj of serverList) {
        const stEnc = await safeFetchText(`${apiData.result.stream}/${sObj.data}`, { method: 'POST', headers });
        const stDec = await safeFetchJson(DECRYPT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: stEnc, version: '1' })
        });

        if (stDec?.result?.url) {
            if (stDec.result.url.includes('.m3u8')) {
                const vars = await parseM3U8(stDec.result.url);
                if (vars) {
                    vars.forEach(v => streams.push({ name: `VidFast ${sObj.name} ${v.quality}`, url: v.url, quality: v.quality }));
                    continue;
                }
            }
            streams.push({ name: `VidFast ${sObj.name}`, url: stDec.result.url, quality: 'Auto' });
        }
    }
    return streams.map(s => ({ ...s, title: `${title} (${year})`, provider: 'vidfast', headers: { 'Referer': 'https://vidfast.pro/' } }));
}

async function getVidLink(tmdbId, type, season, episode) {
    try {
        const enc = await safeFetchJson(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`);
        const url = type === 'tv' ? `https://vidlink.pro/api/b/tv/${enc.result}/${season}/${episode}` : `https://vidlink.pro/api/b/movie/${enc.result}`;
        const data = await safeFetchJson(url);
        return data?.stream?.playlist ? [{ name: 'VidLink Primary', url: data.stream.playlist, quality: 'Auto', provider: 'vidlink' }] : [];
    } catch (e) { return []; }
}

// --- MAIN ---

async function getStreams(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
    // 1. Get TMDB Meta First (Critical for titles)
    const meta = await safeFetchJson(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const title = meta?.name || meta?.title || 'Unknown';
    const year = (meta?.first_air_date || meta?.release_date || '').substring(0, 4);

    let allStreams = [];

    // 2. Execute Providers with independent error handling
    try {
        const vf = await getVidFast(tmdbId, mediaType, season, episode, title, year);
        if (vf) allStreams = allStreams.concat(vf);
    } catch (e) {}

    try {
        const vl = await getVidLink(tmdbId, mediaType, season, episode);
        if (vl) allStreams = allStreams.concat(vl);
    } catch (e) {}

    // 3. Deduplicate and return
    const seen = new Set();
    return allStreams.filter(s => {
        if (!s.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
}

module.exports = { getStreams };
