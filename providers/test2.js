/**
 * 1shows - Built from src/1shows/
 * Updated for TV compatibility:
 * - Removed invisible sorting characters.
 * - Removed strict headers and user-agents in the stream return.
 * - Removed custom MIME 'type' injection (letting Stremio handle 'movie'/'series').
 * - Added notWebReady behavior hint.
 */
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

// src/1shows/index.js
var SITE_URL = "https://www.1shows.org";
var API_URL = "https://api.viduki.net";
var TMDB_URL = "https://api.themoviedb.org/3";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
var API_HEADERS = {
  Accept: "application/json",
  Origin: SITE_URL,
  Referer: `${SITE_URL}/`,
  "User-Agent": USER_AGENT
};
var PAGE_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  Referer: `${SITE_URL}/`,
  "User-Agent": USER_AGENT
};
var DOWNLOAD_KEY_HEX = "7a03086357a2147dab4d757e8ed2ff8b5dc8707ee3d473afcb80d97727afa191";

function fetchJson(url, options) {
  return __async(this, null, function* () {
    const response = yield fetch(url, options);
    if (!response.ok)
      throw new Error(`HTTP ${response.status}: ${url}`);
    return response.json();
  });
}

function fetchText(url, options) {
  return __async(this, null, function* () {
    const request = Object.assign({}, options || {}, {
      skipSizeCheck: true,
      cfKiller: true
    });
    let response = yield fetch(url, request);
    if ((response.status === 403 || response.status === 503) && typeof globalThis.Cloudflare !== "undefined" && globalThis.Cloudflare.solve) {
      const solvedHeaders = yield globalThis.Cloudflare.solve(url);
      response = yield fetch(
        url,
        Object.assign({}, request, {
          headers: Object.assign({}, request.headers || {}, solvedHeaders || {})
        })
      );
    }
    if (!response.ok)
      throw new Error(`HTTP ${response.status}: ${url}`);
    return { html: yield response.text(), url: response.url || url };
  });
}

function absoluteUrl(value, base) {
  if (!value)
    return "";
  try {
    return new URL(value, base).toString();
  } catch (e) {
    return "";
  }
}

function decodeHtml(value) {
  return String(value || "").replace(/&amp;/gi, "&").replace(/&#0*39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function attribute(tag, name) {
  const match = String(tag || "").match(
    new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i")
  );
  return match ? decodeHtml(match[2]) : "";
}

function anchors(html, base) {
  const found = [];
  const pattern = /<a\b[^>]*>[\s\S]*?<\/a>/gi;
  let match;
  while (match = pattern.exec(String(html || ""))) {
    const href = absoluteUrl(attribute(match[0], "href"), base);
    if (href)
      found.push({ href, text: stripTags(match[0]) });
  }
  return found;
}

function hexToBytes(value) {
  const hex = String(value || "").trim();
  if (!hex || hex.length % 2)
    throw new Error("Invalid encrypted payload");
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    if (Number.isNaN(byte))
      throw new Error("Invalid encrypted payload");
    bytes[index] = byte;
  }
  return bytes;
}

function writeBytes(exports2, allocName, writeName, bytes) {
  const pointer = exports2[allocName](bytes.length);
  if (!pointer)
    throw new Error("1Shows decryptor allocation failed");
  if (exports2.memory) {
    new Uint8Array(exports2.memory.buffer, pointer, bytes.length).set(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      exports2[writeName](pointer + index, bytes[index]);
    }
  }
  return pointer;
}

function readBytes(exports2, readName, pointer, length) {
  if (exports2.memory) {
    return new Uint8Array(exports2.memory.buffer.slice(pointer, pointer + length));
  }
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = exports2[readName](pointer + index);
  }
  return bytes;
}

function joinBytes(first, second) {
  const joined = new Uint8Array(first.length + second.length);
  joined.set(first, 0);
  joined.set(second, first.length);
  return joined;
}

var AES_SBOX = new Uint8Array([
  99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171, 118, 202, 130, 201, 125, 250, 89, 71, 240, 173, 212, 162, 175, 156, 164, 114, 192, 183, 253, 147, 38, 54, 63, 247, 204, 52, 165, 229, 241, 113, 216, 49, 21, 4, 199, 35, 195, 24, 150, 5, 154, 7, 18, 128, 226, 235, 39, 178, 117, 9, 131, 44, 26, 27, 110, 90, 160, 82, 59, 214, 179, 41, 227, 47, 132, 83, 209, 0, 237, 32, 252, 177, 91, 106, 203, 190, 57, 74, 76, 88, 207, 208, 239, 170, 251, 67, 77, 51, 133, 69, 249, 2, 127, 80, 60, 159, 168, 81, 163, 64, 143, 146, 157, 56, 245, 188, 182, 218, 33, 16, 255, 243, 210, 205, 12, 19, 236, 95, 151, 68, 23, 196, 167, 126, 61, 100, 93, 25, 115, 96, 129, 79, 220, 34, 42, 144, 136, 70, 238, 184, 20, 222, 94, 11, 219, 224, 50, 58, 10, 73, 6, 36, 92, 194, 211, 172, 98, 145, 149, 228, 121, 231, 200, 55, 109, 141, 213, 78, 169, 108, 86, 244, 234, 101, 122, 174, 8, 186, 120, 37, 46, 28, 166, 180, 198, 232, 221, 116, 31, 75, 189, 139, 138, 112, 62, 181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 134, 193, 29, 158, 225, 248, 152, 17, 105, 217, 142, 148, 155, 30, 135, 233, 206, 85, 40, 223, 140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84, 187, 22
]);
var AES_RCON = new Uint8Array([0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54]);

