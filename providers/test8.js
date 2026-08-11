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
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const DOMAINS_URL = "https://raw.githubusercontent.com/sapariyaneel/nuvio-plugin/refs/heads/main/domains.json";
const FALLBACK_BASE_URL = "https://vidrock.net";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  "Referer": "https://vidrock.net/",
  "Origin": "https://vidrock.net"
};
const STREAM_KEY_HEX = "7f3e9c2a8b5d1f4e6a9c3b7d2e5f8a1c4b6d9e2f5a8c1b4d7e9f2a5c8b1d4e7f";
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;
let cachedDomains = null;

function getDomains() {
  return __async(this, null, function* () {
    if (cachedDomains)
      return cachedDomains;
    try {
      const resp = yield fetch(DOMAINS_URL, { skipSizeCheck: true });
      cachedDomains = yield resp.json();
    } catch (e) {
      cachedDomains = {};
    }
    return cachedDomains;
  });
}

function getBaseUrl() {
  return __async(this, null, function* () {
    const d = yield getDomains();
    return (d.vidrock || FALLBACK_BASE_URL).replace(/\/+$/, "");
  });
}

const AES_SBOX = new Uint8Array(256);
const AES_RCON = [1, 2, 4, 8, 16, 32, 64, 128, 27, 54, 108, 216, 171, 77];
(function buildSbox() {
  const pow = new Uint8Array(256);
  const log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 256; i++) {
    pow[i] = x;
    log[x] = i;
    x = (x ^ x << 1 & 255 ^ (x & 128 ? 27 : 0)) & 255;
  }
  AES_SBOX[0] = 99;
  for (let i = 1; i < 256; i++) {
    const inverse = pow[(255 - log[i]) % 255];
    let s = inverse;
    let rotated = inverse;
    for (let k = 0; k < 4; k++) {
      rotated = (rotated << 1 | rotated >>> 7) & 255;
      s ^= rotated;
    }
    AES_SBOX[i] = (s ^ 99) & 255;
  }
})();

function gfMultiply(a, b) {
  let result = 0;
  while (b) {
    if (b & 1)
      result ^= a;
    a = (a << 1 ^ (a & 128 ? 27 : 0)) & 255;
    b >>= 1;
  }
  return result & 255;
}

function expandAesKey(key) {
  const words = key.length / 4;
  const rounds = words + 6;
  const schedule = new Uint8Array(16 * (rounds + 1));
  schedule.set(key);
  for (let i = words; i < 4 * (rounds + 1); i++) {
    let t0 = schedule[(i - 1) * 4];
    let t1 = schedule[(i - 1) * 4 + 1];
    let t2 = schedule[(i - 1) * 4 + 2];
    let t3 = schedule[(i - 1) * 4 + 3];
    if (i % words === 0) {
      const first = t0;
      t0 = AES_SBOX[t1] ^ AES_RCON[i / words - 1];
      t1 = AES_SBOX[t2];
      t2 = AES_SBOX[t3];
      t3 = AES_SBOX[first];
    } else if (words > 6 && i % words === 4) {
      t0 = AES_SBOX[t0];
      t1 = AES_SBOX[t1];
      t2 = AES_SBOX[t2];
      t3 = AES_SBOX[t3];
    }
    schedule[i * 4] = schedule[(i - words) * 4] ^ t0;
    schedule[i * 4 + 1] = schedule[(i - words) * 4 + 1] ^ t1;
    schedule[i * 4 + 2] = schedule[(i - words) * 4 + 2] ^ t2;
    schedule[i * 4 + 3] = schedule[(i - words) * 4 + 3] ^ t3;
  }
  return { schedule, rounds };
}

