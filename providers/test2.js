var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

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
  "Cookie": COOKIE
};

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBytes(base64) {
  let b64 = base64.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }
  const lookup = new Uint8Array(256).fill(255);
  for (let i = 0; i < 64; i++) {
    lookup[BASE64_CHARS.charCodeAt(i)] = i;
  }
  const len = b64.length;
  let outputLen = len * 3 >> 2;
  if (b64[len - 1] === "=")
    outputLen--;
  if (b64[len - 2] === "=")
    outputLen--;
  const bytes = new Uint8Array(outputLen);
  let byteIdx = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[b64.charCodeAt(i)];
    const b = lookup[b64.charCodeAt(i + 1)];
    const c = lookup[b64.charCodeAt(i + 2)];
    const d = lookup[b64.charCodeAt(i + 3)];
    if (byteIdx < outputLen)
      bytes[byteIdx++] = a << 2 | b >> 4;
    if (byteIdx < outputLen)
      bytes[byteIdx++] = (b & 15) << 4 | c >> 2;
    if (byteIdx < outputLen)
      bytes[byteIdx++] = (c & 3) << 6 | d;
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let result = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
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
    if (byte < 128) {
      str += String.fromCharCode(byte);
      i += 1;
    } else if ((byte & 224) === 192) {
      str += String.fromCharCode((byte & 31) << 6 | bytes[i + 1] & 63);
      i += 2;
    } else if ((byte & 240) === 224) {
      str += String.fromCharCode((byte & 15) << 12 | (bytes[i + 1] & 63) << 6 | bytes[i + 2] & 63);
      i += 3;
    } else if ((byte & 248) === 240) {
      const cp = (byte & 7) << 18 | (bytes[i + 1] & 63) << 12 | (bytes[i + 2] & 63) << 6 | bytes[i + 3] & 63;
      const hi = Math.floor((cp - 65536) / 1024) + 55296;
      const lo = (cp - 65536) % 1024 + 56320;
      str += String.fromCharCode(hi, lo);
      i += 4;
    } else {
      i += 1;
    }
  }
  return str;
}

function stringToUtf8Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    if (cp >= 55296 && cp <= 56319 && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1);
      if (lo >= 56320 && lo <= 57343) {
        cp = 65536 + (cp - 55296) * 1024 + (lo - 56320);
        i++;
      }
    }
    if (cp < 128) {
      bytes.push(cp);
    } else if (cp < 2048) {
      bytes.push(192 | cp >> 6, 128 | cp & 63);
    } else if (cp < 65536) {
      bytes.push(224 | cp >> 12, 128 | cp >> 6 & 63, 128 | cp & 63);
    } else {
      bytes.push(240 | cp >> 18, 128 | cp >> 12 & 63, 128 | cp >> 6 & 63, 128 | cp & 63);
    }
  }
  return new Uint8Array(bytes);
}

const SBOX = [
  99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171, 118, 202, 130, 201, 125, 250, 89, 71, 240, 173, 212, 162, 175, 156, 164, 114, 192, 183, 253, 147, 38, 54, 63, 247, 204, 52, 165, 229, 241, 113, 216, 49, 21, 4, 199, 35, 195, 24, 150, 5, 154, 7, 18, 128, 226, 235, 39, 178, 117, 9, 131, 44, 26, 27, 110, 90, 160, 82, 59, 214, 179, 41, 227, 47, 132, 83, 209, 0, 237, 32, 252, 177, 91, 106, 203, 190, 57, 74, 76, 88, 207, 208, 239, 170, 251, 67, 77, 51, 133, 69, 249, 2, 127, 80, 60, 159, 168, 81, 163, 64, 143, 146, 157, 56, 245, 188, 182, 218, 33, 16, 255, 243, 210, 205, 12, 19, 236, 95, 151, 68, 23, 196, 167, 126, 61, 100, 93, 25, 115, 96, 129, 79, 220, 34, 42, 144, 136, 70, 238, 184, 20, 222, 94, 11, 219, 224, 50, 58, 10, 73, 6, 36, 92, 194, 211, 172, 98, 145, 149, 228, 121, 231, 200, 55, 109, 141, 213, 78, 169, 108, 86, 244, 234, 101, 122, 174, 8, 186, 120, 37, 46, 28, 166, 180, 198, 232, 221, 116, 31, 75, 189, 139, 138, 112, 62, 181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 193, 29, 158, 225, 248, 152, 17, 105, 217, 142, 148, 155, 30, 135, 233, 206, 85, 40, 223, 140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84, 187, 22
];
const RCON = [0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54];

