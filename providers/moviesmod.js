/**
 * Cinevibe Scraper for Nuvio
 */

const BASE_URL = 'https://cinevibe.asia';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

const WORKING_HEADERS = {
    'Referer': BASE_URL + '/',
    'Origin': BASE_URL,
    'User-Agent': 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': '*/*',
    'sec-ch-ua-platform': '"Android"',
    'sec-ch-ua-mobile': '?1'
};

// --- Utilities ---

const safeBase64 = (str) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    for (let block = 0, charCode, i = 0, map = chars; str.charAt(i | 0) || (map = '=', i % 1); output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
        charCode = str.charCodeAt(i += 3 / 4);
        if (charCode > 0xFF) throw new Error("Invalid Character");
        block = block << 8 | charCode;
    }
    return output;
};

function rot13(str) {
    return str.replace(/[A-Za-z]/g, (c) => 
        String.fromCharCode(c.charCodeAt(0) + (c.toUpperCase() <= 'M' ? 13 : -13))
    );
}

function fnv1a32(s) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        hash ^= s.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function customEncode(e) {
    let encoded = safeBase64(e);
    encoded = encoded.split('').reverse().join('');
    encoded = rot13(encoded);
    encoded = safeBase64(encoded);
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// --- Main Scraper Logic ---

async function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    try {
        // Nuvio TV Check
        if (mediaType === 'tv') return [];

        // 1. Get metadata from TMDB
        const tmdbUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const tmdbRes = await fetch(tmdbUrl);
        const movie = await tmdbRes.json();

        if (!movie.title) return [];

        const title = movie.title;
        const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : "";
        const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');

        // 2. Security Token Generation
        const timeWindow = Math.floor(Date.now() / 300000);
        const timeStamp = Math.floor(Date.now() / 1000 / 600);
        const fingerPrint = "eyJzY3JlZW4iOiIzNjB4ODA2eDI0Iiwi";
        const entropy = "pjght152dw2rb.ssst4bzleDI0Iiwibv78";
        
        const hashedKey = fnv1a32(`${timeWindow}_${fingerPrint}_cinevibe_2025`);
        const tokenString = `${entropy}|${tmdbId}|${cleanTitle}|${releaseYear}||${hashedKey}|${timeStamp}|${fingerPrint}`;
        const token = customEncode(tokenString);

        // 3. API Request
        const apiUrl = `${BASE_URL}/api/stream/fetch?server=cinebox-1&type=movie&mediaId=${tmdbId}&title=${encodeURIComponent(title)}&releaseYear=${releaseYear}&_token=${token}&_ts=${Date.now()}`;

        const response = await fetch(apiUrl, { headers: WORKING_HEADERS });
        const data = await response.json();

        if (!data.sources || !Array.isArray(data.sources)) return [];

        // 4. Return formatted stream list for Nuvio
        return data.sources.map(source => ({
            name: `Cinevibe`,
            title: `${title} (${releaseYear}) [${source.quality || 'Auto'}]`,
            url: source.url,
            quality: source.quality || 'Unknown',
            headers: WORKING_HEADERS,
            provider: 'Cinevibe'
        }));

    } catch (e) {
        console.error("Cinevibe Error:", e);
        return [];
    }
}

// Nuvio Exports
module.exports = { getStreams };
