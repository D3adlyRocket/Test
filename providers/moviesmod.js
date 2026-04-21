// --- UTILS ---

async function getJson(url, options) {
    const response = await fetch(url, options || {});
    if (!response.ok) throw new Error('JSON Error');
    return await response.json();
}

async function getText(url, options) {
    const response = await fetch(url, options || {});
    if (!response.ok) throw new Error('Text Error');
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
    const ALLOWED_SERVERS = ['Alpha', 'Cobra', 'Kirito', 'Max', 'Meliodas', 'Oscar', 'vEdge', 'vFast', 'vRapid', 'Bollywood'];
    
    // Static Desktop UA works better on Android TV than the default TV UA
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    try {
        const pageUrl = mediaType === 'tv' 
            ? `${VIDFAST_BASE}/tv/${tmdbId}/${season || 1}/${episode || 1}` 
            : `${VIDFAST_BASE}/movie/${tmdbId}`;
            
        const headers = {
            'User-Agent': UA,
            'Referer': pageUrl,
            'X-Requested-With': 'XMLHttpRequest'
        };

        const pageText = await getText(pageUrl, { headers });
        let rawData = null;
        
        const patterns = [/"en":"([^"]+)"/, /'en':'([^']+)'/, /data\s*=\s*"([^"]+)"/];
        for (let i = 0; i < patterns.length; i++) {
            const match = pageText.match(patterns[i]);
            if (match) { rawData = match[1]; break; }
        }
        if (!rawData) return [];

        const apiData = await getJson(`https://enc-dec.app/api/enc-vidfast?text=${encodeURIComponent(rawData)}&version=1`, { headers: { 'User-Agent': UA } });
        if (!apiData || !apiData.result) return [];
        
        if (apiData.result.token) {
            headers['X-CSRF-Token'] = apiData.result.token;
        }

        // POST to get servers
        const serversResponse = await fetch(apiData.result.servers, { 
            method: 'POST', 
            headers: headers 
        });
        const serversEncrypted = await serversResponse.text();
        
        const decServers = await getJson('https://enc-dec.app/api/dec-vidfast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
            body: JSON.stringify({ text: serversEncrypted, version: '1' })
        });

        const serverList = (decServers.result || []).filter(s => ALLOWED_SERVERS.indexOf(s.name) !== -1);
        const streams = [];
        const streamBase = apiData.result.stream;

        for (let j = 0; j < serverList.length; j++) {
            try {
                const sObj = serverList[j];
                const streamResp = await fetch(`${streamBase}/${sObj.data}`, { method: 'POST', headers: headers });
                const streamEnc = await streamResp.text();
                
                const decStream = await getJson('https://enc-dec.app/api/dec-vidfast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
                    body: JSON.stringify({ text: streamEnc, version: '1' })
                });

                if (decStream.result && decStream.result.url) {
                    streams.push(streamObject(
                        'VidFast', 
                        `VidFast ${sObj.name}`, 
                        decStream.result.url, 
                        normalizeQuality(decStream.result.quality || decStream.result.label), 
                        { 'Referer': 'https://vidfast.pro/', 'User-Agent': UA }
                    ));
                }
            } catch (e) { continue; }
        }
        return streams;
    } catch (e) { return []; }
}

// ... (Other resolvers: resolveVidEasy, resolveVidLink, resolveVidmody, resolveVidSrc) ...
// Use the same UA strategy for these if they fail on TV

