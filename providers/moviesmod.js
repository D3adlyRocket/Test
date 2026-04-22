// Master Scraper: Optimized for Android TV & Mobile
// Priority 1: VidFast (Full Original Logic)
// Fallbacks: VidEasy, VidLink, Vidmody, VidSrc

const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const VIDFAST_BASE = 'https://vidfast.pro';
const ENCRYPT_API = 'https://enc-dec.app/api/enc-vidfast';
const DECRYPT_API = 'https://enc-dec.app/api/dec-vidfast';
const ALLOWED_SERVERS = ['Alpha', 'Bollywood', 'Cobra', 'Max', 'Oscar', 'vEdge', 'vFast', 'vRapid'];

// --- VIDFAST CORE LOGIC (YOUR WORKING VERSION) ---

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
                    quality = h >= 2160 ? '4K' : h >= 1080 ? '1080p' : h >= 720 ? '720p' : h >= 480 ? '480p' : h >= 360 ? '360p' : h + 'p';
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

        const pageText = await (await fetch(pageUrl, { headers })).text();
        let rawData = null;
        const nextDataMatch = pageText.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        if (nextDataMatch) {
            const dataMatch = nextDataMatch[1].match(/"en":"([^"]+)"/);
            if (dataMatch) rawData = dataMatch[1];
        }
        if (!rawData) {
            const pats = [/"en":"([^"]+)"/, /'en':'([^']+)'/, /data\s*=\s*"([^"]+)"/];
            for (const p of pats) {
                const m = pageText.match(p);
                if (m) { rawData = m[1]; break; }
            }
        }
        if (!rawData) return [];

        const apiData = await (await fetch(`${ENCRYPT_API}?text=${encodeURIComponent(rawData)}&version=1`)).json();
        if (apiData.result?.token) headers['X-CSRF-Token'] = apiData.result.token;

        const sEnc = await (await fetch(apiData.result.servers, { method: 'POST', headers })).text();
        const sDec = await (await fetch(DECRYPT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: sEnc, version: '1' })
        })).json();

        const serverList = (sDec.result || []).filter(s => ALLOWED_SERVERS.includes(s.name));
        const rawStreams = [];

        for (const sObj of serverList) {
            try {
                const stEnc = await (await fetch(`${apiData.result.stream}/${sObj.data}`, { method: 'POST', headers })).text();
                const stDec = await (await fetch(DECRYPT_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: stEnc, version: '1' })
                })).json();
                if (stDec.result?.url) {
                    rawStreams.push({ serverName: sObj.name, url: stDec.result.url, isM3U8: stDec.result.url.includes('.m3u8') });
                }
            } catch (e) {}
        }

        const parsePromises = rawStreams.map(async (rs) => {
            if (rs.isM3U8) {
                const vars = await parseM3U8Playlist(rs.url);
                if (vars) return vars.map(v => ({ name: `VidFast ${rs.serverName} - ${v.quality}`, url: v.url, quality: v.quality }));
            }
            return [{ name: `VidFast ${rs.serverName}`, url: rs.url, quality: 'Auto' }];
        });

        const results = await Promise.all(parsePromises);
        return results.flat().map(s => ({
            name: s.name,
            title: `${mediaInfo.title} (${mediaInfo.year})`,
            url: s.url,
            quality: s.quality,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://vidfast.pro/' },
            provider: 'vidfast'
        }));
    } catch (e) { return []; }
}

// --- FALLBACK RESOLVERS ---

async function resolveOtherSources(tmdbId, mediaType, season, episode) {
    const streams = [];
    try {
        // VidLink Fallback
        const linkEnc = await (await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`)).json();
        const linkUrl = mediaType === 'tv' ? `https://vidlink.pro/api/b/tv/${linkEnc.result}/${season}/${episode}` : `https://vidlink.pro/api/b/movie/${linkEnc.result}`;
        const linkData = await (await fetch(linkUrl)).json();
        if (linkData?.stream?.playlist) {
            streams.push({ name: 'VidLink Primary', url: linkData.stream.playlist, quality: 'Auto', provider: 'vidlink' });
        }
    } catch (e) {}
    return streams;
}

// --- MAIN INTEGRATION ---

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = 1, episodeNum = 1) {
    try {
        // 1. Get TMDB Meta
        const tmdbUrl = `${TMDB_BASE_URL}/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const meta = await (await fetch(tmdbUrl)).json();
        const mediaInfo = {
            title: mediaType === 'tv' ? meta.name : meta.title,
            year: (mediaType === 'tv' ? meta.first_air_date : meta.release_date)?.substring(0, 4) || '',
            mediaType: mediaType
        };

        // 2. Run VidFast (Primary)
        const vidFastResults = await scrapeVidFast(tmdbId, mediaInfo, seasonNum, episodeNum);

        // 3. Run Fallbacks
        const otherResults = await resolveOtherSources(tmdbId, mediaType, seasonNum, episodeNum);

        const merged = [...vidFastResults, ...otherResults];
        
        // 4. Deduplicate & Return
        const seen = new Set();
        return merged.filter(s => {
            if (!s.url || seen.has(s.url)) return false;
            seen.add(s.url);
            return true;
        }).slice(0, 50);
        
    } catch (e) {
        console.error("Main Scraper Error:", e);
        return [];
    }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
