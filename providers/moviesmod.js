// --- UTILS ---

async function getJson(url, options) {
    const response = await fetch(url, options || {});
    if (!response.ok) throw new Error('Request failed');
    return response.json();
}

async function getText(url, options) {
    const response = await fetch(url, options || {});
    if (!response.ok) throw new Error('Request failed');
    return response.text();
}

function normalizeQuality(label) {
    const text = (label || '').toString();
    const match = text.match(/(2160p|1440p|1080p|720p|480p|360p|4K)/i);
    return match ? match[1].toUpperCase() : 'Auto';
}

function streamObject(provider, title, url, quality, headers) {
    if (!url || typeof url !== 'string') return null;
    return {
        name: provider,
        title: title || provider,
        url: url,
        quality: quality || 'Auto',
        headers: headers || undefined
    };
}

function dedupeStreams(streams) {
    const seen = new Set();
    return (streams || []).filter(stream => {
        if (!stream || !stream.url || seen.has(stream.url)) return false;
        seen.add(stream.url);
        return true;
    });
}

async function getTmdbMeta(tmdbId, mediaType) {
    const typePath = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `https://api.themoviedb.org/3/${typePath}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`;
    return getJson(url);
}

// --- RESOLVERS ---

async function resolveVidFast(tmdbId, mediaType, season, episode) {
    const VIDFAST_BASE = 'https://vidfast.pro';
    const ALLOWED_SERVERS = ['Alpha', 'Cobra', 'Kirito', 'Max', 'Meliodas', 'Oscar', 'vEdge', 'vFast', 'vRapid', 'Bollywood'];
    
    try {
        const pageUrl = mediaType === 'tv' ? `${VIDFAST_BASE}/tv/${tmdbId}/${season || 1}/${episode || 1}` : `${VIDFAST_BASE}/movie/${tmdbId}`;
        const headers = {
            'Referer': pageUrl,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-Requested-With': 'XMLHttpRequest'
        };

        const pageText = await getText(pageUrl, { headers });
        let rawData = null;
        const patterns = [/"en":"([^"]+)"/, /'en':'([^']+)'/, /data\s*=\s*"([^"]+)"/];
        for (const p of patterns) {
            const match = pageText.match(p);
            if (match) { rawData = match[1]; break; }
        }
        if (!rawData) return [];

        const apiData = await getJson(`https://enc-dec.app/api/enc-vidfast?text=${encodeURIComponent(rawData)}&version=1`);
        if (!apiData.result) return [];
        if (apiData.result.token) headers['X-CSRF-Token'] = apiData.result.token;

        const encServers = await getText(apiData.result.servers, { method: 'POST', headers });
        const decServers = await getJson('https://enc-dec.app/api/dec-vidfast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: encServers, version: '1' })
        });

        const serverList = (decServers.result || []).filter(s => ALLOWED_SERVERS.includes(s.name));
        const results = await Promise.all(serverList.map(async (serverObj) => {
            try {
                const encStream = await getText(`${apiData.result.stream}/${serverObj.data}`, { method: 'POST', headers });
                const decStream = await getJson('https://enc-dec.app/api/dec-vidfast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: encStream, version: '1' })
                });
                return streamObject('VidFast', `VidFast ${serverObj.name}`, decStream.result.url, normalizeQuality(decStream.result.quality), { 'Referer': 'https://vidfast.pro/' });
            } catch (e) { return null; }
        }));
        return results.filter(Boolean);
    } catch (e) { return []; }
}

async function resolveVidEasy(tmdbId, mediaType, season, episode) {
    try {
        const typePath = mediaType === 'tv' ? 'tv' : 'movie';
        const meta = await getJson(`https://db.videasy.net/3/${typePath}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`);
        const title = encodeURIComponent(meta.name || meta.title);
        const year = new Date(meta.first_air_date || meta.release_date).getFullYear();
        const imdbId = meta.external_ids?.imdb_id || '';
        
        const fullUrl = `https://api.videasy.net/cdn/sources-with-title?title=${title}&mediaType=${mediaType}&year=${year}&episodeId=${episode || 1}&seasonId=${season || 1}&tmdbId=${tmdbId}&imdbId=${imdbId}`;
        const enc = await getText(fullUrl);
        const dec = await getJson('https://enc-dec.app/api/dec-videasy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: enc, id: String(tmdbId) })
        });

        return (dec.result?.sources || []).map(s => streamObject('VidEasy', `VidEasy ${s.quality}`, s.url, normalizeQuality(s.quality), { Referer: 'https://player.videasy.net' }));
    } catch (e) { return []; }
}

async function resolveVidLink(tmdbId, mediaType, season, episode) {
    try {
        const enc = await getJson(`https://enc-dec.app/api/enc-vidlink?text=${encodeURIComponent(tmdbId)}`);
        const url = mediaType === 'tv' ? `https://vidlink.pro/api/b/tv/${enc.result}/${season || 1}/${episode || 1}` : `https://vidlink.pro/api/b/movie/${enc.result}`;
        const data = await getJson(url);
        return [streamObject('VidLink', 'VidLink Primary', data.stream.playlist, 'Auto', { Referer: 'https://vidlink.pro' })].filter(Boolean);
    } catch (e) { return []; }
}

async function resolveVidmody(tmdbId, mediaType, season, episode) {
    try {
        const meta = await getTmdbMeta(tmdbId, mediaType);
        const imdbId = mediaType === 'tv' ? meta.external_ids?.imdb_id : meta.imdb_id;
        if (!imdbId) return [];
        const url = mediaType === 'movie' ? `https://vidmody.com/vs/${imdbId}#.m3u8` : `https://vidmody.com/vs/${imdbId}/s${season || 1}/e${String(episode || 1).padStart(2, '0')}#.m3u8`;
        return [streamObject('Vidmody', 'Vidmody Server', url, 'Auto', { Referer: 'https://vidmody.com/' })];
    } catch (e) { return []; }
}

async function resolveVidSrc(tmdbId, mediaType, season, episode) {
    try {
        const meta = await getTmdbMeta(tmdbId, mediaType);
        const imdbId = mediaType === 'tv' ? meta.external_ids?.imdb_id : meta.imdb_id;
        if (!imdbId) return [];
        const embedUrl = mediaType === 'tv' ? `https://vsrc.su/embed/tv?imdb=${imdbId}&season=${season || 1}&episode=${episode || 1}` : `https://vsrc.su/embed/${imdbId}`;
        const html = await getText(embedUrl);
        const match = html.match(/src=["']([^"']+)["']/i);
        return match ? [streamObject('VidSrc', 'VidSrc Server', 'https:' + match[1], 'Auto')] : [];
    } catch (e) { return []; }
}

// --- MAIN ---

async function getStreams(tmdbId, mediaType, season, episode) {
    const resolvers = [resolveVidFast, resolveVidEasy, resolveVidLink, resolveVidmody, resolveVidSrc];
    const results = await Promise.all(resolvers.map(r => r(tmdbId, mediaType, season, episode).catch(() => [])));
    return dedupeStreams(results.flat()).slice(0, 50);
}

module.exports = { getStreams };
