var TMDB_KEY = '1c29a5198ee1854bd5eb45dbe8d17d92';
var SB_BASE = 'https://febapi.nuvioapp.space/api/media';
var LOCAL_URL = "http://192.168.1.176:8080/cookie.txt"; 

async function getStreams(tmdbId, type, s, e) {
    try {
        console.log("[ShowBox] ATTEMPTING FETCH FROM: " + LOCAL_URL);
        
        // We use a very short timeout so the UI doesn't hang if the server is blocked
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const tokenResp = await fetch(LOCAL_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        const token = (await tokenResp.text()).trim();
        console.log("[ShowBox] TOKEN RETRIEVED: " + (token ? "YES (Starts with " + token.substring(0,5) + ")" : "NO"));

        if (!token) return [];

        const api = (type === 'tv') 
            ? `${SB_BASE}/tv/${tmdbId}/${s}/${e}?cookie=${token}`
            : `${SB_BASE}/movie/${tmdbId}?cookie=${token}`;

        const d = await (await fetch(api)).json();
        
        if (!d || !d.versions) {
            console.log("[ShowBox] API returned no versions. Likely TMDB ID mismatch.");
            return [];
        }
        
        return d.versions.flatMap(v => (v.links || []).map(l => ({
            name: "ShowBox " + (l.quality || "HD"),
            url: l.url,
            quality: l.quality || "HD",
            provider: "showbox-local"
        })));

    } catch (err) {
        // THIS IS THE IMPORTANT PART: Look for these messages in Nuvio logs
        if (err.name === 'AbortError') {
            console.log("[ShowBox] ERROR: Local Server Timed Out (Firewall or IP wrong)");
        } else if (err.message.includes("Network request failed")) {
            console.log("[ShowBox] ERROR: Network Blocked (Android Cleartext or SSL issue)");
        } else {
            console.log("[ShowBox] ERROR: " + err.message);
        }
        return [];
    }
}

global.getStreams = getStreams;
