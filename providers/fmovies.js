// ShowBox Scraper - Android TV / Local Cookie Edition
const TMDB_API_KEY = '1c29a5198ee1854bd5eb45dbe8d17d92';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const SHOWBOX_API_BASE = 'https://febapi.nuvioapp.space/api/media';
const LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie.txt";

const WORKING_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Android TV) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
};

// 1. IMPROVED TOKEN DETECTION
async function getUiToken() {
    try {
        console.log(`[ShowBox] Checking local server: ${LOCAL_COOKIE_URL}`);
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 2000); // 2 second timeout
        
        const response = await fetch(LOCAL_COOKIE_URL, { signal: controller.signal });
        if (response.ok) {
            const serverCookie = (await response.text()).trim();
            if (serverCookie) {
                console.log("[ShowBox] Cookie detected from server");
                return serverCookie;
            }
        }
    } catch (e) {
        console.log(`[ShowBox] Local fetch failed/blocked: ${e.message}`);
    }

    // Fallback to Scraper Settings in Nuvio App
    if (typeof global !== 'undefined' && global.SCRAPER_SETTINGS?.uiToken) {
        console.log("[ShowBox] Falling back to App Settings token");
        return String(global.SCRAPER_SETTINGS.uiToken);
    }
    return '';
}

// 2. ORIGINAL UTILITIES (Preserved)
function getQualityFromName(q) {
    if (!q) return 'Unknown';
    const match = q.match(/(\d{3,4})[pP]?/);
    return match ? match[1] + 'p' : q;
}

function extractCodecDetails(text) {
    if (!text) return [];
    const details = new Set();
    const low = text.toLowerCase();
    if (low.includes('h265') || low.includes('x265') || low.includes('hevc')) details.add('H.265');
    if (low.includes('hdr')) details.add('HDR');
    if (low.includes('atmos')) details.add('Atmos');
    if (low.includes('10bit')) details.add('10-bit');
    return Array.from(details);
}

// 3. MAIN FETCH LOGIC
async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        const cookie = await getUiToken();
        if (!cookie) return [];

        // Get TMDB Title for fallback
        const tmdbUrl = `${TMDB_BASE_URL}/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const tmdbRes = await fetch(tmdbUrl);
        const mediaInfo = await tmdbRes.json();
        const title = mediaType === 'tv' ? mediaInfo.name : mediaInfo.title;

        // API Endpoint - Try Direct ID first
        let apiUrl = (mediaType === 'tv')
            ? `${SHOWBOX_API_BASE}/tv/${tmdbId}/${seasonNum}/${episodeNum}?cookie=${encodeURIComponent(cookie)}`
            : `${SHOWBOX_API_BASE}/movie/${tmdbId}?cookie=${encodeURIComponent(cookie)}`;

        console.log(`[ShowBox] Fetching API: ${apiUrl}`);
        let response = await fetch(apiUrl, { headers: WORKING_HEADERS });
        let data = await response.json();

        // FALLBACK: If direct ID returns nothing, try Title Search (Fixes movies like Hoppers)
        if ((!data.versions || data.versions.length === 0) && title) {
            console.log(`[ShowBox] ID failed. Searching title: ${title}`);
            const searchUrl = `${SHOWBOX_API_BASE}/search?query=${encodeURIComponent(title)}&cookie=${encodeURIComponent(cookie)}`;
            const sRes = await fetch(searchUrl, { headers: WORKING_HEADERS });
            const sData = await sRes.json();

            if (sData.success && sData.results?.length > 0) {
                const internalId = sData.results[0].id;
                const retryUrl = (mediaType === 'tv')
                    ? `${SHOWBOX_API_BASE}/tv/${internalId}/${seasonNum}/${episodeNum}?cookie=${encodeURIComponent(cookie)}`
                    : `${SHOWBOX_API_BASE}/movie/${internalId}?cookie=${encodeURIComponent(cookie)}`;
                response = await fetch(retryUrl, { headers: WORKING_HEADERS });
                data = await response.json();
            }
        }

        if (!data || !data.versions) return [];

        return data.versions.flatMap((v, vIdx) => (v.links || []).map(l => {
            const quality = getQualityFromName(l.quality || 'HD');
            const codecs = extractCodecDetails(v.name).join(' • ');
            return {
                name: `ShowBox V${vIdx + 1} ${quality}`,
                title: `${title} ${quality}${codecs ? '\n' + codecs : ''}`,
                url: l.url,
                quality: quality,
                size: l.size || v.size || 'Unknown',
                provider: 'showbox'
            };
        }));

    } catch (error) {
        console.error(`[ShowBox] Fatal Error: ${error.message}`);
        return [];
    }
}

global.ShowBoxScraperModule = { getStreams };