function expandAes256Key(key) {
  if (key.length !== 32)
    throw new Error("Invalid AES-256 key");
  const expanded = new Uint8Array(240);
  expanded.set(key);
  let generated = 32;
  let rcon = 1;
  const temp = new Uint8Array(4);
  while (generated < expanded.length) {
    for (let i = 0; i < 4; i += 1)
      temp[i] = expanded[generated - 4 + i];
    if (generated % 32 === 0) {
      const first = temp[0];
      temp[0] = AES_SBOX[temp[1]] ^ AES_RCON[rcon++];
      temp[1] = AES_SBOX[temp[2]];
      temp[2] = AES_SBOX[temp[3]];
      temp[3] = AES_SBOX[first];
    } else if (generated % 32 === 16) {
      for (let i = 0; i < 4; i += 1)
        temp[i] = AES_SBOX[temp[i]];
    }
    for (let i = 0; i < 4 && generated < expanded.length; i += 1) {
      expanded[generated] = expanded[generated - 32] ^ temp[i];
      generated += 1;
    }
  }
  return expanded;
}

function aesXtime(value) {
  return (value << 1 ^ (value & 128 ? 27 : 0)) & 255;
}

function aesEncryptBlock(input, expandedKey) {
  const state = new Uint8Array(input);
  for (let i = 0; i < 16; i += 1)
    state[i] ^= expandedKey[i];
  for (let round = 1; round <= 14; round += 1) {
    for (let i = 0; i < 16; i += 1)
      state[i] = AES_SBOX[state[i]];
    const shifted = new Uint8Array(16);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        shifted[row + 4 * column] = state[row + 4 * (column + row & 3)];
      }
    }
    state.set(shifted);
    if (round < 14) {
      for (let column = 0; column < 4; column += 1) {
        const offset = column * 4;
        const a = state[offset];
        const b = state[offset + 1];
        const c = state[offset + 2];
        const d = state[offset + 3];
        const total = a ^ b ^ c ^ d;
        state[offset] ^= total ^ aesXtime(a ^ b);
        state[offset + 1] ^= total ^ aesXtime(b ^ c);
        state[offset + 2] ^= total ^ aesXtime(c ^ d);
        state[offset + 3] ^= total ^ aesXtime(d ^ a);
      }
    }
    const keyOffset = round * 16;
    for (let i = 0; i < 16; i += 1)
      state[i] ^= expandedKey[keyOffset + i];
  }
  return state;
}

function xorBlock(target, block) {
  for (let i = 0; i < 16; i += 1)
    target[i] ^= block[i];
}

function ghashMultiply(value, hashKey) {
  const result = new Uint8Array(16);
  const current = new Uint8Array(hashKey);
  for (let bit = 0; bit < 128; bit += 1) {
    if (value[bit >> 3] >> 7 - (bit & 7) & 1)
      xorBlock(result, current);
    const lowBit = current[15] & 1;
    for (let index = 15; index > 0; index -= 1) {
      current[index] = current[index] >>> 1 | (current[index - 1] & 1) << 7;
    }
    current[0] >>>= 1;
    if (lowBit)
      current[0] ^= 225;
  }
  return result;
}

function ghashUpdate(state, hashKey, bytes) {
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const block = new Uint8Array(16);
    block.set(bytes.subarray(offset, Math.min(offset + 16, bytes.length)));
    xorBlock(state, block);
    state.set(ghashMultiply(state, hashKey));
  }
}

function writeBitLength(block, offset, byteLength) {
  let bits = byteLength * 8;
  for (let index = 7; index >= 0; index -= 1) {
    block[offset + index] = bits & 255;
    bits = Math.floor(bits / 256);
  }
}

function incrementCounter(counter) {
  for (let index = 15; index >= 12; index -= 1) {
    counter[index] = counter[index] + 1 & 255;
    if (counter[index])
      break;
  }
}

function constantTimeEqual(first, second) {
  if (first.length !== second.length)
    return false;
  let difference = 0;
  for (let i = 0; i < first.length; i += 1)
    difference |= first[i] ^ second[i];
  return difference === 0;
}

