const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const PROVIDER_ID = 'alas-vidfast';

// Utility for fetching with potential custom environment support
async function safeFetch(url, options = {}) {
    if (typeof fetchv2 === 'function') {
        const headers = options.headers || {};
        const method = options.method || 'GET';
        const body = options.body || null;
        try {
            return await fetchv2(url, headers, method, body, true, options.encoding || 'utf-8');
        } catch (e) {
            console.error("fetchv2 failed", e);
        }
    }
    return fetch(url, options);
}

// Encryption Helpers
function hexToBytes(hex) {
    const clean = String(hex || '').trim().replace(/^0x/i, '').toLowerCase();
    if (!clean || clean.length % 2 !== 0) return new Uint8Array();
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}

function pkcs7Pad(bytes, blockSize = 16) {
    const mod = bytes.length % blockSize;
    const pad = mod === 0 ? blockSize : (blockSize - mod);
    const out = new Uint8Array(bytes.length + pad);
    out.set(bytes, 0);
    out.fill(pad, bytes.length);
    return out;
}

function bytesToBase64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function aesCbcEncrypt(plainText, keyBytes, ivBytes) {
    const subtle = (globalThis.crypto && globalThis.crypto.subtle) ? globalThis.crypto.subtle : null;
    if (!subtle) throw new Error('WebCrypto not available');

    const encoder = new TextEncoder();
    const padded = pkcs7Pad(encoder.encode(String(plainText || '')));
    const key = await subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']);
    const cipherBuf = await subtle.encrypt({ name: 'AES-CBC', iv: ivBytes }, key, padded);
    return new Uint8Array(cipherBuf);
}

// Core Logic
async function getVidfastConfig() {
    // Note: In a production environment, you should fetch these dynamically 
    // from the site's JS files as they rotate.
    return {
        aesKey: "732d61323330343734612d313165622d",
        aesIv: "61316232633364346535663637383930",
        xorKey: "33353335353033323333333633313331",
        staticPath: "sources",
        encodeSrc: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
        encodeDst: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_",
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
}

async function getStreams(tmdbId, mediaType, seasonNum = 1, episodeNum = 1) {
    try {
        const config = await getVidfastConfig();
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        
        // 1. Get IMDB ID via TMDB
        const tmdbUrl = type === 'movie' 
            ? `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
            : `${TMDB_BASE}/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
        
        const tmdbRes = await safeFetch(tmdbUrl);
        const tmdbData = await tmdbRes.json();
        const imdbId = tmdbData.imdb_id;
        if (!imdbId) return [];

        // 2. Get the Token from the Video Page
        const pageUrl = type === 'tv'
            ? `https://vidfast.pro/tv/${imdbId}/${seasonNum}/${episodeNum}`
            : `https://vidfast.pro/movie/${imdbId}`;

        const pageRes = await safeFetch(pageUrl, { headers: { 'User-Agent': config.userAgent } });
        const pageText = await pageRes.text();
        const tokenMatch = pageText.match(/"en"\s*:\s*"([^"]+)"/);
        if (!tokenMatch) return [];
        const rawToken = tokenMatch[1];

        // 3. Encrypt and Obfuscate the Token
        const keyBytes = hexToBytes(config.aesKey);
        const ivBytes = hexToBytes(config.aesIv);
        const xorBytes = hexToBytes(config.xorKey);

        const cipherBytes = await aesCbcEncrypt(rawToken, keyBytes, ivBytes);
        const xorResult = cipherBytes.map((b, i) => b ^ xorBytes[i % xorBytes.length]);
        const b64 = bytesToBase64Url(xorResult);

        // Character swap (Substitution Cipher)
        let finalEncoded = "";
        for (const char of b64) {
            const idx = config.encodeSrc.indexOf(char);
            finalEncoded += idx !== -1 ? config.encodeDst[idx] : char;
        }

        // 4. Fetch Server List
        const serverUrl = `https://vidfast.pro/${config.staticPath}/wfPFjh__qQ/${finalEncoded}`;
        const serverRes = await safeFetch(serverUrl, { 
            headers: { 'User-Agent': config.userAgent, 'Referer': 'https://vidfast.pro/', 'X-Requested-With': 'XMLHttpRequest' } 
        });
        const servers = await serverRes.json();

        // 5. Resolve actual stream URLs
        const streams = [];
        for (const srv of servers) {
            const streamApi = `https://vidfast.pro/${config.staticPath}/AddlBFe5/${srv.data}`;
            const streamRes = await safeFetch(streamApi, { headers: { 'Referer': 'https://vidfast.pro/' } });
            const streamData = await streamRes.json();

            if (streamData && streamData.url) {
                streams.push({
                    name: `${PROVIDER_ID} - ${srv.name}`,
                    url: streamData.url,
                    quality: 'Auto',
                    headers: { Referer: 'https://vidfast.pro/' }
                });
            }
        }

        return streams;
    } catch (e) {
        console.error("Vidfast Provider Error:", e);
        return [];
    }
}
