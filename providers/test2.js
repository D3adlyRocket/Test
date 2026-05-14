var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

const API_POMFY = "https://api.pomfy.stream";
const TMDB_API_KEY = "3644dd4950b67cd8067b8772de576d6b";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const COOKIE = "SITE_TOTAL_ID=aTYqe6GU65PNmeCXpelwJwAAAMi; __dtsu=104017651574995957BEB724C6373F9E; __cc_id=a44d1e52993b9c2Oaaf40eba24989a06";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBytes(base64) {
  let b64 = base64.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const lookup = new Uint8Array(256).fill(255);
  for (let i = 0; i < 64; i++) lookup[BASE64_CHARS.charCodeAt(i)] = i;
  const len = b64.length;
  let outputLen = len * 3 >> 2;
  if (b64[len - 1] === "=") outputLen--;
  if (b64[len - 2] === "=") outputLen--;
  const bytes = new Uint8Array(outputLen);
  let byteIdx = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[b64.charCodeAt(i)], b = lookup[b64.charCodeAt(i + 1)], c = lookup[b64.charCodeAt(i + 2)], d = lookup[b64.charCodeAt(i + 3)];
    if (byteIdx < outputLen) bytes[byteIdx++] = a << 2 | b >> 4;
    if (byteIdx < outputLen) bytes[byteIdx++] = (b & 15) << 4 | c >> 2;
    if (byteIdx < outputLen) bytes[byteIdx++] = (c & 3) << 6 | d;
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let result = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i], b1 = i + 1 < len ? bytes[i + 1] : 0, b2 = i + 2 < len ? bytes[i + 2] : 0;
    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[(b0 & 3) << 4 | b1 >> 4];
    result += i + 1 < len ? BASE64_CHARS[(b1 & 15) << 2 | b2 >> 6] : "=";
    result += i + 2 < len ? BASE64_CHARS[b2 & 63] : "=";
  }
  return result;
}

function utf8BytesToString(bytes) {
  let str = "";
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i];
    if (byte < 128) { str += String.fromCharCode(byte); i += 1; }
    else if ((byte & 224) === 192) { str += String.fromCharCode((byte & 31) << 6 | bytes[i + 1] & 63); i += 2; }
    else if ((byte & 240) === 224) { str += String.fromCharCode((byte & 15) << 12 | (bytes[i + 1] & 63) << 6 | bytes[i + 2] & 63); i += 3; }
    else i += 1;
  }
  return str;
}

function stringToUtf8Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    if (cp < 128) bytes.push(cp);
    else if (cp < 2048) bytes.push(192 | cp >> 6, 128 | cp & 63);
    else bytes.push(224 | cp >> 12, 128 | cp >> 6 & 63, 128 | cp & 63);
  }
  return new Uint8Array(bytes);
}

const SBOX = [99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22];
const RCON = [0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54];