function decryptDownloadPureJs(payload, token) {
  const key = hexToBytes(DOWNLOAD_KEY_HEX);
  const iv = hexToBytes(payload.iv);
  const ciphertext = hexToBytes(payload.ct);
  const expectedTag = hexToBytes(payload.tag);
  const additionalData = hexToBytes(token);
  if (iv.length !== 12 || expectedTag.length !== 16) {
    throw new Error("Unsupported 1Shows AES-GCM payload");
  }
  const expandedKey = expandAes256Key(key);
  const hashKey = aesEncryptBlock(new Uint8Array(16), expandedKey);
  const authState = new Uint8Array(16);
  ghashUpdate(authState, hashKey, additionalData);
  ghashUpdate(authState, hashKey, ciphertext);
  const lengths = new Uint8Array(16);
  writeBitLength(lengths, 0, additionalData.length);
  writeBitLength(lengths, 8, ciphertext.length);
  xorBlock(authState, lengths);
  authState.set(ghashMultiply(authState, hashKey));
  const initialCounter = new Uint8Array(16);
  initialCounter.set(iv);
  initialCounter[15] = 1;
  const authenticationTag = aesEncryptBlock(initialCounter, expandedKey);
  xorBlock(authenticationTag, authState);
  if (!constantTimeEqual(authenticationTag, expectedTag)) {
    throw new Error("1Shows authentication failed");
  }
  const counter = new Uint8Array(initialCounter);
  const plaintext = new Uint8Array(ciphertext.length);
  for (let offset = 0; offset < ciphertext.length; offset += 16) {
    incrementCounter(counter);
    const keyStream = aesEncryptBlock(counter, expandedKey);
    const length = Math.min(16, ciphertext.length - offset);
    for (let i = 0; i < length; i += 1) {
      plaintext[offset + i] = ciphertext[offset + i] ^ keyStream[i];
    }
  }
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function decryptDownloadWithWebCrypto(payload, token) {
  return __async(this, null, function* () {
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi || !cryptoApi.subtle) {
      throw new Error("Web Crypto is unavailable");
    }
    const key = hexToBytes(DOWNLOAD_KEY_HEX);
    const additionalData = hexToBytes(token);
    const iv = hexToBytes(payload.iv);
    const encrypted = joinBytes(hexToBytes(payload.ct), hexToBytes(payload.tag));
    const importedKey = yield cryptoApi.subtle.importKey(
      "raw",
      key,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const decrypted = yield cryptoApi.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData, tagLength: 128 },
      importedKey,
      encrypted
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  });
}

function decryptDownloadWithWasm(payload, token) {
  return __async(this, null, function* () {
    if (typeof WebAssembly === "undefined" || !WebAssembly.instantiate) {
      throw new Error("WebAssembly is unavailable");
    }
    const manifest = yield fetchJson(`${SITE_URL}/makimaDL-manifest.json`, {
      headers: API_HEADERS
    });
    const wasmUrl = absoluteUrl(manifest.url, SITE_URL);
    if (!wasmUrl || !manifest.exports)
      throw new Error("Invalid decryptor manifest");
    const response = yield fetch(wasmUrl, { headers: PAGE_HEADERS });
    if (!response.ok)
      throw new Error(`Decryptor HTTP ${response.status}`);
    const loaded = yield WebAssembly.instantiate(yield response.arrayBuffer(), {
      env: {
        abort() {
          throw new Error("1Shows decryptor aborted");
        }
      }
    });
    const exports2 = (loaded.instance || loaded).exports;
    const names = manifest.exports;
    const key = hexToBytes(token);
    const iv = hexToBytes(payload.iv);
    const ciphertext = hexToBytes(payload.ct);
    const tag = hexToBytes(payload.tag);
    try {
      const keyPointer = writeBytes(exports2, names.alloc, names.writeByte, key);
      const ivPointer = writeBytes(exports2, names.alloc, names.writeByte, iv);
      const ciphertextPointer = writeBytes(
        exports2,
        names.alloc,
        names.writeByte,
        ciphertext
      );
      const tagPointer = writeBytes(exports2, names.alloc, names.writeByte, tag);
      const outputPointer = exports2[names.alloc](ciphertext.length);
      const outputLength = exports2[names.decryptDownload](
        keyPointer,
        key.length,
        ivPointer,
        iv.length,
        ciphertextPointer,
        ciphertext.length,
        tagPointer,
        tag.length,
        outputPointer
      );
      if (outputLength <= 0 || outputLength > ciphertext.length) {
        throw new Error("1Shows download decryption failed");
      }
      const decoded = new TextDecoder().decode(
        readBytes(exports2, names.readByte, outputPointer, outputLength)
      );
      return JSON.parse(decoded);
    } finally {
      if (exports2[names.reset])
        exports2[names.reset]();
    }
  });
}

function decryptDownload(payload, token) {
  return __async(this, null, function* () {
    try {
      return decryptDownloadPureJs(payload, token);
    } catch (pureJsError) {
      console.log(
        `[1Shows] Pure JS decrypt unavailable, trying Web Crypto: ${pureJsError.message}`
      );
      try {
        return yield decryptDownloadWithWebCrypto(payload, token);
      } catch (webCryptoError) {
        console.log(
          `[1Shows] Web Crypto decrypt unavailable, trying WASM: ${webCryptoError.message}`
        );
        return decryptDownloadWithWasm(payload, token);
      }
    }
  });
}

function fetchDownloadSources(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const tokenData = yield fetchJson(`${API_URL}/download-token`, {
      headers: API_HEADERS
    });
    if (!tokenData.token)
      throw new Error("1Shows returned no download token");
    const route = mediaType === "tv" ? `/download/tv/${encodeURIComponent(tmdbId)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}` : `/download/movie/${encodeURIComponent(tmdbId)}`;
    const encrypted = yield fetchJson(
      `${API_URL}${route}`,
      {
        headers: Object.assign({}, API_HEADERS, {
          "x-download-token": tokenData.token
        })
      }
    );
    const decrypted = yield decryptDownload(encrypted, tokenData.token);
    return Array.isArray(decrypted.sources) ? decrypted.sources : [];
  });
}

