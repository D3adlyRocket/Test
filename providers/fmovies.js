var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var SB_BASE = 'https://febapi.nuvioapp.space/api/media';
var LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie.txt";

async function getStreams(tmdbId, type, s, e) {
    try {
        console.log("[ShowBox] Fetching token from local server...");
        const tokenResp = await fetch(LOCAL_COOKIE_URL);
        const token = (await tokenResp.text()).trim();

        if (!token) {
            console.log("[ShowBox] Token file is empty.");
            return [];
        }

        // Get Title from TMDB for search fallback
        const tmdbUrl = `https://api.themoviedb.org/3/${type === 'tv' ? 'tv/' : 'movie/'}${tmdbId}?api_key=${TMDB_KEY}`;
        const m = await (await fetch(tmdbUrl)).json();
        const title = type === 'tv' ? m.name : m.title;

        // Try direct ID fetch first
        let api = (type === 'tv') 
            ? `${SB_BASE}/tv/${tmdbId}/${s}/${e}?cookie=${token}`
            : `${SB_BASE}/movie/${tmdbId}?cookie=${token}`;

        let resp = await fetch(api);
        let d = await resp.json();

        // FALLBACK: If ID fetch returns nothing, try searching by title
        if ((!d || !d.versions || d.versions.length === 0) && title) {
            console.log(`[ShowBox] ID fetch failed. Searching for: ${title}`);
            const searchUrl = `${SB_BASE}/search?query=${encodeURIComponent(title)}&cookie=${token}`;
            const searchData = await (await fetch(searchUrl)).json();

            if (searchData.success && searchData.results && searchData.results.length > 0) {
                const internalId = searchData.results[0].id;
                const retryUrl = (type === 'tv')
                    ? `${SB_BASE}/tv/${internalId}/${s}/${e}?cookie=${token}`
                    : `${SB_BASE}/movie/${internalId}?cookie=${token}`;
                
                d = await (await fetch(retryUrl)).json();
            }
        }

        if (!d || !d.versions) return [];
        
        return d.versions.flatMap(v => (v.links || []).map(l => ({
            name: "ShowBox " + (l.quality || "HD"),
            url: l.url,
            quality: l.quality || "HD",
            provider: "showbox-private"
        })));

    } catch (err) {
        console.log("[ShowBox] Error: " + err.message);
        return []; 
    }
}

global.getStreams = getStreams;