function aesEncryptBlock(state, keySchedule) {
  const schedule = keySchedule.schedule;
  const rounds = keySchedule.rounds;
  for (let i = 0; i < 16; i++)
    state[i] ^= schedule[i];
  for (let round = 1; round <= rounds; round++) {
    for (let i = 0; i < 16; i++)
      state[i] = AES_SBOX[state[i]];
    let tmp = state[1];
    state[1] = state[5];
    state[5] = state[9];
    state[9] = state[13];
    state[13] = tmp;
    tmp = state[2];
    state[2] = state[10];
    state[10] = tmp;
    tmp = state[6];
    state[6] = state[14];
    state[14] = tmp;
    tmp = state[15];
    state[15] = state[11];
    state[11] = state[7];
    state[7] = state[3];
    state[3] = tmp;
    if (round !== rounds) {
      for (let column = 0; column < 4; column++) {
        const o = column * 4;
        const a0 = state[o], a1 = state[o + 1], a2 = state[o + 2], a3 = state[o + 3];
        state[o] = gfMultiply(a0, 2) ^ gfMultiply(a1, 3) ^ a2 ^ a3;
        state[o + 1] = a0 ^ gfMultiply(a1, 2) ^ gfMultiply(a2, 3) ^ a3;
        state[o + 2] = a0 ^ a1 ^ gfMultiply(a2, 2) ^ gfMultiply(a3, 3);
        state[o + 3] = gfMultiply(a0, 3) ^ a1 ^ a2 ^ gfMultiply(a3, 2);
      }
    }
    for (let i = 0; i < 16; i++)
      state[i] ^= schedule[round * 16 + i];
  }
  return state;
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64UrlToBytes(str) {
  const normalized = str.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const out = new Uint8Array(Math.floor(normalized.length * 3 / 4));
  let accumulator = 0;
  let bits = 0;
  let outIndex = 0;
  for (let i = 0; i < normalized.length; i++) {
    const value = BASE64_CHARS.indexOf(normalized.charAt(i));
    if (value < 0)
      continue;
    accumulator = accumulator << 6 | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIndex++] = accumulator >> bits & 255;
    }
  }
  return out.subarray(0, outIndex);
}

function utf8BytesToString(bytes) {
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 128) {
      result += String.fromCharCode(b0);
    } else if ((b0 & 224) === 192) {
      const b1 = bytes[i++];
      result += String.fromCharCode((b0 & 31) << 6 | b1 & 63);
    } else if ((b0 & 240) === 224) {
      const b1 = bytes[i++], b2 = bytes[i++];
      result += String.fromCharCode((b0 & 15) << 12 | (b1 & 63) << 6 | b2 & 63);
    } else if ((b0 & 248) === 240) {
      const b1 = bytes[i++], b2 = bytes[i++], b3 = bytes[i++];
      let code = (b0 & 7) << 18 | (b1 & 63) << 12 | (b2 & 63) << 6 | b3 & 63;
      code -= 65536;
      result += String.fromCharCode(55296 + (code >> 10), 56320 + (code & 1023));
    } else {
      result += String.fromCharCode(b0);
    }
  }
  return result;
}

let cachedKeySchedule = null;
function decryptStreamUrl(encoded) {
  const all = base64UrlToBytes(encoded);
  if (all.length <= GCM_IV_LENGTH + GCM_TAG_LENGTH)
    throw new Error("ciphertext too short");
  if (!cachedKeySchedule)
    cachedKeySchedule = expandAesKey(hexToBytes(STREAM_KEY_HEX));
  const body = all.subarray(GCM_IV_LENGTH, all.length - GCM_TAG_LENGTH);
  const plain = new Uint8Array(body.length);
  const counterBlock = new Uint8Array(16);
  counterBlock.set(all.subarray(0, GCM_IV_LENGTH), 0);
  let counter = 2;
  for (let offset = 0; offset < body.length; offset += 16) {
    counterBlock[12] = counter >>> 24 & 255;
    counterBlock[13] = counter >>> 16 & 255;
    counterBlock[14] = counter >>> 8 & 255;
    counterBlock[15] = counter & 255;
    const keystream = new Uint8Array(16);
    keystream.set(counterBlock);
    aesEncryptBlock(keystream, cachedKeySchedule);
    const blockLength = Math.min(16, body.length - offset);
    for (let i = 0; i < blockLength; i++)
      plain[offset + i] = body[offset + i] ^ keystream[i];
    counter++;
  }
  return utf8BytesToString(plain);
}

