/**
 * Pomfy - Provider com fingerprint fixo
 * Fluxo: api.pomfy.stream -> statusToken -> /api/play-token -> 9n8o.com -> challenge -> playback -> M3U8
 */

var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try { step(generator.next(value)); } catch (e) { reject(e); }
    };
    var rejected = (value) => {
      try { step(generator.throw(value)); } catch (e) { reject(e); }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// ==============================================
// CONSTANTS
// ==============================================

const API_POMFY = "https://api.pomfy.stream";
const TMDB_API_KEY = "3644dd4950b67cd8067b8772de576d6b";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Cookie (pode precisar ser atualizado)
const COOKIE = "cf_clearance=FY8zyQybVu2kflZRPEY.MK6_U4tb6fhgsHFcqL8ADrw-1778869729-1.2.1.1-QEpMO3YW7Bw5towDJ0vt.qryy45W8_ZNcfiIwZVFH8VxGfccA92JLE.AijYDUhFSQvlcvBCYFOIQBfR7AiAU62Z2oi.LcbauCXoBKFn7PZgFIctmHdbwAw1PEX6Cd3KSIE4iYDAek732vCD0AKZpj356_o087ffIzRotI1NaRK8w99XVw.9feR25y8bUDv3zRKAwmZOmWCc4EJ2Gl.t9G4av0mgASGgZCiBrikohLj0kWfe8ZZVyx2cimdouLH1CBth.AiPugowBvs4Ta0omNyc8qCD09QTfKAiOF7EGrY8J7XXyRC9M_ejoQplmjOoDFUo7d5qFqqWG.OsRZWzPVg";

const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

const DEBUG = true;
function log(step, message, data = null) {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}] [${step}] ${message}`);
  if (data !== null && typeof data === 'object') {
    console.log(`[${timestamp}] [${step}] └─ ${JSON.stringify(data, null, 2).substring(0, 300)}`);
  } else if (data !== null) {
    console.log(`[${timestamp}] [${step}] └─ ${data}`);
  }
}

// ==============================================
// BASE64 MANUAL
// ==============================================

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

function bytesToBase64(bytes) {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
    result += i + 1 < len ? BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < len ? BASE64_CHARS[b2 & 0x3f] : '=';
  }
  return result;
}

function utf8BytesToString(bytes) {
  let str = '';
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i];
    if (byte < 0x80) { str += String.fromCharCode(byte); i += 1; }
    else if ((byte & 0xe0) === 0xc0) { str += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
    else if ((byte & 0xf0) === 0xe0) { str += String.fromCharCode(((byte & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3; }
    else if ((byte & 0xf8) === 0xf0) {
      const cp = ((byte & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      const hi = Math.floor((cp - 0x10000) / 0x400) + 0xd800;
      const lo = ((cp - 0x10000) % 0x400) + 0xdc00;
      str += String.fromCharCode(hi, lo);
      i += 4;
    } else { i += 1; }
  }
  return str;
}

function stringToUtf8Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + (cp - 0xd800) * 0x400 + (lo - 0xdc00);
        i++;
      }
    }
    if (cp < 0x80) { bytes.push(cp); }
    else if (cp < 0x800) { bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f)); }
    else if (cp < 0x10000) { bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)); }
    else { bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)); }
  }
  return new Uint8Array(bytes);
}

// ==============================================
// AES-256-GCM MANUAL
// ==============================================

const SBOX = [
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
];

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
    return utf8BytesToString(plaintext);
  }
}

// ==============================================
// FUNÇÕES AUXILIARES
// ==============================================

// FINGERPRINT FIXO (que funcionava nos códigos antigos)
function generateFingerprint() {
  const viewerId = "bed4fadd25c8dcdcaced26e318c3be5a";
  const deviceId = "b69c7e41fe010d4445b827dd95aa89fc";
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    viewer_id: viewerId,
    device_id: deviceId,
    confidence: 0.93,
    iat: timestamp,
    exp: timestamp + 600
  };
  const token = bytesToBase64(stringToUtf8Bytes(JSON.stringify(payload)));
  return { token, viewer_id: viewerId, device_id: deviceId, confidence: 0.93 };
}

function decryptPlayback(playback) {
  log("DECRYPT", "Iniciando descriptografia AES-256-GCM");
  try {
    const iv = base64ToBytes(playback.iv);
    const key1 = base64ToBytes(playback.key_parts[0]);
    const key2 = base64ToBytes(playback.key_parts[1]);
    const key = new Uint8Array(key1.length + key2.length);
    key.set(key1, 0);
    key.set(key2, key1.length);
    
    const encryptedData = base64ToBytes(playback.payload);
    const ciphertext = encryptedData.slice(0, -16);
    const cipher = new AES256GCM_Manual(key);
    const decrypted = cipher.decrypt(iv, ciphertext);
    const videoData = JSON.parse(decrypted);
    
    let m3u8Url = videoData.url || 
                  (videoData.sources && videoData.sources[0] && videoData.sources[0].url) || 
                  (videoData.data && videoData.data.sources && videoData.data.sources[0].url);
    
    if (m3u8Url) {
      log("DECRYPT", `Sucesso! URL obtida: ${m3u8Url.substring(0, 100)}...`);
      return { success: true, url: m3u8Url.replace(/\\u0026/g, '&') };
    }
    return { success: false, error: "URL não encontrada" };
  } catch (e) { 
    log("DECRYPT", `Erro: ${e.message}`);
    return { success: false, error: e.message };
  }
}

async function detectRealQuality(videoUrl, headers) {
  try {
    const rangeHeaders = { ...headers, "Range": "bytes=0-5242880" };
    const response = await fetch(videoUrl, { headers: rangeHeaders });
    if (!response.ok) return 1080;
    
    const bytes = new Uint8Array(await response.arrayBuffer());
    let quality = 0;
    
    for (let i = 0; i < bytes.length - 20; i++) {
      if (bytes[i] === 0x74 && bytes[i+1] === 0x6B && bytes[i+2] === 0x68 && bytes[i+3] === 0x64) {
        for (let offset = 48; offset <= 80; offset++) {
          if (i + offset + 8 <= bytes.length) {
            const widthFixed = ((bytes[i+offset] << 24) | (bytes[i+offset+1] << 16) | (bytes[i+offset+2] << 8) | bytes[i+offset+3]);
            const heightFixed = ((bytes[i+offset+4] << 24) | (bytes[i+offset+5] << 16) | (bytes[i+offset+6] << 8) | bytes[i+offset+7]);
            const width = Math.round(widthFixed / 65536.0);
            const height = Math.round(heightFixed / 65536.0);
            
            if (width >= 640 && width <= 7680 && height >= 360 && height <= 4320) {
              const pixels = width * height;
              quality = (pixels >= 6000000) ? 2160 :
                       (pixels >= 1400000) ? 1080 :
                       (pixels >= 700000)  ? 720 : 480;
              break;
            }
          }
        }
        if (quality) break;
      }
    }
    
    if (quality === 0) {
      const urlMatch = videoUrl.match(/(\d{3,4})p/i);
      quality = urlMatch ? parseInt(urlMatch[1]) : 1080;
    }
    
    return quality;
  } catch (error) {
    return 1080;
  }
}

function isImdbId(id) {
  return typeof id === "string" && id.toLowerCase().startsWith("tt");
}

async function convertImdbToTmdb(imdbId, mediaType) {
  try {
    const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const response = await fetch(url, { 
      headers: { 
        "User-Agent": USER_AGENT, 
        "Accept": "application/json" 
      } 
    });
    if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
    const data = await response.json();
    const results = mediaType === "tv" ? (data.tv_results || []) : (data.movie_results || []);
    if (results && results.length > 0) {
      return { success: true, tmdbId: results[0].id };
    }
    return { success: false, error: "Nenhum resultado encontrado" };
  } catch (error) { 
    return { success: false, error: error.message };
  }
}

// ==============================================
// FUNÇÃO PRINCIPAL getStreams
// ==============================================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  log("START", `═══════════════════════════════════════════════════════════`);
  log("START", `INICIANDO getStreams`);
  log("START", `Parâmetros: tmdbId=${tmdbId}, type=${mediaType}, season=${season}, episode=${episode}`);
  
  let finalTmdbId = tmdbId;

  if (isImdbId(tmdbId)) {
    const conversion = await convertImdbToTmdb(tmdbId, mediaType);
    if (conversion.success) {
      finalTmdbId = conversion.tmdbId;
    } else {
      log("START", "Falha na conversão IMDb");
      return [];
    }
  } else if (typeof tmdbId === "string" && !isNaN(parseInt(tmdbId))) {
    finalTmdbId = parseInt(tmdbId);
  }

  const seasonNum = mediaType === "movie" ? 1 : (season || 1);
  const episodeNum = mediaType === "movie" ? 1 : (episode || 1);
  log("START", `Parâmetros finais: season=${seasonNum}, episode=${episodeNum}`);

  try {
    // ========== PASSO 1: Acessar api.pomfy.stream ==========
    const mediaTypeParam = mediaType === "tv" ? "serie" : "filme";
    const apiUrl = `${API_POMFY}/${mediaTypeParam}/${finalTmdbId}/${seasonNum}/${episodeNum}`;
    
    log("STEP1", `🌐 Acessando: ${apiUrl}`);
    
    const apiHeaders = {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "pt-BR,pt;q=0.9",
      "cookie": COOKIE,
      "referer": `https://pomfy.online/assistir/${finalTmdbId}?tipo=${mediaTypeParam}&temporada=${seasonNum}&episodio=${episodeNum}`,
      "sec-ch-ua": '"Chromium";v="127", "Not)A;Brand";v="99", "Microsoft Edge Simulate";v="127", "Lemur";v="127"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-fetch-dest": "iframe",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "cross-site",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "user-agent": USER_AGENT
    };
    
    const response = await fetch(apiUrl, { headers: apiHeaders });
    log("STEP1", `📡 HTTP Status: ${response.status}`);
    
    if (!response.ok) {
      log("STEP1", `❌ Falha HTTP ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    log("STEP1", `📄 HTML recebido: ${html.length} bytes`);
    
    // ========== PASSO 2: Extrair statusToken e byseId ==========
    const statusTokenMatch = html.match(/const statusToken="([^"]+)"/);
    if (!statusTokenMatch) {
      log("STEP2", `❌ statusToken NÃO encontrado`);
      return [];
    }
    
    const statusToken = statusTokenMatch[1];
    const byseId = statusToken.split('.')[0];
    log("STEP2", `✅ byseId=${byseId}`);
    log("STEP2", `🔑 statusToken: ${statusToken.substring(0, 60)}...`);
    
    // ========== PASSO 3: Chamar /api/play-token (opcional, para referer) ==========
    const playTokenUrl = `${API_POMFY}/api/play-token?t=${statusToken}`;
    log("STEP3", `🌐 Play-token: ${playTokenUrl}`);
    
    const playTokenResponse = await fetch(playTokenUrl, {
      headers: {
        "accept": "*/*",
        "cookie": COOKIE,
        "referer": apiUrl,
        "user-agent": USER_AGENT
      }
    });
    
    let embedPageUrl = null;
    if (playTokenResponse.ok) {
      const playTokenData = await playTokenResponse.json();
      embedPageUrl = playTokenData.url;
      log("STEP3", `✅ Embed URL: ${embedPageUrl}`);
    } else {
      log("STEP3", `⚠️ Play-token falhou: ${playTokenResponse.status}, continuando...`);
    }
    
    // ========== PASSO 4: Acessar 9n8o.com (usando /fu2/ ou /gtg/) ==========
    // Tenta primeiro /fu2/ (que funcionou no curl)
    let playerUrl = `https://9n8o.com/fu2/${byseId}`;
    log("STEP4", `🌐 Acessando player: ${playerUrl}`);
    
    let playerResponse = await fetch(playerUrl, {
      headers: {
        "accept": "text/html,application/xhtml+xml",
        "referer": embedPageUrl || apiUrl,
        "user-agent": USER_AGENT,
        "cookie": COOKIE,
        "sec-fetch-dest": "iframe"
      }
    });
    
    // Se /fu2/ falhar, tenta /gtg/
    if (!playerResponse.ok) {
      log("STEP4", `⚠️ /fu2/ falhou (${playerResponse.status}), tentando /gtg/...`);
      playerUrl = `https://9n8o.com/gtg/${byseId}`;
      playerResponse = await fetch(playerUrl, {
        headers: {
          "accept": "text/html,application/xhtml+xml",
          "referer": embedPageUrl || apiUrl,
          "user-agent": USER_AGENT,
          "cookie": COOKIE,
          "sec-fetch-dest": "iframe"
        }
      });
    }
    
    if (!playerResponse.ok) {
      log("STEP4", `❌ Player falhou: ${playerResponse.status}`);
      return [];
    }
    
    log("STEP4", `✅ Player carregado: ${playerUrl}`);
    
    // ========== PASSO 5: Challenge ==========
    const challengeUrl = "https://9n8o.com/api/videos/access/challenge";
    log("STEP5", `🔐 Challenge: ${challengeUrl}`);
    
    try {
      const challengeResponse = await fetch(challengeUrl, {
        method: 'POST',
        headers: {
          "accept": "*/*",
          "origin": "https://9n8o.com",
          "referer": playerUrl,
          "user-agent": USER_AGENT
        }
      });
      log("STEP5", `✅ Challenge HTTP: ${challengeResponse.status}`);
    } catch (err) {
      log("STEP5", `⚠️ Challenge ignorado: ${err.message}`);
    }
    
    // ========== PASSO 6: Playback com fingerprint FIXO ==========
    const fingerprint = generateFingerprint();
    log("STEP6", `🔑 Fingerprint fixo: ${fingerprint.viewer_id}`);
    
    const playbackUrl = `https://9n8o.com/api/videos/${byseId}/embed/playback`;
    log("STEP6", `🎬 Playback: ${playbackUrl}`);
    
    const playbackResponse = await fetch(playbackUrl, {
      method: "POST",
      headers: {
        "accept": "*/*",
        "content-type": "application/json",
        "origin": "https://9n8o.com",
        "referer": playerUrl,
        "user-agent": USER_AGENT,
        "x-embed-origin": "api.pomfy.stream",
        "x-embed-parent": embedPageUrl || apiUrl,
        "x-embed-referer": apiUrl
      },
      body: JSON.stringify({ fingerprint })
    });
    
    log("STEP6", `📡 Playback HTTP: ${playbackResponse.status}`);
    
    if (!playbackResponse.ok) {
      log("STEP6", `❌ Playback falhou: ${playbackResponse.status}`);
      // Tenta obter o corpo do erro para debug
      try {
        const errorText = await playbackResponse.text();
        log("STEP6", `📦 Erro: ${errorText.substring(0, 200)}`);
      } catch(e) {}
      return [];
    }
    
    const playbackData = await playbackResponse.json();
    log("STEP6", `📦 Playback response recebida`);
    
    if (!playbackData.playback) {
      log("STEP6", `❌ Sem playback na resposta`);
      return [];
    }
    
    // ========== PASSO 7: Descriptografar ==========
    const decryptResult = decryptPlayback(playbackData.playback);
    if (!decryptResult.success) {
      log("STEP7", `❌ Descriptografia falhou: ${decryptResult.error}`);
      return [];
    }
    
    const m3u8Url = decryptResult.url;
    log("STEP7", `✅ M3U8 obtido: ${m3u8Url.substring(0, 100)}...`);
    
    // ========== PASSO 8: Qualidade ==========
    const streamHeaders = {
      "User-Agent": USER_AGENT,
      "Referer": playerUrl,
      "Accept": "*/*"
    };
    
    const realQuality = await detectRealQuality(m3u8Url, streamHeaders);
    
    const title = mediaType === "movie"
      ? `Filme ${finalTmdbId} - ${realQuality}p`
      : `S${seasonNum.toString().padStart(2, "0")}E${episodeNum.toString().padStart(2, "0")} - ${realQuality}p`;

    log("END", `═══════════════════════════════════════════════════════════`);
    log("END", `🎉 SUCESSO! Stream encontrado!`);
    log("END", `📺 Título: ${title}`);
    log("END", `🎬 Qualidade: ${realQuality}p`);
    log("END", `🔗 URL: ${m3u8Url.substring(0, 150)}...`);
    log("END", `═══════════════════════════════════════════════════════════`);

    return [{
      name: title,
      title: title,
      url: m3u8Url,
      quality: realQuality,
      headers: streamHeaders
    }];

  } catch (error) {
    log("ERROR", `❌ Exceção: ${error.message}`);
    log("ERROR", error.stack || "");
    return [];
  }
}

module.exports = { getStreams };
