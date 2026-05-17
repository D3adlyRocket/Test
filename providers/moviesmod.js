/** * Pomfy - Surgical Fix (2026 CDN Edition) 
 */

const TMDB_KEY = '3644dd4950b67cd8067b8772de576d6b';
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const API_POMFY = "https://api.pomfy.stream";

// Domain and Browser data from your 15:05 screenshot
const TARGET_DOMAIN = "398fitus.com";
const TARGET_ORIGIN = `https://${TARGET_DOMAIN}`;
const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36";

const HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    "Origin": TARGET_ORIGIN,
    "Referer": TARGET_ORIGIN + "/",
    "Sec-Ch-Ua": '"Chromium";v="137", "Not)A;Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?1",
    "Sec-Ch-Ua-Platform": '"Android"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site"
};

// --- CRYPTO HELPERS ---
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBytes(base64) {
    let b64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const lookup = new Uint8Array(256).fill(255);
    for (let i = 0; i < 64; i++) lookup[BASE64_CHARS.charCodeAt(i)] = i;
    const len = b64.length;
    let outputLen = (len * 3) >> 2;
    if (b64[len - 1] === '=') outputLen--;
    if (b64[len - 2] === '=') outputLen--;
    const bytes = new Uint8Array(outputLen);
    let byteIdx = 0;
    for (let i = 0; i < len; i += 4) {
        const a = lookup[b64.charCodeAt(i)];
        const b = lookup[b64.charCodeAt(i + 1)];
        const c = lookup[b64.charCodeAt(i + 2)];
        const d = lookup[b64.charCodeAt(i + 3)];
        if (byteIdx < outputLen) bytes[byteIdx++] = (a << 2) | (b >> 4);
        if (byteIdx < outputLen) bytes[byteIdx++] = ((b & 0x0f) << 4) | (c >> 2);
        if (byteIdx < outputLen) bytes[byteIdx++] = ((c & 0x03) << 6) | d;
    }
    return bytes;
}

const SBOX = [0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76, 0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0, 0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15, 0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75, 0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84, 0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf, 0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8, 0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2, 0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73, 0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb, 0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79, 0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08, 0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a, 0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e, 0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf, 0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16];
const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

class AES256GCM_Manual {
    constructor(key) { this.roundKeys = this._expandKey(key); }
    _expandKey(key) {
        let w = new Uint32Array(60);
        for (let i = 0; i < 8; i++) { w[i] = (key[i * 4] << 24) | (key[i * 4 + 1] << 16) | (key[i * 4 + 2] << 8) | key[i * 4 + 3]; }
        for (let i = 8; i < 60; i++) {
            let temp = w[i - 1];
            if (i % 8 === 0) {
                temp = ((temp << 8) | (temp >>> 24)) >>> 0;
                temp = (SBOX[temp >>> 24] << 24) | (SBOX[(temp >>> 16) & 0xff] << 16) | (SBOX[(temp >>> 8) & 0xff] << 8) | SBOX[temp & 0xff];
                temp ^= (RCON[i / 8] << 24) >>> 0;
            } else if (i % 8 === 4) {
                temp = (SBOX[temp >>> 24] << 24) | (SBOX[(temp >>> 16) & 0xff] << 16) | (SBOX[(temp >>> 8) & 0xff] << 8) | SBOX[temp & 0xff];
            }
            w[i] = (w[i - 8] ^ temp) >>> 0;
        }
        return w;
    }
    _galoisMult(a, b) {
        let p = 0;
        for (let i = 0; i < 8; i++) {
            if (b & 1) p ^= a;
            let hiBitSet = a & 0x80;
            a = (a << 1) & 0xff;
            if (hiBitSet) a ^= 0x1b;
            b >>= 1;
        }
        return p;
    }
    _encryptBlock(block) {
        let state = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => block[r + c * 4]));
        const addRoundKey = (s, rkIdx) => {
            for (let c = 0; c < 4; c++) {
                let rk = this.roundKeys[rkIdx * 4 + c];
                for (let r = 0; r < 4; r++) { s[r][c] ^= (rk >>> (24 - 8 * r)) & 0xff; }
            }
        };
        addRoundKey(state, 0);
        for (let round = 1; round < 14; round++) {
            for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) state[r][c] = SBOX[state[r][c]];
            let row1 = state[1], row2 = state[2], row3 = state[3];
            state[1] = [row1[1], row1[2], row1[3], row1[0]];
            state[2] = [row2[2], row2[3], row2[0], row2[1]];
            state[3] = [row3[3], row3[0], row3[1], row3[2]];
            for (let c = 0; c < 4; c++) {
                let s0 = state[0][c], s1 = state[1][c], s2 = state[2][c], s3 = state[3][c];
                state[0][c] = this._galoisMult(0x02, s0) ^ this._galoisMult(0x03, s1) ^ s2 ^ s3;
                state[1][c] = s0 ^ this._galoisMult(0x02, s1) ^ this._galoisMult(0x03, s2) ^ s3;
                state[2][c] = s0 ^ s1 ^ this._galoisMult(0x02, s2) ^ this._galoisMult(0x03, s3);
                state[3][c] = this._galoisMult(0x03, s0) ^ s1 ^ s2 ^ this._galoisMult(0x02, s3);
            }
            addRoundKey(state, round);
        }
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) state[r][c] = SBOX[state[r][c]];
        let row1 = state[1], row2 = state[2], row3 = state[3];
        state[1] = [row1[1], row1[2], row1[3], row1[0]];
        state[2] = [row2[2], row2[3], row2[0], row2[1]];
        state[3] = [row3[3], row3[0], row3[1], row3[2]];
        addRoundKey(state, 14);
        let res = new Uint8Array(16);
        for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) res[c * 4 + r] = state[r][c];
        return res;
    }
    decrypt(iv, ciphertext) {
        let counter = new Uint8Array(16);
        counter.set(iv);
        counter[15] = 2;
        let plaintext = new Uint8Array(ciphertext.length);
        for (let i = 0; i < ciphertext.length; i += 16) {
            let keystream = this._encryptBlock(counter);
            for (let j = 0; j < 16 && (i + j) < ciphertext.length; j++) { plaintext[i + j] = ciphertext[i + j] ^ keystream[j]; }
            for (let j = 15; j >= 12; j--) {
                counter[j]++;
                if (counter[j] !== 0) break;
            }
        }
        return new TextDecoder().decode(plaintext);
    }
}

