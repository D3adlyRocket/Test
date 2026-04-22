// Master Integrated Scraper: Optimized for Stability
const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = 1, episodeNum = 1) {
    const allStreams = [];

    // 1. Get Metadata (Linear)
    let mediaInfo = { title: "Unknown", year: "", mediaType: mediaType };
    try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const metaRes = await fetch(`${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const data = await metaRes.json();
        mediaInfo.title = mediaType === 'tv' ? data.name : data.title;
        mediaInfo.year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4) || '';
    } catch (e) { console.log("Meta failed"); }

    // 2. VidFast Scraper (Integrated Logic)
    try {
        const VIDFAST_BASE = 'https://vidfast.pro';
        const pageUrl = mediaType === 'tv' ? `${VIDFAST_BASE}/tv/${tmdbId}/${seasonNum}/${episodeNum}` : `${VIDFAST_BASE}/movie/${tmdbId}`;
        const headers = {
            'Origin': 'https://vidfast.pro',
            'Referer': pageUrl,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-Requested-With': 'XMLHttpRequest'
        };

        const pageRes = await fetch(pageUrl, { headers });
        const pageText = await pageRes.text();
        let rawData = pageText.match(/"en":"([^"]+)"/)?.[1] || pageText.match(/data\s*=\s*"([^"]+)"/)?.[1];

        if (rawData) {
            const apiRes = await fetch(`https://enc-dec.app/api/enc-vidfast?text=${encodeURIComponent(rawData)}&version=1`);
            const apiData = await apiRes.json();

            if (apiData?.result) {
                if (apiData.result.token) headers['X-CSRF-Token'] = apiData.result.token;
                
                const sEnc = await (await fetch(apiData.result.servers, { method: 'POST', headers })).text();
                const sDec = await (await fetch('https://enc-dec.app/api/dec-vidfast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: sEnc, version: '1' })
                })).json();

                const allowed = ['Alpha', 'Cobra', 'Max', 'Oscar', 'vEdge', 'vFast', 'vRapid'];
                const servers = (sDec.result || []).filter(s => allowed.includes(s.name));

                for (const sObj of servers) {
                    try {
                        const stEnc = await (await fetch(`${apiData.result.stream}/${sObj.data}`, { method: 'POST', headers })).text();
                        const stDec = await (await fetch('https://enc-dec.app/api/dec-vidfast', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: stEnc, version: '1' })
                        })).json();

                        if (stDec.result?.url) {
                            allStreams.push({
                                name: `VidFast ${sObj.name}`,
                                title: `${mediaInfo.title} (${mediaInfo.year})`,
                                url: stDec.result.url,
                                quality: stDec.result.quality || 'Auto',
                                provider: 'vidfast',
                                headers: { 'Referer': 'https://vidfast.pro/', 'User-Agent': 'Mozilla/5.0' }
                            });
                        }
                    } catch (e) {}
                }
            }
        }
    } catch (e) { console.log("VidFast Block failed"); }

    // 3. VidLink Fallback
    try {
        const vlEnc = await (await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`)).json();
        const vlUrl = mediaType === 'tv' ? `https://vidlink.pro/api/b/tv/${vlEnc.result}/${seasonNum}/${episodeNum}` : `https://vidlink.pro/api/b/movie/${vlEnc.result}`;
        const vlData = await (await fetch(vlUrl)).json();
        if (vlData?.stream?.playlist) {
            allStreams.push({
                name: 'VidLink Primary',
                title: `${mediaInfo.title} (${mediaInfo.year})`,
                url: vlData.stream.playlist,
                quality: 'Auto',
                provider: 'vidlink'
            });
        }
    } catch (e) { console.log("VidLink Block failed"); }

    // 4. Final Deduplication
    const seen = new Set();
    return allStreams.filter(s => {
        if (!s.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
}

if (typeof module !== 'undefined') module.exports = { getStreams };