class AES256GCM_Manual {
  constructor(key) { this.roundKeys = this._expandKey(key); }
  _expandKey(key) {
    let w = new Uint32Array(60);
    for (let i = 0; i < 8; i++) w[i] = key[i * 4] << 24 | key[i * 4 + 1] << 16 | key[i * 4 + 2] << 8 | key[i * 4 + 3];
    for (let i = 8; i < 60; i++) {
      let temp = w[i - 1];
      if (i % 8 === 0) {
        temp = (temp << 8 | temp >>> 24) >>> 0;
        temp = SBOX[temp >>> 24] << 24 | SBOX[temp >>> 16 & 255] << 16 | SBOX[temp >>> 8 & 255] << 8 | SBOX[temp & 255];
        temp ^= RCON[i / 8] << 24 >>> 0;
      } else if (i % 8 === 4) temp = SBOX[temp >>> 24] << 24 | SBOX[temp >>> 16 & 255] << 16 | SBOX[temp >>> 8 & 255] << 8 | SBOX[temp & 255];
      w[i] = (w[i - 8] ^ temp) >>> 0;
    }
    return w;
  }
  _galoisMult(a, b) {
    let p = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) p ^= a;
      let hi = a & 128; a = a << 1 & 255;
      if (hi) a ^= 27; b >>= 1;
    }
    return p;
  }
  _encryptBlock(block) {
    let state = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => block[r + c * 4]));
    const addRoundKey = (s, rkIdx) => {
      for (let c = 0; c < 4; c++) {
        let rk = this.roundKeys[rkIdx * 4 + c];
        for (let r = 0; r < 4; r++) s[r][c] ^= rk >>> 24 - 8 * r & 255;
      }
    };
    addRoundKey(state, 0);
    for (let round = 1; round < 14; round++) {
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) state[r][c] = SBOX[state[r][c]];
      let r1 = state[1], r2 = state[2], r3 = state[3];
      state[1] = [r1[1], r1[2], r1[3], r1[0]]; state[2] = [r2[2], r2[3], r2[0], r2[1]]; state[3] = [r3[3], r3[0], r3[1], r3[2]];
      for (let c = 0; c < 4; c++) {
        let s0 = state[0][c], s1 = state[1][c], s2 = state[2][c], s3 = state[3][c];
        state[0][c] = this._galoisMult(2, s0) ^ this._galoisMult(3, s1) ^ s2 ^ s3;
        state[1][c] = s0 ^ this._galoisMult(2, s1) ^ this._galoisMult(3, s2) ^ s3;
        state[2][c] = s0 ^ s1 ^ this._galoisMult(2, s2) ^ this._galoisMult(3, s3);
        state[3][c] = this._galoisMult(3, s0) ^ s1 ^ s2 ^ this._galoisMult(2, s3);
      }
      addRoundKey(state, round);
    }
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) state[r][c] = SBOX[state[r][c]];
    let r1 = state[1], r2 = state[2], r3 = state[3];
    state[1] = [r1[1], r1[2], r1[3], r1[0]]; state[2] = [r2[2], r2[3], r2[0], r2[1]]; state[3] = [r3[3], r3[0], r3[1], r3[2]];
    addRoundKey(state, 14);
    let res = new Uint8Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) res[c * 4 + r] = state[r][c];
    return res;
  }
  decrypt(iv, ciphertext) {
    let ctr = new Uint8Array(16); ctr.set(iv); ctr[15] = 2;
    let pt = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i += 16) {
      let ks = this._encryptBlock(ctr);
      for (let j = 0; j < 16 && i + j < ciphertext.length; j++) pt[i + j] = ciphertext[i + j] ^ ks[j];
      for (let j = 15; j >= 12; j--) { ctr[j]++; if (ctr[j] !== 0) break; }
    }
    return utf8BytesToString(pt);
  }
}

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const streams = [];
  try {
    let finalId = tmdbId;
    if (typeof tmdbId === "string" && tmdbId.startsWith("tt")) {
      const data = await (await fetch(`${TMDB_BASE_URL}/find/${tmdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`)).json();
      const res = mediaType === "tv" ? data.tv_results : data.movie_results;
      if (res && res.length > 0) finalId = res[0].id;
    }

    const pomfyUrl = mediaType === "movie" ? `${API_POMFY}/filme/${finalId}` : `${API_POMFY}/serie/${finalId}/${season || 1}/${episode || 1}`;
    const html = await (await fetch(pomfyUrl, { headers: { "User-Agent": USER_AGENT, "Cookie": COOKIE, "Referer": "https://pomfy.online/" } })).text();
    
    const byseMatch = html.match(/const link\s*=\s*"([^"]+)"/);
    if (!byseMatch) return [];

    const byseUrl = byseMatch[1];
    const byseId = byseUrl.split("/").pop();
    const embedDomain = "https://pomfy-cdn.shop";

    const pbResp = await fetch(`${embedDomain}/api/videos/${byseId}/embed/playback`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Referer": byseUrl, 
        "X-Embed-Origin": "api.pomfy.stream", 
        "X-Embed-Parent": byseUrl, 
        "User-Agent": USER_AGENT 
      },
      body: JSON.stringify({ 
        fingerprint: { 
          token: bytesToBase64(stringToUtf8Bytes(JSON.stringify({ viewer_id: "bed4fadd25c8dcdcaced26e318c3be5a", iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+600 }))), 
          viewer_id: "bed4fadd25c8dcdcaced26e318c3be5a" 
        } 
      })
    });

    const { playback } = await pbResp.json();
    if (!playback) return [];

    const key = new Uint8Array([...base64ToBytes(playback.key_parts[0]), ...base64ToBytes(playback.key_parts[1])]);
    const cipher = new AES256GCM_Manual(key);
    const decrypted = JSON.parse(cipher.decrypt(base64ToBytes(playback.iv), base64ToBytes(playback.payload).slice(0, -16)));
    
    const streamUrl = (decrypted.url || decrypted.sources?.[0]?.url).replace(/\\u0026/g, '&');

    streams.push({
      name: "Pomfy | 4K",
      url: streamUrl,
      quality: 2160,
      headers: { "User-Agent": USER_AGENT, "Referer": embedDomain }
    });
  } catch (e) {}
  return streams;
}

module.exports = { getStreams };
