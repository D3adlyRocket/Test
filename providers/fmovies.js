var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var SB_BASE = 'https://febapi.nuvioapp.space/api/media';
var LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie.txt";

async function getStreams(tmdbId, type, s, e) {
    try {
        // 1. Get Token (Removed the 'timeout' property that causes crashes)
        const tokenResp = await fetch(LOCAL_COOKIE_URL);
        const token = (await tokenResp.text()).trim();

        if (!token) return [];

        // 2. Fetch TMDB Data
        const tmdbUrl = `https://api.themoviedb.org/3/${type === 'tv' ? 'tv/' : 'movie/'}${tmdbId}?api_key=${TMDB_KEY}`;
        const tmdbRes = await fetch(tmdbUrl);
        const m = await tmdbRes.json();
        const title = type === 'tv' ? m.name : m.title;

        // 3. THE FIX: Corrected API URL Structure
        // ShowBox often needs the region (oss) and proper encoding to return links
        let api = (type === 'tv') 
            ? `${SB_BASE}/tv/${tmdbId}/oss=USA5/${s}/${e}?cookie=${encodeURIComponent(token)}`
            : `${SB_BASE}/movie/${tmdbId}/oss=USA5?cookie=${encodeURIComponent(token)}`;

        const resp = await fetch(api);
        let d = await resp.json();

        // 4. FALLBACK: Search by Title (Critical for movies like 'Hoppers')
        if ((!d || !d.versions || d.versions.length === 0) && title) {
            const searchUrl = `${SB_BASE}/search?query=${encodeURIComponent(title)}&cookie=${encodeURIComponent(token)}`;
            const sData = await (await fetch(searchUrl)).json();

            if (sData.success && sData.results && sData.results.length > 0) {
                const internalId = sData.results[0].id;
                const retryUrl = (type === 'tv')
                    ? `${SB_BASE}/tv/${internalId}/oss=aws/${s}/${e}?cookie=${encodeURIComponent(token)}`
                    : `${SB_BASE}/movie/${internalId}/oss=aws?cookie=${encodeURIComponent(token)}`;
                
                d = await (await fetch(retryUrl)).json();
            }
        }

        if (!d || !d.versions) return [];
        
        // 5. Transform to Nuvio format
        return d.versions.flatMap(v => (v.links || []).map(l => ({
            name: "ShowBox " + (l.quality || "HD"),
            url: l.url,
            quality: l.quality || "HD",
            provider: "private-local"
        })));

    } catch (e) {
        // console.log("Error: " + e.message);
        return [];
    }
}

global.getStreams = getStreams;
