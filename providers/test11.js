// goated.js - Full Integration: UI TV Fix + Zero-Width Sort + Goated Direct Extractor

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const DOMAINS_URL = "https://raw.githubusercontent.com/sapariyaneel/nuvio-plugin/refs/heads/main/domains.json";
const FALLBACK_API_HOST = "https://api.reallyfast.xyz";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Referer": "https://goated.cx/",
  "Origin": "https://goated.cx"
};

let cachedDomains = null;

async function getDomains() {
  if (cachedDomains) return cachedDomains;
  try {
    const resp = await fetch(DOMAINS_URL, { skipSizeCheck: true });
    cachedDomains = await resp.json();
  } catch (_) {
    cachedDomains = {};
  }
  return cachedDomains;
}

async function getApiHost() {
  const d = await getDomains();
  return (d["reallyfast"] || d["api.reallyfast.xyz"] || FALLBACK_API_HOST).replace(/\/+$/, "");
}

/* ========================================================================== */
/*                    ZERO-WIDTH INVERTED SORTING ENGINE                      */
/* ========================================================================== */

function getInvertedSortTag(val, maxBaseline = 999999) {
  const safeVal = Math.max(0, parseInt(val, 10) || 0);
  const inverted = Math.max(0, maxBaseline - safeVal);
  const binaryStr = inverted.toString(2).padStart(20, '0');
  return binaryStr.split('').map(bit => bit === '1' ? "\uFEFF" : "\u200B").join('');
}

function getQualityRank(res) {
  const clean = String(res || '').toLowerCase();
  if (clean.includes("2160") || clean.includes("4k") || clean.includes("uhd")) return 4;
  if (clean.includes("1080") || clean.includes("fhd") || clean.includes("fullhd")) return 3;
  if (clean.includes("720") || clean.includes("hd")) return 2;
  if (clean.includes("480") || clean.includes("sd") || clean.includes("360")) return 1;
  return 0;
}

function parseSizeToMB(sizeStr) {
  if (!sizeStr || sizeStr === "N/A" || sizeStr === "Unknown") return 0;
  const match = String(sizeStr).match(/([\d.]+)\s*(GB|MB)/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === "GB") return Math.floor(num * 1024);
  if (unit === "MB") return Math.floor(num);
  return 0;
}

/* ========================================================================== */
/*                           METADATA & HELPERS                               */
/* ========================================================================== */

function getResolutionEmoji(res) {
  const clean = String(res || '').toLowerCase();
  if (clean.includes("2160") || clean.includes("4k") || clean.includes("uhd")) return "🌟 4K";
  if (clean.includes("1080") || clean.includes("fhd")) return "🔥 1080p";
  if (clean.includes("720") || clean.includes("hd")) return "💎 720p";
  if (clean.includes("480") || clean.includes("sd")) return "📱 480p";
  return "📺 " + (res || "1080p");
}

const SHA256_K = [
  1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221,
  3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580,
  3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
  2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895,
  666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037,
  2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
  430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779,
  1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298
];

function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 128) {
      out.push(code);
    } else if (code < 2048) {
      out.push(192 | code >> 6, 128 | code & 63);
    } else if (code >= 55296 && code <= 56319 && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 56320 && next <= 57343) {
        const cp = 65536 + (code - 55296 << 10) + (next - 56320);
        out.push(240 | cp >> 18, 128 | cp >> 12 & 63, 128 | cp >> 6 & 63, 128 | cp & 63);
        i++;
      } else {
        out.push(224 | code >> 12, 128 | code >> 6 & 63, 128 | code & 63);
      }
    } else {
      out.push(224 | code >> 12, 128 | code >> 6 & 63, 128 | code & 63);
    }
  }
  return out;
}

