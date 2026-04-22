const TMDB_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";

async function getStreams(tmdbId, mediaType = 'movie', season = 1, episode = 1) {
    const allStreams = [];

    // 1. Get Metadata (linear fetch)
    let title = "Unknown";
    let year = "";
    try {
        const metaRes = await fetch(`https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_KEY}`);
        const meta = await metaRes.json();
        title = meta.name || meta.title || "Unknown";
        year = (meta.first_air_date || meta.release_date || "").substring(0, 4);
    } catch (e) {
        // If TMDB fails, we still try to scrape using just the ID
    }

    // 2. VidFast Scraper (Your working logic, simplified for stability)
    try {
        const vfBase = 'https://vidfast.pro';
        const pageUrl = mediaType === 'tv' ? `${vfBase}/tv/${tmdbId}/${season}/${episode}` : `${vfBase}/movie/${tmdbId}`;
        
        const pageRes = await fetch(pageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': pageUrl }
        });
        const pageText = await pageRes.text();

        const rawData = pageText.match(/"en":"([^"]+)"/)?.[1] || pageText.match(/data\s*=\s*"([^"]+)"/)?.[1];

        if (rawData) {
            const encRes = await fetch(`https://enc-dec.app/api/enc-vidfast?text=${encodeURIComponent(rawData)}&version=1`);
            const encData = await encRes.json();

            if (encData?.result?.servers) {
                const sHeaders = { 'User-Agent': 'Mozilla/5.0', 'Referer': pageUrl };
                if (encData.result.token) sHeaders['X-CSRF-Token'] = encData.result.token;

                const sRes = await fetch(encData.result.servers, { method: 'POST', headers: sHeaders });
                const sEnc = await sRes.text();
                
                const sDecRes = await fetch('https://enc-dec.app/api/dec-vidfast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: sEnc, version: '1' })
                });
                const sDec = await sDecRes.json();

                if (sDec?.result) {
                    // Filter for specific servers as per your working code
                    const allowed = ['Alpha', 'Bollywood', 'Cobra', 'Max', 'Oscar', 'vEdge', 'vFast', 'vRapid'];
                    const filteredServers = sDec.result.filter(s => allowed.includes(s.name));

                    for (const sObj of filteredServers) {
                        try {
                            const stRes = await fetch(`${encData.result.stream}/${sObj.data}`, { method: 'POST', headers: sHeaders });
                            const stEnc = await stRes.text();
                            const stDecRes = await fetch('https://enc-dec.app/api/dec-vidfast', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ text: stEnc, version: '1' })
                            });
                            const stDec = await stDecRes.json();

                            if (stDec?.result?.url) {
                                allStreams.push({
                                    name: `VidFast ${sObj.name}`,
                                    title: `${title} (${year})`,
                                    url: stDec.result.url,
                                    quality: stDec.result.quality || 'Auto',
                                    provider: 'vidfast'
                                });
                            }
                        } catch (err) {}
                    }
                }
            }
        }
    } catch (e) {}

    // 3. VidLink Fallback (If VidFast fails or to add more links)
    try {
        const vlEncRes = await fetch(`https://enc-dec.app/api/enc-vidlink?text=${tmdbId}`);
        const vlEnc = await vlEncRes.json();
        const vlUrl = mediaType === 'tv' ? `https://vidlink.pro/api/b/tv/${vlEnc.result}/${season}/${episode}` : `https://vidlink.pro/api/b/movie/${vlEnc.result}`;
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

    // 4. Final deduplication and safe return
    const seen = new Set();
    return allStreams.filter(s => {
        if (!s.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
}

if (typeof module !== 'undefined') module.exports = { getStreams };
