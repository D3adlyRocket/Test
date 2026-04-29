const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const PROVIDER_ID = 'alas-vidfast';

// Hardcoded verified keys from your working script
const CFG = {
    key: "732d61323330343734612d313165622d",
    iv: "61316232633364346535663637383930",
    xor: "33353335353033323333333633313331",
    path: "sources",
    src: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
    dst: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_"
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

// Fixed Encryption Helpers to match working logic
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

function toB64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return (typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64'))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function aesEncrypt(text, keyHex, ivHex) {
    const subtle = globalThis.crypto.subtle;
    const padded = pkcs7Pad(new TextEncoder().encode(text));
    const key = await subtle.importKey('raw', hexToBytes(keyHex), { name: 'AES-CBC' }, false, ['encrypt']);
    const buf = await subtle.encrypt({ name: 'AES-CBC', iv: hexToBytes(ivHex) }, key, padded);
    return new Uint8Array(buf);
}

// UI/Quality Helpers from your first script
function inferQuality(url) {
    const v = String(url).toLowerCase();
    if (v.includes('2160') || v.includes('4k')) return 2160;
    if (v.includes('1080')) return 1080;
    if (v.includes('720')) return 720;
    return 0;
}

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

        // 2. Fetch the 'en' token using the robust regex from your working code
        const pageUrl = type === 'tv'
            ? `https://vidfast.pro/tv/${imdbId}/${seasonNum || 1}/${episodeNum || 1}`
            : `https://vidfast.pro/movie/${imdbId}`;
        const pageRes = await safeFetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const pageText = await pageRes.text();
        const token = pageText.match(/"en"\s*:\s*"([^"]+)"/)?.[1];
        if (!token) return [];

        // 3. Encrypt, XOR, and Substitution Cipher
        const encrypted = await aesEncrypt(token, CFG.key, CFG.iv);
        const xorKey = hexToBytes(CFG.xor);
        const xored = encrypted.map((b, i) => b ^ xorKey[i % xorKey.length]);
        const b64 = toB64Url(xored);

        let finalEncoded = '';
        for (const ch of b64) {
            const idx = CFG.src.indexOf(ch);
            finalEncoded += idx !== -1 ? CFG.dst[idx] : ch;
        }

        // 4. Fetch Server List
        const apiServers = `https://vidfast.pro/${CFG.path}/wfPFjh__qQ/${finalEncoded}`;
        const serversRes = await safeFetch(apiServers, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0', 
                'Referer': pageUrl,
                'X-Requested-With': 'XMLHttpRequest' 
            } 
        });
        const serverList = await serversRes.json();
        if (!Array.isArray(serverList)) return [];

        // 5. Build and Sort Streams
        const streams = [];
        for (const srv of serverList) {
            const apiStream = `https://vidfast.pro/${CFG.path}/AddlBFe5/${srv.data}`;
            const sRes = await safeFetch(apiStream, { headers: { 'Referer': 'https://vidfast.pro/' } });
            const sData = await sRes.json();

            if (sData?.url) {
                const score = inferQuality(sData.url);
                streams.push({
                    name: `${PROVIDER_ID} - ${srv.name}`,
                    url: sData.url,
                    quality: score >= 1080 ? '1080p' : 'Auto',
                    headers: { 'Referer': 'https://vidfast.pro/' },
                    _score: score
                });
            }
        }

        return streams.sort((a, b) => b._score - a._score).map(({ _score, ...rest }) => rest);

    } catch (e) {
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
