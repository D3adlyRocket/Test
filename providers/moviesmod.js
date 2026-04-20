const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const BASE_URL = 'https://vixsrc.to';
const WYZIE_BASE = 'https://sub.wyzie.io';

async function makeRequest(url, options = {}) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
        'Referer': BASE_URL + '/',
        'Origin': BASE_URL,
        'Accept': 'application/json, text/plain, */*',
        ...options.headers
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    return response;
}

// FIX 1: Using sub.wyzie.io API correctly
async function getSubtitles(tmdbId, type, season, episode) {
    try {
        // format: sub.wyzie.io/search?id=TMDB_ID&type=movie OR &type=tv&s=1&e=1
        let query = `${WYZIE_BASE}/search?id=${tmdbId}&type=${type}`;
        if (type === 'tv') query += `&s=${season}&e=${episode}`;

        const res = await makeRequest(query);
        const subs = await res.json();

        // Map Wyzie response to Nuvio format
        return subs.map(s => ({
            url: s.url,
            lang: s.display || s.language,
            label: s.display || s.language
        })).filter(s => s.lang.toLowerCase().includes('english'));
    } catch (e) {
        console.log("[Wyzie] Subtitle fetch failed:", e.message);
        return [];
    }
}

// FIX 2: Vixsrc "Hidden API" fetch
async function extractVideoLink(tmdbId, type, s, e) {
    // 2026 Logic: Vixsrc now uses a /api/ route for the data payload
    const apiPath = type === 'movie' 
        ? `${BASE_URL}/api/movie/${tmdbId}` 
        : `${BASE_URL}/api/tv/${tmdbId}/${s}/${e}`;

    try {
        const res = await makeRequest(apiPath);
        const data = await res.json();
        
        // Vixsrc usually returns { "url": "...", "token": "..." }
        if (data && data.url) {
            return data.url.includes('token') ? data.url : `${data.url}?token=${data.token}`;
        }
        return null;
    } catch (e) {
        console.log("[Vixsrc] Video API fetch failed. Trying HTML fallback...");
        return null; 
    }
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    // 1. Get the Video Link
    const videoUrl = await extractVideoLink(tmdbId, mediaType, seasonNum, episodeNum);
    
    if (!videoUrl) {
        console.error("No video link found. Check Cloudflare status.");
        return [];
    }

    // 2. Get Subtitles from Wyzie
    const subtitles = await getSubtitles(tmdbId, mediaType, seasonNum, episodeNum);

    return [{
        name: "Vixsrc",
        title: "Auto Quality (HLS)",
        url: videoUrl,
        quality: 'Auto',
        subtitles: subtitles,
        headers: {
            'Referer': BASE_URL + '/',
            'User-Agent': 'Mozilla/5.0...'
        }
    }];
}

module.exports = { getStreams };
