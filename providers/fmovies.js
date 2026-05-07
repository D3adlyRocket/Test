// ShowBox Scraper - Android TV Optimized
const TMDB_API_KEY = '1c29a5198ee1854bd5eb45dbe8d17d92';
const SHOWBOX_API_BASE = 'https://febapi.nuvioapp.space/api/media';
const LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie.txt";

async function getUiToken() {
    try {
        console.log(`[ShowBox] Android TV Fetching: ${LOCAL_COOKIE_URL}`);
        
        // Android TV requires a longer timeout and specific headers sometimes
        const response = await fetch(LOCAL_COOKIE_URL, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
        });

        if (response.ok) {
            const serverCookie = await response.text();
            if (serverCookie && serverCookie.trim()) return serverCookie.trim();
        }
    } catch (e) {
        // If this logs "Network request failed", Android TV is blocking HTTP
        console.log(`[ShowBox] Android TV Network Error: ${e.message}`);
    }

    // Fallback to manual settings
    if (typeof global !== 'undefined' && global.SCRAPER_SETTINGS?.uiToken) {
        return String(global.SCRAPER_SETTINGS.uiToken);
    }
    return '';
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        const cookie = await getUiToken();
        if (!cookie) return [];

        // Direct API Call
        let apiUrl = mediaType === 'tv' 
            ? `${SHOWBOX_API_BASE}/tv/${tmdbId}/${seasonNum}/${episodeNum}?cookie=${encodeURIComponent(cookie)}`
            : `${SHOWBOX_API_BASE}/movie/${tmdbId}?cookie=${encodeURIComponent(cookie)}`;

        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Android TV)',
                'Accept': 'application/json'
            }
        });

        const data = await response.json();
        if (!data?.versions) return [];

        return data.versions.flatMap((v, vIdx) => (v.links || []).map(l => ({
            name: `ShowBox V${vIdx + 1} - ${l.quality || 'HD'}`,
            url: l.url,
            quality: l.quality || 'HD',
            size: l.size || v.size || 'Unknown',
            provider: 'showbox'
        })));
    } catch (error) {
        console.error(`[ShowBox] Failed: ${error.message}`);
        return [];
    }
}

global.ShowBoxScraperModule = { getStreams };
