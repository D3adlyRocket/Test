// --- UTILS ---

async function getJson(url, options) {
    const response = await fetch(url, options || {});
    if (!response.ok) throw new Error('JSON Fetch Failed');
    return await response.json();
}

async function getText(url, options) {
    const response = await fetch(url, options || {});
    if (!response.ok) throw new Error('Text Fetch Failed');
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
        headers: headers || {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://vidfast.pro/'
        }
    };
}

async function getTmdbMeta(tmdbId, mediaType) {
    const typePath = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `https://api.themoviedb.org/3/${typePath}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`;
    const data = await getJson(url);
    return {
        title: mediaType === 'tv' ? data.name : data.title,
        year: (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4) || '',
        imdbId: mediaType === 'tv' ? data.external_ids?.imdb_id : data.imdb_id
    };
}

// --- VIDFAST SPECIFIC UTILS ---

async function parseM3U8Playlist(playlistUrl) {
    try {
        const playlistText = await getText(playlistUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidfast.pro/' }
        });
        if (!playlistText.includes('#EXT-X-STREAM-INF')) return null;
        const variants = [];
        const lines = playlistText.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('#EXT-X-STREAM-INF')) {
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

// --- RESOLVERS ---

async function resolveVidFast(tmdbId, mediaType, season, episode) {
    const VIDFAST_BASE = 'https://vidfast.pro';
    const ENCRYPT_API = 'https://enc-dec.app/api/enc-vidfast';
    const DECRYPT_API = 'https://enc-dec.app/api/dec-vidfast';
    // Removed Bollywood from blocked list so it shows up
    const BLOCKED_SERVERS = ['Beta', 'Iron', 'Viper', 'Specter', 'Ranger', 'Echo', 'Charlie', 'Vodka', 'Pablo', 'Loco', 'Samba'];

    try {
        const meta = await getTmdbMeta(tmdbId, mediaType);
        const pageUrl = mediaType === 'tv' ? `${VIDFAST_BASE}/tv/${tmdbId}/${season || 1}/${episode || 1}` : `${VIDFAST_BASE}/movie/${tmdbId}`;
        const headers = {
            'Origin': 'https://vidfast.pro',
            'Referer': pageUrl,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15',
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

        const apiData = await getJson(`${ENCRYPT_API}?text=${encodeURIComponent(rawData)}&version=1`);
        if (apiData.result.token) headers['X-CSRF-Token'] = apiData.result.token;

        const serversEnc = await getText(apiData.result.servers, { method: 'POST', headers });
        const decServers = await getJson(DECRYPT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: serversEnc, version: '1' })
        });

        let serverList = (decServers.result || []).filter(s => !BLOCKED_SERVERS.includes(s.name));
        const streams = [];

        for (const sObj of serverList) {
            try {
                const sEnc = await getText(`${apiData.result.stream}/${sObj.data}`, { method: 'POST', headers });
                const sDec = await getJson(DECRYPT_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: sEnc, version: '1' })
                });

                if (sDec.result?.url) {
                    if (sDec.result.url.includes('.m3u8')) {
                        const variants = await parseM3U8Playlist(sDec.result.url);
                        if (variants) {
                            variants.forEach(v => streams.push(streamObject('VidFast', `VidFast ${sObj.name} - ${v.quality}`, v.url, v.quality)));
                            continue;
                        }
                    }
                    streams.push(streamObject('VidFast', `VidFast ${sObj.name}`, sDec.result.url, normalizeQuality(sDec.result.quality || sDec.result.label)));
                }
            } catch (e) {}
        }
        return streams;
    } catch (e) { return []; }
}

async function resolveVidEasy(tmdbId, mediaType, season, episode) {
    try {
        const meta = await getTmdbMeta(tmdbId, mediaType);
        const year = meta.year;
        const title = encodeURIComponent(meta.title);
        const fullUrl = `https://api.videasy.net/cdn/sources-with-title?title=${title}&mediaType=${mediaType}&year=${year}&episodeId=${episode || 1}&seasonId=${season || 1}&tmdbId=${tmdbId}&imdbId=${meta.imdbId || ''}`;
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
        return data?.stream?.playlist ? [streamObject('VidLink', 'VidLink Primary', data.stream.playlist, 'Auto', { Referer: 'https://vidlink.pro' })] : [];
    } catch (e) { return []; }
}

async function resolveVidmody(tmdbId, mediaType, season, episode) {
    try {
        const meta = await getTmdbMeta(tmdbId, mediaType);
        if (!meta.imdbId) return [];
        const url = mediaType === 'movie' ? `https://vidmody.com/vs/${meta.imdbId}#.m3u8` : `https://vidmody.com/vs/${meta.imdbId}/s${season || 1}/e${String(episode || 1).padStart(2, '0')}#.m3u8`;
        return [streamObject('Vidmody', 'Vidmody Server', url, 'Auto', { Referer: 'https://vidmody.com/' })];
    } catch (e) { return []; }
}

async function resolveVidSrc(tmdbId, mediaType, season, episode) {
    try {
        const meta = await getTmdbMeta(tmdbId, mediaType);
        if (!meta.imdbId) return [];
        const embed = mediaType === 'tv' ? `https://vsrc.su/embed/tv?imdb=${meta.imdbId}&season=${season || 1}&episode=${episode || 1}` : `https://vsrc.su/embed/${meta.imdbId}`;
        const html = await getText(embed);
        const match = html.match(/src=["']([^"']+)["']/i);
        return match ? [streamObject('VidSrc', 'VidSrc Server', 'https:' + match[1], 'Auto')] : [];
    } catch (e) { return []; }
}

// --- MAIN ---

async function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
    const resolvers = [resolveVidFast, resolveVidEasy, resolveVidLink, resolveVidmody, resolveVidSrc];
    let merged = [];
    for (const resolver of resolvers) {
        try {
            const results = await resolver(tmdbId, mediaType, season, episode);
            if (results && results.length > 0) merged = merged.concat(results);
        } catch (err) {}
    }
    
    // Final deduplication
    const seen = new Set();
    return merged.filter(s => {
        if (seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    }).slice(0, 50);
}

module.exports = { getStreams };
