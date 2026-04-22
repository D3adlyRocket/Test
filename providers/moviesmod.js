async function getStreams(tmdbId, mediaType = 'movie', seasonNum = 1, episodeNum = 1) {
    const allStreams = [];
    const sNum = seasonNum || 1;
    const eNum = episodeNum || 1;
    const TMDB_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";

    // 1. Get Metadata quickly
    let title = "Unknown";
    let year = "";
    try {
        const metaRes = await fetch(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_KEY}`);
        const meta = await metaRes.json();
        title = meta.name || meta.title;
        year = (meta.first_air_date || meta.release_date || "").substring(0, 4);
    } catch (e) {}

    // 2. VIDLINK - (Fastest Provider first to ensure we get SOMETHING)
    try {
        const vlEncRes = await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`);
        const vlEnc = await vlEncRes.json();
        const vlUrl = mediaType === 'tv' ? `https://vidlink.pro/api/b/tv/${vlEnc.result}/${sNum}/${eNum}` : `https://vidlink.pro/api/b/movie/${vlEnc.result}`;
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
    } catch (e) {}

    // 3. VIDFAST - (Limited to the 2 Fastest Servers to beat the 30s timeout)
    try {
        const VID_BASE = 'https://vidfast.pro';
        const pageUrl = mediaType === 'tv' ? `${VID_BASE}/tv/${tmdbId}/${sNum}/${eNum}` : `${VID_BASE}/movie/${tmdbId}`;
        const pageRes = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const pageText = await pageRes.text();
        const rawData = pageText.match(/"en":"([^"]+)"/)?.[1] || pageText.match(/data\s*=\s*"([^"]+)"/)?.[1];

        if (rawData) {
            const apiData = await (await fetch(`https://enc-dec.app/api/enc-vidfast?text=${encodeURIComponent(rawData)}&version=1`)).json();
            if (apiData?.result?.servers) {
                const sHeaders = { 'User-Agent': 'Mozilla/5.0', 'Referer': pageUrl };
                if (apiData.result.token) sHeaders['X-CSRF-Token'] = apiData.result.token;

                const sRes = await fetch(apiData.result.servers, { method: 'POST', headers: sHeaders });
                const sDec = await (await fetch('https://enc-dec.app/api/dec-vidfast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: await sRes.text(), version: '1' })
                })).json();

                // LIMIT: Just take the first 2 servers to save time
                const servers = (sDec.result || []).slice(0, 2); 

                for (const sObj of servers) {
                    try {
                        const stEnc = await (await fetch(`${apiData.result.stream}/${sObj.data}`, { method: 'POST', headers: sHeaders })).text();
                        const stDec = await (await fetch('https://enc-dec.app/api/dec-vidfast', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: stEnc, version: '1' })
                        })).json();

                        if (stDec.result?.url) {
                            allStreams.push({
                                name: `VidFast ${sObj.name}`,
                                title: `${title} (${year})`,
                                url: stDec.result.url,
                                quality: 'Auto',
                                provider: 'vidfast'
                            });
                        }
                    } catch (err) {}
                }
            }
        }
    } catch (e) {}

    // Return what we found before the timeout hits
    const seen = new Set();
    return allStreams.filter(s => {
        if (!s.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
}

if (typeof module !== 'undefined') module.exports = { getStreams };
