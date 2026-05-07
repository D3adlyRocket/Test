var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var SB_BASE = 'https://febapi.nuvioapp.space/api/media';
var LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie.txt";

async function getStreams(tmdbId, type, s, e) {
    try {
        // 1. Get Token from your server
        const tokenResp = await fetch(LOCAL_COOKIE_URL);
        const token = (await tokenResp.text()).trim();
        if (!token) return [];

        // 2. Fetch TMDB Data (to get the title for searching if ID fails)
        const tmdbUrl = `https://api.themoviedb.org/3/${type === 'tv' ? 'tv/' : 'movie/'}${tmdbId}?api_key=${TMDB_KEY}`;
        const m = await (await fetch(tmdbUrl)).json();
        const title = type === 'tv' ? m.name : m.title;

        // 3. Setup Headers (Android TV needs to look like a browser)
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        };

        // 4. Primary API Call (Using USA5 region)
        let api = (type === 'tv') 
            ? `${SB_BASE}/tv/${tmdbId}/oss=USA5/${s}/${e}?cookie=${encodeURIComponent(token)}`
            : `${SB_BASE}/movie/${tmdbId}/oss=USA5?cookie=${encodeURIComponent(token)}`;

        let resp = await fetch(api, { headers });
        let d = await resp.json();

        // 5. FALLBACK: Search by Title (If ID returns no links)
        // This fixes newer movies like 'Hoppers'
        if ((!d || !d.versions || d.versions.length === 0) && title) {
            console.log("[ShowBox] ID failed, trying title search...");
            const searchUrl = `${SB_BASE}/search?query=${encodeURIComponent(title)}&cookie=${encodeURIComponent(token)}`;
            const sRes = await fetch(searchUrl, { headers });
            const sData = await sRes.json();

            if (sData.success && sData.results && sData.results.length > 0) {
                const internalId = sData.results[0].id;
                // Try fallback region 'aws'
                const retryUrl = (type === 'tv')
                    ? `${SB_BASE}/tv/${internalId}/oss=aws/${s}/${e}?cookie=${encodeURIComponent(token)}`
                    : `${SB_BASE}/movie/${internalId}/oss=aws?cookie=${encodeURIComponent(token)}`;
                
                d = await (await fetch(retryUrl, { headers })).json();
            }
        }

        if (!d || !d.versions) return [];
        
        // 6. Map to Nuvio format
        return d.versions.flatMap(v => (v.links || []).map(l => ({
            name: "ShowBox " + (l.quality || "HD"),
            url: l.url,
            quality: l.quality || "HD",
            provider: "private-local"
        })));

    } catch (e) {
        return [];
    }
}

global.getStreams = getStreams;
