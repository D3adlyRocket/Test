/**
 * MovieBox provider for Nuvio
 * ---------------------------------------------------------------------------
 * Ported from phisher98's Cloudstream extension (MovieBoxProvider.cs3).
 * That extension was a compiled plugin (no public .kt source), so this was
 * built by decompiling the shipped classes.dex with jadx and re-reading the
 * real string constants (endpoints, header names) straight out of the dex.
 * Endpoints, header names, and the signing algorithm below are taken
 * directly from that decompile, not guessed.
 *
 * What this talks to is MovieBox's real backend, "aoneroom" / "mbox.in"
 * (com.community.mbox.in Android app), which requires a signed-request
 * scheme on every call:
 *   - x-client-token:  "<timestamp>,<md5(reverse(timestamp))>"
 *   - x-tr-signature:  "<timestamp>|2|<base64(HMAC-MD5(secret, canonical))>"
 *   - a short-lived bearer token returned via an "x-user" response header
 *     on the first authenticated-ish call, cached and reused while valid.
 *
 * Nuvio's sandbox does not have Node's `crypto`, so md5 / HMAC-MD5 / base64
 * are implemented from scratch below (no dependencies).
 *
 * IMPORTANT / things you must fill in or verify before relying on this:
 *  1. TMDB_API_KEY below - Nuvio's getStreams() only gives you a tmdbId, but
 *     MovieBox's own search only takes a free-text keyword. So we look the
 *     title/year up on TMDB first, then search MovieBox with that title.
 *     Put your own (free) TMDB v3 API key in TMDB_API_KEY.
 *  2. The "fallback detectors" branch in the original loadLinks() (used only
 *     when playData.streams comes back empty) could not be recovered from
 *     the decompile - that one method hit a decompiler stack overflow on a
 *     deeply nested control-flow graph. Everything else below (search,
 *     get, play-info, signing, token flow) came from readable decompiled
 *     code or literal strings pulled from the dex. The fallback path is
 *     stubbed out and clearly marked - streams simply won't include that
 *     extra fallback source until/unless it's filled in.
 *  3. Host pool: the app rotates between a few api hosts. Default below
 *     matches the original provider's default (index 4 of its pool).
 * ---------------------------------------------------------------------------
 */

// ============================================================================
// Config - key loaded from local config.js (gitignored, never committed)
// ============================================================================
const { TMDB_API_KEY } = require('./config.js');

const HOST_POOL = [
  'https://api6.aoneroom.com',
  'https://api5.aoneroom.com',
  'https://api4.aoneroom.com',
  'https://api4sg.aoneroom.com',
  'https://api3.aoneroom.com'
];
const DEFAULT_HOST = HOST_POOL[4]; // matches original provider's default

// These two constants are exactly what's in the app: base64 blobs that
// decode to *another* base64 string, which is the real HMAC key.
// (double base64 - this is the app's own obfuscation, not mine)
const SECRET_KEY_DEFAULT_B64 = 'NzZpUmwwN3MweFNOOWpxbUVXQXQ3OUVCSlp1bElRSXNWNjRGWnIyTw==';
const SECRET_KEY_ALT_B64 = 'WHFuMm5uTzQxL0w5Mm8xaXVYaFNMSFRiWHZZNFo1Wlo2Mm04bVNMQQ==';

const APP_UA = 'com.community.mbox.in/50020042 (Linux; U; Android 16; en_IN; sdk_gphone64_x86_64; Build/BP22.250325.006; Cronet/133.0.6876.3)';
const APP_PACKAGE_NAME = 'com.community.mbox.in';
const APP_VERSION_NAME = '3.0.03.0529.03';
const APP_VERSION_CODE = 50020042;

const BRAND_MODELS = {
  Samsung: ['SM-S918B', 'SM-A528B', 'SM-M336B'],
  Xiaomi: ['2201117TI', 'M2012K11AI', 'Redmi Note 11'],
  OnePlus: ['LE2111', 'CPH2449', 'IN2023'],
  Google: ['Pixel 6', 'Pixel 7', 'Pixel 8'],
  Realme: ['RMX3085', 'RMX3360', 'RMX3551']
};