function getProviderEmoji(serverName) {
  const nameLower = String(serverName).toLowerCase();
  if (nameLower.includes("astra")) return "🪐";
  if (nameLower.includes("atlas")) return "🌀";
  if (nameLower.includes("orion")) return "🎯";
  return "🌍";
}

function buildDropdownMetadata(serverName, qualityLabel, mediaInfo, seasonNum, episodeNum, streamUrl) {
  let cleanServer = String(serverName).replace(/\s*(1080p\s+)?server\s*2\s*$/gi, "").trim();
  let normalizedQuality = qualityLabel.toLowerCase().trim() === "auto" ? "Auto" : qualityLabel;
  let qualityBadge = "💎 " + normalizedQuality;
  const lowQuality = normalizedQuality.toLowerCase();
  if (lowQuality.includes("2160") || lowQuality.includes("4k")) {
    qualityBadge = "🌟 2160p";
  } else if (lowQuality.includes("1080")) {
    qualityBadge = "🚀 1080p";
  } else if (lowQuality.includes("720")) {
    qualityBadge = "🛰️ 720p";
  } else if (lowQuality === "auto") {
    qualityBadge = "🛸 Auto";
  }
  const durationStr = mediaInfo.runtime || "90 min";
  const containerFormat = streamUrl.includes(".m3u8") ? "📡 M3U8" : "🎞️ MP4";
  const providerEmoji = getProviderEmoji(cleanServer);
  const yearStr = mediaInfo.year ? `(${mediaInfo.year})` : "N/A";
  
  let line1 = `🎬 ${mediaInfo.title || "Unknown"} - ${yearStr}`;
  if (seasonNum && episodeNum) {
    line1 += ` | S${seasonNum}E${episodeNum}`;
  }
  return line1 + "\n" + qualityBadge + " | 🌍 Original Audio | 🎧 AAC\n" + containerFormat + " | ⚡ x2.64 | ⏱️ " + durationStr + "\n" + providerEmoji + " " + cleanServer + " | 🔗 Provider: VidRock";
}

