/**
 * 4khdhub - Built from src/4khdhub/
 * Generated: 2026-07-30T21:34:33.906Z
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
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

// src/4khdhub/index.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));
var BASE_URL = "https://4khdhub.one";
var TMDB_URL = "https://api.themoviedb.org/3";
var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
var HEADERS = { "User-Agent": USER_AGENT, Referer: `${BASE_URL}/` };

function pad(n, width = 2) {
  return String(n).padStart(width, '0');
}

function fetchText(_0) {
  return __async(this, arguments, function* (url, referer = BASE_URL) {
    const response = yield fetch(url, {
      headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: `${referer}/` })
    });
    if (!response.ok)
      throw new Error(`HTTP ${response.status}: ${url}`);
    return response.text();
  });
}

function absoluteUrl(value, base = BASE_URL) {
  if (!value)
    return "";
  if (/^https?:\/\//i.test(value))
    return value;
  try {
    return new URL(value, base).toString();
  } catch (e) {
    return "";
  }
}

function decodeBase64(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const input = String(value || "").replace(/=+$/, "");
  let output = "";
  let count = 0;
  let bits;
  let buffer;
  let index = 0;
  while (buffer = input.charAt(index++)) {
    buffer = alphabet.indexOf(buffer);
    if (buffer < 0)
      continue;
    bits = count % 4 ? bits * 64 + buffer : buffer;
    if (count++ % 4) {
      output += String.fromCharCode(bits >> (-2 * count & 6) & 255);
    }
  }
  return output;
}

function rot13(value) {
  return String(value || "").replace(/[a-zA-Z]/g, (character) => {
    const code = character.charCodeAt(0) + 13;
    const limit = character <= "Z" ? 90 : 122;
    return String.fromCharCode(code <= limit ? code : code - 26);
  });
}

function normalizeTitle(value) {
  return String(value || "").toLowerCase().replace(/\[[^\]]*]/g, " ").replace(/\b(the|a|an|directors?|cut)\b/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function titleScore(expected, candidate) {
  const expectedWords = normalizeTitle(expected).split(" ").filter(Boolean);
  const candidateWords = new Set(
    normalizeTitle(candidate).split(" ").filter(Boolean)
  );
  if (!expectedWords.length)
    return 0;
  const matches = expectedWords.filter((word) => candidateWords.has(word)).length;
  return matches / expectedWords.length;
}

function parseQuality(value) {
  if (/\b(?:2160p|4k|uhd)\b/i.test(value))
    return "2160p";
  const match = String(value || "").match(/\b(1080|720|480)p\b/i);
  return match ? `${match[1]}p` : "1080p";
}

function parseSize(value) {
  const match = String(value || "").match(/([\d.]+)\s*(GB|MB|KB)/i);
  return match ? `${match[1]} ${match[2].toUpperCase()}` : "N/A";
}

function isDirectVideo(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith(".workers.dev") || host.endsWith(".r2.cloudflarestorage.com");
  } catch (e) {
    return false;
  }
}

function getMetadata(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const endpoint = mediaType === "tv" || mediaType === "series" ? "tv" : "movie";
    const response = yield fetch(
      `${TMDB_URL}/${endpoint}/${encodeURIComponent(tmdbId)}?api_key=${TMDB_KEY}&language=en-US`,
      { headers: { Accept: "application/json", "User-Agent": USER_AGENT } }
    );
    if (!response.ok)
      throw new Error(`TMDB HTTP ${response.status}`);
    const data = yield response.json();
    const date = endpoint === "tv" ? data.first_air_date : data.release_date;
    return {
      title: endpoint === "tv" ? data.name : data.title,
      year: date ? Number(date.slice(0, 4)) : null
    };
  });
}

function findPage(metadata, isSeries, season) {
  return __async(this, null, function* () {
    const query = isSeries && season ? `${metadata.title} Season ${season}` : `${metadata.title} ${metadata.year || ""}`.trim();
    const html = yield fetchText(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
    const $ = import_cheerio_without_node_native.default.load(html);
    let best = null;
    $(".movie-card").each((_, element) => {
      const card = $(element);
      const title = card.find(".movie-card-title").text().trim();
      const format = card.find(".movie-card-format").text().trim();
      const meta = card.find(".movie-card-meta").text();
      const href = card.attr("href") || card.find("a[href]").first().attr("href");
      if (!title || !href)
        return;
      if (isSeries && !/series/i.test(format))
        return;
      if (!isSeries && !/movies?/i.test(format))
        return;
      const yearMatch = meta.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? Number(yearMatch[0]) : null;
      let score = titleScore(metadata.title, title);
      if (metadata.year && year === metadata.year)
        score += 0.35;
      else if (metadata.year && year && Math.abs(year - metadata.year) > 1) {
        score -= 0.5;
      }
      if (isSeries && season) {
        const foundSeason = title.match(/(?:season\s*|s)(\d+)/i);
        if (foundSeason && Number(foundSeason[1]) === Number(season))
          score += 0.4;
        else if (foundSeason)
          score -= 0.6;
      }
      if (!best || score > best.score) {
        best = { url: absoluteUrl(href), score, title };
      }
    });
    return best && best.score >= 0.7 ? best.url : "";
  });
}

function decodeRedirect(url) {
  return __async(this, null, function* () {
    var _a, _b;
    if (/hubcloud|hubdrive/i.test(url))
      return url;
    try {
      const html = yield fetchText(url);
      const encoded = ((_a = html.match(/['"]o['"]\s*,\s*['"]([^'"]+)['"]/)) == null ? void 0 : _a[1]) || ((_b = html.match(/'o','([^']+)'/)) == null ? void 0 : _b[1]);
      if (!encoded)
        return url;
      const decoded = decodeBase64(rot13(decodeBase64(decodeBase64(encoded))));
      const payload = JSON.parse(decoded);
      return payload.o ? decodeBase64(payload.o).trim() : url;
    } catch (e) {
      return url;
    }
  });
}

function findHubCloud(item, pageUrl, $) {
  return __async(this, null, function* () {
    const links = item.find("a[href]").get();
    for (const element of links) {
      const link = $(element);
      const href = link.attr("href");
      const text = link.text();
      if (!href)
        continue;
      if (/hubcloud/i.test(text) || /hubcloud/i.test(href)) {
        return decodeRedirect(absoluteUrl(href, pageUrl));
      }
      if (/hubdrive/i.test(text) || /hubdrive/i.test(href)) {
        const driveUrl = yield decodeRedirect(absoluteUrl(href, pageUrl));
        try {
          const driveHtml = yield fetchText(driveUrl, pageUrl);
          const $drive = import_cheerio_without_node_native.default.load(driveHtml);
          const cloud = $drive("a[href]").filter((_, anchor) => {
            const candidate = $drive(anchor);
            return /hubcloud/i.test(
              `${candidate.text()} ${candidate.attr("href") || ""}`
            );
          }).first().attr("href");
          if (cloud)
            return absoluteUrl(cloud, driveUrl);
        } catch (e) {
        }
      }
    }
    return "";
  });
}

function extractHubCloud(url, fallback) {
  return __async(this, null, function* () {
    var _a;
    try {
      let html = yield fetchText(url, url);
      let pageUrl = url;
      const redirect = ((_a = html.match(/var url\s*=\s*['"]([^'"]+)['"]/)) == null ? void 0 : _a[1]) || import_cheerio_without_node_native.default.load(html)("#download").attr("href");
      if (redirect) {
        pageUrl = absoluteUrl(redirect, url);
        html = yield fetchText(pageUrl, url);
      }
      const $ = import_cheerio_without_node_native.default.load(html);
      const header = $("div.card-header").text().replace(/\s+/g, " ").trim() || $("title").text().trim() || fallback.title;
      const parsedSize = parseSize($("i#size, #size").first().text());
      const size = parsedSize !== "N/A" ? parsedSize : fallback.size;
      const quality = parseQuality(header) !== "Unknown" ? parseQuality(header) : fallback.quality;
      const results = [];
      $("a[href]").each((_, element) => {
        const href = $(element).attr("href");
        if (!href || !isDirectVideo(href))
          return;
        results.push({ url: href, title: header, quality, size });
      });
      return results;
    } catch (e) {
      return [];
    }
  });
}

function extractStreams(pageUrl, isSeries, season, episode) {
  return __async(this, null, function* () {
    const html = yield fetchText(pageUrl);
    const $ = import_cheerio_without_node_native.default.load(html);
    const items = [];
    if (isSeries && season && episode) {
      const seasonCode = `S${String(season).padStart(2, "0")}`;
      const episodeCode = `Episode-${String(episode).padStart(2, "0")}`;
      $(".episode-item").each((_, element) => {
        const section = $(element);
        if (!section.find(".episode-title").text().includes(seasonCode))
          return;
        section.find(".episode-download-item").each((__, download) => {
          if ($(download).text().includes(episodeCode))
            items.push($(download));
        });
      });
    } else {
      $(".download-item").each((_, element) => items.push($(element)));
    }
    const resolved = yield Promise.all(
      items.map((item) => __async(this, null, function* () {
        const context = item.text().replace(/\s+/g, " ").trim();
        const fallback = {
          title: item.find(".file-title, .episode-file-title").text().trim() || context,
          quality: parseQuality(context),
          size: parseSize(context)
        };
        const cloud = yield findHubCloud(item, pageUrl, $);
        return cloud ? extractHubCloud(cloud, fallback) : [];
      }))
    );
    return resolved.flat();
  });
}

// ---------------------------------------------------------------------------
// AnimeZeY Layout Engine Adaptation for 4KHDHub
// ---------------------------------------------------------------------------

function makeStream(rawTitle, url, size, quality, metadata, isSeries, season, episode) {
  var cleanName = (rawTitle || '').replace(/[\n\t]+/g, '').trim();
  var lowerContext = (cleanName + " " + (url || "")).toLowerCase();

  var parsedQuality = (quality && quality !== "Unknown") ? quality : parseQuality(cleanName);
  var is4K = parsedQuality === "2160p" || lowerContext.includes("4k") || lowerContext.includes("uhd");
  var qIcon = is4K ? "🌟" : "🔥";
  var fileSizeOnly = size || "N/A";

  var fileFormat = (url && url.split('?')[0].endsWith(".mp4")) ? "MP4" : "MKV";

  // Source
  var sourceTag = "WEB-DL";
  if (/\b(bluray|blu\-ray|bdrip)\b/i.test(lowerContext)) sourceTag = "BluRay";
  else if (/\b(webrip)\b/i.test(lowerContext)) sourceTag = "WEBRip";

  // Codec
  var codecTag = "H.264";
  if (/\b(x265|h265)\b/i.test(lowerContext)) codecTag = "H.265";
  else if (/\bhevc\b/i.test(lowerContext) || is4K) codecTag = "HEVC";

  // HDR Tags
  var hdrMatch = "";
  if (/\bhdr10plus\b/i.test(lowerContext)) hdrMatch = "HDR10+";
  else if (/\bhdr10\b/i.test(lowerContext)) hdrMatch = "HDR10";
  else if (/\bhdr\b/i.test(lowerContext)) hdrMatch = "HDR";
  else if (/\b(10bit|10\-bit)\b/i.test(lowerContext)) hdrMatch = "10Bit";
  var hdrPart = hdrMatch ? '🌈 ' + hdrMatch + ' | ' : '';

  // Dolby Vision
  var hasDV = /\b(dolby\s*vision|dovi|dv)\b/i.test(lowerContext);
  var dvPart = hasDV ? ' | 👁️ DV' : '';

  // Audio Channels (Strict Atmos)
  var audioChannelTag = "DD5.1";
  if (/\bddp5\.1\b/i.test(lowerContext)) {
    audioChannelTag = "DDP5.1";
  } else if (/\bdd5\.1\b|\b5\.1\b/i.test(lowerContext)) {
    audioChannelTag = "DD5.1";
  } else if (/\baac\b/i.test(lowerContext)) {
    audioChannelTag = "AAC";
  }

  if (/\batmos\b/i.test(lowerContext)) {
    if (audioChannelTag === "DDP5.1") {
      audioChannelTag = "DDP5.1 • 🔊 Atmos";
    } else {
      audioChannelTag = "DD5.1 • 🔊 Atmos";
    }
  }

  // Audio Language & Type
  var isDualAudio = /\b(dual|multi|dubbed|hindi|org)\b/i.test(lowerContext);
  var audioType = isDualAudio ? "Dual-Audio" : "Single Audio";
  var langTag = isDualAudio ? "English 🇺🇸 • Multi 🌐" : "English 🇺🇸";

  // Clean Title Presentation
  var displayTitle = metadata.title || "Unknown Title";
  var displayYear = metadata.year || "2026";
  var epInfo = (isSeries && season && episode) ? 'S' + pad(season) + 'E' + pad(episode) : '';

  // --- Subheading Builder ---
  var line1 = epInfo 
    ? '🍿 ' + displayTitle + ' - ' + displayYear + ' | ' + epInfo 
    : '🍿 ' + displayTitle + ' - ' + displayYear;
  
  var line2 = qIcon + ' ' + parsedQuality + ' | 💾 ' + fileSizeOnly + ' | 🎞️ ' + fileFormat;
  var line3 = hdrPart + '⚡ ' + codecTag + ' | ';
  var line4 = '🌍 ' + audioType + ' | 🎧 ' + audioChannelTag + dvPart;
  var line5 = '🗣️ ' + langTag + ' | ';
  var line6 = '🔗 4KHDHub Server | 🕸️ ' + sourceTag;

  var formattedTitle = line1 + '\n' + line2 + '\n' + line3 + '\n' + line4 + '\n' + line5 + '\n' + line6;
  var headerName = "4KHDHub | " + parsedQuality + " | " + audioType;

  return {
    name: headerName,
    title: formattedTitle,
    url: url,
    quality: parsedQuality,
    size: fileSizeOnly,
    provider: "4khdhub"
  };
}

function getStreams(tmdbId, mediaType, season = null, episode = null) {
  return __async(this, null, function* () {
    const isSeries = mediaType === "tv" || mediaType === "series";
    if (!tmdbId || !isSeries && mediaType !== "movie")
      return [];
    try {
      console.log(`[4KHDHub] Looking up ${mediaType} ${tmdbId}`);
      const metadata = yield getMetadata(tmdbId, mediaType);
      const pageUrl = yield findPage(metadata, isSeries, season);
      if (!pageUrl)
        return [];
      const extracted = yield extractStreams(
        pageUrl,
        isSeries,
        season,
        episode
      );
      const seen = {};
      const streams = extracted.filter((stream) => isDirectVideo(stream.url)).filter((stream) => {
        if (seen[stream.url])
          return false;
        seen[stream.url] = true;
        return true;
      }).map((stream) => makeStream(
        stream.title,
        stream.url,
        stream.size,
        stream.quality,
        metadata,
        isSeries,
        season,
        episode
      ));

      const order = {
        "2160p": 4,
        "1080p": 3,
        "720p": 2,
        "480p": 1,
        Unknown: 0
      };
      console.log(`[4KHDHub] Returning ${streams.length} direct stream(s)`);
      return streams.sort((a, b) => order[b.quality] - order[a.quality]);
    } catch (error) {
      console.error(`[4KHDHub] Error: ${error.message}`);
      return [];
    }
  });
}

module.exports = { getStreams };
