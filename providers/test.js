/**
 * Pomfy Provider - Optimized & Cleaned
 * Targets high-quality HLS streams (1080p/2160p)
 */

const API_POMFY = "https://api.pomfy.stream";
const TMDB_API_KEY = "3644dd4950b67cd8067b8772de576d6b";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Standard Base64/UTF8 helpers
const b64 = {
  decode: (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
  encode: (b) => btoa(String.fromCharCode(...b))
};

// Simplified AES-GCM logic (Requires environment with SubtleCrypto or a stable implementation)
// For most provider environments (like Stremio/Cloudflare), we use the manual logic you provided but cleaned up.

/** 
 * [Insert your AES256GCM_Manual class here - kept identical for decryption compatibility] 
 */

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const streams = [];
  let finalId = tmdbId;

  try {
    // 1. Resolve IMDb to TMDB if necessary
    if (typeof tmdbId === "string" && tmdbId.startsWith("tt")) {
      const resp = await fetch(`${TMDB_BASE_URL}/find/${tmdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`);
      const data = await resp.json();
      const result = mediaType === "movie" ? data.movie_results[0] : data.tv_results[0];
      if (!result) return [];
      finalId = result.id;
    }

    // 2. Fetch Pomfy Page
    const pomfyUrl = mediaType === "movie" 
      ? `${API_POMFY}/filme/${finalId}` 
      : `${API_POMFY}/serie/${finalId}/${season}/${episode}`;

    const htmlResp = await fetch(pomfyUrl, { headers: { "User-Agent": USER_AGENT } });
    const html = await htmlResp.text();
    
    const byseMatch = html.match(/const link\s*=\s*"([^"]+)"/);
    if (!byseMatch) return [];

    const byseUrl = byseMatch[1];
    const byseId = byseUrl.split("/").pop();
    const embedDomain = new URL(byseUrl).origin;

    // 3. Get Embed Details
    const detailsResp = await fetch(`${embedDomain}/api/videos/${byseId}/embed/details`, {
      headers: { "Referer": byseUrl, "X-Embed-Origin": "api.pomfy.stream", "User-Agent": USER_AGENT }
    });
    const details = await detailsResp.json();
    
    // 4. Fingerprint & Playback
    const ts = Math.floor(Date.now() / 1000);
    const fingerprint = {
      token: b64.encode(new TextEncoder().encode(JSON.stringify({
        viewer_id: "bed4fadd25c8dcdcaced26e318c3be5a",
        iat: ts,
        exp: ts + 600
      }))),
      viewer_id: "bed4fadd25c8dcdcaced26e318c3be5a"
    };

    const pbResp = await fetch(`${embedDomain}/api/videos/${byseId}/embed/playback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Referer": details.embed_frame_url, "User-Agent": USER_AGENT },
      body: JSON.stringify({ fingerprint })
    });

    const pbData = await pbResp.json();
    if (!pbData.playback) return [];

    // 5. Decrypt
    const playback = pbData.playback;
    const key = new Uint8Array([...b64.decode(playback.key_parts[0]), ...b64.decode(playback.key_parts[1])]);
    const cipher = new AES256GCM_Manual(key); 
    const decrypted = JSON.parse(cipher.decrypt(b64.decode(playback.iv), b64.decode(playback.payload).slice(0, -16)));

    const streamUrl = decrypted.url || decrypted.sources?.[0]?.url;

    if (streamUrl) {
      streams.push({
        name: "Pomfy 🚀",
        title: `Multi-Quality (Up to 4K)\nPrimary Server`,
        url: streamUrl.replace(/\\u0026/g, '&'),
        quality: 2160, // Marked as 2160 to prioritize in lists
        behaviorHints: {
          notInterchangeable: true,
          proxyHeaders: {
            "Referer": embedDomain,
            "User-Agent": USER_AGENT
          }
        }
      });
    }

  } catch (e) {
    console.error("Pomfy Error:", e.message);
  }

  return streams;
}

module.exports = { getStreams };
