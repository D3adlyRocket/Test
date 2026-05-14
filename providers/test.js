/**
 * Pomfy - Provider com Byse/9n8o
 * Versão com DEBUG de TIMESTAMP (comparar Nuvio vs Termux)
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
const COOKIE = "SITE_TOTAL_ID=aTYqe6GU65PNmeCXpelwJwAAAMi; __dtsu=104017651574995957BEB724C6373F9E; __cc_id=a44d1e52993b9c2Oaaf40eba24989a06";

const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

const HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,webp,image/apng,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "Referer": "https://pomfy.online/",
  "Sec-Fetch-Dest": "iframe",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "cross-site",
  "Upgrade-Insecure-Requests": "1",
  "Cookie": COOKIE
};

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

// ==============================================
// UTF-8 MANUAL
// ==============================================

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

// FINGERPRINT FIXO (que funciona no Termux)
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

function isImdbId(id) {
  return typeof id === "string" && id.toLowerCase().startsWith("tt");
}

async function convertImdbToTmdb(imdbId, mediaType) {
  try {
    const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" } });
    if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
    const data = await response.json();
    const results = mediaType === "tv" ? (data.tv_results || []) : (data.movie_results || []);
    if (results && results.length > 0) return { success: true, tmdbId: results[0].id };
    return { success: false, error: "Nenhum resultado encontrado" };
  } catch (error) { return { success: false, error: error.message }; }
}

function decryptPlayback(playback) {
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
    let m3u8Url = videoData.url || (videoData.sources && videoData.sources[0] && videoData.sources[0].url) || (videoData.data && videoData.data.sources && videoData.data.sources[0].url);
    if (m3u8Url) return { success: true, url: m3u8Url.replace(/\\u0026/g, '&') };
    return { success: false, error: "URL não encontrada" };
  } catch (e) { return { success: false, error: e.message }; }
}

// ==============================================
// FUNÇÃO PRINCIPAL getStreams COM DEBUG DE TIMESTAMP
// ==============================================

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const streams = [];
  let finalTmdbId = tmdbId;

  // ========== TIMESTAMP INICIAL ==========
  const startTime = Date.now();
  const startTimestamp = Math.floor(startTime / 1000);
  const timezoneOffset = new Date().getTimezoneOffset();
  
  streams.push({
    name: `⏰ [0/9] TIMESTAMP INÍCIO: ${startTimestamp}`,
    title: `Timezone offset: ${timezoneOffset} minutos | Hora local: ${new Date().toISOString()}`,
    url: `debug://timestamp`,
    quality: 1080,
    headers: HEADERS
  });

  streams.push({
    name: `🔍 [0/9] Iniciando busca`,
    title: `${mediaType} ${tmdbId} S${season || 1}E${episode || 1}`,
    url: `debug://start`,
    quality: 1080,
    headers: HEADERS
  });

  // Converter IMDb se necessário
  if (isImdbId(tmdbId)) {
    streams.push({
      name: `🔄 [0/9] IMDb detectado: ${tmdbId}`,
      title: "Convertendo para TMDb...",
      url: `debug://converting`,
      quality: 1080,
      headers: HEADERS
    });

    const conversion = await convertImdbToTmdb(tmdbId, mediaType);
    if (conversion.success) {
      finalTmdbId = conversion.tmdbId;
      streams.push({
        name: `✅ [0/9] Convertido: ${tmdbId} → ${finalTmdbId}`,
        title: "Conversão bem-sucedida",
        url: `debug://converted`,
        quality: 1080,
        headers: HEADERS
      });
    } else {
      streams.push({
        name: `❌ [0/9] Falha na conversão: ${conversion.error}`,
        title: conversion.error,
        url: `debug://conversion-failed`,
        quality: 1080,
        headers: HEADERS
      });
      return streams;
    }
  } else if (typeof tmdbId === "string" && !isNaN(parseInt(tmdbId))) {
    finalTmdbId = parseInt(tmdbId);
    streams.push({
      name: `✅ [0/9] ID convertido: ${tmdbId} → ${finalTmdbId}`,
      title: "String para número",
      url: `debug://id-converted`,
      quality: 1080,
      headers: HEADERS
    });
  }

  const seasonNum = mediaType === "movie" ? 1 : (season || 1);
  const episodeNum = mediaType === "movie" ? 1 : (episode || 1);

  streams.push({
    name: `📡 [1/9] Buscando HTML do Pomfy`,
    title: `${mediaType} ${finalTmdbId} S${seasonNum}E${episodeNum}`,
    url: `debug://fetching-html`,
    quality: 1080,
    headers: HEADERS
  });

  try {
    const pomfyUrl = mediaType === "movie"
      ? `${API_POMFY}/filme/${finalTmdbId}`
      : `${API_POMFY}/serie/${finalTmdbId}/${seasonNum}/${episodeNum}`;

    streams.push({
      name: `🌐 [1/9] URL: ${pomfyUrl}`,
      title: "Requisição HTTP",
      url: `debug://url`,
      quality: 1080,
      headers: HEADERS
    });

    const response = await fetch(pomfyUrl, { headers: HEADERS });

    streams.push({
      name: `📊 [1/9] HTTP ${response.status}`,
      title: response.ok ? "OK" : "FALHOU",
      url: `debug://http-status`,
      quality: 1080,
      headers: HEADERS
    });

    if (!response.ok) return streams;

    const html = await response.text();

    streams.push({
      name: `✅ [1/9] HTML recebido (${html.length} bytes)`,
      title: "Página carregada",
      url: `debug://html-loaded`,
      quality: 1080,
      headers: HEADERS
    });

    const linkMatch = html.match(/const link\s*=\s*"([^"]+)"/);
    if (!linkMatch) {
      streams.push({
        name: `❌ [2/9] Link não encontrado no HTML`,
        title: "Conteúdo indisponível",
        url: `debug://no-link`,
        quality: 1080,
        headers: HEADERS
      });
      return streams;
    }

    const byseUrl = linkMatch[1];
    const byseId = byseUrl.split("/").pop();

    streams.push({
      name: `✅ [2/9] Byse ID: ${byseId}`,
      title: byseUrl,
      url: `debug://byse-id`,
      quality: 1080,
      headers: HEADERS
    });

    const detailsUrl = `https://pomfy-cdn.shop/api/videos/${byseId}/embed/details`;

    streams.push({
      name: `📡 [3/9] Buscando detalhes do vídeo`,
      title: detailsUrl,
      url: `debug://fetching-details`,
      quality: 1080,
      headers: HEADERS
    });

    const detailsResponse = await fetch(detailsUrl, {
      headers: {
        "accept": "*/*",
        "referer": byseUrl,
        "x-embed-origin": "api.pomfy.stream",
        "x-embed-parent": byseUrl,
        "user-agent": USER_AGENT,
        "Cookie": COOKIE
      }
    });

    streams.push({
      name: `📊 [3/9] Detalhes HTTP ${detailsResponse.status}`,
      title: detailsResponse.ok ? "OK" : "FALHOU",
      url: `debug://details-status`,
      quality: 1080,
      headers: HEADERS
    });

    if (!detailsResponse.ok) return streams;

    const detailsData = await detailsResponse.json();
    const embedUrl = detailsData.embed_frame_url;

    streams.push({
      name: `✅ [3/9] Embed URL obtida`,
      title: embedUrl,
      url: `debug://embed-url`,
      quality: 1080,
      headers: HEADERS
    });

    if (!embedUrl) {
      streams.push({
        name: `❌ [3/9] embed_frame_url não encontrado`,
        title: "Resposta sem URL de embed",
        url: `debug://no-embed-url`,
        quality: 1080,
        headers: HEADERS
      });
      return streams;
    }

    const embedDomain = new URL(embedUrl).origin;

    streams.push({
      name: `🌐 [4/9] Embed domain: ${embedDomain}`,
      title: "Domínio extraído",
      url: `debug://embed-domain`,
      quality: 1080,
      headers: HEADERS
    });

    // Access Challenge
    const challengeUrl = `${embedDomain}/api/videos/access/challenge`;
    
    streams.push({
      name: `🔐 [5/9] Solicitando Challenge`,
      title: challengeUrl,
      url: `debug://challenge`,
      quality: 1080,
      headers: HEADERS
    });

    try {
      const challengeResponse = await fetch(challengeUrl, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'origin': embedDomain,
          'referer': embedUrl,
          'user-agent': USER_AGENT
        }
      });
      
      streams.push({
        name: `📊 [5/9] Challenge HTTP ${challengeResponse.status}`,
        title: challengeResponse.ok ? "OK" : "FALHOU",
        url: `debug://challenge-status`,
        quality: 1080,
        headers: HEADERS
      });
    } catch (err) {
      streams.push({
        name: `⚠️ [5/9] Challenge erro: ${err.message}`,
        title: "Continuando sem challenge",
        url: `debug://challenge-error`,
        quality: 1080,
        headers: HEADERS
      });
    }

    // TIMESTAMP ANTES DO FINGERPRINT
    const beforeFingerprint = Math.floor(Date.now() / 1000);
    streams.push({
      name: `⏰ [6/9] Timestamp antes do fingerprint: ${beforeFingerprint}`,
      title: `Diferença do início: ${beforeFingerprint - startTimestamp}s`,
      url: `debug://timestamp-before-fingerprint`,
      quality: 1080,
      headers: HEADERS
    });

    // Fingerprint FIXO
    const fingerprint = generateFingerprint();
    
    // EXTRAIR IAT DO TOKEN
    try {
      const tokenBytes = base64ToBytes(fingerprint.token);
      const tokenJson = utf8BytesToString(tokenBytes);
      const tokenPayload = JSON.parse(tokenJson);
      streams.push({
        name: `🔐 [6/9] TOKEN iat: ${tokenPayload.iat}`,
        title: `exp: ${tokenPayload.exp} | Diferença: ${beforeFingerprint - tokenPayload.iat}s`,
        url: `debug://token-iat`,
        quality: 1080,
        headers: HEADERS
      });
    } catch(e) {
      streams.push({
        name: `⚠️ [6/9] Erro ao ler iat do token`,
        title: e.message,
        url: `debug://token-error`,
        quality: 1080,
        headers: HEADERS
      });
    }

    streams.push({
      name: `🔐 [6/9] Fingerprint FIXO`,
      title: `viewer: ${fingerprint.viewer_id}`,
      url: `debug://fingerprint`,
      quality: 1080,
      headers: HEADERS
    });

    // Playback Request
    const playbackUrl = `${embedDomain}/api/videos/${byseId}/embed/playback`;

    streams.push({
      name: `🎬 [7/9] Solicitando playback`,
      title: playbackUrl,
      url: `debug://requesting-playback`,
      quality: 1080,
      headers: HEADERS
    });

    const requestTimestamp = Math.floor(Date.now() / 1000);
    streams.push({
      name: `⏰ [7/9] Timestamp da requisição: ${requestTimestamp}`,
      title: `Diferença do início: ${requestTimestamp - startTimestamp}s`,
      url: `debug://timestamp-request`,
      quality: 1080,
      headers: HEADERS
    });

    const playbackResponse = await fetch(playbackUrl, {
      method: "POST",
      headers: {
        "accept": "*/*",
        "accept-language": "pt-BR,pt;q=0.9",
        "content-type": "application/json",
        "origin": embedDomain,
        "referer": embedUrl,
        "x-embed-origin": "api.pomfy.stream",
        "x-embed-parent": byseUrl,
        "user-agent": USER_AGENT
      },
      body: JSON.stringify({ fingerprint: fingerprint })
    });

    const responseTimestamp = Math.floor(Date.now() / 1000);
    streams.push({
      name: `⏰ [7/9] Timestamp da resposta: ${responseTimestamp}`,
      title: `Tempo de resposta: ${responseTimestamp - requestTimestamp}s`,
      url: `debug://timestamp-response`,
      quality: 1080,
      headers: HEADERS
    });

    streams.push({
      name: `📊 [7/9] Playback HTTP ${playbackResponse.status}`,
      title: playbackResponse.ok ? "OK" : "FALHOU",
      url: `debug://playback-status`,
      quality: 1080,
      headers: HEADERS
    });

    if (!playbackResponse.ok) return streams;

    const playbackData = await playbackResponse.json();

    streams.push({
      name: `✅ [7/9] Playback recebido`,
      title: `has key_parts: ${!!(playbackData.playback && playbackData.playback.key_parts)}`,
      url: `debug://playback-received`,
      quality: 1080,
      headers: HEADERS
    });

    if (!playbackData.playback) {
      streams.push({
        name: `❌ [7/9] Playback sem dados`,
        title: "Objeto playback não encontrado",
        url: `debug://no-playback-data`,
        quality: 1080,
        headers: HEADERS
      });
      return streams;
    }

    // Decrypt
    streams.push({
      name: `🔓 [8/9] Descriptografando payload AES-256-GCM`,
      title: "Processando...",
      url: `debug://decrypting`,
      quality: 1080,
      headers: HEADERS
    });

    const decryptResult = decryptPlayback(playbackData.playback);

    if (!decryptResult.success) {
      streams.push({
        name: `❌ [8/9] Falha na descriptografia: ${decryptResult.error}`,
        title: decryptResult.error,
        url: `debug://decrypt-failed`,
        quality: 1080,
        headers: HEADERS
      });
      return streams;
    }

    streams.push({
      name: `✅ [8/9] Payload decifrado com sucesso!`,
      title: "URL extraída",
      url: `debug://decrypt-success`,
      quality: 1080,
      headers: HEADERS
    });

    // EXTRAIR TIMESTAMP DA URL (parâmetro s)
    let urlTimestamp = null;
    try {
      const urlParams = new URL(decryptResult.url);
      urlTimestamp = urlParams.searchParams.get('s');
      const tParam = urlParams.searchParams.get('t');
      streams.push({
        name: `🔗 [9/9] URL s (timestamp): ${urlTimestamp}`,
        title: `t: ${(tParam || "").substring(0, 30)}...`,
        url: `debug://url-params`,
        quality: 1080,
        headers: HEADERS
      });
    } catch(e) {}

    // TIMESTAMP FINAL
    const endTimestamp = Math.floor(Date.now() / 1000);
    streams.push({
      name: `⏰ [9/9] TIMESTAMP FINAL: ${endTimestamp}`,
      title: `Duração total: ${endTimestamp - startTimestamp}s`,
      url: `debug://timestamp-end`,
      quality: 1080,
      headers: HEADERS
    });

    const title = mediaType === "movie"
      ? `Filme ${finalTmdbId}`
      : `S${seasonNum.toString().padStart(2, "0")}E${episodeNum.toString().padStart(2, "0")}`;

    streams.push({
      name: `🎉 SUCESSO! Stream encontrado`,
      title: title,
      url: decryptResult.url,
      quality: 1080,
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": embedUrl,
        "Accept": "*/*"
      }
    });

    // CONSOLE LOG COMPARATIVO
    console.log(`\n${'='.repeat(80)}`);
    console.log(`⏰ COMPARAÇÃO DE TIMESTAMP (Nuvio vs Termux):`);
    console.log(`   Início: ${startTimestamp}`);
    console.log(`   Antes fingerprint: ${beforeFingerprint}`);
    console.log(`   iat do token: ${JSON.parse(utf8BytesToString(base64ToBytes(fingerprint.token))).iat}`);
    console.log(`   Requisição: ${requestTimestamp}`);
    console.log(`   Resposta: ${responseTimestamp}`);
    console.log(`   URL s (timestamp): ${urlTimestamp}`);
    console.log(`   Final: ${endTimestamp}`);
    console.log(`   Duração total: ${endTimestamp - startTimestamp}s`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(`✅ URL: ${decryptResult.url}\n`);

  } catch (error) {
    streams.push({
      name: `❌ ERRO: ${error.message}`,
      title: error.stack || "",
      url: `debug://error`,
      quality: 1080,
      headers: HEADERS
    });
  }

  return streams;
}

module.exports = { getStreams };