class AES256GCM_Manual {
  constructor(key) {
    this.roundKeys = this._expandKey(key);
  }
  _expandKey(key) {
    let w = new Uint32Array(60);
    for (let i = 0; i < 8; i++) {
      w[i] = key[i * 4] << 24 | key[i * 4 + 1] << 16 | key[i * 4 + 2] << 8 | key[i * 4 + 3];
    }
    for (let i = 8; i < 60; i++) {
      let temp = w[i - 1];
      if (i % 8 === 0) {
        temp = (temp << 8 | temp >>> 24) >>> 0;
        temp = SBOX[temp >>> 24] << 24 | SBOX[temp >>> 16 & 255] << 16 | SBOX[temp >>> 8 & 255] << 8 | SBOX[temp & 255];
        temp ^= RCON[i / 8] << 24 >>> 0;
      } else if (i % 8 === 4) {
        temp = SBOX[temp >>> 24] << 24 | SBOX[temp >>> 16 & 255] << 16 | SBOX[temp >>> 8 & 255] << 8 | SBOX[temp & 255];
      }
      w[i] = (w[i - 8] ^ temp) >>> 0;
    }
    return w;
  }
  _galoisMult(a, b) {
    let p = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1)
        p ^= a;
      let hiBitSet = a & 128;
      a = a << 1 & 255;
      if (hiBitSet)
        a ^= 27;
      b >>= 1;
    }
    return p;
  }
  _encryptBlock(block) {
    let state = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => block[r + c * 4]));
    const addRoundKey = (s, rkIdx) => {
      for (let c = 0; c < 4; c++) {
        let rk = this.roundKeys[rkIdx * 4 + c];
        for (let r = 0; r < 4; r++) {
          s[r][c] ^= rk >>> 24 - 8 * r & 255;
        }
      }
    };
    addRoundKey(state, 0);
    for (let round = 1; round < 14; round++) {
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++)
          state[r][c] = SBOX[state[r][c]];
      let row1 = state[1], row2 = state[2], row3 = state[3];
      state[1] = [row1[1], row1[2], row1[3], row1[0]];
      state[2] = [row2[2], row2[3], row2[0], row2[1]];
      state[3] = [row3[3], row3[0], row3[1], row3[2]];
      for (let c = 0; c < 4; c++) {
        let s0 = state[0][c], s1 = state[1][c], s2 = state[2][c], s3 = state[3][c];
        state[0][c] = this._galoisMult(2, s0) ^ this._galoisMult(3, s1) ^ s2 ^ s3;
        state[1][c] = s0 ^ this._galoisMult(2, s1) ^ this._galoisMult(3, s2) ^ s3;
        state[2][c] = s0 ^ s1 ^ this._galoisMult(2, s2) ^ this._galoisMult(3, s3);
        state[3][c] = this._galoisMult(3, s0) ^ s1 ^ s2 ^ this._galoisMult(2, s3);
      }
      addRoundKey(state, round);
    }
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        state[r][c] = SBOX[state[r][c]];
    let row1 = state[1], row2 = state[2], row3 = state[3];
    state[1] = [row1[1], row1[2], row1[3], row1[0]];
    state[2] = [row2[2], row2[3], row2[0], row2[1]];
    state[3] = [row3[3], row3[0], row3[1], row3[2]];
    addRoundKey(state, 14);
    let res = new Uint8Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        res[c * 4 + r] = state[r][c];
    return res;
  }
  decrypt(iv, ciphertext) {
    let counter = new Uint8Array(16);
    counter.set(iv);
    counter[15] = 2;
    let plaintext = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i += 16) {
      let keystream = this._encryptBlock(counter);
      for (let j = 0; j < 16 && i + j < ciphertext.length; j++) {
        plaintext[i + j] = ciphertext[i + j] ^ keystream[j];
      }
      for (let j = 15; j >= 12; j--) {
        counter[j]++;
        if (counter[j] !== 0)
          break;
      }
    }
    return utf8BytesToString(plaintext);
  }
}

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
  return {
    token,
    viewer_id: viewerId,
    device_id: deviceId,
    confidence: 0.93
  };
}

