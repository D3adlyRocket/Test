const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const PROVIDER_ID = 'alas-vidfast';

// Fixed configuration from your working version
const CONFIG = {
    aesKey: "732d61323330343734612d313165622d",
    aesIv: "61316232633364346535663637383930",
    xorKey: "33353335353033323333333633313331",
    staticPath: "sources",
    encodeSrc: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
    encodeDst: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_",
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function safeFetch(url, options = {}) {
    if (typeof fetchv2 === 'function') {
        const headers = options.headers || {};
        const method = options.method || 'GET';
        const body = options.body || null;
        try {
            return await fetchv2(url, headers, method, body, true, options.encoding || 'utf-8');
        } catch {}
    }
    return fetch(url, options);
}

// Re-implemented Encryption Helpers to ensure 1:1 compatibility
function hexToBytes(hex) {
    const clean = String(hex || '').trim().replace(/^0x/i, '').toLowerCase();
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}

function pkcs7Pad(bytes, blockSize = 16) {
    const pad = blockSize - (bytes.length % blockSize);
    const out = new Uint8Array(bytes.length + pad);
    out.set(bytes);
    out.fill(pad, bytes.length);
    return out;
}

function bytesToBase64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return (typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64'))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function aesCbcEncryptPkcs7(plainText, keyBytes, ivBytes) {
    const subtle = globalThis.crypto.subtle;
    const encoder = new TextEncoder();
    const padded = pkcs7Pad(encoder.encode(String(plainText || '')));
    const key = await subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']);
    const cipherBuf = await subtle.encrypt({ name: 'AES-CBC', iv: ivBytes }, key, padded);
    return new Uint8Array(cipherBuf);
}

// Improved Stream Selection Logic
async function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        
        // 1. Get IMDB ID
        const tmdbUrl = type === 'movie' 
            ? `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
            : `${TMDB_BASE}/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
        
        const tmdbRes = await safeFetch(tmdbUrl);
        const tmdbData = await tmdbRes.json();
        const imdbId = tmdbData.imdb_id;
        if (!imdbId) return [];

        // 2. Extract the 'en' token from Vidfast
        const pageUrl = type === 'tv'
            ? `https://vidfast.pro/tv/${imdbId}/${Number(seasonNum || 1)}/${Number(episodeNum || 1)}`
            : `https://vidfast.pro/movie/${imdbId}`;

        const pageRes = await safeFetch(pageUrl, { headers: { 'User-Agent': CONFIG.userAgent } });
        const pageText = await pageRes.text();
        const rawToken = pageText.match(/"en"\s*:\s*"([^"]+)"/)?.[1];
        if (!rawToken) return [];

        // 3. Perform Encryption/XOR/Substitution
        const cipherBytes = await aesCbcEncryptPkcs7(rawToken, hexToBytes(CONFIG.aesKey), hexToBytes(CONFIG.aesIv));
        const xorBytes = hexToBytes(CONFIG.xorKey);
        const xorResult = cipherBytes.map((b, i) => b ^ xorBytes[i % xorBytes.length]);
        const base64Url = bytesToBase64Url(xorResult);

        let encodedFinal = '';
        for (const ch of base64Url) {
            const idx = CONFIG.encodeSrc.indexOf(ch);
            encodedFinal += idx !== -1 ? CONFIG.encodeDst[idx] : ch;
        }

        // 4. Fetch Server List
        const apiServers = `https://vidfast.pro/${CONFIG.staticPath}/wfPFjh__qQ/${encodedFinal}`;
        const serversRes = await safeFetch(apiServers, { 
            headers: { 
                'User-Agent': CONFIG.userAgent, 
                'Referer': pageUrl,
                'X-Requested-With': 'XMLHttpRequest' 
            } 
        });
        const serverList = await serversRes.json();
        if (!Array.isArray(serverList)) return [];

        // 5. Build Stream Array
        const streams = [];
        for (const srv of serverList) {
            const apiStream = `https://vidfast.pro/${CONFIG.staticPath}/AddlBFe5/${srv.data}`;
            const streamRes = await safeFetch(apiStream, { headers: { 'Referer': 'https://vidfast.pro/' } });
            const data = await streamRes.json();

            if (data?.url) {
                streams.push({
                    name: `${PROVIDER_ID} - ${srv.name}`,
                    url: data.url,
                    quality: data.url.includes('m3u8') ? 'Auto' : '1080p',
                    headers: { 'Referer': 'https://vidfast.pro/' }
                });
            }
        }

        return streams;
    } catch (e) {
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
