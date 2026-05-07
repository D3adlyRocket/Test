var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var SB_BASE = 'https://febapi.nuvioapp.space/api/media';
var LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie.txt";

async function getStreams(tmdbId, type, s, e) {
    try {
        // 1. Fetch token from your server
        const tokenResp = await fetch(LOCAL_COOKIE_URL);
        const rawToken = await tokenResp.text();
        const token = rawToken.trim();

        if (!token) return [];

        // 2. Build the API URL with the 2026 "USA5" region mapping
        // Note: Some versions of this API prefer 'token=' instead of 'cookie='
        const region = "USA5"; 
        let api = (type === 'tv') 
            ? `${SB_BASE}/tv/${tmdbId}/oss=${region}/${s}/${e}?token=${encodeURIComponent(token)}`
            : `${SB_BASE}/movie/${tmdbId}/oss=${region}?token=${encodeURIComponent(token)}`;

        // 3. Mandatory Headers for Android TV
        // Without these, the server often sends back 0 links to "protect" against bots
        const response = await fetch(api, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Android TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://www.febbox.com/'
            }
        });

        const d = await response.json();

        // 4. Verification Check
        if (!d || !d.versions || d.versions.length === 0) {
            // Try fallback region if USA5 fails
            const fallbackApi = api.replace('oss=USA5', 'oss=aws');
            const fallbackResp = await fetch(fallbackApi);
            const fallbackData = await fallbackResp.json();
            
            if (!fallbackData || !fallbackData.versions) return [];
            d = fallbackData;
        }
        
        // 5. Final Mapping
        return d.versions.flatMap(v => (v.links || []).map(l => ({
            name: "ShowBox " + (l.quality || "HD"),
            url: l.url,
            quality: l.quality || "HD",
            provider: "showbox-local"
        })));

    } catch (err) {
        return [];
    }
}

global.getStreams = getStreams;