function isImdbId(id) {
  return typeof id === "string" && id.toLowerCase().startsWith("tt");
}

async function convertImdbToTmdb(imdbId, mediaType) {
  try {
    const url = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" } });
    const data = await response.json();
    const results = mediaType === "tv" ? data.tv_results || [] : data.movie_results || [];
    if (results && results.length > 0) {
      return { success: true, tmdbId: results[0].id };
    }
    return { success: false };
  } catch (error) {
    return { success: false };
  }
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
    let m3u8Url = videoData.url || videoData.sources && videoData.sources[0] && videoData.sources[0].url || videoData.data && videoData.data.sources && videoData.data.sources[0].url;
    if (m3u8Url) {
      return { success: true, url: m3u8Url.replace(/\\u0026/g, "&") };
    }
    return { success: false };
  } catch (e) {
    return { success: false };
  }
}

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const streams = [];
  let finalTmdbId = tmdbId;
  try {
    if (isImdbId(tmdbId)) {
      const conversion = await convertImdbToTmdb(tmdbId, mediaType);
      if (conversion.success)
        finalTmdbId = conversion.tmdbId;
    }
    const s = mediaType === "movie" ? 1 : season || 1;
    const e = mediaType === "movie" ? 1 : episode || 1;
    const pomfyUrl = mediaType === "movie" ? `${API_POMFY}/filme/${finalTmdbId}` : `${API_POMFY}/serie/${finalTmdbId}/${s}/${e}`;
    const response = await fetch(pomfyUrl, { headers: HEADERS });
    if (!response.ok)
      return [];
    const html = await response.text();
    const linkMatch = html.match(/const link\s*=\s*"([^"]+)"/);
    if (!linkMatch)
      return [];
    const byseUrl = linkMatch[1];
    const byseId = byseUrl.split("/").pop();
    const detailsUrl = `https://pomfy-cdn.shop/api/videos/${byseId}/embed/details`;
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
    if (!detailsResponse.ok)
      return [];
    const detailsData = await detailsResponse.json();
    const embedUrl = detailsData.embed_frame_url;
    const embedDomain = new URL(embedUrl).origin;
    try {
      await fetch(`${embedDomain}/api/videos/access/challenge`, {
        method: "POST",
        headers: { "accept": "*/*", "origin": embedDomain, "referer": embedUrl, "user-agent": USER_AGENT }
      });
    } catch (err) {
    }
    const fingerprint = generateFingerprint();
    const playbackUrl = `${embedDomain}/api/videos/${byseId}/embed/playback`;
    const playbackResponse = await fetch(playbackUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "origin": embedDomain,
        "referer": embedUrl,
        "x-embed-origin": "api.pomfy.stream",
        "x-embed-parent": byseUrl,
        "user-agent": USER_AGENT
      },
      body: JSON.stringify({ fingerprint })
    });
    if (!playbackResponse.ok)
      return [];
    const playbackData = await playbackResponse.json();
    if (!playbackData.playback)
      return [];
    const decryptResult = decryptPlayback(playbackData.playback);
    if (decryptResult.success) {
      streams.push({
        name: `Pomfy | High Quality`,
        url: decryptResult.url,
        quality: 2160,
        headers: { "User-Agent": USER_AGENT, "Referer": embedUrl }
      });
    }
  } catch (error) {
  }
  return streams;
}

module.exports = { getStreams };
