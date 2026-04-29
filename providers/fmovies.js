const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const PROVIDER_ID = 'alas-vidfast';

// EXACT WORKING KEYS FROM YOUR CODE
const CFG = {
    key: "732d61323330343734612d313165622d",
    iv: "61316232633364346535663637383930",
    xor: "33353335353033323333333633313331",
    path: "sources",
    src: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
    dst: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_"
};

// Helper: Ensure the fetcher uses the environment's best available method
async function safeFetch(url, options = {}) {
    if (typeof fetchv2 === 'function') {
        return await fetchv2(url, options.headers || {}, options.method || 'GET', options.body || null, true);
    }
    return fetch(url, options);
}

// CRYPTO: Exact blocks from the working script
function hexToBytes(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
}

function pkcs7Pad(bytes) {
    const pad = 16 - (bytes.length % 16);
    const out = new Uint8Array(bytes.length + pad);
    out.set(bytes);
    out.fill(pad, bytes.length);
    return out;
}

async function aesEncrypt(text, keyHex, ivHex) {
    const subtle = globalThis.crypto.subtle;
    const padded = pkcs7Pad(new TextEncoder().encode(text));
    const key = await subtle.importKey('raw', hexToBytes(keyHex), { name: 'AES-CBC' }, false, ['encrypt']);
    const buf = await subtle.encrypt({ name: 'AES-CBC', iv: hexToBytes(ivHex) }, key, padded);
    return new Uint8Array(buf);
}

function toB64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// MAIN FUNCTION: The working logic
async function getStreams(tmdbId, mediaType, seasonNum = 1, episodeNum = 1) {
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        
        // 1. Get IMDB ID (Required for Vidfast URL)
        const tmdbUrl = type === 'movie' 
            ? `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
            : `${TMDB_BASE}/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
        const tmdbRes = await safeFetch(tmdbUrl);
        const tmdbData = await tmdbRes.json();
        const imdbId = tmdbData.imdb_id;
        if (!imdbId) return [];

        // 2. Load Page and Extract Token
        const pageUrl = type === 'tv'
            ? `https://vidfast.pro/tv/${imdbId}/${seasonNum}/${episodeNum}`
            : `https://vidfast.pro/movie/${imdbId}`;
        const pageRes = await safeFetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const pageText = await pageRes.text();
        const token = pageText.match(/"en"\s*:\s*"([^"]+)"/)?.[1];
        if (!token) return [];

        // 3. Encrypt & Translate (Exact logic from your working code)
        const encrypted = await aesEncrypt(token, CFG.key, CFG.iv);
        const xorKey = hexToBytes(CFG.xor);
        const xored = encrypted.map((b, i) => b ^ xorKey[i % xorKey.length]);
        const b64 = toB64Url(xored);

        let encoded = '';
        for (const ch of b64) {
            const idx = CFG.src.indexOf(ch);
            encoded += idx !== -1 ? CFG.dst[idx] : ch;
        }

        // 4. Fetch Server List with REQUIRED Headers
        const serverUrl = `https://vidfast.pro/${CFG.path}/wfPFjh__qQ/${encoded}`;
        const serverRes = await safeFetch(serverUrl, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0', 
                'Referer': pageUrl,
                'X-Requested-With': 'XMLHttpRequest' 
            } 
        });
        const servers = await serverRes.json();
        if (!Array.isArray(servers)) return [];

        // 5. Final Links
        const results = [];
        for (const srv of servers) {
            const streamUrl = `https://vidfast.pro/${CFG.path}/AddlBFe5/${srv.data}`;
            const sRes = await safeFetch(streamUrl, { headers: { 'Referer': 'https://vidfast.pro/' } });
            const sData = await sRes.json();

            if (sData?.url) {
                results.push({
                    name: `${PROVIDER_ID} - ${srv.name}`,
                    url: sData.url,
                    quality: 'Auto',
                    headers: { 'Referer': 'https://vidfast.pro/' }
                });
            }
        }
        return results;

    } catch (e) {
        return [];
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