function fetchMediaYear(tmdbId, mediaType) {
  return __async(this, null, function* () {
    try {
      const data = yield fetchJson(
        `${TMDB_URL}/${mediaType === "tv" ? "tv" : "movie"}/${encodeURIComponent(tmdbId)}?api_key=${TMDB_API_KEY}`,
        { headers: { Accept: "application/json", "User-Agent": USER_AGENT } }
      );
      return Number(
        String(data.release_date || data.first_air_date || "").slice(0, 4)
      ) || null;
    } catch (e) {
      return null;
    }
  });
}

function hasWrongYear(label, expectedYear) {
  if (!expectedYear)
    return false;
  const years = String(label || "").match(/\b(?:19|20)\d{2}\b/g) || [];
  return years.some((year) => Math.abs(Number(year) - expectedYear) > 1);
}

function isDirectMedia(url) {
  if (/\.(?:m3u8|mpd|mp4|mkv|webm)(?:$|[?#])/i.test(url))
    return true;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === "fffast.filesdl.in" || host === "video-downloads.googleusercontent.com" || host.endsWith(".workers.dev") || host.endsWith(".r2.cloudflarestorage.com") || host.includes("pixeldrain") || host.includes("iwebp.store") || host === "fuckingfast.net";
  } catch (e) {
    return false;
  }
}

function isKnownUnplayableHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "moondl.com" || host.endsWith(".moondl.com") || host === "takefile.link" || host.endsWith(".takefile.link") || host === "pixel.hubcloud.cx";
  } catch (e) {
    return false;
  }
}

