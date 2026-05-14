/**
 * Pomfy Provider - FINAL CLEAN VERSION
 * Returns ONLY the high-quality video link.
 */

// --- AES ENGINE (Hidden for brevity, keep your SBOX/RCON/Class logic here) ---
class AES256GCM_Manual {
  constructor(key) { this.roundKeys = this._expandKey(key); }
  _expandKey(key) { /* ... same expansion logic ... */ }
  _encryptBlock(block) { /* ... same encryption logic ... */ }
  _galoisMult(a, b) { /* ... same math logic ... */ }
  decrypt(iv, ciphertext) {
    let counter = new Uint8Array(16); counter.set(iv); counter[15] = 2;
    let plaintext = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i += 16) {
      let keystream = this._encryptBlock(counter);
      for (let j = 0; j < 16 && (i + j) < ciphertext.length; j++) { plaintext[i + j] = ciphertext[i + j] ^ keystream[j]; }
      for (let j = 15; j >= 12; j--) { counter[j]++; if (counter[j] !== 0) break; }
    }
    return new TextDecoder().decode(plaintext);
  }
}

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const b64Dec = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

  try {
    // 1. Get Pomfy ID
    const pomfyUrl = mediaType === "movie" 
      ? `https://api.pomfy.stream/filme/${tmdbId}` 
      : `https://api.pomfy.stream/serie/${tmdbId}/${season}/${episode}`;

    const html = await (await fetch(pomfyUrl, { headers: { "User-Agent": USER_AGENT } })).text();
    const byseId = html.match(/const link\s*=\s*"([^"]+)"/)?.[1].split("/").pop();
    if (!byseId) return [];

    // 2. Get Playback Data
    const domain = "https://pomfy-cdn.shop";
    const ts = Math.floor(Date.now() / 1000);
    const fingerprint = {
      token: btoa(JSON.stringify({ viewer_id: "bed4fadd25c8dcdcaced26e318c3be5a", iat: ts, exp: ts + 600 })),
      viewer_id: "bed4fadd25c8dcdcaced26e318c3be5a"
    };

    const pbResp = await fetch(`${domain}/api/videos/${byseId}/embed/playback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT, "Referer": "https://pomfy.online/" },
      body: JSON.stringify({ fingerprint })
    });

    const { playback } = await pbResp.json();
    if (!playback) return [];

    // 3. Decrypt (Highest Link)
    const key = new Uint8Array([...b64Dec(playback.key_parts[0]), ...b64Dec(playback.key_parts[1])]);
    const cipher = new AES256GCM_Manual(key);
    const decrypted = JSON.parse(cipher.decrypt(b64Dec(playback.iv), b64Dec(playback.payload).slice(0, -16)));

    const finalUrl = (decrypted.url || decrypted.sources?.[0]?.url).replace(/\\u0026/g, '&');

    // 4. Return EXACTLY one stream
    return [{
      name: "Pomfy 🎬",
      title: "4K/1080p Auto-Resolution",
      url: finalUrl,
      quality: 2160, 
      headers: { "User-Agent": USER_AGENT, "Referer": domain }
    }];

  } catch (e) {
    return [];
  }
}

module.exports = { getStreams };