// ============================================================================
// Module state (persists for the life of the plugin process)
// ============================================================================
let cachedBearerToken = null;
let cachedDeviceId = null;

// ============================================================================
// Minimal, dependency-free crypto: MD5, HMAC-MD5, base64
// ============================================================================

// --- base64 (byte array <-> string), no atob/btoa/Buffer assumed ---
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : null;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : null;
    const triplet = (b0 << 16) | ((b1 !== null ? b1 : 0) << 8) | (b2 !== null ? b2 : 0);
    out += B64_CHARS[(triplet >> 18) & 0x3f];
    out += B64_CHARS[(triplet >> 12) & 0x3f];
    out += b1 !== null ? B64_CHARS[(triplet >> 6) & 0x3f] : '=';
    out += b2 !== null ? B64_CHARS[triplet & 0x3f] : '=';
  }
  return out;
}

function base64ToBytes(b64) {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const val = B64_CHARS.indexOf(clean[i]);
    if (val === -1) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

function utf8Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.codePointAt(i);
    if (code > 0xffff) i++; // surrogate pair consumed
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

function bytesToHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
  }
  return out;
}

// --- MD5 (standard public-domain style implementation) ---
function md5(bytesIn) {
  function rotl(x, c) { return (x << c) | (x >>> (32 - c)); }
  function addU32(a, b) { return (a + b) >>> 0; }

  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];
  const K = new Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  }

  const msgLenBits = bytesIn.length * 8;
  const msg = bytesIn.slice();
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 0; i < 8; i++) {
    // little-endian 64-bit length (we only ever hit the low 32 bits in practice)
    if (i < 4) {
      msg.push((msgLenBits >>> (8 * i)) & 0xff);
    } else {
      msg.push(0);
    }
  }

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (let chunkStart = 0; chunkStart < msg.length; chunkStart += 64) {
    const M = new Array(16);
    for (let i = 0; i < 16; i++) {
      const o = chunkStart + i * 4;
      M[i] = (msg[o]) | (msg[o + 1] << 8) | (msg[o + 2] << 16) | (msg[o + 3] << 24);
      M[i] = M[i] >>> 0;
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = addU32(B, rotl(F, s[i]));
    }
    a0 = addU32(a0, A); b0 = addU32(b0, B); c0 = addU32(c0, C); d0 = addU32(d0, D);
  }

  function u32le(n) {
    return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  }
  return [].concat(u32le(a0), u32le(b0), u32le(c0), u32le(d0));
}

function md5Hex(bytes) {
  return bytesToHex(md5(bytes));
}

// --- HMAC-MD5 (generic HMAC construction, block size 64 bytes for MD5) ---
function hmacMd5(keyBytes, msgBytes) {
  const blockSize = 64;
  let key = keyBytes.slice();
  if (key.length > blockSize) key = md5(key);
  while (key.length < blockSize) key.push(0);

  const oKeyPad = key.map((b) => b ^ 0x5c);
  const iKeyPad = key.map((b) => b ^ 0x36);

  const inner = md5(iKeyPad.concat(msgBytes));
  return md5(oKeyPad.concat(inner));
}

// ============================================================================
// Signing scheme (recovered from MovieBoxProvider.kt logic)
// ============================================================================

function reverseString(str) {
  return str.split('').reverse().join('');
}

function generateXClientToken(hardcodedTimestamp) {
  const timestamp = String(hardcodedTimestamp != null ? hardcodedTimestamp : Date.now());
  const reversed = reverseString(timestamp);
  const hash = md5Hex(utf8Bytes(reversed));
  return timestamp + ',' + hash;
}

