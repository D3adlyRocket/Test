/**
 * Pomfy - Mobile & TV Compatibility Fix
 * Standardized headers to ensure cross-platform fetching.
 */

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

// Updated to a more universal User-Agent that doesn't trigger "Mobile vs Desktop" blocks
const UNIVERSAL_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
const COOKIE = "SITE_TOTAL_ID=aTYqe6GU65PNmeCXpelwJwAAAMi; __dtsu=104017651574995957BEB724C6373F9E; __cc_id=a44d1e52993b9c2Oaaf40eba24989a06";

const GET_HEADERS = (referer = "https://pomfy.online/") => ({
  "User-Agent": UNIVERSAL_UA,
  "Accept": "application/json, text/plain, */*",
  "Referer": referer,
  "Origin": new URL(referer).origin,
  "Cookie": COOKIE
});

// [Keep your original base64ToBytes, utf8BytesToString, stringToUtf8Bytes, and AES256GCM_Manual here exactly as they are]

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const streams = [];
  let finalTmdbId = tmdbId;

  try {
    // 1. Resolve ID (Same logic as before)
    if (typeof tmdbId === "string" && tmdbId.startsWith("tt")) {
      const url = `${TMDB_BASE_URL}/find/${tmdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const data = await (await fetch(url)).json();
      const res = mediaType === "tv" ? data.tv_results : data.movie_results;
      if (res && res.length > 0) finalTmdbId = res[0].id;
    }

    const s = mediaType === "movie" ? 1 : (season || 1);
    const e = mediaType === "movie" ? 1 : (episode || 1);
    const pomfyUrl = mediaType === "movie" ? `${API_POMFY}/filme/${finalTmdbId}` : `${API_POMFY}/serie/${finalTmdbId}/${s}/${e}`;

    // 2. Fetch with Universal Headers
    const html = await (await fetch(pomfyUrl, { headers: GET_HEADERS() })).text();
    const linkMatch = html.match(/const link\s*=\s*"([^"]+)"/);
    if (!linkMatch) return [];

    const byseUrl = linkMatch[1];
    const byseId = byseUrl.split("/").pop();
    const embedDomain = "https://pomfy-cdn.shop";

    // 3. Playback Handshake (The part that usually fails on Mobile)
    const ts = Math.floor(Date.now() / 1000);
    const fingerprint = {
      token: bytesToBase64(stringToUtf8Bytes(JSON.stringify({ 
        viewer_id: "bed4fadd25c8dcdcaced26e318c3be5a", 
        iat: ts, exp: ts + 600 
      }))),
      viewer_id: "bed4fadd25c8dcdcaced26e318c3be5a"
    };

    const pbResp = await fetch(`${embedDomain}/api/videos/${byseId}/embed/playback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": byseUrl,
        "X-Embed-Origin": "api.pomfy.stream",
        "X-Embed-Parent": byseUrl,
        "User-Agent": UNIVERSAL_UA
      },
      body: JSON.stringify({ fingerprint })
    });

    const pbData = await pbResp.json();
    if (!pbData.playback) return [];

    // 4. Decrypt (Original Engine)
    const pb = pbData.playback;
    const iv = base64ToBytes(pb.iv);
    const key = new Uint8Array([...base64ToBytes(pb.key_parts[0]), ...base64ToBytes(pb.key_parts[1])]);
    const encryptedData = base64ToBytes(pb.payload);
    
    const cipher = new AES256GCM_Manual(key);
    const decrypted = JSON.parse(cipher.decrypt(iv, encryptedData.slice(0, -16)));
    
    const finalUrl = (decrypted.url || decrypted.sources?.[0]?.url).replace(/\\u0026/g, '&');

    // 5. Final Stream
    streams.push({
      name: "Pomfy | Multi-Platform",
      url: finalUrl,
      quality: 2160,
      headers: {
        "User-Agent": UNIVERSAL_UA,
        "Referer": embedDomain
      }
    });

  } catch (error) {
    // Silent catch to keep UI clean
  }
  return streams;
}

module.exports = { getStreams };
