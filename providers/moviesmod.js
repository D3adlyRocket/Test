const BASE_URL = 'https://cinevibe.asia';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const FINGERPRINT = "eyJzY3JlZW4iOiIzNjB4ODA2eDI0Iiwi";

// Helper: Custom Base64 that handles URI safety manually
const b64 = (s) => {
    const t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let o = "", i = 0;
    while (i < s.length) {
        let c1 = s.charCodeAt(i++), c2 = s.charCodeAt(i++), c3 = s.charCodeAt(i++);
        let e1 = c1 >> 2, e2 = ((c1 & 3) << 4) | (c2 >> 4), e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (c3 >> 6), e4 = isNaN(c3) ? 64 : c3 & 63;
        o += t.charAt(e1) + t.charAt(e2) + t.charAt(e3) + t.charAt(e4);
    }
    return o;
};

// Helper: Secure 32-bit FNV-1a
const fnv1a = (str) => {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        // Equivalent to hash * 16777619 but safe for JS 32-bit
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
};

async function getStreams(tmdbId, mediaType, season, episode) {
    // Force movie for now to test connectivity
    if (mediaType !== 'movie') return [];

    try {
        // 1. TMDB Metadata
        const metaRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const meta = await metaRes.json();
        if (!meta.title) return [];

        const title = meta.title;
        const year = (meta.release_date || "2024").split('-')[0];
        const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');

        // 2. Token Generation
        // These windows must match the server exactly
        const timeWindow = Math.floor(Date.now() / 300000); 
        const timeStamp = Math.floor(Date.now() / 1000 / 600);
        
        const hashInput = `${timeWindow}_${FINGERPRINT}_cinevibe_2025`;
        const hashedKey = fnv1a(hashInput);
        
        // Construct Payload
        const entropy = "pjght152dw2rb.ssst4bzleDI0Iiwibv78";
        const rawPayload = `${entropy}|${tmdbId}|${cleanTitle}|${year}||${hashedKey}|${timeStamp}|${FINGERPRINT}`;
        
        // Encode: Base64 -> Reverse -> ROT13 -> Base64 -> URLSafe
        let step1 = b64(rawPayload).split('').reverse().join('');
        let step2 = step1.replace(/[A-Za-z]/g, c => String.fromCharCode(c.charCodeAt(0) + (c.toUpperCase() <= 'M' ? 13 : -13)));
        const finalToken = b64(step2).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        // 3. API Call
        const apiUrl = `${BASE_URL}/api/stream/fetch?server=cinebox-1&type=movie&mediaId=${tmdbId}&title=${encodeURIComponent(title)}&releaseYear=${year}&_token=${finalToken}&_ts=${Date.now()}`;

        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
                'Referer': BASE_URL + '/',
                'X-CV-Fingerprint': FINGERPRINT,
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            }
        });

        const data = await response.json();
        if (!data || !data.sources) return [];

        return data.sources.map(s => ({
            name: "Cinevibe",
            title: `${title} (${year}) [${s.quality || s.label || 'HD'}]`,
            url: s.url,
            quality: s.quality || s.label || 'HD',
            headers: {
                'User-Agent': "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
                'Referer': BASE_URL + '/',
                'Origin': BASE_URL
            }
        }));

    } catch (e) {
        return [];
    }
}

module.exports = { getStreams };