function buildCanonicalString(method, accept, contentType, url, body, timestamp) {
  const u = new URL(url);
  const path = u.pathname || '';
  const paramNames = [];
  u.searchParams.forEach((_, key) => {
    if (paramNames.indexOf(key) === -1) paramNames.push(key);
  });
  paramNames.sort();
  const query = paramNames
    .map((key) => u.searchParams.getAll(key).map((v) => key + '=' + v).join('&'))
    .join('&');
  const canonicalUrl = query.length > 0 ? path + '?' + query : path;

  let bodyHash = '';
  let bodyLength = '';
  if (body != null) {
    let bodyBytes = utf8Bytes(body);
    bodyLength = String(bodyBytes.length);
    if (bodyBytes.length > 102400) bodyBytes = bodyBytes.slice(0, 102400);
    bodyHash = md5Hex(bodyBytes);
  }

  return (
    method.toUpperCase() + '\n' +
    (accept || '') + '\n' +
    (contentType || '') + '\n' +
    bodyLength + '\n' +
    timestamp + '\n' +
    bodyHash + '\n' +
    canonicalUrl
  );
}

function generateXTrSignature(method, accept, contentType, url, body, useAltKey, hardcodedTimestamp) {
  const timestamp = hardcodedTimestamp != null ? hardcodedTimestamp : Date.now();
  const canonical = buildCanonicalString(method, accept, contentType, url, body, timestamp);

  // double base64: field value -> base64 decode -> that string is ITSELF base64 -> decode again to raw key bytes
  const secretB64 = useAltKey ? SECRET_KEY_ALT_B64 : SECRET_KEY_DEFAULT_B64;
  const secretStr = bytesToUtf8String(base64ToBytes(secretB64));
  const secretBytes = base64ToBytes(secretStr);

  const sig = hmacMd5(secretBytes, utf8Bytes(canonical));
  const sigB64 = bytesToBase64(sig);
  return timestamp + '|2|' + sigB64;
}

function bytesToUtf8String(bytes) {
  // decode utf8 byte array back to a JS string (good enough for our ascii-only secrets)
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function randomBrandModel() {
  const brands = Object.keys(BRAND_MODELS);
  const brand = brands[Math.floor(Math.random() * brands.length)];
  const models = BRAND_MODELS[brand];
  const model = models[Math.floor(Math.random() * models.length)];
  return { brand, model };
}

function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  let id = '';
  for (let i = 0; i < 16; i++) {
    const b = Math.floor(Math.random() * 256);
    id += (b < 16 ? '0' : '') + b.toString(16);
  }
  cachedDeviceId = id;
  return id;
}

function buildClientInfoHeader() {
  const bm = randomBrandModel();
  return JSON.stringify({
    package_name: APP_PACKAGE_NAME,
    version_name: APP_VERSION_NAME,
    version_code: APP_VERSION_CODE,
    os: 'android',
    os_version: '16',
    device_id: getDeviceId(),
    install_store: 'ps',
    gaid: 'd7578036d13336cc', // literal value baked into the original app build
    brand: bm.brand,
    model: bm.model,
    system_language: 'en',
    net: 'NETWORK_WIFI',
    region: 'IN',
    timezone: 'Asia/Calcutta',
    sp_code: ''
  });
}

// ============================================================================
// Bearer token (returned via "x-user" response header, cached while valid)
// ============================================================================

function decodeJwtExpiry(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 0;
    let b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const json = bytesToUtf8String(base64ToBytes(b64));
    return JSON.parse(json).exp || 0;
  } catch (e) {
    return 0;
  }
}

function isTokenValid(token) {
  if (!token) return false;
  const exp = decodeJwtExpiry(token);
  return exp > Math.floor(Date.now() / 1000) + 3600;
}

function extractTokenFromXUser(xUserHeader) {
  if (!xUserHeader) return null;
  try {
    const parsed = JSON.parse(xUserHeader);
    return parsed.token || null;
  } catch (e) {
    return null;
  }
}

// GET a cheap endpoint whose response carries "x-user", to mint a bearer token.
function fetchFreshToken(host) {
  const url = host + '/wefeed-mobile-bff/tab/ranking-list?tabId=0&categoryType=4516404531735022304&page=1&perPage=1';
  const xClientToken = generateXClientToken();
  const xTrSignature = generateXTrSignature('GET', 'application/json', 'application/json', url, null, false);
  const headers = {
    'user-agent': APP_UA,
    accept: 'application/json',
    'content-type': 'application/json',
    'x-client-token': xClientToken,
    'x-tr-signature': xTrSignature,
    'x-client-info': buildClientInfoHeader(),
    'x-client-status': '0'
  };
  return fetch(url, { method: 'GET', headers })
    .then((res) => {
      const xUser = res.headers.get('x-user');
      const token = extractTokenFromXUser(xUser);
      if (token && isTokenValid(token)) {
        cachedBearerToken = token;
      }
      return cachedBearerToken || '';
    })
    .catch(() => '');
}

