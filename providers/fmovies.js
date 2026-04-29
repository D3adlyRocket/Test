const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const PROVIDER_ID = 'alas-vidfast';

// Use the working static configuration
const CONFIG = {
    aesKey: "732d61323330343734612d313165622d",
    aesIv: "61316232633364346535663637383930",
    xorKey: "33353335353033323333333633313331",
    staticPath: "sources",
    encodeSrc: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
    encodeDst: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_",
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
};

async function safeFetch(url, options = {}) {
    if (typeof fetchv2 === 'function') {
        const headers = options.headers || {};
        const method = options.method || 'GET';
        const body = options.body || null;
        try {
            return await fetchv2(url, headers, method, body, true, options.encoding || 'utf-8');
        } catch (e) {}
    }
    return fetch(url, options);
}

// Encryption Helpers
function hexToBytes(hex) {
    const clean = String(hex || '').replace(/^0x/i, '');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
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

async function aesCbcEncrypt(plainText, keyBytes, ivBytes) {
    const subtle = globalThis.crypto.subtle;
    const encoder = new TextEncoder();
    const padded = pkcs7Pad(encoder.encode(String(plainText || '')));
    const key = await subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']);
    const cipherBuf = await subtle.encrypt({ name: 'AES-CBC', iv: ivBytes }, key, padded);
    return new Uint8Array(cipherBuf);
}

// Main Logic
async function getStreams(tmdbId, mediaType, seasonNum = 1, episodeNum = 1) {
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        
        // 1. Get IMDB ID (Crucial for Vidfast URL structure)
        const tmdbUrl = type === 'movie' 
            ? `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
            : `${TMDB_BASE}/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
        const tmdbRes = await safeFetch(tmdbUrl);
        const tmdbData = await tmdbRes.json();
        const imdbId = tmdbData.imdb_id;
        if (!imdbId) return [];

        // 2. Load the Vidfast page to get the 'en' token
        const pageUrl = type === 'tv'
            ? `https://vidfast.pro/tv/${imdbId}/${seasonNum}/${episodeNum}`
            : `https://vidfast.pro/movie/${imdbId}`;

        const pageRes = await safeFetch(pageUrl, { 
            headers: { 'User-Agent': CONFIG.userAgent } 
        });
        const pageText = await pageRes.text();
        
        // Use a more robust regex to find the token
        const tokenMatch = pageText.match(/"en"\s*:\s*"([^"]+)"/);
        const rawToken = tokenMatch ? tokenMatch[1] : null;
        if (!rawToken) return [];

        // 3. Encrypt the token (Matching your working code's logic)
        const cipherBytes = await aesCbcEncrypt(rawToken, hexToBytes(CONFIG.aesKey), hexToBytes(CONFIG.aesIv));
        const xorBytes = hexToBytes(CONFIG.xorKey);
        const xorResult = cipherBytes.map((b, i) => b ^ xorBytes[i % xorBytes.length]);
        const b64 = bytesToBase64Url(xorResult);

        let encodedFinal = '';
        for (const ch of b64) {
            const idx = CONFIG.encodeSrc.indexOf(ch);
            encodedFinal += idx !== -1 ? CONFIG.encodeDst[idx] : ch;
        }

        // 4. Fetch the Server List with the CORRECT HEADERS
        const apiServers = `https://vidfast.pro/${CONFIG.staticPath}/wfPFjh__qQ/${encodedFinal}`;
        const serversRes = await safeFetch(apiServers, { 
            headers: { 
                'User-Agent': CONFIG.userAgent, 
                'Referer': pageUrl, // Must be the specific movie page
                'X-Requested-With': 'XMLHttpRequest', // Mandatory for Vidfast API
                'Accept': 'application/json, text/javascript, */*; q=0.01'
            } 
        });
        
        const serverList = await serversRes.json();
        if (!Array.isArray(serverList)) return [];

        // 5. Final stream extraction
        const streams = [];
        for (const srv of serverList) {
            const apiStream = `https://vidfast.pro/${CONFIG.staticPath}/AddlBFe5/${srv.data}`;
            const streamRes = await safeFetch(apiStream, { 
                headers: { 
                    'User-Agent': CONFIG.userAgent,
                    'Referer': 'https://vidfast.pro/',
                    'X-Requested-With': 'XMLHttpRequest'
                } 
            });
            const data = await streamRes.json();

            if (data && data.url) {
                streams.push({
                    name: `${PROVIDER_ID} - ${srv.name || 'Server'}`,
                    url: data.url,
                    quality: data.url.includes('m3u8') ? 'Auto' : '1080p',
                    headers: { 
                        'Referer': 'https://vidfast.pro/',
                        'User-Agent': CONFIG.userAgent
                    }
                });
            }
        }

        return streams;
    } catch (e) {
        console.error("Vidfast Error:", e);
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