function sha256Hex(input) {
  const bytes = utf8Bytes(input);
  const bitLen = bytes.length * 8;
  bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 4294967296);
  bytes.push(hi >>> 24 & 255, hi >>> 16 & 255, hi >>> 8 & 255, hi & 255);
  bytes.push(bitLen >>> 24 & 255, bitLen >>> 16 & 255, bitLen >>> 8 & 255, bitLen & 255);
  let h0 = 1779033703, h1 = 3144134277, h2 = 1013904242, h3 = 2773480762;
  let h4 = 1359893119, h5 = 2600822924, h6 = 528734635, h7 = 1541459225;
  const w = new Array(64);
  for (let pos = 0; pos < bytes.length; pos += 64) {
    for (let i = 0; i < 16; i++) {
      const j = pos + i * 4;
      w[i] = (bytes[j] << 24 | bytes[j + 1] << 16 | bytes[j + 2] << 8 | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      const s0 = ((x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ x >>> 3) >>> 0;
      const s1 = ((y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ y >>> 10) >>> 0;
      w[i] = (w[i - 16] + s0 >>> 0) + (w[i - 7] + s1 >>> 0) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) >>> 0;
      const ch = (e & f ^ ~e & g) >>> 0;
      const temp1 = ((h + S1 >>> 0) + ch >>> 0) + (SHA256_K[i] + w[i] >>> 0) >>> 0;
      const S0 = ((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) >>> 0;
      const maj = (a & b ^ a & c ^ b & c) >>> 0;
      const temp2 = S0 + maj >>> 0;
      h = g; g = f; f = e;
      e = d + temp1 >>> 0;
      d = c; c = b; b = a;
      a = temp1 + temp2 >>> 0;
    }
    h0 = h0 + a >>> 0; h1 = h1 + b >>> 0; h2 = h2 + c >>> 0; h3 = h3 + d >>> 0;
    h4 = h4 + e >>> 0; h5 = h5 + f >>> 0; h6 = h6 + g >>> 0; h7 = h7 + h >>> 0;
  }
  const parts = [h0, h1, h2, h3, h4, h5, h6, h7];
  let hex = "";
  for (const p of parts) hex += ("00000000" + p.toString(16)).slice(-8);
  return hex;
}

async function solveProofOfWork(apiHost) {
  const resp = await fetch(`${apiHost}/api/challenge`, { skipSizeCheck: true });
  if (!resp.ok) throw new Error("failed to fetch PoW challenge");
  const { challenge, difficulty } = await resp.json();
  const target = "0".repeat(difficulty);
  for (let nonce = 0; nonce < 5000000; nonce++) {
    const hash = sha256Hex(challenge + nonce);
    if (hash.startsWith(target)) return { challenge, nonce: String(nonce) };
  }
  throw new Error("PoW solve timed out");
}

async function getTmdbRuntimeSeconds(tmdbId, mediaType, season, episode) {
  try {
    const url = mediaType === "tv" ? `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season || 1}/episode/${episode || 1}?api_key=${TMDB_API_KEY}` : `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const resp = await fetch(url, { skipSizeCheck: true });
    if (!resp.ok) return null;
    const data = await resp.json();
    const minutes = data.runtime || data.episode_run_time?.[0];
    return minutes ? minutes * 60 : null;
  } catch (_) {
    return null;
  }
}

async function getTmdbMetadata(tmdbId, mediaType) {
  try {
    const type = mediaType === "tv" ? "tv" : "movie";
    const resp = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`, { skipSizeCheck: true });
    const meta = await resp.json();
    const title = type === "tv" ? meta.name : meta.title;
    const releaseDate = type === "tv" ? meta.first_air_date : meta.release_date;
    const year = releaseDate ? releaseDate.split("-")[0] : "";
    return { title, year };
  } catch (_) {
    return { title: "", year: "" };
  }
}

function formatBytes(bytes) {
  if (!bytes) return "Unknown";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function resolveUrl(urlLine, baseUrl) {
  try {
    return new URL(urlLine, baseUrl).toString();
  } catch (_) {
    return urlLine;
  }
}

function parseMasterPlaylist(text, baseUrl) {
  const lines = text.split("\n").map((l) => l.trim());
  const variants = [];
  let defaultAudioUrl = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#EXT-X-MEDIA") && lines[i].includes("TYPE=AUDIO") && !defaultAudioUrl) {
      const uriMatch = lines[i].match(/URI="([^"]+)"/);
      const isDefault = /DEFAULT=YES/.test(lines[i]);
      if (uriMatch && (isDefault || !defaultAudioUrl))
        defaultAudioUrl = resolveUrl(uriMatch[1], baseUrl);
      continue;
    }
    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
    const attrLine = lines[i];
    const urlLine = lines[i + 1];
    if (!urlLine || urlLine.startsWith("#")) continue;
    const bandwidthMatch = attrLine.match(/BANDWIDTH=(\d+)/);
    const resolutionMatch = attrLine.match(/RESOLUTION=(\d+)x(\d+)/);
    const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0;
    const height = resolutionMatch ? parseInt(resolutionMatch[2], 10) : 0;
    variants.push({ url: resolveUrl(urlLine, baseUrl), bandwidth, height });
  }
  return { variants, defaultAudioUrl };
}

