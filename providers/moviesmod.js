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
    const seen = {};
    const out = [];
    for (let i = 0; i < streams.length; i++) {
        const s = streams[i];
        if (s && s.url && !seen[s.url]) {
            seen[s.url] = true;
            out.push(s);
        }
    }
    return out;
}

// --- RESOLVERS ---

async function resolveVidFast(tmdbId, mediaType, season, episode) {
    const VIDFAST_BASE = 'https://vidfast.pro';
    const ALLOWED = ['Alpha', 'Cobra', 'Kirito', 'Max', 'Meliodas', 'Oscar', 'vEdge', 'vFast', 'vRapid', 'Bollywood'];
    
    // Using a Mobile UA as it works on your mobile app
    const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

    try {
        const pageUrl = mediaType === 'tv' 
            ? `${VIDFAST_BASE}/tv/${tmdbId}/${season || 1}/${episode || 1}` 
            : `${VIDFAST_BASE}/movie/${tmdbId}`;
            
        const baseHeaders = {
            'User-Agent': UA,
            'Referer': pageUrl
        };

        const pageText = await getText(pageUrl, { headers: baseHeaders });
        let rawData = null;
        
        // Regex for the "en" data
        const patterns = [/"en":"([^"]+)"/, /'en':'([^']+)'/, /data\s*=\s*"([^"]+)"/];
        for (let i = 0; i < patterns.length; i++) {
            const match = pageText.match(patterns[i]);
            if (match) { rawData = match[1]; break; }
        }
        if (!rawData) return [];

        const apiData = await getJson(`https://enc-dec.app/api/enc-vidfast?text=${encodeURIComponent(rawData)}&version=1`, { headers: { 'User-Agent': UA } });
        if (!apiData || !apiData.result) return [];
        
        // Prepare headers for the POST requests
        const postHeaders = {
            'User-Agent': UA,
            'Referer': pageUrl,
            'Origin': 'https://vidfast.pro'
        };
        if (apiData.result.token) postHeaders['X-CSRF-Token'] = apiData.result.token;

        // Fetch servers
        const serversEnc = await getText(apiData.result.servers, { method: 'POST', headers: postHeaders });
        const decServers = await getJson('https://enc-dec.app/api/dec-vidfast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
            body: JSON.stringify({ text: serversEnc, version: '1' })
        });

        const serverList = (decServers.result || []).filter(s => ALLOWED.indexOf(s.name) !== -1);
        const streams = [];
        const streamBase = apiData.result.stream;

        for (let j = 0; j < serverList.length; j++) {
            try {
                const sObj = serverList[j];
                const sEnc = await getText(`${streamBase}/${sObj.data}`, { method: 'POST', headers: postHeaders });
                const sDec = await getJson('https://enc-dec.app/api/dec-vidfast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
                    body: JSON.stringify({ text: sEnc, version: '1' })
                });

                if (sDec.result && sDec.result.url) {
                    streams.push(streamObject(
                        'VidFast', 
                        `VidFast ${sObj.name}`, 
                        sDec.result.url, 
                        normalizeQuality(sDec.result.quality || sDec.result.label), 
                        { 'Referer': 'https://vidfast.pro/', 'User-Agent': UA }
                    ));
                }
            } catch (e) {}
        }
        return streams;
    } catch (e) { return []; }
}

async function resolveVidEasy(tmdbId, mediaType, season, episode) {
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        const meta = await getJson(`https://db.videasy.net/3/${type}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`);
        const title = encodeURIComponent(meta.name || meta.title);
        const year = (meta.first_air_date || meta.release_date || '').substring(0, 4);
        const imdbId = meta.external_ids?.imdb_id || '';
        
        const enc = await getText(`https://api.videasy.net/cdn/sources-with-title?title=${title}&mediaType=${mediaType}&year=${year}&episodeId=${episode || 1}&seasonId=${season || 1}&tmdbId=${tmdbId}&imdbId=${imdbId}`);
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
        return data?.stream?.playlist ? [streamObject('VidLink', 'VidLink Primary', data.stream.playlist, 'Auto', { Referer: 'https://vidlink.pro' })] : [];
    } catch (e) { return []; }
}

async function resolveVidmody(tmdbId, mediaType, season, episode) {
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        const meta = await getJson(`https://api.themoviedb.org/3/${type}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`);
        const imdbId = mediaType === 'tv' ? meta.external_ids?.imdb_id : meta.imdb_id;
        if (!imdbId) return [];
        const url = mediaType === 'movie' ? `https://vidmody.com/vs/${imdbId}#.m3u8` : `https://vidmody.com/vs/${imdbId}/s${season || 1}/e${String(episode || 1).padStart(2, '0')}#.m3u8`;
        return [streamObject('Vidmody', 'Vidmody Server', url, 'Auto', { Referer: 'https://vidmody.com/' })];
    } catch (e) { return []; }
}

async function resolveVidSrc(tmdbId, mediaType, season, episode) {
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        const meta = await getJson(`https://api.themoviedb.org/3/${type}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`);
        const imdbId = mediaType === 'tv' ? meta.external_ids?.imdb_id : meta.imdb_id;
        if (!imdbId) return [];
        const html = await getText(mediaType === 'tv' ? `https://vsrc.su/embed/tv?imdb=${imdbId}&season=${season || 1}&episode=${episode || 1}` : `https://vsrc.su/embed/${imdbId}`);
        const match = html.match(/src=["']([^"']+)["']/i);
        return match ? [streamObject('VidSrc', 'VidSrc Server', 'https:' + match[1], 'Auto')] : [];
    } catch (e) { return []; }
}

// --- MAIN ---

async function getStreams(tmdbId, mediaType, season, episode) {
    const resolvers = [resolveVidFast, resolveVidEasy, resolveVidLink, resolveVidmody, resolveVidSrc];
    let merged = [];
    for (const resolver of resolvers) {
        try {
            const results = await resolver(tmdbId, mediaType, season, episode);
            if (results && results.length > 0) merged = merged.concat(results);
        } catch (err) {}
    }
    return dedupeStreams(merged).slice(0, 50);
}

module.exports = { getStreams };
