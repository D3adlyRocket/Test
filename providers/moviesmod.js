const BASE_URL = 'https://cinevibe.asia';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const FINGERPRINT = "eyJzY3JlZW4iOiIzNjB4ODA2eDI0Iiwi";

const b64 = (s) => {
    const t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let o = "", i = 0;
    while (i < s.length) {
        let c1 = s.charCodeAt(i++), c2 = s.charCodeAt(i++), c3 = s.charCodeAt(i++);
        let e1 = c1 >> 2, e2 = ((c1 & 3) << 4) | (c2 >> 4), e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (c3 >> 6), e4 = isNaN(c2) || isNaN(c3) ? 64 : c3 & 63;
        o += t.charAt(e1) + t.charAt(e2) + t.charAt(e3) + t.charAt(e4);
    }
    return o;
};

const fnv1a = (s) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
};

async function getStreams(tmdbId, mediaType, season, episode) {
    if (mediaType !== 'movie') return [];

    try {
        // 1. Metadata
        const metaRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const meta = await metaRes.json();
        const title = meta.title;
        const year = (meta.release_date || "").split('-')[0];
        const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');

        // 2. Token Security
        const timeWindow = Math.floor(Date.now() / 300000);
        const timeStamp = Math.floor(Date.now() / 1000 / 600);
        const hashedKey = fnv1a(`${timeWindow}_${FINGERPRINT}_cinevibe_2025`);
        
        const rawPayload = `pjght152dw2rb.ssst4bzleDI0Iiwibv78|${tmdbId}|${cleanTitle}|${year}||${hashedKey}|${timeStamp}|${FINGERPRINT}`;
        
        let token = b64(rawPayload).split('').reverse().join('');
        token = token.replace(/[A-Za-z]/g, c => String.fromCharCode(c.charCodeAt(0) + (c.toUpperCase() <= 'M' ? 13 : -13)));
        const finalToken = b64(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        // 3. API Call with Precise Headers
        const apiUrl = `${BASE_URL}/api/stream/fetch?server=cinebox-1&type=movie&mediaId=${tmdbId}&title=${encodeURIComponent(title)}&releaseYear=${year}&_token=${finalToken}&_ts=${Date.now()}`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'User-Agent': UA,
                'Referer': 'https://cinevibe.asia/',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CV-Fingerprint': FINGERPRINT,
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) return [];
        const data = await response.json();

        if (!data || !data.sources) return [];

        return data.sources.map(s => ({
            name: "Cinevibe",
            title: `${title} (${year}) [${s.label || s.quality || 'HD'}]`,
            url: s.url,
            quality: s.label || s.quality || 'Unknown',
            headers: {
                'User-Agent': UA,
                'Referer': 'https://cinevibe.asia/',
                'Origin': 'https://cinevibe.asia',
                'Accept': '*/*'
            }
        }));

    } catch (err) {
        return [];
    }
}

module.exports = { getStreams };