async function getAudioBitrateBps(audioPlaylistUrl) {
  if (!audioPlaylistUrl) return 0;
  try {
    const text = await (await fetch(audioPlaylistUrl, { skipSizeCheck: true })).text();
    const match = text.match(/#EXT-X-BITRATE:(\d+)/);
    return match ? parseInt(match[1], 10) * 1000 : 0;
  } catch (_) {
    return 0;
  }
}

function qualityLabelFromHeight(height) {
  if (height >= 2000) return "4K";
  if (height <= 0) return "Unknown";
  return `${height}p`;
}

/* ========================================================================== */
/*                          STREAM LAYOUT ENGINE                              */
/* ========================================================================== */

function makeStream(url, quality, displaySize, title, year, subtitles) {
  const qualityRank = getQualityRank(quality);
  const sizeInMB = parseSizeToMB(displaySize);
  
  // Zero-Width Sort Tag
  const sortTag = getInvertedSortTag((qualityRank * 100000) + sizeInMB, 999999);

  // Clean values
  const lineResTag = getResolutionEmoji(quality);
  const cleanTitle = (title || "").replace(/[^a-zA-Z0-9]/g, ".");
  const filenameStr = `${cleanTitle}.${year || '2026'}.${quality}.WEB-DL.Multi-Audio.AAC.MKV.MSubs`;

  // Layout lines
  const line1 = `🎬 ${title}${year ? ` (${year})` : ""}`;
  const line2 = `${lineResTag} | 🗣️ Multi-Audio | 💾 ${displaySize}`;
  const line3 = `🎞️ MKV | ✨ H.264 | 🎧 AAC`;
  const line4 = `🌐 Goated | 📦 Adaptive HLS`;
  const line5 = filenameStr;

  // Assembly (Android TV and Mobile Layout Parity)
  const headerLayout = `${sortTag}Goated • ${quality} • Adaptive`;
  const fullLayout = [line1, line2, line3, line4, line5].join("\n");

  return {
    qualityRank,
    sizeInMB,
    data: {
      name: headerLayout,
      title: fullLayout,
      size: fullLayout,
      description: fullLayout,
      url: url,
      headers: HEADERS,
      subtitles: subtitles,
      behaviorHints: {
        notWebReady: true,
        proxyHeaders: {
          request: HEADERS
        }
      }
    }
  };
}

/* ========================================================================== */
/*                           MAIN PROVIDER LOGIC                              */
/* ========================================================================== */

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    let numericTmdbId = tmdbId;
    if (typeof tmdbId === "string" && tmdbId.trim().toLowerCase().startsWith("tt")) {
      const findUrl = `https://api.themoviedb.org/3/find/${tmdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      const findData = await (await fetch(findUrl, { skipSizeCheck: true })).json();
      const results = mediaType === "tv" ? findData.tv_results : findData.movie_results;
      numericTmdbId = results && results.length ? results[0].id : null;
      if (!numericTmdbId) return [];
    }
    numericTmdbId = parseInt(numericTmdbId, 10);
    if (!numericTmdbId) return [];

    const { title, year } = await getTmdbMetadata(numericTmdbId, mediaType);
    const apiHost = await getApiHost();
    const isTv = mediaType === "tv";
    
    const resolvePow = await solveProofOfWork(apiHost);
    const resolveBody = {
      mediaType: isTv ? "tv" : "movie",
      id: String(numericTmdbId),
      challenge: resolvePow.challenge,
      nonce: resolvePow.nonce
    };
    if (isTv) {
      resolveBody.season = season || 1;
      resolveBody.episode = episode || 1;
    }

    const resolveResp = await fetch(`${apiHost}/api/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resolveBody),
      skipSizeCheck: true
    });
    if (!resolveResp.ok) return [];

    const resolveData = await resolveResp.json().catch(() => null);
    if (!resolveData || !resolveData.url) return [];

    const playlistResp = await fetch(resolveData.url, { skipSizeCheck: true });
    if (!playlistResp.ok) return [];

    const playlistText = await playlistResp.text();
    const { variants, defaultAudioUrl } = parseMasterPlaylist(playlistText, resolveData.url);
    if (!variants.length) return [];

    const topVariant = variants.slice().sort((a, b) => b.height - a.height)[0];
    const [runtimeSeconds, audioBitrateBps] = await Promise.all([
      getTmdbRuntimeSeconds(numericTmdbId, mediaType, season, episode),
      getAudioBitrateBps(defaultAudioUrl)
    ]);

    let subtitles = [];
    try {
      const subPow = await solveProofOfWork(apiHost);
      const subBody = {
        mediaType: isTv ? "tv" : "movie",
        id: String(numericTmdbId),
        challenge: subPow.challenge,
        nonce: subPow.nonce
      };
      if (isTv) {
        subBody.season = season || 1;
        subBody.episode = episode || 1;
      }
      const subResp = await fetch(`${apiHost}/api/subtitles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subBody),
        skipSizeCheck: true
      });
      if (subResp.ok) {
        const subData = await subResp.json().catch(() => null);
        subtitles = (subData && subData.subtitles || [])
          .filter((s) => s && s.url)
          .map((s) => ({ url: s.url, lang: s.label || s.language || "Unknown" }));
      }
    } catch (_) {}

    const totalBitrateBps = topVariant.bandwidth + audioBitrateBps;
    const quality = qualityLabelFromHeight(topVariant.height);
    const displaySize = runtimeSeconds ? formatBytes(totalBitrateBps * runtimeSeconds / 8) : "Unknown";

    const streamObj = makeStream(
      resolveData.url,
      quality,
      displaySize,
      title || "Unknown Title",
      year || "2026",
      subtitles
    );

    return [streamObj.data];
  } catch (e) {
    console.error("[Goated]", e);
    return [];
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