async function resolveVidEasy(tmdbId, mediaType, season, episode) {
    try {
        const typePath = mediaType === 'tv' ? 'tv' : 'movie';
        const meta = await getJson(`https://db.videasy.net/3/${typePath}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`);
        const title = encodeURIComponent(meta.name || meta.title);
        const dateStr = meta.first_air_date || meta.release_date;
        const year = dateStr ? dateStr.substring(0, 4) : '';
        const imdbId = (meta.external_ids && meta.external_ids.imdb_id) ? meta.external_ids.imdb_id : '';
        
        const fullUrl = `https://api.videasy.net/cdn/sources-with-title?title=${title}&mediaType=${mediaType}&year=${year}&episodeId=${episode || 1}&seasonId=${season || 1}&tmdbId=${tmdbId}&imdbId=${imdbId}`;
        const enc = await getText(fullUrl);
        const dec = await getJson('https://enc-dec.app/api/dec-videasy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: enc, id: String(tmdbId) })
        });

        const results = [];
        const sources = dec.result && dec.result.sources ? dec.result.sources : [];
        for (let i = 0; i < sources.length; i++) {
            const s = sources[i];
            results.push(streamObject('VidEasy', `VidEasy ${s.quality}`, s.url, normalizeQuality(s.quality), { Referer: 'https://player.videasy.net', 'User-Agent': 'Mozilla/5.0' }));
        }
        return results;
    } catch (e) { return []; }
}

async function resolveVidLink(tmdbId, mediaType, season, episode) {
    try {
        const enc = await getJson(`https://enc-dec.app/api/enc-vidlink?text=${encodeURIComponent(tmdbId)}`);
        const url = mediaType === 'tv' ? `https://vidlink.pro/api/b/tv/${enc.result}/${season || 1}/${episode || 1}` : `https://vidlink.pro/api/b/movie/${enc.result}`;
        const data = await getJson(url);
        if (data && data.stream && data.stream.playlist) {
            return [streamObject('VidLink', 'VidLink Primary', data.stream.playlist, 'Auto', { Referer: 'https://vidlink.pro', 'User-Agent': 'Mozilla/5.0' })];
        }
        return [];
    } catch (e) { return []; }
}

async function resolveVidmody(tmdbId, mediaType, season, episode) {
    try {
        const typePath = mediaType === 'tv' ? 'tv' : 'movie';
        const meta = await getJson(`https://api.themoviedb.org/3/${typePath}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`);
        const imdbId = mediaType === 'tv' ? (meta.external_ids && meta.external_ids.imdb_id) : meta.imdb_id;
        if (!imdbId) return [];
        const url = mediaType === 'movie' ? `https://vidmody.com/vs/${imdbId}#.m3u8` : `https://vidmody.com/vs/${imdbId}/s${season || 1}/e${String(episode || 1).padStart(2, '0')}#.m3u8`;
        return [streamObject('Vidmody', 'Vidmody Server', url, 'Auto', { Referer: 'https://vidmody.com/', 'User-Agent': 'Mozilla/5.0' })];
    } catch (e) { return []; }
}

async function resolveVidSrc(tmdbId, mediaType, season, episode) {
    try {
        const typePath = mediaType === 'tv' ? 'tv' : 'movie';
        const meta = await getJson(`https://api.themoviedb.org/3/${typePath}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`);
        const imdbId = mediaType === 'tv' ? (meta.external_ids && meta.external_ids.imdb_id) : meta.imdb_id;
        if (!imdbId) return [];
        const embedUrl = mediaType === 'tv' ? `https://vsrc.su/embed/tv?imdb=${imdbId}&season=${season || 1}&episode=${episode || 1}` : `https://vsrc.su/embed/${imdbId}`;
        const html = await getText(embedUrl);
        const match = html.match(/src=["']([^"']+)["']/i);
        if (match) {
            return [streamObject('VidSrc', 'VidSrc Server', 'https:' + match[1], 'Auto', { 'User-Agent': 'Mozilla/5.0' })];
        }
        return [];
    } catch (e) { return []; }
}

// --- MAIN ---

async function getStreams(tmdbId, mediaType, season, episode) {
    const resolvers = [resolveVidFast, resolveVidEasy, resolveVidLink, resolveVidmody, resolveVidSrc];
    let merged = [];
    
    for (let i = 0; i < resolvers.length; i++) {
        try {
            const results = await resolvers[i](tmdbId, mediaType, season, episode);
            if (results && results.length > 0) {
                merged = merged.concat(results);
            }
        } catch (err) {}
    }
    
    return dedupeStreams(merged).slice(0, 50);
}

module.exports = { getStreams };
