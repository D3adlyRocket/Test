var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
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

// src/peachify/index.js
var PROVIDER_NAME = "Peachify";
var PROXY_URL = "";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var SERVERS = [
  { label: "Iron", url: "https://uwu.eat-peach.sbs/moviebox", key: "iron" },
  { label: "Spider", url: "https://usa.eat-peach.sbs/holly", key: "spider" },
  { label: "Wolf", url: "https://usa.eat-peach.sbs/air", key: "wolf" },
  { label: "Backup", url: "https://usa.eat-peach.sbs/multi", key: "backup" }
];
var AES_KEY_HEX = "a8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b8cad1e2d0a4d5c5b";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
  "Origin": "https://peachify.top",
  "Referer": "https://peachify.top/"
};
var SBOX = [
  99,
  124,
  119,
  123,
  242,
  107,
  111,
  197,
  48,
  1,
  103,
  43,
  254,
  215,
  171,
  118,
  202,
  130,
  201,
  125,
  250,
  89,
  71,
  240,
  173,
  212,
  162,
  175,
  156,
  164,
  114,
  192,
  183,
  253,
  147,
  38,
  54,
  63,
  247,
  204,
  52,
  165,
  229,
  241,
  113,
  216,
  49,
  21,
  4,
  199,
  35,
  195,
  24,
  150,
  5,
  154,
  7,
  18,
  128,
  226,
  235,
  39,
  178,
  117,
  9,
  131,
  44,
  26,
  27,
  110,
  90,
  160,
  82,
  59,
  214,
  179,
  41,
  227,
  47,
  132,
  83,
  209,
  0,
  237,
  32,
  252,
  177,
  91,
  106,
  203,
  190,
  57,
  74,
  76,
  88,
  207,
  208,
  239,
  170,
  251,
  67,
  77,
  51,
  133,
  69,
  249,
  2,
  127,
  80,
  60,
  159,
  168,
  81,
  163,
  64,
  143,
  146,
  157,
  56,
  245,
  188,
  182,
  218,
  33,
  16,
  255,
  243,
  210,
  205,
  12,
  19,
  236,
  95,
  151,
  68,
  23,
  196,
  167,
  126,
  61,
  100,
  93,
  25,
  115,
  96,
  129,
  79,
  220,
  34,
  42,
  144,
  136,
  70,
  238,
  184,
  20,
  222,
  94,
  11,
  219,
  224,
  50,
  58,
  10,
  73,
  6,
  36,
  92,
  194,
  211,
  172,
  98,
  145,
  149,
  228,
  121,
  231,
  200,
  55,
  109,
  141,
  213,
  78,
  169,
  108,
  86,
  244,
  234,
  101,
  122,
  174,
  8,
  186,
  120,
  37,
  46,
  28,
  166,
  180,
  198,
  232,
  221,
  116,
  31,
  75,
  189,
  139,
  138,
  112,
  62,
  181,
  102,
  72,
  3,
  246,
  14,
  97,
  53,
  87,
  185,
  134,
  193,
  29,
  158,
  225,
  248,
  152,
  17,
  105,
  217,
  142,
  148,
  155,
  30,
  135,
  233,
  206,
  85,
  40,
  223,
  140,
  161,
  137,
  13,
  191,
  230,
  66,
  104,
  65,
  153,
  45,
  15,
  176,
  84,
  187,
  22
];
var RCON = [1, 2, 4, 8, 16, 32, 64, 128, 27, 54];
function xtime(a) {
  return (a << 1 ^ (a >> 7 & 1) * 27) & 255;
}
function aesKeyExpansion(keyBytes) {
  const w = [];
  for (let i = 0; i < 8; i++) {
    w[i] = keyBytes[4 * i] << 24 | keyBytes[4 * i + 1] << 16 | keyBytes[4 * i + 2] << 8 | keyBytes[4 * i + 3];
  }
  for (let i = 8; i < 60; i++) {
    let temp = w[i - 1];
    if (i % 8 === 0) {
      temp = (temp << 8 | temp >>> 24) >>> 0;
      const b0 = SBOX[temp >>> 24 & 255];
      const b1 = SBOX[temp >>> 16 & 255];
      const b2 = SBOX[temp >>> 8 & 255];
      const b3 = SBOX[temp & 255];
      temp = b0 << 24 | b1 << 16 | b2 << 8 | b3;
      const rconVal = RCON[i / 8 - 1] << 24;
      temp = (temp ^ rconVal) >>> 0;
    } else if (i % 8 === 4) {
      const b0 = SBOX[temp >>> 24 & 255];
      const b1 = SBOX[temp >>> 16 & 255];
      const b2 = SBOX[temp >>> 8 & 255];
      const b3 = SBOX[temp & 255];
      temp = b0 << 24 | b1 << 16 | b2 << 8 | b3;
    }
    w[i] = (w[i - 8] ^ temp) >>> 0;
  }
  const roundKeys = [];
  for (let r = 0; r < 15; r++) {
    const rk = new Uint8Array(16);
    for (let j = 0; j < 4; j++) {
      const word = w[r * 4 + j];
      rk[4 * j] = word >>> 24 & 255;
      rk[4 * j + 1] = word >>> 16 & 255;
      rk[4 * j + 2] = word >>> 8 & 255;
      rk[4 * j + 3] = word & 255;
    }
    roundKeys.push(rk);
  }
  return roundKeys;
}
function aesEncryptBlock(block, roundKeys) {
  let state = new Uint8Array(block);
  for (let i = 0; i < 16; i++)
    state[i] ^= roundKeys[0][i];
  for (let round = 1; round <= 14; round++) {
    for (let i = 0; i < 16; i++)
      state[i] = SBOX[state[i]];
    const t1 = state[1];
    state[1] = state[5];
    state[5] = state[9];
    state[9] = state[13];
    state[13] = t1;
    const t2a = state[2];
    const t2b = state[6];
    state[2] = state[10];
    state[6] = state[14];
    state[10] = t2a;
    state[14] = t2b;
    const t3 = state[3];
    state[3] = state[15];
    state[15] = state[11];
    state[11] = state[7];
    state[7] = t3;
    if (round < 14) {
      for (let c = 0; c < 4; c++) {
        const i = c * 4;
        const a0 = state[i], a1 = state[i + 1], a2 = state[i + 2], a3 = state[i + 3];
        state[i] = xtime(a0) ^ (xtime(a1) ^ a1) ^ a2 ^ a3;
        state[i + 1] = a0 ^ xtime(a1) ^ (xtime(a2) ^ a2) ^ a3;
        state[i + 2] = a0 ^ a1 ^ xtime(a2) ^ (xtime(a3) ^ a3);
        state[i + 3] = xtime(a0) ^ a0 ^ a1 ^ a2 ^ xtime(a3);
      }
    }
    for (let i = 0; i < 16; i++)
      state[i] ^= roundKeys[round][i];
  }
  return state;
}
function ghashMul(x, y) {
  const Z = new Uint8Array(16);
  const V = new Uint8Array(y);
  for (let i = 0; i < 128; i++) {
    const byteIdx = Math.floor(i / 8);
    const bitIdx = 7 - i % 8;
    if (x[byteIdx] >>> bitIdx & 1) {
      for (let j = 0; j < 16; j++)
        Z[j] ^= V[j];
    }
    const lsb = V[15] & 1;
    for (let j = 15; j > 0; j--)
      V[j] = V[j] >>> 1 | (V[j - 1] & 1) << 7;
    V[0] = V[0] >>> 1;
    if (lsb)
      V[0] ^= 225;
  }
  return Z;
}
function ghash(h, data) {
  const Y = new Uint8Array(16);
  for (let i = 0; i < data.length; i += 16) {
    for (let j = 0; j < 16; j++)
      Y[j] ^= data[i + j];
    const result = ghashMul(Y, h);
    Y.set(result);
  }
  return Y;
}
function inc32(block) {
  const result = new Uint8Array(block);
  let c = 1;
  for (let i = 15; i >= 12 && c > 0; i--) {
    const val = result[i] + c;
    result[i] = val & 255;
    c = val >>> 8;
  }
  return result;
}
function aes256GcmDecrypt(encryptedData, keyHex) {
  const parts = encryptedData.split(".");
  if (parts.length < 3)
    return null;
  function b64urlToBytes(str) {
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice(0, (4 - base64.length % 4) % 4);
    const raw = atob(padded);
    const bytes = new Uint8Array(raw.length);
    for (let i2 = 0; i2 < raw.length; i2++)
      bytes[i2] = raw.charCodeAt(i2);
    return bytes;
  }
  const iv = b64urlToBytes(parts[0]);
  const c1 = b64urlToBytes(parts[1]);
  const c2 = b64urlToBytes(parts[2]);
  const cipherWithTag = new Uint8Array(c1.length + c2.length);
  cipherWithTag.set(c1, 0);
  cipherWithTag.set(c2, c1.length);
  const tag = cipherWithTag.slice(-16);
  const ciphertext = cipherWithTag.slice(0, -16);
  const keyLen = keyHex.length / 2;
  const key = new Uint8Array(keyLen);
  for (let i2 = 0; i2 < keyLen; i2++)
    key[i2] = parseInt(keyHex.substr(i2 * 2, 2), 16);
  const roundKeys = aesKeyExpansion(key);
  const zeroBlock = new Uint8Array(16);
  const H = aesEncryptBlock(zeroBlock, roundKeys);
  let J0;
  if (iv.length === 12) {
    J0 = new Uint8Array(16);
    J0.set(iv, 0);
    J0[15] = 1;
  } else {
    return null;
  }
  const plaintext = new Uint8Array(ciphertext.length);
  let counter = inc32(J0);
  for (let offset = 0; offset < ciphertext.length; offset += 16) {
    const keyStream = aesEncryptBlock(counter, roundKeys);
    const remaining = Math.min(16, ciphertext.length - offset);
    for (let j = 0; j < remaining; j++) {
      plaintext[offset + j] = ciphertext[offset + j] ^ keyStream[j];
    }
    counter = inc32(counter);
  }
  const paddedCT = new Uint8Array(Math.ceil(ciphertext.length / 16) * 16);
  paddedCT.set(ciphertext, 0);
  const lenAAD = 0;
  const lenCT = ciphertext.length;
  const lenBlock = new Uint8Array(16);
  const totalBits = lenCT * 8;
  lenBlock[8] = totalBits >>> 56 & 255;
  lenBlock[9] = totalBits >>> 48 & 255;
  lenBlock[10] = totalBits >>> 40 & 255;
  lenBlock[11] = totalBits >>> 32 & 255;
  lenBlock[12] = totalBits >>> 24 & 255;
  lenBlock[13] = totalBits >>> 16 & 255;
  lenBlock[14] = totalBits >>> 8 & 255;
  lenBlock[15] = totalBits & 255;
  const ghashInput = new Uint8Array(paddedCT.length + 16);
  ghashInput.set(paddedCT, 0);
  ghashInput.set(lenBlock, paddedCT.length);
  const S = ghash(H, ghashInput);
  const E_J0 = aesEncryptBlock(J0, roundKeys);
  const computedTag = new Uint8Array(16);
  for (let j = 0; j < 16; j++)
    computedTag[j] = S[j] ^ E_J0[j];
  let tagMatch = computedTag.length === tag.length;
  if (tagMatch) {
    for (let j = 0; j < 16; j++) {
      if (computedTag[j] !== tag[j]) {
        tagMatch = false;
        break;
      }
    }
  }
  let result = "";
  let i = 0;
  while (i < plaintext.length) {
    const b1 = plaintext[i++];
    if (b1 < 128) {
      result += String.fromCharCode(b1);
    } else if (b1 < 224 && i < plaintext.length) {
      result += String.fromCharCode((b1 & 31) << 6 | plaintext[i++] & 63);
    } else if (b1 < 240 && i + 1 < plaintext.length) {
      const b2 = plaintext[i++];
      const b3 = plaintext[i++];
      result += String.fromCharCode((b1 & 15) << 12 | (b2 & 63) << 6 | b3 & 63);
    } else if (i + 2 < plaintext.length) {
      const b2 = plaintext[i++];
      const b3 = plaintext[i++];
      const b4 = plaintext[i++];
      const cp = (b1 & 7) << 18 | (b2 & 63) << 12 | (b3 & 63) << 6 | b4 & 63;
      result += String.fromCharCode(cp);
    } else
      break;
  }
  return result;
}
function fetchWithTimeout(_0) {
  return __async(this, arguments, function* (url, options = {}, timeout = 15e3) {
    try {
      const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(timeout) : null;
      const mergedOptions = __spreadValues({}, options);
      if (signal)
        mergedOptions.signal = signal;
      if (!mergedOptions.headers)
        mergedOptions.headers = {};
      return yield fetch(url, mergedOptions);
    } catch (e) {
      if (e.name === "AbortError" || e.name === "TimeoutError") {
        throw new Error("[" + PROVIDER_NAME + "] Timeout: " + url.substring(0, 80));
      }
      throw e;
    }
  });
}
function fetchFromServer(server, tmdbId, mediaType, season, episode, mediaTitle, mediaYear) {
  return __async(this, null, function* () {
    const type = mediaType === "tv" ? "tv" : "movie";
    let url = server.url + "/" + type + "/" + tmdbId;
    if (type === "tv" && season !== null && episode !== null) {
      url += "/" + season + "/" + episode;
    }
    const mediaInfo = {
      title: mediaTitle || "",
      year: mediaYear || "",
      season,
      episode,
      isTv: type === "tv"
    };
    const labels = {
      origin: "https://peachify.top",
      referer: "https://peachify.top/"
    };
    console.log("[" + PROVIDER_NAME + "] Fetching " + server.label + ": " + url);
    try {
      const res = yield fetchWithTimeout(url, {
        headers: {
          "User-Agent": HEADERS["User-Agent"],
          "Accept": HEADERS["Accept"],
          "Origin": labels.origin,
          "Referer": labels.referer
        }
      });
      if (!res.ok) {
        console.log("[" + PROVIDER_NAME + "] " + server.label + " returned " + res.status);
        return null;
      }
      const body = yield res.text();
      console.log("[" + PROVIDER_NAME + "] " + server.label + " response length: " + body.length);
      let json;
      try {
        json = JSON.parse(body);
      } catch (e) {
        console.log("[" + PROVIDER_NAME + "] " + server.label + " not JSON: " + body.substring(0, 100));
        return null;
      }
      if (!json.isEncrypted) {
        console.log("[" + PROVIDER_NAME + "] " + server.label + " unencrypted response");
        return parseStreamData(json, server, mediaInfo);
      }
      if (json.isEncrypted && json.data) {
        console.log("[" + PROVIDER_NAME + "] " + server.label + " encrypted data: " + json.data.substring(0, 50) + "...");
        if (PROXY_URL) {
          console.log("[" + PROVIDER_NAME + "] Using proxy for decryption...");
          const decrypted = yield decryptViaProxy(json.data, server);
          if (decrypted) {
            const parsed = parseDecryptedData(decrypted, server, mediaInfo);
            return parsed;
          }
          console.log("[" + PROVIDER_NAME + "] Proxy decryption failed, falling back to direct...");
        }
        console.log("[" + PROVIDER_NAME + "] Decrypting directly with AES-256-GCM...");
        try {
          const decrypted = aes256GcmDecrypt(json.data, AES_KEY_HEX);
          if (decrypted) {
            console.log("[" + PROVIDER_NAME + "] Decrypted: " + decrypted.substring(0, 200));
            const parsed = parseDecryptedData(decrypted, server, mediaInfo);
            return parsed;
          }
        } catch (eDec) {
          console.log("[" + PROVIDER_NAME + "] Direct decryption failed: " + eDec.message);
        }
        return null;
      }
      console.log("[" + PROVIDER_NAME + "] " + server.label + " unexpected format");
      return null;
    } catch (e) {
      console.log("[" + PROVIDER_NAME + "] " + server.label + " error: " + e.message);
      return null;
    }
  });
}
function decryptViaProxy(encryptedData, server) {
  return __async(this, null, function* () {
    try {
      const proxyUrl = PROXY_URL + "?action=decrypt&data=" + encodeURIComponent(encryptedData) + "&server=" + encodeURIComponent(server.key);
      const res = yield fetchWithTimeout(proxyUrl, {}, 2e4);
      if (!res.ok) {
        console.log("[" + PROVIDER_NAME + "] Proxy returned " + res.status);
        return null;
      }
      const proxyRes = yield res.json();
      if (proxyRes.code === 0 && proxyRes.data) {
        if (typeof proxyRes.data === "string")
          return proxyRes.data;
        return JSON.stringify(proxyRes.data);
      }
      return null;
    } catch (e) {
      console.log("[" + PROVIDER_NAME + "] Proxy error: " + e.message);
      return null;
    }
  });
}
function parseDecryptedData(decryptedStr, server, mediaInfo) {
  try {
    const data = JSON.parse(decryptedStr);
    return parseStreamData(data, server, mediaInfo);
  } catch (e) {
    if (decryptedStr.startsWith("http://") || decryptedStr.startsWith("https://") || decryptedStr.startsWith("//")) {
      let url = decryptedStr;
      if (url.startsWith("//"))
        url = "https:" + url;
      var displayTitle = mediaInfo && mediaInfo.title ? mediaInfo.title : server.label;
      var displaySeason = mediaInfo && mediaInfo.isTv && mediaInfo.season ? " S" + padNum(mediaInfo.season) + "E" + padNum(mediaInfo.episode) : "";
      return [{
        name: (mediaInfo && mediaInfo.title ? mediaInfo.title : server.label) + displaySeason + " | HD",
        title: displayTitle + (mediaInfo && mediaInfo.year ? " (" + mediaInfo.year + ")" : "") + displaySeason + "\nHD \xB7 Direct",
        url,
        quality: "1080p",
        headers: {
          "Referer": "https://peachify.top/",
          "Origin": "https://peachify.top",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      }];
    }
    return null;
  }
}
function padNum(n) {
  return n < 10 ? "0" + n : "" + n;
}
function getFormat(url) {
  var u = url.toLowerCase();
  if (u.includes(".m3u8"))
    return "HLS";
  if (u.includes(".mp4"))
    return "MP4";
  if (u.includes(".mkv"))
    return "MKV";
  if (u.includes("m3u8-proxy") || u.includes("/hls/") || u.includes("master.m3u8"))
    return "HLS";
  if (u.includes("mp4-proxy"))
    return "MP4";
  return "";
}
function parseStreamData(json, server, mediaInfo) {
  if (!json)
    return null;
  var isTv = mediaInfo && mediaInfo.isTv;
  var showTitle = mediaInfo && mediaInfo.title ? mediaInfo.title : "";
  var showYear = mediaInfo && mediaInfo.year ? "(" + mediaInfo.year + ")" : "";
  var epLabel = "";
  if (isTv && mediaInfo.season != null && mediaInfo.episode != null) {
    epLabel = " S" + padNum(mediaInfo.season) + "E" + padNum(mediaInfo.episode);
  }
  var baseDisplay = showTitle + showYear + epLabel;
  if (!baseDisplay)
    baseDisplay = server.label;
  const streams = [];
  let sources = json.sources || json.source || json.data || [];
  if (!Array.isArray(sources))
    sources = [sources];
  const directUrl = json.url || json.file || json.playUrl || json.playurl || json.streamUrl || json.src || null;
  if (directUrl && sources.length === 0) {
    sources = [{ url: directUrl }];
  }
  for (const src of sources) {
    const url = src.url || src.file || src.src || src.playUrl || null;
    if (!url)
      continue;
    let cleanUrl = String(url);
    if (cleanUrl.startsWith("//"))
      cleanUrl = "https:" + cleanUrl;
    const label = src.label || src.quality || src.name || src.qualityLabel || "HD";
    const quality = normalizeQuality(label + " " + (src.resolution || ""));
    const dub = (src.dub || src.language || src.lang || src.audio || "").trim();
    var shortDub = dub.replace(/^Original Audio$/i, "Original").replace(/^English Dub$/i, "English");
    var langTag = shortDub ? " \xB7 " + shortDub : "";
    var nameLang = shortDub ? " | " + shortDub : "";
    var fmt = getFormat(cleanUrl);
    var fmtTag = fmt ? " \xB7 " + fmt : "";
    const subtitles = parseSubtitles(json.tracks || json.subtitles || json.subs || src.tracks || []);
    var sizeTag = "";
    if (src.size)
      sizeTag = " \xB7 " + src.size;
    if (src.filesize)
      sizeTag = " \xB7 " + src.filesize;
    var streamName = baseDisplay + " | " + quality + nameLang;
    var streamTitle = baseDisplay + "\n" + quality + fmtTag + langTag + " \xB7 " + server.label + sizeTag;
    streams.push({
      name: streamName,
      title: streamTitle,
      url: cleanUrl,
      quality,
      headers: {
        "Referer": "https://peachify.top/",
        "Origin": "https://peachify.top",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      subtitles
    });
  }
  if (streams.length === 0 && directUrl) {
    streams.push({
      name: baseDisplay + " | HD",
      title: baseDisplay + "\nHD \xB7 " + server.label,
      url: String(directUrl),
      quality: "1080p",
      headers: {
        "Referer": "https://peachify.top/",
        "Origin": "https://peachify.top",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
  }
  return streams.length > 0 ? streams : null;
}
function parseSubtitles(tracks) {
  if (!tracks || !Array.isArray(tracks))
    return [];
  return tracks.filter((t) => t.file || t.url).map((t) => ({
    label: t.label || t.language || t.lang || "Unknown",
    url: t.file || t.url
  }));
}
function normalizeQuality(text) {
  const t = String(text || "").toLowerCase();
  if (t.includes("2160") || t.includes("4k") || t.includes("uhd"))
    return "2160p";
  if (t.includes("1440"))
    return "1440p";
  if (t.includes("1080"))
    return "1080p";
  if (t.includes("720"))
    return "720p";
  if (t.includes("480"))
    return "480p";
  if (t.includes("360"))
    return "360p";
  return "HD";
}
function getTMDBInfo(id, type) {
  return __async(this, null, function* () {
    const idStr = String(id).trim();
    const isImdbId = idStr.startsWith("tt");
    const tmdbType = type === "tv" || type === "series" ? "tv" : "movie";
    try {
      if (isImdbId) {
        console.log("[" + PROVIDER_NAME + "] IMDB ID: " + idStr);
        const res = yield fetchWithTimeout(
          "https://api.themoviedb.org/3/find/" + idStr + "?api_key=" + TMDB_API_KEY + "&external_source=imdb_id"
        );
        if (res.ok) {
          const data = yield res.json();
          const results = tmdbType === "tv" ? data.tv_results : data.movie_results;
          if (results && results.length > 0) {
            const item = results[0];
            return {
              id: item.id,
              title: tmdbType === "tv" ? item.name : item.title,
              year: (item.first_air_date || item.release_date || "").split("-")[0]
            };
          }
        }
        return { id: idStr, title: idStr, year: null };
      } else {
        const res = yield fetchWithTimeout(
          "https://api.themoviedb.org/3/" + tmdbType + "/" + idStr + "?api_key=" + TMDB_API_KEY
        );
        if (res.ok) {
          const data = yield res.json();
          return {
            id: data.id,
            title: tmdbType === "tv" ? data.name : data.title,
            year: (data.first_air_date || data.release_date || "").split("-")[0]
          };
        }
        return { id: idStr, title: idStr, year: null };
      }
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] TMDB error: " + e.message);
      return { id: idStr, title: String(idStr), year: null };
    }
  });
}
function deduplicateStreams(streams) {
  const seen = /* @__PURE__ */ new Set();
  return streams.filter((s) => {
    const key = s.url || s.title || "";
    if (!key || seen.has(key))
      return false;
    seen.add(key);
    return true;
  });
}
function sortStreamsByQuality(streams) {
  const order = { "2160p": 5, "4k": 5, "1440p": 4, "1080p": 3, "720p": 2, "480p": 1, "360p": 0 };
  return streams.sort((a, b) => {
    var _a, _b, _c, _d;
    const qa = (_b = order[(_a = a.quality) == null ? void 0 : _a.toLowerCase()]) != null ? _b : 0;
    const qb = (_d = order[(_c = b.quality) == null ? void 0 : _c.toLowerCase()]) != null ? _d : 0;
    return qb - qa;
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log("[" + PROVIDER_NAME + "] Request: ID=" + tmdbId + ", Type=" + mediaType + ", S=" + season + ", E=" + episode);
      const media = yield getTMDBInfo(tmdbId, mediaType);
      console.log("[" + PROVIDER_NAME + '] Resolved: "' + media.title + '" (TMDB ID: ' + media.id + ")");
      const results = yield Promise.allSettled(
        SERVERS.map((server) => fetchFromServer(server, media.id, mediaType, season, episode, media.title, media.year))
      );
      const allStreams = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled" && r.value && Array.isArray(r.value) && r.value.length > 0) {
          allStreams.push(...r.value);
          console.log("[" + PROVIDER_NAME + "] " + SERVERS[i].label + " returned " + r.value.length + " streams");
        } else if (r.status === "rejected") {
          console.log("[" + PROVIDER_NAME + "] " + SERVERS[i].label + " rejected: " + r.reason);
        }
      }
      if (allStreams.length === 0) {
        console.log("[" + PROVIDER_NAME + "] No streams from any server.");
        return [];
      }
      const finalStreams = sortStreamsByQuality(deduplicateStreams(allStreams));
      console.log("[" + PROVIDER_NAME + "] Returning " + finalStreams.length + " unique streams.");
      return finalStreams;
    } catch (e) {
      console.error("[" + PROVIDER_NAME + "] Fatal: " + e.message);
      return [];
    }
  });
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