// --- CORE SCRAPER ---

function generateFingerprint() {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
        viewer_id: Math.random().toString(36).substring(2, 15),
        device_id: Math.random().toString(36).substring(2, 15),
        confidence: 0.99,
        iat: timestamp,
        exp: timestamp + 3600
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let result = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        result += BASE64_CHARS[b0 >> 2] + BASE64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
        result += i + 1 < bytes.length ? BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
        result += i + 2 < bytes.length ? BASE64_CHARS[b2 & 0x3f] : '=';
    }
    return { token: result };
}

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
    const streams = [];
    try {
        const s = season || 1;
        const e = episode || 1;
        const pomfyUrl = mediaType === "movie" ? `${API_POMFY}/filme/${tmdbId}` : `${API_POMFY}/serie/${tmdbId}/${s}/${e}`;

        const entryRes = await fetch(pomfyUrl, { headers: HEADERS });
        if (!entryRes.ok) return [];

        const html = await entryRes.text();
        const linkMatch = html.match(/const\s+link\s*=\s*["'](https?:\/\/[^"']+)["']/);
        if (!linkMatch) return [];

        const byseUrl = linkMatch[1];
        const byseId = byseUrl.split("/").pop();

        // 1. Get Details
        const detailsRes = await fetch(`https://pomfy-cdn.shop/api/videos/${byseId}/embed/details`, {
            headers: { ...HEADERS, "Referer": byseUrl }
        });
        if (!detailsRes.ok) return [];
        const details = await detailsRes.json();

        // 2. Fetch Playback
        const embedDomain = new URL(details.embed_frame_url).origin;
        const playbackRes = await fetch(`${embedDomain}/api/videos/${byseId}/embed/playback`, {
            method: "POST",
            headers: {
                ...HEADERS,
                "Content-Type": "application/json",
                "Origin": embedDomain,
                "Referer": details.embed_frame_url
            },
            body: JSON.stringify({ fingerprint: generateFingerprint() })
        });

        if (!playbackRes.ok) return [];
        const data = await playbackRes.json();

        // 3. Decrypt
        const iv = base64ToBytes(data.playback.iv);
        const k1 = base64ToBytes(data.playback.key_parts[0]);
        const k2 = base64ToBytes(data.playback.key_parts[1]);
        const key = new Uint8Array([...k1, ...k2]);
        const encrypted = base64ToBytes(data.playback.payload);
        const ciphertext = encrypted.slice(0, -16);

        const cipher = new AES256GCM_Manual(key);
        const videoData = JSON.parse(cipher.decrypt(iv, ciphertext));

        let m3u8 = videoData.url || (videoData.sources && videoData.sources[0].url);

        if (m3u8) {
            streams.push({
                name: "🎦 Pomfy",
                quality: `Auto | ${details.language || 'Multi'}`,
                url: m3u8.replace(/\\u0026/g, '&'),
                headers: {
                    "User-Agent": USER_AGENT,
                    "Referer": TARGET_ORIGIN + "/",
                    "Origin": TARGET_ORIGIN
                }
            });
        }
    } catch (err) {
        console.error("Fetch Error:", err);
    }
    return streams;
}

module.exports = { getStreams };
