/**
 * Pomfy Provider - FIXED HEADERS & CHALLENGE
 * Returns only the highest quality stream.
 */

// [Insert your AES256GCM_Manual class here]

async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";
  const b64Dec = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  
  try {
    // 1. Get the initial link from Pomfy API
    const pomfyUrl = mediaType === "movie" 
      ? `https://api.pomfy.stream/filme/${tmdbId}` 
      : `https://api.pomfy.stream/serie/${tmdbId}/${season}/${episode}`;

    const html = await (await fetch(pomfyUrl, { headers: { "User-Agent": USER_AGENT } })).text();
    const byseMatch = html.match(/const link\s*=\s*"([^"]+)"/);
    if (!byseMatch) return [];

    const byseUrl = byseMatch[1];
    const byseId = byseUrl.split("/").pop();
    const embedDomain = "https://pomfy-cdn.shop";

    // 2. REQUIRED: Solve the Access Challenge
    // This 'primes' the session so the playback API doesn't return 403
    await fetch(`${embedDomain}/api/videos/access/challenge`, {
      method: 'POST',
      headers: {
        'Origin': embedDomain,
        'Referer': byseUrl,
        'User-Agent': USER_AGENT
      }
    });

    // 3. Request Playback with Full Security Headers
    const ts = Math.floor(Date.now() / 1000);
    const fingerprint = {
      token: btoa(JSON.stringify({
        viewer_id: "bed4fadd25c8dcdcaced26e318c3be5a",
        device_id: "b69c7e41fe010d4445b827dd95aa89fc",
        iat: ts,
        exp: ts + 600
      })),
      viewer_id: "bed4fadd25c8dcdcaced26e318c3be5a"
    };

    const pbResp = await fetch(`${embedDomain}/api/videos/${byseId}/embed/playback`, {
      method: "POST",
      headers: {
        "Accept": "*/*",
        "Content-Type": "application/json",
        "Origin": embedDomain,
        "Referer": byseUrl, // Critical referer
        "X-Embed-Origin": "api.pomfy.stream",
        "X-Embed-Parent": byseUrl,
        "User-Agent": USER_AGENT
      },
      body: JSON.stringify({ fingerprint })
    });

    const pbData = await pbResp.json();
    if (!pbData.playback) return [];

    // 4. Decrypt the Payload
    const pb = pbData.playback;
    const key = new Uint8Array([...b64Dec(pb.key_parts[0]), ...b64Dec(pb.key_parts[1])]);
    const cipher = new AES256GCM_Manual(key);
    const decryptedJson = cipher.decrypt(b64Dec(pb.iv), b64Dec(pb.payload).slice(0, -16));
    const decrypted = JSON.parse(decryptedJson);

    const finalUrl = (decrypted.url || decrypted.sources?.[0]?.url || decrypted.data?.sources?.[0]?.url);
    if (!finalUrl) return [];

    // 5. Final clean stream entry
    return [{
      name: "Pomfy | 4K-1080p",
      title: mediaType === "movie" ? "Movie" : `S${season} E${episode}`,
      url: finalUrl.replace(/\\u0026/g, '&'),
      quality: 2160,
      headers: {
        "User-Agent": USER_AGENT,
        "Referer": embedDomain,
        "Origin": embedDomain
      }
    }];

  } catch (error) {
    console.error("Stream Fetch Failed:", error.message);
    return [];
  }
}

module.exports = { getStreams };
