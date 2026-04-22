const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = 1, episodeNum = 1) {
    const allStreams = [];

    // 1. Get Metadata (Linear fetch from your working code)
    let title = "Unknown";
    let year = "";
    try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const metaRes = await fetch(`${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const meta = await metaRes.json();
        title = meta.name || meta.title || "Unknown";
        year = (meta.first_air_date || meta.release_date || "").substring(0, 4);
    } catch (e) {
        console.log('[Scraper] TMDB Metadata fetch failed');
    }

    const mediaInfo = { title, year, mediaType };

    // 2. VidFast Scraper Block (Your exact working logic integrated)
    try {
        const VIDFAST_BASE = 'https://vidfast.pro';
        const ENCRYPT_API = 'https://enc-dec.app/api/enc-vidfast';
        const DECRYPT_API = 'https://enc-dec.app/api/dec-vidfast';
        const ALLOWED_SERVERS = ['Alpha', 'Cobra', 'Max', 'Oscar', 'vEdge', 'vFast', 'vRapid'];

        const pageUrl = mediaType === 'tv'
            ? `${VIDFAST_BASE}/tv/${tmdbId}/${seasonNum}/${episodeNum}`
            : `${VIDFAST_BASE}/movie/${tmdbId}`;

        const headers = {
            'Accept': '*/*',
            'Origin': 'https://vidfast.pro',
            'Referer': pageUrl,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15',
            'X-Requested-With': 'XMLHttpRequest'
        };

        const pageRes = await fetch(pageUrl, { headers });
        const pageText = await pageRes.text();

        let rawData = pageText.match(/"en":"([^"]+)"/)?.[1] || pageText.match(/data\s*=\s*"([^"]+)"/)?.[1];

        if (rawData) {
            const apiRes = await fetch(`${ENCRYPT_API}?text=${encodeURIComponent(rawData)}&version=1`);
            const apiData = await apiRes.json();

            if (apiData?.result) {
                if (apiData.result.token) headers['X-CSRF-Token'] = apiData.result.token;

                const sEnc = await (await fetch(apiData.result.servers, { method: 'POST', headers })).text();
                const sDec = await (await fetch(DECRYPT_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: sEnc, version: '1' })
                })).json();

                const serverList = (sDec.result || []).filter(s => ALLOWED_SERVERS.includes(s.name));

                for (const sObj of serverList) {
                    try {
                        const stEnc = await (await fetch(`${apiData.result.stream}/${sObj.data}`, { method: 'POST', headers })).text();
                        const stDec = await (await fetch(DECRYPT_API, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: stEnc, version: '1' })
                        })).json();

                        if (stDec.result?.url) {
                            allStreams.push({
                                name: `VidFast ${sObj.name}`,
                                title: `${title} (${year})`,
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
    } catch (e) {
        console.log('[Scraper] VidFast section failed');
    }

    // 3. VidLink Fallback (Your other working logic)
    try {
        const vlEncRes = await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`);
        const vlEnc = await vlEncRes.json();
        const vlUrl = mediaType === 'tv' ? `https://vidlink.pro/api/b/tv/${vlEnc.result}/${seasonNum}/${episodeNum}` : `https://vidlink.pro/api/b/movie/${vlEnc.result}`;
        const vlRes = await fetch(vlUrl);
        const vlData = await vlRes.json();
        if (vlData?.stream?.playlist) {
            allStreams.push({
                name: 'VidLink Primary',
                title: `${title} (${year})`,
                url: vlData.stream.playlist,
                quality: 'Auto',
                provider: 'vidlink'
            });
        }
    } catch (e) {
        console.log('[Scraper] VidLink section failed');
    }

    // 4. Final Cleanup
    const seen = new Set();
    const finalResults = allStreams.filter(s => {
        if (!s.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });

    return finalResults;
}

if (typeof module !== 'undefined') {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