function getCachedToken(host) {
  if (isTokenValid(cachedBearerToken)) {
    return Promise.resolve(cachedBearerToken);
  }
  return fetchFreshToken(host);
}

// ============================================================================
// Title normalization / matching (for picking the right search result)
// ============================================================================

function cleanTitle(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenScore(a, b) {
  if (a === b) return 1;
  const aTokens = new Set(a.split(' ').filter(Boolean));
  const bTokens = new Set(b.split(' ').filter(Boolean));
  let overlap = 0;
  aTokens.forEach((t) => { if (bTokens.has(t)) overlap++; });
  const union = new Set([...aTokens, ...bTokens]).size || 1;
  return overlap / union;
}

// ============================================================================
// TMDB lookup (Nuvio hands us a tmdbId, MovieBox search wants a keyword)
// ============================================================================

function fetchTmdbTitle(tmdbId, mediaType) {
  const path = mediaType === 'tv' ? 'tv' : 'movie';
  const url = 'https://api.themoviedb.org/3/' + path + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;
  return fetch(url)
    .then((res) => res.json())
    .then((data) => {
      const title = data.title || data.name || '';
      const dateStr = data.release_date || data.first_air_date || '';
      const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : null;
      return { title, year };
    });
}

// ============================================================================
// MovieBox API calls
// ============================================================================

function searchMovieBox(host, keyword, page) {
  const url = host + '/wefeed-mobile-bff/subject-api/search/v2';
  const jsonBody = JSON.stringify({ page: page || 1, perPage: 20, keyword: keyword });

  return getCachedToken(host).then((token) => {
    const xClientToken = generateXClientToken();
    const xTrSignature = generateXTrSignature('POST', 'application/json', 'application/json; charset=utf-8', url, jsonBody, false);
    const headers = {
      'user-agent': APP_UA,
      accept: 'application/json',
      'content-type': 'application/json',
      connection: 'keep-alive',
      'x-client-token': xClientToken,
      'x-tr-signature': xTrSignature,
      'x-client-info': buildClientInfoHeader(),
      'x-client-status': '0',
      Authorization: 'Bearer ' + token
    };
    return fetch(url, { method: 'POST', headers, body: jsonBody }).then((res) => {
      const xUser = res.headers.get('x-user');
      const freshToken = extractTokenFromXUser(xUser);
      if (freshToken && isTokenValid(freshToken)) cachedBearerToken = freshToken;
      return res.json();
    });
  }).then((root) => {
    const results = (root && root.data && root.data.results) || [];
    const subjects = [];
    results.forEach((r) => {
      (r.subjects || []).forEach((s) => {
        subjects.push({
          title: s.title,
          subjectId: s.subjectId,
          cover: s.cover && s.cover.url,
          subjectType: s.subjectType != null ? s.subjectType : 1 // 1 = movie, else tv
        });
      });
    });
    return subjects;
  });
}

function getSubjectDetail(host, subjectId) {
  const url = host + '/wefeed-mobile-bff/subject-api/get?subjectId=' + subjectId;
  return getCachedToken(host).then((token) => {
    const xClientToken = generateXClientToken();
    const xTrSignature = generateXTrSignature('GET', 'application/json', 'application/json', url, null, false);
    const headers = {
      'user-agent': APP_UA,
      accept: 'application/json',
      'content-type': 'application/json',
      'x-client-token': xClientToken,
      'x-tr-signature': xTrSignature,
      'x-client-info': buildClientInfoHeader(),
      'x-client-status': '0',
      Authorization: 'Bearer ' + token
    };
    return fetch(url, { method: 'GET', headers }).then((res) => res.json());
  }).then((root) => (root && root.data) || {});
}

function getPlayInfo(host, subjectId, season, episode, token) {
  const url = host + '/wefeed-mobile-bff/subject-api/play-info?subjectId=' + subjectId +
    '&se=' + (season || 0) + '&ep=' + (episode != null ? episode : 0);
  const xClientToken = generateXClientToken();
  const xTrSignature = generateXTrSignature('GET', 'application/json', 'application/json', url, null, false);
  const headers = {
    'user-agent': APP_UA,
    accept: 'application/json',
    'content-type': 'application/json',
    'x-client-token': xClientToken,
    'x-tr-signature': xTrSignature,
    'x-client-info': buildClientInfoHeader(),
    'x-client-status': '0',
    Authorization: 'Bearer ' + token
  };
  return fetch(url, { method: 'GET', headers })
    .then((res) => res.json())
    .then((root) => {
      const playData = root && root.data && root.data.playData;
      const streams = (playData && playData.streams) || [];
      // NOTE: if `streams` is empty here, the original provider falls back to
      // a "detectors" scan that could not be recovered from decompilation
      // (see file header). Nothing is returned in that case below.
      return streams;
    })
    .catch(() => []);
}

function getHighestQuality(input) {
  const table = [['2160', 2160], ['1440', 1440], ['1080', 1080], ['720', 720], ['480', 480], ['360', 360], ['240', 240]];
  const lower = (input || '').toLowerCase();
  for (const [label, val] of table) {
    if (lower.indexOf(label) !== -1) return val;
  }
  return null;
}

// ============================================================================
// Main entry point Nuvio calls
// ============================================================================

function getStreams(tmdbId, mediaType, season, episode) {
  const host = DEFAULT_HOST;

  return fetchTmdbTitle(tmdbId, mediaType)
    .then(({ title, year }) => {
      if (!title) return [];
      const wantType = mediaType === 'tv' ? 2 : 1; // subjectType: 1 movie, else tv per decompile
      const normWanted = cleanTitle(title);

      return searchMovieBox(host, title, 1).then((subjects) => {
        if (!subjects.length) return null;
        let best = null;
        let bestScore = -1;
        subjects.forEach((s) => {
          const score = tokenScore(normWanted, cleanTitle(s.title || ''));
          const typeMatches = mediaType === 'tv' ? s.subjectType !== 1 : s.subjectType === 1;
          const adjusted = score + (typeMatches ? 0.25 : 0);
          if (adjusted > bestScore) {
            bestScore = adjusted;
            best = s;
          }
        });
        return best;
      });
    })
    .then((best) => {
      if (!best) return [];

      return getSubjectDetail(host, best.subjectId).then((detail) => {
        const dubs = (detail && detail.dubs) || [];
        const subjectIds = [{ subjectId: best.subjectId, language: detail.language || 'original' }];
        dubs.forEach((d) => {
          if (d && d.subjectId) subjectIds.push({ subjectId: d.subjectId, language: d.language || 'dub' });
        });

        return getCachedToken(host).then((token) => {
          const perLanguage = subjectIds.map((entry) =>
            getPlayInfo(host, entry.subjectId, season, episode, token).then((streams) =>
              streams.map((stream) => ({
                name: 'MovieBox' + (entry.language ? ' - ' + entry.language : ''),
                title: stream.format || best.title,
                url: stream.streamUrl || stream.url,
                quality: getHighestQuality(
                  (stream.resolutions && stream.resolutions[0]) || stream.format || stream.streamUrl || ''
                ),
                headers: {
                  Referer: host,
                  // signCookieRaw carries the short-lived signed cookie the CDN checks
                  Cookie: stream.signCookie || stream.signCookieRaw || ''
                }
              }))
            )
          );
          return Promise.all(perLanguage);
        });
      });
    })
    .then((perLanguageResults) => [].concat.apply([], perLanguageResults || []))
    .catch((err) => {
      console.error('[MovieBox] getStreams error:', err && err.message);
      return [];
    });
}

module.exports = { getStreams };
