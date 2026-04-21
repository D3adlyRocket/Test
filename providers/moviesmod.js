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
        headers: headers || {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://vidfast.pro/'
        }
    };
}

// --- VIDFAST HELPERS ---

async function parseM3U8Playlist(playlistUrl) {
    try {
        const playlistText = await getText(playlistUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 
                'Referer': 'https://vidfast.pro/' 
            }
        });
        if (!playlistText.includes('#EXT-X-STREAM-INF')) return null;
        const variants = [];
        const lines = playlistText.split('\n');
        const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('#EXT-X-STREAM-INF')) {
                const resMatch = lines[i].match(/RESOLUTION=(\d+)x(\d+)/i);
                const urlLine = lines[i + 1]?.trim();
                if (!urlLine || urlLine.startsWith('#')) continue;
                let vUrl = urlLine.startsWith('http') ? urlLine : baseUrl + urlLine;
                variants.push({ url: vUrl, quality: resMatch ? resMatch[2] + 'p' : 'Auto' });
            }
        }
        return variants.length > 0 ? variants : null;
    } catch (e) { return null; }
}

// --- RESOLVERS ---

async function resolveVidFast(tmdbId, mediaType, season, episode) {
    const VIDFAST_BASE = 'https://vidfast.pro';
    const ENCRYPT_API = 'https://enc-dec.app/api/enc-vidfast';
    const DECRYPT_API = 'https://enc-dec.app/api/dec-vidfast';
    const FILTER_DESCRIPTION = 'Original audio';
    const BLOCKED_SERVERS = ['Beta', 'Iron', 'Viper', 'Specter', 'Ranger', 'Echo', 'Charlie', 'Vodka', 'Pablo', 'Loco', 'Samba', 'Bollywood'];

    try {
        const pageUrl = mediaType === 'tv' 
            ? `${VIDFAST_BASE}/tv/${tmdbId}/${season || 1}/${episode || 1}` 
            : `${VIDFAST_BASE}/movie/${tmdbId}`;

        // Fixed Headers for Android TV compatibility
        const currentHeaders = {
            'Accept': '*/*',
            'Origin': 'https://vidfast.pro',
            'Referer': pageUrl,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15',
            'X-Requested-With': 'XMLHttpRequest'
        };

        const pageText = await getText(pageUrl, { headers: currentHeaders });
        let rawData = null;
        
        // Comprehensive regex match
        const patterns = [/"en":"([^"]+)"/, /'en':'([^']+)'/, /data\s*=\s*"([^"]+)"/, /"en":\s*"([^"]+)"/];
        for (const p of patterns) {
            const match = pageText.match(p);
            if (match) { rawData = match[1]; break; }
        }
        
        if (!rawData) {
            const nextDataMatch = pageText.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
            if (nextDataMatch) {
                const dataMatch = nextDataMatch[1].match(/"en":"([^"]+)"/);
                if (dataMatch) rawData = dataMatch[1];
            }
        }
        
        if (!rawData) return [];

        // Encrypt call
        const apiData = await getJson(`${ENCRYPT_API}?text=${encodeURIComponent(rawData)}&version=1`);
        if (!apiData || !apiData.result) return [];
        
        // Critical: Update headers with token for all subsequent POSTs
        if (apiData.result.token) currentHeaders['X-CSRF-Token'] = apiData.result.token;

        // Fetch server list
        const serversEnc = await getText(apiData.result.servers, { method: 'POST', headers: currentHeaders });
        const decServers = await getJson(DECRYPT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': currentHeaders['User-Agent'] },
            body: JSON.stringify({ text: serversEnc, version: '1' })
        });

        // Filter: Must not be blocked AND must contain "Original audio"
        const serverList = (decServers.result || []).filter(s => 
            !BLOCKED_SERVERS.includes(s.name) && 
            s.description && s.description.toLowerCase().includes(FILTER_DESCRIPTION.toLowerCase())
        );

        const streams = [];
        for (const sObj of serverList) {
            try {
                const sEnc = await getText(`${apiData.result.stream}/${sObj.data}`, { method: 'POST', headers: currentHeaders });
                const sDec = await getJson(DECRYPT_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'User-Agent': currentHeaders['User-Agent'] },
                    body: JSON.stringify({ text: sEnc, version: '1' })
                });

                if (sDec.result && sDec.result.url) {
                    const videoUrl = sDec.result.url;
                    if (videoUrl.includes('.m3u8')) {
                        const variants = await parseM3U8Playlist(videoUrl);
                        if (variants) {
                            variants.forEach(v => {
                                streams.push(streamObject('VidFast', `VidFast ${sObj.name} - ${v.quality}`, v.url, v.quality));
                            });
                            continue;
                        }
                    }
                    streams.push(streamObject('VidFast', `VidFast ${sObj.name}`, videoUrl, normalizeQuality(sDec.result.quality || sDec.result.label)));
                }
            } catch (e) {}
        }
        return streams;
    } catch (e) { return []; }
}

// ... (Other resolvers: resolveVidEasy, resolveVidLink, resolveVidmody, resolveVidSrc) ...

async function resolveVidEasy(tmdbId, mediaType, season, episode) {
    try {
        const meta = await getJson(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=ad301b7cc82ffe19273e55e4d4206885`);
        const title = encodeURIComponent(meta.name || meta.title);
        const year = (meta.first_air_date || meta.release_date || '').substring(0, 4);
        const enc = await getText(`https://api.videasy.net/cdn/sources-with-title?title=${title}&mediaType=${mediaType}&year=${year}&episodeId=${episode || 1}&seasonId=${season || 1}&tmdbId=${tmdbId}`);
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
        const meta = await getJson(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`);
        const imdbId = mediaType === 'tv' ? meta.external_ids?.imdb_id : meta.imdb_id;
        if (!imdbId) return [];
        const url = mediaType === 'movie' ? `https://vidmody.com/vs/${imdbId}#.m3u8` : `https://vidmody.com/vs/${imdbId}/s${season || 1}/e${String(episode || 1).padStart(2, '0')}#.m3u8`;
        return [streamObject('Vidmody', 'Vidmody Server', url, 'Auto', { Referer: 'https://vidmody.com/' })];
    } catch (e) { return []; }
}

async function resolveVidSrc(tmdbId, mediaType, season, episode) {
    try {
        const meta = await getJson(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`);
        const imdbId = mediaType === 'tv' ? meta.external_ids?.imdb_id : meta.imdb_id;
        const embed = mediaType === 'tv' ? `https://vsrc.su/embed/tv?imdb=${imdbId}&season=${season || 1}&episode=${episode || 1}` : `https://vsrc.su/embed/${imdbId}`;
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
    
    const seen = new Set();
    return merged.filter(s => {
        if (!s || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    }).slice(0, 50);
}

module.exports = { getStreams };