function normalizeDirectUrl(url) {
  const value = String(url || "").replace(/ /g, "%20");
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (host === "pixeldrain.com" || host === "www.pixeldrain.com" || host === "pixeldrain.dev" || host === "www.pixeldrain.dev" || host.endsWith(".iwebp.store")) {
      const match = parsed.pathname.match(/^\/(?:u|l)\/([^/?#]+)/i);
      if (match)
        return `https://pixeldrain.com/api/file/${match[1]}`;
    }
  } catch (e) {
  }
  return value;
}

function preferredDownloadLink(links) {
  const usableLinks = links.filter(
    (link) => link && link.href && !isKnownUnplayableHost(link.href)
  );
  const priorities = [
    /(?:direct download|instant dl)/i,
    /(?:pixeldrain|buzzheavier)/i,
    /(?:fast cloud|zipdisk)/i
  ];
  for (const pattern of priorities) {
    const match = usableLinks.find((link) => pattern.test(link.text));
    if (match)
      return match;
  }
  const direct = usableLinks.find((link) => isDirectMedia(link.href));
  return direct || null;
}

function routeName(value, url) {
  const text = String(value || "");
  if (/fast cloud|zipdisk/i.test(text))
    return "Fast Cloud";
  if (/cloud direct/i.test(text))
    return "Cloud Direct";
  if (/pixeldrain/i.test(text))
    return "Pixeldrain";
  if (/hubcloud/i.test(text))
    return "HubCloud";
  if (/gd\s*index|gdflix/i.test(text))
    return "GD Index";
  if (/streamtape/i.test(text))
    return "Streamtape";
  if (/instant dl/i.test(text))
    return "Instant DL";
  if (/direct download/i.test(text))
    return "Direct";
  try {
    const host = new URL(url || value).hostname.toLowerCase();
    if (host.includes("pixeldrain"))
      return "Pixeldrain";
    if (host.includes("streamtape"))
      return "Streamtape";
    if (host.includes("hubcloud"))
      return "HubCloud";
    if (host.endsWith(".r2.cloudflarestorage.com"))
      return "Fast Cloud";
  } catch (e) {
  }
  return "Direct";
}

function resolveStreamTape(embedUrl, referer) {
  return __async(this, null, function* () {
    const page = yield fetchText(embedUrl, {
      headers: Object.assign({}, PAGE_HEADERS, { Referer: referer })
    });
    if (/video not found/i.test(page.html))
      return "";
    const expression = page.html.match(
      /innerHTML\s*=\s*["']([^"']+)["']\s*\+\s*\(\s*["']([^"']+)["']\s*\)\.substring\((\d+)\)(?:\.substring\((\d+)\))?/i
    );
    if (expression) {
      let suffix = expression[2].substring(Number(expression[3]));
      if (expression[4] !== void 0) {
        suffix = suffix.substring(Number(expression[4]));
      }
      const reconstructed = `${expression[1]}${suffix}`.replace(/&amp;/gi, "&");
      return normalizeDirectUrl(
        reconstructed.startsWith("//") ? `https:${reconstructed}` : reconstructed
      );
    }
    return "";
  });
}

function resolveKmhdPlayer(playerUrl) {
  return __async(this, null, function* () {
    var _a;
    const page = yield fetchText(playerUrl, {
      headers: Object.assign({}, PAGE_HEADERS, { Referer: `${SITE_URL}/` })
    });
    const streamTapeId = (_a = page.html.match(
      /streamtape_res\s*:\s*["']([^"']+)["']/i
    )) == null ? void 0 : _a[1];
    if (!streamTapeId)
      return "";
    return resolveStreamTape(
      `https://streamtape.com/e/${encodeURIComponent(streamTapeId)}`,
      page.url
    );
  });
}

function fetchKmhdFilePage(fileUrl) {
  return __async(this, null, function* () {
    const parsed = new URL(fileUrl);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let redirect = "";
    for (let index = 0; index < parsed.pathname.length; index += 3) {
      const first = parsed.pathname.charCodeAt(index);
      const hasSecond = index + 1 < parsed.pathname.length;
      const hasThird = index + 2 < parsed.pathname.length;
      const second = hasSecond ? parsed.pathname.charCodeAt(index + 1) : 0;
      const third = hasThird ? parsed.pathname.charCodeAt(index + 2) : 0;
      redirect += alphabet[first >> 2];
      redirect += alphabet[(first & 3) << 4 | second >> 4];
      redirect += hasSecond ? alphabet[(second & 15) << 2 | third >> 6] : "=";
      redirect += hasThird ? alphabet[third & 63] : "=";
    }
    try {
      yield fetch(`${parsed.origin}/locked?/unlock&redirect=${encodeURIComponent(redirect)}`, {
        method: "POST",
        headers: Object.assign({}, PAGE_HEADERS, {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: parsed.origin,
          Referer: `${parsed.origin}/locked?redirect=${encodeURIComponent(redirect)}`
        }),
        skipSizeCheck: true
      });
    } catch (e) {
    }
    return fetchText(fileUrl, {
      headers: Object.assign({}, PAGE_HEADERS, {
        Cookie: "unlocked=true",
        Referer: `${SITE_URL}/`
      })
    });
  });
}

function resolveGdIndexUrls(fileUrl, referer) {
  return __async(this, null, function* () {
    var _a;
    try {
      const page = yield fetchText(fileUrl, {
        headers: Object.assign({}, PAGE_HEADERS, { Referer: referer })
      });
      const parsed = new URL(page.url);
      const fileId = (_a = parsed.pathname.match(/\/file\/([^/?#]+)/i)) == null ? void 0 : _a[1];
      if (!fileId)
        return [];
      const wfileUrl = `${parsed.origin}/wfile/${fileId}`;
      const indexPage = yield fetchText(wfileUrl, {
        headers: Object.assign({}, PAGE_HEADERS, { Referer: page.url })
      });
      return anchors(indexPage.html, indexPage.url).filter((link) => /download/i.test(link.text) && isDirectMedia(link.href)).map((link) => normalizeDirectUrl(link.href));
    } catch (error) {
      console.log(`[1Shows] KatMovies GD Index unavailable: ${error.message}`);
      return [];
    }
  });
}

function resolveKatMoviesUrls(source) {
  return __async(this, null, function* () {
    var _a;
    const sourceUrl = absoluteUrl(source.url, SITE_URL);
    if (!sourceUrl || /\/play(?:\?|$)/i.test(sourceUrl))
      return [];
    let gdFileUrl = sourceUrl;
    if (/^https?:\/\/links\.kmhd\.eu\/file\//i.test(sourceUrl)) {
      try {
        const page = yield fetchKmhdFilePage(sourceUrl);
        const gdId = (_a = page.html.match(/gdflix_res:\s*["']([^"']+)["']/i)) == null ? void 0 : _a[1];
        if (!gdId || /^none$/i.test(gdId))
          return [];
        gdFileUrl = `https://gd.kmhd.eu/file/${encodeURIComponent(gdId)}`;
      } catch (error) {
        console.log(`[1Shows] KatMovies file unavailable: ${error.message}`);
        return [];
      }
    }
    if (!/(?:gdflix|gd\.kmhd)\./i.test(gdFileUrl))
      return [];
    return resolveGdIndexUrls(gdFileUrl, sourceUrl);
  });
}

function resolveFilmyFlyUrls(source) {
  return __async(this, null, function* () {
    try {
      const page = yield fetchText(source.url, {
        headers: Object.assign({}, PAGE_HEADERS, { Referer: `${SITE_URL}/` })
      });
      const choices = anchors(page.html, page.url).filter(
        (link) => /cloud direct|pixeldrain|hubcloud/i.test(link.text)
      );
      const groups = yield Promise.all(
        choices.map((link) => __async(this, null, function* () {
          if (/hubcloud/i.test(link.text)) {
            const resolved2 = yield resolveSourceUrl(
              { url: link.href, label: source.label },
              0,
              page.url,
              "HubCloud"
            );
            return resolved2 ? [resolved2] : [];
          }
          return [{
            url: normalizeDirectUrl(link.href),
            route: routeName(link.text, link.href)
          }];
        }))
      );
      const resolved = [].concat.apply([], groups);
      return resolved;
    } catch (error) {
      console.log(`[1Shows] ${source.label || "FilmyFly"} unavailable: ${error.message}`);
      return [];
    }
  });
}

function resolveDirectUrls(source) {
  return __async(this, null, function* () {
    const url = normalizeDirectUrl(source.url);
    return url && !isKnownUnplayableHost(url) ? [url] : [];
  });
}

function resolveSourceUrl(_0) {
  return __async(this, arguments, function* (source, depth = 0, referer = `${SITE_URL}/`, route = "") {
    if (depth > 5)
      return null;
    const sourceUrl = absoluteUrl(source.url, SITE_URL);
    if (!sourceUrl)
      return null;
    if (isKnownUnplayableHost(sourceUrl)) {
      console.log(
        `[1Shows] ${source.label || "Download"} skipped: unsupported playback host`
      );
      return null;
    }
    if (isDirectMedia(sourceUrl)) {
      return {
        url: normalizeDirectUrl(sourceUrl),
        route: route || routeName("", sourceUrl)
      };
    }
    if (/^https?:\/\/links\.kmhd\.eu\/play(?:\?|$)/i.test(sourceUrl)) {
      try {
        const url = yield resolveKmhdPlayer(sourceUrl);
        return url ? { url, route: route || "Streamtape" } : null;
      } catch (error) {
        console.log(
          `[1Shows] KatMovies player unavailable: ${error.message}`
        );
        return null;
      }
    }
    try {
      const page = yield fetchText(sourceUrl, {
        headers: Object.assign({}, PAGE_HEADERS, { Referer: referer })
      });
      const scriptedRedirect = page.html.match(
        /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i
      );
      const pageLinks = anchors(page.html, page.url);
      const fslLink = /(?:^|\.)sportverse\.cc$/i.test(
        new URL(page.url).hostname
      ) ? pageLinks.find((link) => {
        try {
          return new URL(link.href).hostname.toLowerCase().endsWith(".r2.cloudflarestorage.com");
        } catch (e) {
          return false;
        }
      }) : null;
      const preferred = preferredDownloadLink(pageLinks);
      const nextLink = fslLink ? fslLink : scriptedRedirect ? { href: absoluteUrl(scriptedRedirect[1], page.url), text: "" } : preferred;
      const nextUrl = nextLink && nextLink.href;
      if (!nextUrl || nextUrl === sourceUrl)
        return null;
      return resolveSourceUrl(
        { url: nextUrl, label: source.label },
        depth + 1,
        page.url,
        route || routeName(nextLink.text, nextUrl)
      );
    } catch (error) {
      console.log(`[1Shows] ${source.label || sourceUrl} unavailable: ${error.message}`);
      return null;
    }
  });
}

function sourceName(label) {
  if (/4khdhub|hubcloud/i.test(label))
    return "HubCloud";
  if (/katmovies/i.test(label))
    return "KatMovies";
  if (/filmyfly/i.test(label))
    return "FilmyFly";
  if (/premium\s*hm/i.test(label))
    return "Premium HM";
  return "Download";
}

function sourceFamily(label, url) {
  if (/4khdhub|hubcloud/i.test(label))
    return "hubcloud";
  if (/katmovies/i.test(label))
    return "katmovies";
  if (/filmyfly/i.test(label))
    return "filmyfly";
  if (/premium\s*hm/i.test(label))
    return "premium-hm";
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "111477.xyz" || host.endsWith(".111477.xyz")) {
      return "direct";
    }
  } catch (e) {
  }
  return "other";
}

function sizeFromLabel(label) {
  const match = String(label || "").match(/([\d.]+)\s*(GB|MB|KB)/i);
  return match ? `${match[1]} ${match[2].toUpperCase()}` : "";
}

function filenameFromUrl(url) {
  var _a;
  try {
    const parsed = new URL(url);
    const disposition = parsed.searchParams.get("response-content-disposition") || "";
    const dispositionName = (_a = disposition.match(/filename\*?=(?:UTF-8''|["']?)([^"';]+(?:\.[a-z0-9]{2,5}))/i)) == null ? void 0 : _a[1];
    const pathName = parsed.pathname.split("/").filter(Boolean).pop() || "";
    const value = dispositionName || pathName;
    if (!/\.(?:mkv|mp4|avi|mov|webm)$/i.test(value))
      return "";
    return decodeURIComponent(value.replace(/\+/g, " ")).replace(/\.(?:mkv|mp4|avi|mov|webm)$/i, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  } catch (e) {
    return "";
  }
}

function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0)
    return "";
  if (value >= 1024 ** 3)
    return `${(value / 1024 ** 3).toFixed(value >= 10 * 1024 ** 3 ? 1 : 2).replace(/\.0+$/, "")} GB`;
  if (value >= 1024 ** 2)
    return `${(value / 1024 ** 2).toFixed(value >= 10 * 1024 ** 2 ? 1 : 2).replace(/\.0+$/, "")} MB`;
  return `${Math.round(value / 1024)} KB`;
}

function typeFromUrl(url) {
  if (/\.m3u8(?:$|[?#])/i.test(url))
    return "application/x-mpegURL";
  if (/\.mpd(?:$|[?#])/i.test(url))
    return "application/dash+xml";
  if (/\.mp4(?:$|[?#])/i.test(url) || /\/get_video\?(?:[^#]*&)?id=/i.test(url)) {
    return "video/mp4";
  }
  return "video/x-matroska";
}

function playbackReferer(url, fallback) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase().includes("streamtape")) {
      return `${parsed.protocol}//${parsed.hostname}/`;
    }
  } catch (e) {
  }
  return fallback || `${SITE_URL}/`;
}

function parseExtendedDetails(text) {
  const str = String(text || "").replace(/р/gi, "p");

  const qualityMatch = str.match(/\b(?:2160p|1080p|720p|480p|4K)\b/i);
  const quality = qualityMatch ? (qualityMatch[0].toLowerCase() === '4k' ? '4K' : qualityMatch[0]) : "Unknown";

  const codecMatch = str.match(/\b(?:HEVC|AVC|H\.?265|H\.?264|x265|x264|AV1)\b/i);
  let codec = codecMatch ? codecMatch[0] : "";
  if (/H\.?265/i.test(codec)) codec = "HEVC";
  if (/H\.?264/i.test(codec)) codec = "x264";
  codec = codec.toUpperCase();

  const releaseMatch = str.match(/\b(?:BluRay|WEB[- .]?DL|WEBRip|BRRip|HDRip|DVDRip|HD)\b/i);
  let release = releaseMatch ? releaseMatch[0] : "";
  if (/WEB[- .]?DL/i.test(release)) release = "WEB-DL";

  const is10Bit = /\b10[- .]?bit\b/i.test(str) ? "10Bit" : "";
  const isHDR = /\b(?:HDR10\+?|HDR)\b/i.test(str) ? "HDR" : "";
  const isDV = /\b(?:Dolby[- .]?Vision|DV)\b/i.test(str) ? "DV" : "";
  const isESub = /\bE-?Sub\b/i.test(str) ? "ESub" : "";

  const audioMatch = str.match(/\b(?:DDP?\s?\d\.\d|AAC\s?\d\.\d|DTS(?:-HD)?|TrueHD|DD\s?\d\.\d)\b/i);
  const audio = audioMatch ? audioMatch[0].replace(/\s/g, "").toUpperCase() : "";
  const isAtmos = /\bAtmos\b/i.test(str) ? "Atmos" : "";

  const langs = ["Hindi", "English", "Romanian", "Tamil", "Telugu", "Malayalam", "Bengali"].filter((l) => new RegExp(`\\b${l}\\b`, "i").test(str));
  const isDualAudio = /\b(?:Dual[- ]?Audio|Multi[- ]?Audio)\b/i.test(str);

  let title = "";
  const titleMatch = str.match(/^([^\[\]]+?(?:\(\d{4}\)|\b(?:19|20)\d{2}\b|\bS\d{2}E\d{2}(?:-E\d{2})?\b))/i);
  if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace(/[\._]+/g, " ").trim();
  } else {
      const fallbackMatch = str.match(/^(.*?)(?:\b(?:2160p|1080p|720p|480p|4K)\b)/i);
      if (fallbackMatch && fallbackMatch[1]) {
          title = fallbackMatch[1].replace(/[\._]+/g, " ").trim();
      } else {
          title = str.split(".")[0] || "Unknown Title";
      }
  }

  return { quality, codec, release, is10Bit, isHDR, isDV, isESub, audio, isAtmos, langs, isDualAudio, title };
}

function streamFromUrl(source, resolved, index, total) {
  const url = resolved.url;
  const provider = resolved.route || routeName("", url);

  const rawLabel = source.label || "";
  const filename = filenameFromUrl(url) || "";
  const fullText = `${filename} ${rawLabel} ${decodeURIComponent(url || "")}`;

  const meta = parseExtendedDetails(fullText);

  let fileFormat = "Unknown";
  const formatMatch = fullText.match(/\.(mkv|mp4|avi|mov|webm)(?:$|[?#\s])/i);
  if (formatMatch) {
      fileFormat = formatMatch[1].toUpperCase();
  }

  const isDual = meta.isDualAudio || meta.langs.length > 1 ? " | Dual-Audio" : "";
  
  // Cleaned name string
  const streamName = `1Shows | ${meta.quality}${isDual}`;

  const titleLine = `🍿 ${meta.title || "Unknown Title"}`;

  const rawSize = sizeFromLabel(rawLabel) || (resolved.size ? resolved.size : "Unknown Size");
  const line2 = `🌟 ${meta.quality} | 💾 ${rawSize} | 🎞️ ${fileFormat}`;

  const langStr = meta.langs.length > 0 ? meta.langs.join(" - ") : (meta.isDualAudio ? "Dual Audio" : "Unknown Lang");
  const audioParts = [`🗣️ ${langStr}`];
  if (meta.audio) audioParts.push(`🎧 ${meta.audio}`);
  if (meta.isAtmos) audioParts.push(`🔊 Atmos`);
  const line3 = audioParts.join(" | ");

  const videoParts = [];
  const hdrBits = [meta.isHDR, meta.is10Bit].filter(Boolean).join(" • ");
  if (hdrBits) videoParts.push(`🌈 ${hdrBits}`);
  if (meta.codec) videoParts.push(`⚡ ${meta.codec}`);
  if (meta.isDV) videoParts.push(`👁️ ${meta.isDV}`);
  const line4 = videoParts.length > 0 ? videoParts.join(" | ") : "🌈 SDR";

  const provParts = [`🔗 ${provider}`];
  if (meta.release) provParts.push(`☁️ ${meta.release}`);
  if (meta.isESub) provParts.push(`📝 ESub`);
  const line5 = provParts.join(" | ");

  const line6 = filename || (rawLabel ? rawLabel.substring(0, 60) + "..." : "Unknown File");
  const finalTitleString = [titleLine, line2, line3, line4, line5, line6].join("\n");

  return {
    name: streamName,
    title: finalTitleString,
    description: finalTitleString,
    url,
    quality: meta.quality,
    size: sizeFromLabel(rawLabel) || undefined,
    behaviorHints: {
        bingeGroup: `1shows-${meta.quality}-${provider}`,
        notWebReady: true
    }
  };
}

function resolveSource(source) {
  return __async(this, null, function* () {
    const family = sourceFamily(source.label || "", source.url);
    const resolvedItems = family === "katmovies" ? (yield resolveKatMoviesUrls(source)).map((url) => ({ url, route: "GD Index" })) : family === "filmyfly" ? yield resolveFilmyFlyUrls(source) : family === "direct" ? (yield resolveDirectUrls(source)).map((url) => ({ url, route: "Direct" })) : [yield resolveSourceUrl(source)];
    const uniqueItems = resolvedItems.filter(
      (item, index) => item && item.url && resolvedItems.findIndex((candidate) => candidate && candidate.url === item.url) === index
    );
    return uniqueItems.map(
      (item, index) => streamFromUrl(source, item, index, uniqueItems.length)
    );
  });
}

function isStreamAlive(stream) {
  return __async(this, null, function* () {
    var _a;
    const startedAt = Date.now();
    try {
      // stream.headers is undefined now, which evaluates to {} here
      const response = yield fetch(stream.url, {
        method: "GET",
        headers: Object.assign({}, stream.headers || {}, {
          Range: "bytes=0-1"
        }),
        redirect: "follow",
        skipSizeCheck: true
      });
      const contentRange = String(
        response.headers && response.headers.get ? response.headers.get("content-range") || "" : ""
      );
      const contentType = String(
        response.headers && response.headers.get ? response.headers.get("content-type") || "" : ""
      ).toLowerCase();
      const rangeTotal = Number(((_a = contentRange.match(/\/(\d+)$/)) == null ? void 0 : _a[1]) || 0);
      const rangedMedia = response.status === 206 && /^bytes\s+0-1\//i.test(contentRange) && rangeTotal >= 1024 * 1024;
      const hlsPlaylist = response.ok && (/mpegurl|application\/vnd\.apple\.mpegurl/i.test(contentType) || /\.m3u8(?:$|[?#])/i.test(stream.url));
      if (!rangedMedia && !hlsPlaylist) {
        console.log(
          `[1Shows] Dead source removed: HTTP ${response.status}, ${contentType || "unknown type"}`
        );
      }
      if (rangedMedia) {
        const detectedSize = formatFileSize(rangeTotal);
        if (detectedSize) {
          stream.size = detectedSize;
        }
      }
      if (/video\/mp4/i.test(contentType))
        stream.type = "video/mp4";
      else if (/video\/webm/i.test(contentType))
        stream.type = "video/webm";
      else if (/matroska/i.test(contentType))
        stream.type = "video/x-matroska";
      else if (/mpegurl/i.test(contentType))
        stream.type = "application/x-mpegURL";
      stream._probeMs = Date.now() - startedAt;
      return rangedMedia || hlsPlaylist;
    } catch (error) {
      console.log(`[1Shows] Dead source removed: ${error.message}`);
      return false;
    }
  });
}

function mediaFingerprint(stream) {
  if (!/1Shows/i.test(stream.name || ""))
    return "";
  try {
    const filename = decodeURIComponent(
      new URL(stream.url).pathname.split("/").filter(Boolean).pop() || ""
    );
    return /\.(?:mkv|mp4|webm)$/i.test(filename) ? filename.toLowerCase() : "";
  } catch (e) {
    return "";
  }
}

function getStreams(tmdbId, mediaType, season, episode, onlyFamily) {
  return __async(this, null, function* () {
    const normalizedType = mediaType === "series" ? "tv" : mediaType;
    if (!tmdbId || normalizedType !== "movie" && normalizedType !== "tv") {
      return [];
    }
    if (normalizedType === "tv" && (!Number.isInteger(Number(season)) || Number(season) < 1 || !Number.isInteger(Number(episode)) || Number(episode) < 1)) {
      return [];
    }
    try {
      const mediaLabel = normalizedType === "tv" ? `series ${tmdbId} S${season}E${episode}` : `movie ${tmdbId}`;
      console.log(`[1Shows] Loading exact download sources for ${mediaLabel}`);
      const results = yield Promise.all([
        fetchDownloadSources(
          String(tmdbId),
          normalizedType,
          Number(season),
          Number(episode)
        ),
        fetchMediaYear(String(tmdbId), normalizedType)
      ]);
      const sources = results[0];
      const year = results[1];
      const matchingSources = sources.filter(
        (source) => source && source.url && (!onlyFamily || sourceFamily(source.label || "", source.url) === onlyFamily) && !hasWrongYear(`${source.label || ""} ${source.url}`, year)
      );
      const resolvedGroups = yield Promise.all(matchingSources.map(resolveSource));
      const resolved = [].concat.apply([], resolvedGroups);
      const uniqueResolved = resolved.filter(
        (stream, index) => stream && stream.url && resolved.findIndex(
          (candidate) => candidate && candidate.url === stream.url
        ) === index
      );
      const checked = yield Promise.all(
        uniqueResolved.map(
          (stream) => __async(this, null, function* () {
            return stream && (yield isStreamAlive(stream)) ? stream : null;
          })
        )
      );
      const fastestMirrors = {};
      for (const stream of checked) {
        if (!stream)
          continue;
        const fingerprint = mediaFingerprint(stream);
        if (fingerprint && (!fastestMirrors[fingerprint] || stream._probeMs < fastestMirrors[fingerprint]._probeMs)) {
          fastestMirrors[fingerprint] = stream;
        }
      }
      const seen = {};
      const streams = checked.filter((stream) => {
        if (!stream || !stream.url || seen[stream.url])
          return false;
        const fingerprint = mediaFingerprint(stream);
        if (fingerprint && fastestMirrors[fingerprint] !== stream)
          return false;
        seen[stream.url] = true;
        delete stream._probeMs;
        return true;
      });
      console.log(
        `[1Shows] Returning ${streams.length} exact source(s) from ${sources.length} download entries`
      );
      return streams;
    } catch (error) {
      console.error(`[1Shows] Error: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
