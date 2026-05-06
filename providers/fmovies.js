/**
 * Embed69 Provider - Nuvio Next-Gen (v1.2.7)
 * FINAL CORE: Parallel Speed + Legacy Accuracy + Native Bypass
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

function unpack(code) {
  try {
    const match = code.match(/eval\(function\(p,a,c,k,e,[rd]\)\{.*?\}\s*\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/);
    if (!match) return code;
    let [, p, a, c, k] = match;
    a = parseInt(a); c = parseInt(c);
    let kArr = k.split("|");
    return p.replace(/\b\w+\b/g, (e) => kArr[parseInt(e, a)] || e);
  } catch (e) { return code; }
}

function safeAtob(input) {
  if (!input) return "";
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = String(input).replace(/=+$/, '').replace(/[\s\n\r\t]/g, '');
  let output = '';
  if (str.length % 4 === 1) return '';
  for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

function voeDecode(encText) {
  try {
    let decoded = encText.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      const limit = c <= "Z" ? 90 : 122;
      const shifted = code + 13;
      return String.fromCharCode(limit >= shifted ? shifted : shifted - 26);
    });
    const noise = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
    for (const n of noise) decoded = decoded.split(n).join("");
    const b64_1 = safeAtob(decoded);
    if (!b64_1) return null;
    let shiftedStr = "";
    for (let j = 0; j < b64_1.length; j++) shiftedStr += String.fromCharCode(b64_1.charCodeAt(j) - 3);
    const decrypted = safeAtob(shiftedStr.split("").reverse().join(""));
    return decrypted ? JSON.parse(decrypted) : null;
  } catch (e) { return null; }
}

async function resolveVoe(url) {
  try {
    let res = await fetch(url, { headers: { "User-Agent": UA, "Referer": url } });
    let html = await res.text();
    if (html.includes("window.location.href") && html.length < 2000) {
      const rm = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
      if (rm) return resolveVoe(rm[1]);
    }
    const jsonMatch = html.match(/<script type="application\/json">([\s\S]*?)<\/script>/);
    if (jsonMatch) {
      let data = JSON.parse(jsonMatch[1].trim());
      if (Array.isArray(data)) data = data[0];
      const decoded = voeDecode(data);
      if (decoded && decoded.source) return { url: decoded.source, quality: "1080p", headers: { "User-Agent": UA, "Referer": url } };
    }
    const m3u8 = html.match(/["'](https?:\/\/[^"']+?\.m3u8[^"']*?)["']/i);
    if (m3u8 && !m3u8[1].includes("test-videos")) return { url: m3u8[1], quality: "Auto", headers: { "User-Agent": UA, "Referer": url } };
    return null;
  } catch (e) { return null; }
}

async function resolveStreamwish(url) {
  const domains = ["vibuxer.com", "awish.pro", "dwish.pro", "streamwish.to", "embedwish.com", "strish.com", "wishembed.pro"];
  for (const domain of domains) {
    try {
      const res = await fetch(url.replace(/[^/]+\.(?:com|to|pro|net|org)/, domain), { headers: { "User-Agent": UA, "Referer": "https://embed69.org/" } });
      if (!res.ok) continue;
      let html = await res.text();
      if (html.includes("eval(function")) html += "\n" + unpack(html);
      const m3u8 = html.match(/(?:file|source|src|hls)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/i) || html.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
      if (m3u8) return { url: m3u8[1] || m3u8[0], quality: "Auto", headers: { "User-Agent": UA, "Referer": `https://${domain}/` } };
    } catch (e) { }
  }
  return null;
}

async function resolveFilemoon(url) {
  try {
    const videoId = url.split("/").pop();
    const domain = new URL(url).origin;
    const details = await (await fetch(`${domain}/api/videos/${videoId}/embed/details`, { headers: { "User-Agent": UA } })).json();
    if (details.embed_frame_url) {
      const pbDomain = new URL(details.embed_frame_url).origin;
      const challenge = await (await fetch(`${pbDomain}/api/videos/access/challenge`, { method: 'POST', headers: { "Referer": details.embed_frame_url, "Origin": pbDomain, "User-Agent": UA } })).json();
      const sig = typeof __crypto_ecdsa_sign_secp256r1 === "function" ? __crypto_ecdsa_sign_secp256r1(challenge.nonce) : "{}";
      const attestJson = JSON.parse(sig);
      if (attestJson.signature) {
        const uuid = () => 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => (c == 'x' ? Math.random() * 16 | 0 : (Math.random() * 16 | 0 & 0x3 | 0x8)).toString(16));
        const vId = uuid(); const dId = uuid();
        const attestRes = await (await fetch(`${pbDomain}/api/videos/access/attest`, {
          method: 'POST', headers: { "Content-Type": "application/json", "Referer": details.embed_frame_url, "Origin": pbDomain, "User-Agent": UA },
          body: JSON.stringify({
            viewer_id: vId, device_id: dId, challenge_id: challenge.challenge_id, nonce: challenge.nonce,
            signature: attestJson.signature, public_key: { crv: "P-256", ext: true, key_ops: ["verify"], kty: "EC", x: attestJson.x, y: attestJson.y },
            client: { user_agent: UA, platform: "Windows", platform_version: "10.0.0" },
            storage: { cookie: vId, local_storage: vId, indexed_db: `${vId}:${dId}`, cache_storage: `${vId}:${dId}` }, attributes: { entropy: "high" }
          })
        })).json();
        const pbRes = await (await fetch(`${pbDomain}/api/videos/${videoId}/embed/playback`, {
          method: 'POST', headers: { "Content-Type": "application/json", "Referer": details.embed_frame_url, "Origin": pbDomain, "User-Agent": UA, "X-Embed-Parent": url },
          body: JSON.stringify({ fingerprint: { token: attestRes.token, viewer_id: attestRes.viewer_id || vId, device_id: attestRes.device_id || dId, confidence: attestRes.confidence } })
        })).json();
        const dec = typeof __crypto_aes_gcm_decrypt === "function" ? __crypto_aes_gcm_decrypt(JSON.stringify(pbRes.playback.key_parts), pbRes.playback.iv, pbRes.playback.payload) : "";
        if (dec && !dec.includes("error")) {
          const final = JSON.parse(dec);
          return { url: final.sources[0].url, quality: final.sources[0].label || "1080p", headers: { "User-Agent": UA, "Referer": domain + "/", "Origin": domain } };
        }
      }
    }
    let html = await (await fetch(url, { headers: { "User-Agent": UA, "Referer": "https://embed69.org/" } })).text();
    if (html.includes("eval(function")) html += "\n" + unpack(html);
    const m3u8 = html.match(/(?:file|source|src|hls|url)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/i);
    if (m3u8) return { url: m3u8[1], quality: "Auto", headers: { "User-Agent": UA, "Referer": url } };
    return null;
  } catch (e) { return null; }
}

async function resolveVidhide(url) {
  try {
    let html = await (await fetch(url, { headers: { "User-Agent": UA, "Referer": "https://embed69.org/" } })).text();
    if (html.includes("eval(function")) html += "\n" + unpack(html);
    const m3u8 = html.match(/(?:file|source|src|hls)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/i) || html.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/i);
    if (m3u8) return { url: m3u8[1] || m3u8[0], quality: "1080p", headers: { "User-Agent": UA, "Referer": new URL(url).origin + "/" } };
    return null;
  } catch (e) { return null; }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    // Modo Nitro: Detectar si la App envió el "Súper ID" (tmdb|imdb)
    let cleanId = String(tmdbId).trim();
    let imdbId = null;

    if (cleanId.includes("|")) {
      const parts = cleanId.split("|");
      cleanId = parts[0];
      if (parts[1] && parts[1].startsWith("tt")) {
        imdbId = parts[1];
        console.log(`[Embed69] Modo Nitro: Usando IMDB ID directo: ${imdbId}`);
      }
    }

    // Normalización estándar si no hay IMDB ID directo
    cleanId = cleanId.replace(/^tmdb:/, "").replace(/^series:/, "").replace(/^movie:/, "")
      .split(":")[0].split("/")[0];

    const type = ["movie", "film"].includes(String(mediaType).toLowerCase()) ? "movie" : "tv";
    console.log(`[Embed69] Buscando: ${type} | ID:${cleanId} | S:${season} E:${episode}`);

    if (!imdbId) {
      imdbId = cleanId.startsWith("tt") ? cleanId : null;
      if (!imdbId) {
        try {
          const res0 = await fetch(`https://api.themoviedb.org/3/${type}/${cleanId}/external_ids?api_key=439c478a771f35c05022f9feabcca01c`);
          const tmdbData = await res0.json();
          imdbId = tmdbData.imdb_id;
        } catch (e) {
          console.log(`[Embed69] Error TMDB: ${e.message}`);
        }
      }
    }

    if (!imdbId) {
      console.log(`[Embed69] No se pudo obtener IMDB ID.`);
      return [];
    }

    const urlId = (type === "tv" && season) ? `${imdbId}-${season}x${String(episode).padStart(2, "0")}` : imdbId;
    const targetUrl = `https://embed69.org/f/${urlId}`;
    console.log(`[Embed69] URL Objetivo: ${targetUrl}`);

    const response = await fetch(targetUrl, { headers: { "User-Agent": UA } });
    const html = await response.text();
    const match = html.match(/dataLink\s*=\s*([\[\{][\s\S]*?[\]\}]);/);

    if (!match) {
      console.log(`[Embed69] No se encontró dataLink.`);
      return [];
    }

    let data = JSON.parse(match[1]);
    if (!Array.isArray(data)) {
      data = Object.keys(data).map(k => ({ video_language: k, sortedEmbeds: data[k] }));
    }

    const lat = data.find(i => ["LAT", "LATINO"].includes(String(i.video_language).toUpperCase()));
    if (!lat) {
      console.log(`[Embed69] Sin enlaces en Latino.`);
      return [];
    }

    const embedsToResolve = lat.sortedEmbeds.filter(e => e.link && e.servername !== "download").map(embed => {
      const b64 = embed.link.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(safeAtob(b64));
      return { server: embed.servername.toLowerCase(), url: payload.link };
    });

    console.log(`[Embed69] Resolviendo ${embedsToResolve.length} servidores en paralelo... 🚀`);

    // Si el motor nativo está disponible, pre-descargamos todos los HTMLs a la vez
    // y los guardamos en un caché que los resolvers usarán automáticamente
    if (typeof __native_batch_fetch === "function") {
      try {
        const requests = embedsToResolve.map(e => ({ url: e.url }));
        const rawJson = __native_batch_fetch(JSON.stringify(requests));
        const htmlResults = JSON.parse(rawJson); // [{url, html, ok}, ...]

        // Guardar en caché global para que el fetch interceptado lo use
        const _htmlCache = {};
        for (const r of htmlResults) {
          if (r.ok && r.html) _htmlCache[r.url] = r.html;
        }

        // Interceptar fetch temporalmente para servir el caché pre-descargado
        const _originalFetch = globalThis.fetch;
        globalThis.fetch = async (url, opts) => {
          const key = typeof url === 'string' ? url : url.toString();
          if (_htmlCache[key]) {
            const cachedHtml = _htmlCache[key];
            // Crear respuesta sintética compatible con la API fetch
            return {
              ok: true, status: 200,
              text: async () => cachedHtml,
              json: async () => JSON.parse(cachedHtml),
              headers: new Map([['content-type', 'text/html']])
            };
          }
          // Si no está en caché, usa el fetch real
          return _originalFetch(url, opts);
        };

        // Procesar cada embed con su HTML ya descargado (en paralelo)
        // Usamos await Promise.all para que la función NO termine antes de tiempo
        const parallelResults = await Promise.all(embedsToResolve.map(async embed => {
          const sName = embed.server;
          const fetched = htmlMap[embed.url];
          if (!fetched || !fetched.ok || !fetched.html) return null;
          try {
            let res = null;
            if (sName === "filemoon") res = await resolveFilemoon(embed.url, fetched.html);
            else if (sName === "voe") res = await resolveVoe(embed.url, fetched.html);
            else if (sName === "streamwish") res = await resolveStreamwish(embed.url, fetched.html);
            else if (sName === "vidhide") res = await resolveVidhide(embed.url, fetched.html);
            if (res) {
              const item = { name: sName, language: "Latino", quality: res.quality || "HD", url: res.url, headers: res.headers };
              // Enviamos el resultado a la App de inmediato para que aparezca en pantalla
              if (typeof __yield_result === "function") __yield_result(JSON.stringify(item));
              return item;
            }
          } catch (e) {
            console.log(`[Embed69] Error resolviendo ${sName}: ${e.message}`);
          }
          return null;
        }));

        const finalResults = parallelResults.filter(Boolean);
        console.log(`[Embed69] Resolución nativa completada: ${finalResults.length} resultados.`);
        return finalResults;
      } catch (e) {
        console.log(`[Embed69] Error en batch nativo: ${e.message}. Cayendo a modo estándar.`);
      }
    }

    // Fallback secuencial si no hay motor nativo
    const results = [];
    for (const embed of embedsToResolve) {
      try {
        const sName = embed.server;
        let res = null;
        if (sName === "filemoon") res = await resolveFilemoon(embed.url);
        else if (sName === "voe") res = await resolveVoe(embed.url);
        else if (sName === "streamwish") res = await resolveStreamwish(embed.url);
        else if (sName === "vidhide") res = await resolveVidhide(embed.url);

        if (res) {
          const item = { name: sName, language: "Latino", quality: res.quality || "HD", url: res.url, headers: res.headers };
          if (typeof __yield_result === "function") __yield_result(JSON.stringify(item));
          results.push(item);
        }
      } catch (e) { }
    }
    return results;
  } catch (e) {
    console.log(`[Embed69] Error Crítico: ${e.message}`);
    return [];
  }
}

module.exports = { getStreams };
;
