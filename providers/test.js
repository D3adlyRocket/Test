/**
 * Pomfy Provider - CLEANED ORIGINAL LOGIC
 * Reverted to original decryption engine. Removed all debug clutter.
 */

const API_POMFY = "https://api.pomfy.stream";
const TMDB_API_KEY = "3644dd4950b67cd8067b8772de576d6b";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const COOKIE = "SITE_TOTAL_ID=aTYqe6GU65PNmeCXpelwJwAAAMi; __dtsu=104017651574995957BEB724C6373F9E; __cc_id=a44d1e52993b9c2Oaaf40eba24989a06";
const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";

// --- ORIGINAL DECRYPTION ENGINE (Restored) ---
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64ToBytes(base64) {
  let b64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const lookup = new Uint8Array(256).fill(255);
  for (let i = 0; i < 64; i++) lookup[BASE64_CHARS.charCodeAt(i)] = i;
  const len = b64.length;
  let outputLen = (len * 3) >> 2;
  if (b64[len - 1] === '=') outputLen--; if (b64[len - 2] === '=') outputLen--;
  const bytes = new Uint8Array(outputLen);
  let byteIdx = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[b64.charCodeAt(i)], b = lookup[b64.charCodeAt(i + 1)], c = lookup[b64.charCodeAt(i + 2)], d = lookup[b64.charCodeAt(i + 3)];
    if (byteIdx < outputLen) bytes[byteIdx++] = (a << 2) | (b >> 4);
    if (byteIdx < outputLen) bytes[byteIdx++] = ((b & 0x0f) << 4) | (c >> 2);
    if (byteIdx < outputLen) bytes[byteIdx++] = ((c & 0x03) << 6) | d;
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let result = ''; const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i], b1 = i + 1 < len ? bytes[i + 1] : 0, b2 = i + 2 < len ? bytes[i + 2] : 0;
    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
    result += i + 1 < len ? BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < len ? BASE64_CHARS[b2 & 0x3f] : '=';
  }
  return result;
}

function utf8BytesToString(bytes) {
  return new TextDecoder().decode(bytes);
}

function stringToUtf8Bytes(str) {
  return new TextEncoder().encode(str);
}

// [Include your original AES256GCM_Manual class here verbatim from your first snippet]

// --- HELPER FUNCTIONS ---
function generateFingerprint() {
  const ts = Math.floor(Date.now() / 1000);
  const payload = { viewer_id: "bed4fadd25c8dcdcaced26e318c3be5a", device_id: "b69c7e41fe010d4445b827dd95aa89fc", confidence: 0.93, iat: ts, exp: ts + 600 };
  return { token: bytesToBase64(stringToUtf8Bytes(JSON.stringify(payload))), viewer_id: "bed4fadd25c8dcdcaced26e318c3be5a", device_id: "b69c7e41fe010d4445b827dd95aa89fc", confidence: 0.93 };
}

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  try {
    let finalTmdbId = tmdbId;
    
    // Resolve IMDb if needed
    if (typeof tmdbId === "string" && tmdbId.startsWith("tt")) {
      const url = `${TMDB_BASE_URL}/find/${tmdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const data = await (await fetch(url)).json();
      finalTmdbId = mediaType === "tv" ? data.tv_results[0]?.id : data.movie_results[0]?.id;
    }

    const pomfyUrl = mediaType === "movie"
      ? `${API_POMFY}/filme/${finalTmdbId}`
      : `${API_POMFY}/serie/${finalTmdbId}/${season || 1}/${episode || 1}`;

    const html = await (await fetch(pomfyUrl, { headers: { "User-Agent": USER_AGENT, "Cookie": COOKIE } })).text();
    const byseUrl = html.match(/const link\s*=\s*"([^"]+)"/)?.[1];
    if (!byseUrl) return [];

    const byseId = byseUrl.split("/").pop();
    const embedDomain = "https://pomfy-cdn.shop";

    // Challenge Step
    await fetch(`${embedDomain}/api/videos/access/challenge`, {
      method: 'POST',
      headers: { 'Origin': embedDomain, 'Referer': byseUrl, 'User-Agent': USER_AGENT }
    });

    // Playback Request
    const pbResp = await fetch(`${embedDomain}/api/videos/${byseId}/embed/playback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": embedDomain,
        "Referer": byseUrl,
        "X-Embed-Origin": "api.pomfy.stream",
        "X-Embed-Parent": byseUrl,
        "User-Agent": USER_AGENT
      },
      body: JSON.stringify({ fingerprint: generateFingerprint() })
    });

    const pbData = await pbResp.json();
    const playback = pbData.playback;
    if (!playback) return [];

    // Decryption
    const iv = base64ToBytes(playback.iv);
    const key = new Uint8Array([...base64ToBytes(playback.key_parts[0]), ...base64ToBytes(playback.key_parts[1])]);
    const encryptedData = base64ToBytes(playback.payload);
    const ciphertext = encryptedData.slice(0, -16);
    
    const cipher = new AES256GCM_Manual(key);
    const decrypted = JSON.parse(cipher.decrypt(iv, ciphertext));
    const streamUrl = (decrypted.url || decrypted.sources?.[0]?.url || decrypted.data?.sources?.[0]?.url).replace(/\\u0026/g, '&');

    // Return ONLY the one clean link
    return [{
      name: "Pomfy | Auto High-Res",
      title: "1080p / 2160p (Adaptive)",
      url: streamUrl,
      quality: 2160,
      headers: { "User-Agent": USER_AGENT, "Referer": embedDomain }
    }];

  } catch (error) {
    return [];
  }
}

module.exports = { getStreams };
