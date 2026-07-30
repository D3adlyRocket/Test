/**
 * 4khdhub - Fixed Codec/Quality mapping from URL filename & updated line 5 header
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
var PROVIDER_NAME = "4KHDHub";
var BASE_URL = "https://4khdhub.one";
var TMDB_URL = "https://api.themoviedb.org/3";
var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
var HEADERS = { "User-Agent": USER_AGENT, Referer: `${BASE_URL}/` };

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

function decodeEntities(encodedString) {
  if (!encodedString) return '';
  var translate_re = /&(nbsp|amp|quot|lt|gt|#038);/g;
  var translate = { "nbsp": " ", "amp" : "&", "quot": "\"", "lt" : "<", "gt" : ">", "#038": "&" };
  return encodedString.replace(translate_re, function(match, entity) { return translate[entity]; }).replace(/&#(\d+);/g, function(match, num) { return String.fromCharCode(num); });
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

function parseQuality(text) {
  var t = String(text || '').toLowerCase();
  if (t.indexOf('2160') >= 0 || t.indexOf('4k') >= 0) return '2160p';
  if (t.indexOf('1080') >= 0) return '1080p';
  if (t.indexOf('720') >= 0) return '720p';
  if (t.indexOf('480') >= 0) return '480p';
  return '1080p';
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
      const quality = parseQuality(header);
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
// Precision Stream Builder mapped directly from Context & URL Filename
// ---------------------------------------------------------------------------

function makeStream(name, title, url, quality, headers, mediaInfo, mediaMetadata) {
  var decodedUrl = "";
  try {
    decodedUrl = decodeURIComponent(url || "");
  } catch (e) {
    decodedUrl = url || "";
  }

  var cleanTitle = decodeEntities(title || "").replace(/[\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  var fullContext = (cleanTitle + " " + decodedUrl).toLowerCase();

  // 1. Resolution / Quality Extraction
  var displayQuality = quality;
  var qualMatch = fullContext.match(/\b(2160p|4k|1080p|720p|480p)\b/i);
  if (qualMatch) {
    var qStr = qualMatch[1].toLowerCase();
    if (qStr === "4k" || qStr === "2160p") displayQuality = "2160p";
    else if (qStr === "1080p") displayQuality = "1080p";
    else if (qStr === "720p") displayQuality = "720p";
    else if (qStr === "480p") displayQuality = "480p";
  }
  if (!displayQuality || displayQuality === "N/A") {
    displayQuality = parseQuality(fullContext);
  }

  // 2. Audio Type & Fallback Detection
  var audioType = "Single-Audio";
  if (/\b(multi|multi\-audio)\b/i.test(fullContext)) {
    audioType = "Multi-Audio";
  } else if (/\b(dual|dual\-audio|dubbed|hindi)\b/i.test(fullContext) || decodeEntities(name || "").toLowerCase().includes("dual audio")) {
    audioType = "Dual-Audio";
  }

  // Header
  var headerName = PROVIDER_NAME + " | " + displayQuality + " | " + audioType;

  // Subheading Line 1: Movie Name - (Year) or Series Name - (Year) | S1E1
  var mediaTitle = mediaMetadata && mediaMetadata.title ? mediaMetadata.title : name;
  var mediaYear = mediaMetadata && mediaMetadata.year ? mediaMetadata.year : "2026";
  var line1 = "";
  if (mediaInfo && (mediaInfo.startsWith("S") || mediaInfo.includes("E"))) {
    var formattedEp = mediaInfo.replace(/E0*(\d+)/i, 'E$1').replace(/S0*(\d+)/i, 'S$1');
    line1 = "🎬 " + mediaTitle + " - (" + mediaYear + ") | " + formattedEp;
  } else {
    line1 = "🎬 " + mediaTitle + " - (" + mediaYear + ")";
  }

  // Subheading Line 2: Quality Icon | Size | Format
  var qIcon = "🔥";
  if (displayQuality === "2160p") {
    qIcon = "⚡";
  } else if (displayQuality === "720p") {
    qIcon = "💎";
  }

  var fileSizeOnly = "N/A";
  var sizeMatch = cleanTitle.match(/\[\s*(\d+(?:\.\d+)?\s*[MG]B)\s*\]/i) || cleanTitle.match(/(\d+(?:\.\d+)?\s*[MG]B)/i) || decodedUrl.match(/(\d+(?:\.\d+)?\s*[MG]B)/i);
  if (sizeMatch) fileSizeOnly = sizeMatch[1].toUpperCase().replace(/\s+/g, '');

  var numericalSizeWeight = 0;
  if (sizeMatch) {
    var num = parseFloat(sizeMatch[1]);
    var unit = sizeMatch[1].toUpperCase();
    numericalSizeWeight = unit.includes("GB") ? num * 1024 : num;
  }

  var fileFormat = "MKV";
  if (/\.mp4($|\?)/i.test(decodedUrl) || /\.mp4\b/i.test(cleanTitle)) {
    fileFormat = "MP4";
  }

  var line2 = qIcon + " " + displayQuality + " | 💾 " + fileSizeOnly + " | 📼 " + fileFormat;

  // Subheading Line 3: HDR | Codec | Vision
  var hdrTag = "HDR";
  if (/\bhdr10\+/i.test(fullContext)) {
    hdrTag = "HDR10+";
  } else if (/\bhdr10\b/i.test(fullContext)) {
    hdrTag = "HDR10";
  } else if (/\bhdr\b/i.test(fullContext)) {
    hdrTag = "HDR";
  }

  var codecTag = "H.264";
  if (/\b(h\.?265|x265)\b/i.test(fullContext)) {
    codecTag = "H.265";
  } else if (/\bhevc\b/i.test(fullContext)) {
    codecTag = "HEVC";
  } else if (/\b(h\.?264|x264|avc)\b/i.test(fullContext)) {
    codecTag = "H.264";
  }

  var dvTag = "DV";
  if (/\b(dolby\s*vision|dovi|dv)\b/i.test(fullContext)) {
    dvTag = "DV";
  }

  var line3 = "🌈 " + hdrTag + " | 🎥 " + codecTag + " | 👁️ " + dvTag;

  // Subheading Line 4: Audio Languages & Channels
  var audioCodecTag = "DD5.1";
  if (/\btruehd\s*7\.1\b/i.test(fullContext)) {
    audioCodecTag = "TrueHD 7.1";
  } else if (/\bddp5\.1\b/i.test(fullContext) || /\beac3\b/i.test(fullContext)) {
    audioCodecTag = "DDP5.1";
  } else if (/\bdd5\.1\b/i.test(fullContext) || /\bac3\b/i.test(fullContext)) {
    audioCodecTag = "DD5.1";
  }

  var atmosSuffix = "";
  if (/\batmos\b/i.test(fullContext)) {
    atmosSuffix = " • 🔊 Atmos";
  }

  var line4 = "🌍 " + audioType + " | 🎧 " + audioCodecTag + atmosSuffix;

  // Subheading Line 5: Explicit 4KHDHub.com Site Identifier & Rip Source
  var sourceTag = "WEB-DL";
  if (/\b(webrip|web\-rip)\b/i.test(fullContext)) {
    sourceTag = "WEB-RIP";
  } else if (/\b(webdl|web\-dl)\b/i.test(fullContext)) {
    sourceTag = "WEB-DL";
  } else if (/\b(bluray|blu\-ray)\b/i.test(fullContext)) {
    sourceTag = "BluRay";
  }

  var line5 = "⛓️‍💥 4KHDHub.com 📥 " + sourceTag;

  var formattedTitle = line1 + "\n" + line2 + "\n" + line3 + "\n" + line4 + "\n" + line5;

  var is4K = displayQuality === "2160p";
  var baseResWeight = is4K ? 9000000 : (displayQuality.includes("1080") ? 6000000 : 3000000);
  var structuralSortWeight = baseResWeight + numericalSizeWeight;

  return {
    name: headerName,
    title: formattedTitle,
    size: formattedTitle,
    url: url || "",
    _resWeight: baseResWeight,
    _sortWeight: structuralSortWeight,
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: {
        request: headers || { "Referer": BASE_URL + "/" }
      }
    }
  };
}

function getStreams(tmdbId, mediaType, season = null, episode = null) {
  return __async(this, null, function* () {
    const isSeries = mediaType === "tv" || mediaType === "series";
    if (!tmdbId || (!isSeries && mediaType !== "movie"))
      return [];
    try {
      console.log(`[${PROVIDER_NAME}] Request: tmdbId=${tmdbId} type=${mediaType} S=${season} E=${episode}`);
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

      var epLabel = '';
      if (isSeries) {
        var s = parseInt(season, 10) || 1;
        var e = parseInt(episode, 10) || 1;
        epLabel = 'S' + (s < 10 ? '0' : '') + s + 'E' + (e < 10 ? '0' : '') + e;
      }

      const seen = {};
      const streams = [];

      for (let i = 0; i < extracted.length; i++) {
        const stream = extracted[i];
        if (!isDirectVideo(stream.url) || seen[stream.url])
          continue;
        seen[stream.url] = true;

        const rawContext = `${stream.title} [${stream.size}] ${stream.quality}`;
        const streamObj = makeStream(
          metadata.title,
          rawContext,
          stream.url,
          stream.quality,
          { "Referer": BASE_URL + "/", "User-Agent": USER_AGENT },
          epLabel.trim(),
          metadata
        );

        streams.push(streamObj);
      }

      var sortedStreams = streams.sort(function(a, b) {
        return (b._sortWeight || 0) - (a._sortWeight || 0);
      });

      console.log(`[${PROVIDER_NAME}] Returning ${sortedStreams.length} stream(s)`);
      return sortedStreams;
    } catch (error) {
      console.error(`[${PROVIDER_NAME}] Error: ${error.message}`);
      return [];
    }
  });
}

module.exports = { getStreams };
