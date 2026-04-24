const BASE_URL = 'https://cinevibe.asia';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

// Use a consistent User-Agent and Fingerprint
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const FINGERPRINT = "eyJzY3JlZW4iOiIzNjB4ODA2eDI0Iiwi";

const getHeaders = (extra = {}) => ({
    'User-Agent': UA,
    'Referer': BASE_URL + '/',
    'Origin': BASE_URL,
    'X-CV-Fingerprint': FINGERPRINT,
    'X-Requested-With': 'XMLHttpRequest',
    ...extra
});

// Robust Base64 for restricted environments
const b64 = (str) => {
    const map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    for (let i = 0; i < str.length;) {
        const c1 = str.charCodeAt(i++), c2 = str.charCodeAt(i++), c3 = str.charCodeAt(i++);
        const enc1 = c1 >> 2, enc2 = ((c1 & 3) << 4) | (c2 >> 4), enc3 = ((c2 & 15) << 2) | (c3 >> 6), enc4 = c3 & 63;
        output += map.charAt(enc1) + map.charAt(enc2) + (isNaN(c2) ? '=' : map.charAt(enc3)) + (isNaN(c3) ? '=' : map.charAt(enc4));
    }
    return output;
};

async function getStreams(tmdbId, mediaType, season, episode) {
    if (mediaType === 'tv') return []; // Matches your original "TV not supported" logic

    try {
        // STEP 1: Get TMDB metadata
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const meta = await tmdbRes.json();
        if (!meta.title) return [];

        const title = meta.title;
        const year = meta.release_date ? meta.release_date.split('-')[0] : '';
        const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');

        // STEP 2: "Wake up" the session (Crucial for Cinevibe)
        // This ensures the server sees a real visitor before the API call
        await fetch(BASE_URL, { headers: { 'User-Agent': UA } });

        // STEP 3: Token Generation (Corrected 2025 Logic)
        const timeWindow = Math.floor(Date.now() / 300000);
        const timeStamp = Math.floor(Date.now() / 1000 / 600);
        
        // FNV-1a Hash
        let hash = 0x811c9dc5;
        const hashStr = `${timeWindow}_${FINGERPRINT}_cinevibe_2025`;
        for (let i = 0; i < hashStr.length; i++) {
            hash = Math.imul(hash ^ hashStr.charCodeAt(i), 0x01000193);
        }
        const hashedKey = (hash >>> 0).toString(16).padStart(8, '0');

        // Custom Double-Base64-ROT13 Encode
        const tokenRaw = `pjght152dw2rb.ssst4bzleDI0Iiwibv78|${tmdbId}|${cleanTitle}|${year}||${hashedKey}|${timeStamp}|${FINGERPRINT}`;
        let token = b64(tokenRaw).split('').reverse().join('');
        token = token.replace(/[A-Za-z]/g, c => String.fromCharCode(c.charCodeAt(0) + (c.toUpperCase() <= 'M' ? 13 : -13)));
        token = b64(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        // STEP 4: Fetch Streams
        const apiUrl = `${BASE_URL}/api/stream/fetch?server=cinebox-1&type=movie&mediaId=${tmdbId}&title=${encodeURIComponent(title)}&releaseYear=${year}&_token=${token}&_ts=${Date.now()}`;

        const response = await fetch(apiUrl, { 
            headers: getHeaders({ 'Accept': 'application/json' }) 
        });
        
        const data = await response.json();

        if (!data.sources || data.sources.length === 0) {
            console.log("Cinevibe: No sources found in response");
            return [];
        }

        return data.sources.map(s => ({
            name: `Cinevibe`,
            title: `${title} (${year}) [${s.quality || 'HD'}]`,
            url: s.url,
            quality: s.quality || 'Unknown',
            headers: getHeaders({ 
                'Referer': 'https://cinevibe.asia/',
                'Origin': 'https://cinevibe.asia'
            })
        }));

    } catch (err) {
        console.error("Cinevibe Scraper Error:", err);
        return [];
    }
}

module.exports = { getStreams };