function fetchTmdbDetails(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const endpoint = mediaType === "tv" ? "tv" : "movie";
      const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
      const res = yield fetch(url, { skipSizeCheck: true });
      if (!res.ok) return { title: "Unknown", year: "N/A", runtime: "90 min" };
      const data = yield res.json();

      let runtimeMinutes = data.runtime;
      if (mediaType === "tv") {
        try {
          const epUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season || 1}/episode/${episode || 1}?api_key=${TMDB_API_KEY}`;
          const epRes = yield fetch(epUrl, { skipSizeCheck: true });
          if (epRes.ok) {
            const epData = yield epRes.json();
            if (epData.runtime) runtimeMinutes = epData.runtime;
          }
        } catch (e) {}
      }

      const finalRuntime = runtimeMinutes ? `${runtimeMinutes} min` : (mediaType === "tv" ? "45 min" : "90 min");
      return {
        title: mediaType === "tv" ? data.name : data.title,
        year: (mediaType === "tv" ? data.first_air_date : data.release_date || "").substring(0, 4),
        runtime: finalRuntime
      };
    } catch (e) {
      return { title: "Unknown", year: "N/A", runtime: "90 min" };
    }
  });
}

function qualityLabelFromResolution(width, height) {
  if (width >= 3200 || height >= 2e3)
    return "4K";
  if (width >= 2400 || height >= 1400)
    return "1440p";
  if (width >= 1800 || height >= 1e3)
    return "1080p";
  if (width >= 1200 || height >= 700)
    return "720p";
  if (width >= 800 || height >= 460)
    return "480p";
  if (width >= 600 || height >= 340)
    return "360p";
  if (width > 0 || height > 0)
    return "240p";
  return "Unknown";
}

function qualityRank(quality) {
  if (quality === "4K" || quality === "2160p")
    return 2160;
  const n = parseInt(quality, 10);
  return Number.isFinite(n) ? n : 0;
}

function resolveUrl(line, baseUrl) {
  try {
    return new URL(line, baseUrl).toString();
  } catch (e) {
    return line;
  }
}

function parseMasterTopVariant(text, baseUrl) {
  const lines = text.split("\n").map((l) => l.trim());
  let best = null;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXT-X-STREAM-INF"))
      continue;
    const urlLine = lines[i + 1];
    if (!urlLine || urlLine.startsWith("#"))
      continue;
    const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
    const resolutionMatch = lines[i].match(/RESOLUTION=(\d+)x(\d+)/);
    const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0;
    const width = resolutionMatch ? parseInt(resolutionMatch[1], 10) : 0;
    const height = resolutionMatch ? parseInt(resolutionMatch[2], 10) : 0;
    if (!best || bandwidth > best.bandwidth) {
      best = { url: resolveUrl(urlLine, baseUrl), bandwidth, width, height };
    }
  }
  return best;
}

function buildStream(serverName, entry, mediaInfo, season, episode) {
  return __async(this, null, function* () {
    try {
      const masterUrl = decryptStreamUrl(entry.url);
      if (!/^https?:\/\//i.test(masterUrl))
        return null;
      const resp = yield fetch(masterUrl, { headers: HEADERS, skipSizeCheck: true });
      if (!resp.ok)
        return null;
      const topVariant = parseMasterTopVariant(yield resp.text(), masterUrl);
      if (!topVariant)
        return null;
      const quality = qualityLabelFromResolution(topVariant.width, topVariant.height);
      
      let cleanServer = String(serverName).replace(/\s*(1080p\s+)?server\s*2\s*$/gi, "").trim();
      const pEmoji = getProviderEmoji(cleanServer);
      const dropdownTitle = buildDropdownMetadata(serverName, quality, mediaInfo, season, episode, masterUrl);

      return {
        name: `🪨 VidRock | ${quality} | ${pEmoji} [${cleanServer}]`,
        title: dropdownTitle,
        size: dropdownTitle,
        description: dropdownTitle,
        url: masterUrl,
        quality: "",
        language: "",
        headers: HEADERS,
        provider: "vidrock",
        subtitles: [],
        _serverKey: serverName,
        _rawQuality: quality
      };
    } catch (e) {
      return null;
    }
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      let numericTmdbId = tmdbId;
      if (typeof tmdbId === "string" && tmdbId.trim().toLowerCase().startsWith("tt")) {
        const findUrl = `https://api.themoviedb.org/3/find/${tmdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const findData = yield (yield fetch(findUrl, { skipSizeCheck: true })).json();
        const results = mediaType === "tv" ? findData.tv_results : findData.movie_results;
        numericTmdbId = results && results.length ? results[0].id : null;
        if (!numericTmdbId)
          return [];
      }
      numericTmdbId = parseInt(numericTmdbId, 10);
      if (!numericTmdbId)
        return [];
      const baseUrl = yield getBaseUrl();
      const isTv = mediaType === "tv";
      const path = isTv ? `tv/${numericTmdbId}/${season || 1}/${episode || 1}` : `movie/${numericTmdbId}`;
      const resp = yield fetch(`${baseUrl}/api/${path}`, { headers: HEADERS, skipSizeCheck: true });
      if (!resp.ok)
        return [];
      const data = yield resp.json().catch(() => null);
      if (!data || typeof data !== "object" || data.error)
        return [];
      const entries = Object.keys(data).map((name) => ({ name, entry: data[name] })).filter((e) => e.entry && typeof e.entry === "object" && e.entry.url);
      if (!entries.length)
        return [];

      const mediaInfo = yield fetchTmdbDetails(numericTmdbId, mediaType, season, episode);
      const resolved = yield Promise.all(entries.map((e) => buildStream(e.name, e.entry, mediaInfo, season, episode)));
      
      const seenUrls = {};
      const streams = [];
      for (const stream of resolved) {
        if (!stream || seenUrls[stream.url])
          continue;
        seenUrls[stream.url] = true;
        streams.push(stream);
      }
      streams.sort((a, b) => {
        const providerA = String(a._serverKey || "").toLowerCase();
        const providerB = String(b._serverKey || "").toLowerCase();
        if (providerA !== providerB) {
          return providerA.localeCompare(providerB);
        }
        return qualityRank(b._rawQuality) - qualityRank(a._rawQuality);
      });
      return streams;
    } catch (e) {
      console.error("[Vidrock]", e);
      return [];
    }
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
