// --- CONFIG ---
const TMDB_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const VF_BASE = 'https://vidfast.pro';
const ENC_API = 'https://enc-dec.app/api/enc-vidfast';
const DEC_API = 'https://enc-dec.app/api/dec-vidfast';
const SERVERS = ['Alpha', 'Bollywood', 'Cobra', 'Max', 'Oscar', 'vEdge', 'vFast', 'vRapid'];

// --- CORE VIDFAST LOGIC ---

async function fetchVidFast(tmdbId, type, season, episode, meta) {
    try {
        const pageUrl = type === 'tv' ? `${VF_BASE}/tv/${tmdbId}/${season}/${episode}` : `${VF_BASE}/movie/${tmdbId}`;
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': pageUrl,
            'X-Requested-With': 'XMLHttpRequest'
        };

        const pageRes = await fetch(pageUrl, { headers });
        const pageText = await pageRes.text();

        // Robust regex for VidFast data
        const rawMatch = pageText.match(/"en":"([^"]+)"/) || pageText.match(/data\s*=\s*"([^"]+)"/);
        if (!rawMatch) return [];

        const encRes = await fetch(`${ENC_API}?text=${encodeURIComponent(rawMatch[1])}&version=1`);
        const encData = await encRes.json();
        if (!encData?.result) return [];

        if (encData.result.token) headers['X-CSRF-Token'] = encData.result.token;

        const sEncRes = await fetch(encData.result.servers, { method: 'POST', headers });
        const sEnc = await sEncRes.text();
        
        const sDecRes = await fetch(DEC_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: sEnc, version: '1' })
        });
        const sDec = await sDecRes.json();

        const serverList = (sDec?.result || []).filter(s => SERVERS.includes(s.name));
        const streams = [];

        for (const s of serverList) {
            try {
                const stEncRes = await fetch(`${encData.result.stream}/${s.data}`, { method: 'POST', headers });
                const stEnc = await stEncRes.text();
                const stDecRes = await fetch(DEC_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: stEnc, version: '1' })
                });
                const stDec = await stDecRes.json();

                if (stDec?.result?.url) {
                    streams.push({
                        name: `VidFast ${s.name}`,
                        title: `${meta.title} (${meta.year})`,
                        url: stDec.result.url,
                        quality: stDec.result.quality || 'Auto',
                        headers: { 'Referer': 'https://vidfast.pro/', 'User-Agent': headers['User-Agent'] },
                        provider: 'vidfast'
                    });
                }
            } catch (e) {}
        }
        return streams;
    } catch (e) { return []; }
}

// --- FALLBACK LOGIC ---

async function fetchVidLink(tmdbId, type, season, episode, meta) {
    try {
        const encRes = await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`);
        const enc = await encRes.json();
        const url = type === 'tv' ? `https://vidlink.pro/api/b/tv/${enc.result}/${season}/${episode}` : `https://vidlink.pro/api/b/movie/${enc.result}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data?.stream?.playlist) {
            return [{
                name: 'VidLink Primary',
                title: `${meta.title} (${meta.year})`,
                url: data.stream.playlist,
                quality: 'Auto',
                provider: 'vidlink'
            }];
        }
    } catch (e) {}
    return [];
}

// --- MAIN ---

async function getStreams(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
    let meta = { title: 'Unknown', year: '' };
    
    // Step 1: Meta fetch with extreme safety
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_KEY}`);
        const data = await res.json();
        meta.title = data?.name || data?.title || 'Unknown';
        meta.year = (data?.first_air_date || data?.release_date || '').substring(0, 4);
    } catch (e) {}

    // Step 2: Run providers in parallel but catch individual failures
    const results = await Promise.allSettled([
        fetchVidFast(tmdbId, mediaType, season, episode, meta),
        fetchVidLink(tmdbId, mediaType, season, episode, meta)
    ]);

    // Step 3: Flat and Filter
    const finalStreams = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .flat();

    // Step 4: Dedupe
    const seen = new Set();
    return finalStreams.filter(s => {
        if (!s.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
}

if (typeof module !== 'undefined') module.exports = { getStreams };
