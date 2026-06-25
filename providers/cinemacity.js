"use strict";

const __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    const fulfilled = (value) => {
      try { step(generator.next(value)); } catch (e) { reject(e); }
    };
    const rejected = (value) => {
      try { step(generator.throw(value)); } catch (e) { reject(e); }
    };
    const step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

const PROVIDER_NAME = "Cinescrape";
const PYNVIX_PROVIDERS = [
  "https://cinescrape-srkf.onrender.com/providers=fmftp",
  "https://cinescrape-srkf.onrender.com/providers=moviebox",
  "https://cinescrape-srkf.onrender.com/providers=nowhdtime",
  "https://cinescrape-srkf.onrender.com/providers=infomedia",
  "https://cinescrape-srkf.onrender.com/providers=royalflix",
  "https://cinescrape-srkf.onrender.com/providers=miruro",
  "https://cinescrape-srkf.onrender.com/providers=dudefilms",
  "https://cinescrape-srkf.onrender.com/providers=netmirror"
];

const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
};

const pad2 = (n) => String(Number.parseInt(n ?? 0, 10) || 0).padStart(2, "0");
const cleanText = (str) => String(str ?? "").replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, "").trim();

const extractQuality = (titleText) => {
  const match = String(titleText ?? "").match(/(\d{3,4}p)/i);
  return match?.[0] ?? "1080p";
};

const isProxyUrl = (url) =>
  String(url ?? "").includes("workers.dev") || /[?&]url=/.test(String(url ?? ""));

function getImdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const type = mediaType === "tv" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    try {
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
      return data?.external_ids?.imdb_id ?? null;
    } catch {
      return null;
    }
  });
}

function resolveProxyUrl(url) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(url, {
        redirect: "follow",
        headers: { ...HEADERS, "Referer": url },
      });
      const finalUrl = response.url;
      if ([".m3u8", ".mp4", ".mkv"].some((ext) => finalUrl.includes(ext))) {
        return finalUrl;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/plain")) {
        const text = yield response.text();
        return text.trim() || null;
      }
      if (contentType.includes("application/json")) {
        const data = yield response.json();
        return data?.url ?? data?.stream ?? data?.src ?? null;
      }
      return finalUrl || null;
    } catch {
      return null;
    }
  });
}

// ==================== FLAWLESS STRATIFIED LAYOUT ENGINE ====================
function makeStream(name, title, url, quality, serverType, referer, fileSize) {
  var internalQuality = quality ? quality.toLowerCase() : "1080p";
  var encodedUrl = url.replace(/ /g, "%20");
  
  var cleanNameText = String(name || "").replace(/\./g, " ");
  var cleanTitleText = String(title || "").replace(/\./g, " ");
  var combinedScanText = (cleanNameText + " " + cleanTitleText + " " + encodedUrl).toLowerCase();
  var audioScan = combinedScanText.replace(/[\s\.]+/g, "");

  // 1. STRICT LANGUAGE MATRIX ENGINE
  var shortLangLabel = "Dual-Audio"; 
  var hasHindi = /\bhindi\b/i.test(combinedScanText);
  var hasEng = /\b(english|eng)\b/i.test(combinedScanText);
  var hasTamil = /\btamil\b/i.test(combinedScanText);
  var hasTelugu = /\btelugu\b/i.test(combinedScanText);
  
  var langCount = 0;
  if (hasHindi) langCount++;
  if (hasEng) langCount++;
  if (hasTamil) langCount++;
  if (hasTelugu) langCount++;

  if (/\b(multi|multi-audio|multi\.audio)\b/i.test(combinedScanText) || langCount >= 3) {
    shortLangLabel = "Multi-Audio";
  } else if (/\b(dual|dual-audio|dual\.audio|dubbed)\b/i.test(combinedScanText) || langCount === 2) {
    shortLangLabel = "Dual-Audio";
  } else if (langCount === 1) {
    if (hasHindi) shortLangLabel = "Hindi";
    else if (hasTamil) shortLangLabel = "Tamil";
    else if (hasTelugu) shortLangLabel = "Telugu";
    else if (hasEng) shortLangLabel = "English";
  }

  // 2. SERIES & MOVIE TITLE CLEANING ENGINE
  var cleanDisplayTitle = cleanNameText;
  var seasonEpisodeBlock = "";
  
  var tvMatch = cleanNameText.match(/\b(S\d{1,2}\s*E\d{1,2})\b/i);
  if (tvMatch) {
    seasonEpisodeBlock = " | " + tvMatch[1].toUpperCase().replace(/\s+/g, "");
    var tvIdx = cleanNameText.toLowerCase().indexOf(tvMatch[0].toLowerCase());
    if (tvIdx > 0) cleanDisplayTitle = cleanNameText.substring(0, tvIdx);
  }

  var yearBlock = "";
  var yearMatch = cleanDisplayTitle.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    yearBlock = yearMatch[0];
    var titleEndIdx = cleanDisplayTitle.indexOf(yearBlock);
    if (titleEndIdx > 0) cleanDisplayTitle = cleanDisplayTitle.substring(0, titleEndIdx);
  }

  cleanDisplayTitle = cleanDisplayTitle
    .replace(/AMZN|WEB-DL|AVC|x264|x265|HEVC|STAN|WEBRip|SDR|10bit/gi, "")
    .replace(/[-_()\[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  cleanDisplayTitle = cleanDisplayTitle.replace(/\b\w/g, function (c) { return c.toUpperCase(); });

  // 3. SUBHEADING LINE CONFIGURATIONS
  var qUpper = internalQuality.toUpperCase();
  var qEmoji = (internalQuality === "2160p" || internalQuality.includes("4k")) ? "🌟" : "💎";
  var line2 = qEmoji + " " + qUpper + " | 🌍 " + shortLangLabel + " | 💾 " + (fileSize || "N/A");

  var dynamicHdr = "";
  var showLightning = false;
  if (/\b(hdr10\+|hdr10p)\b/i.test(combinedScanText)) { dynamicHdr = "HDR10+"; showLightning = true; }
  else if (/\bhdr10\b/i.test(combinedScanText)) { dynamicHdr = "HDR10"; showLightning = true; }
  else if (/\bhdr\b/i.test(combinedScanText)) { dynamicHdr = "HDR"; showLightning = true; }
  else if (/\bsdr\b/i.test(combinedScanText)) { dynamicHdr = "SDR"; showLightning = true; }

  var bitDepth = /\b10bit\b/i.test(combinedScanText) ? "🔆 10Bit" : "";
  var dv = /\b(dv|dolby\s*vision)\b/i.test(combinedScanText) ? "🕵️‍♀️ DV" : "";
  var isBluRay = /\bbluray\b/i.test(combinedScanText);
  
  var codecTag = "x264";
  if (/\b(hevc|x265|265)\b/i.test(combinedScanText) || internalQuality === "2160p") codecTag = "HEVC x265";

  var line3Part1Elements = [];
  if (dynamicHdr) line3Part1Elements.push(dynamicHdr);
  if (bitDepth) line3Part1Elements.push(bitDepth);
  var line3Part1 = line3Part1Elements.join(" • ");

  var line3Part2Elements = [];
  if (isBluRay) line3Part2Elements.push("📀 BluRay");
  if (dv) line3Part2Elements.push(dv);
  var line3Part2 = line3Part2Elements.join(" • ");

  var metaParts = [];
  if (line3Part1) metaParts.push(line3Part1);
  if (line3Part2) metaParts.push(line3Part2);

  var line3 = "";
  if (metaParts.length > 0) {
    var prefix = showLightning ? "⚡ " : "";
    line3 = prefix + metaParts.join(" | ") + " | 🎥 " + codecTag;
  } else {
    line3 = "🎥 " + codecTag;
  }

  var formatTag = "🎞️ MKV";
  if (/\bmp4\b/i.test(combinedScanText) || encodedUrl.toLowerCase().split('?')[0].endsWith(".mp4")) {
    formatTag = "🎞️ MP4";
  }

  var audioChannelTag = "DDP 5.1";
  var displayAtmos = /\batmos\b/i.test(combinedScanText);

  if (audioScan.indexOf("ddp51") !== -1 && audioScan.indexOf("truehd") !== -1 && audioScan.indexOf("71") !== -1) {
    audioChannelTag = "DDP 5.1 + TrueHD 7.1";
    displayAtmos = true;
  }
  else if (audioScan.indexOf("ddp51") !== -1 && audioScan.indexOf("ddp71") !== -1) {
    audioChannelTag = "DDP 5.1 + DDP 7.1";
  }
  else if (audioScan.indexOf("ddp51") !== -1 && audioScan.indexOf("aac71") !== -1) {
    audioChannelTag = "DDP 5.1 + AAC 7.1";
  }
  else if (audioScan.indexOf("ddp51") !== -1) {
    audioChannelTag = "DDP 5.1";
  }
  else {
    if (audioScan.indexOf("truehd") !== -1) {
      audioChannelTag = "TrueHD 7.1";
    } else if (audioScan.indexOf("aac") !== -1) {
      audioChannelTag = (audioScan.indexOf("71") !== -1) ? "AAC 7.1" : "AAC 5.1";
    } else {
      audioChannelTag = "DDP 5.1";
    }
  }

  var atmosBlock = displayAtmos ? " • 🔊 Atmos" : "";
  var line4 = formatTag + " | 🎧 " + audioChannelTag + atmosBlock + " |";

  var sourceOrigin = "WEB-DL";
  if (isBluRay) sourceOrigin = "BluRay";
  else if (/\b(webrip|hdrip)\b/i.test(combinedScanText)) sourceOrigin = "WEB-Rip";

  var imaxBlock = /\bimax\b/i.test(combinedScanText) ? " | 👁️ iMAX" : "";
  var line5 = "🔗 " + (serverType || "Direct") + " | ☁️ " + sourceOrigin + imaxBlock;

  // 4. STRATIFIED LAYOUT GENERATION
  var finalName = PROVIDER_NAME + " | " + qUpper + " | " + shortLangLabel;
  var finalTitle = 
    "🎬 " + cleanDisplayTitle + (yearBlock ? " - (" + yearBlock + ")" : "") + seasonEpisodeBlock + "\n" +
    line2 + "\n" +
    line3 + "\n" +
    line4 + "\n" +
    line5;

  var baseStream = {
    name: finalName,
    title: finalTitle,
    size: finalTitle, 
    url: encodedUrl,
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: { request: { ...Object.keys(baseStream?.behaviorHints?.proxyHeaders?.request || {}).length > 0 ? baseStream.behaviorHints.proxyHeaders.request : { "Referer": "https://4khdhub.one/" } } }
    }
  };

  try {
    Object.defineProperties(baseStream, {
      qualityTag: { get: function() { return ""; }, enumerable: true, configurable: true },
      quality: { get: function() { return "\x08"; }, enumerable: true, configurable: true },
      language: { get: function() { return ""; }, enumerable: true, configurable: true }
    });
  } catch (e) {}

  return baseStream;
}

function buildStream(item, providerUrl) {
  return __async(this, null, function* () {
    if (!item?.url || item.externalUrl) return null;
    if (String(item.url).includes("github.com")) return null;

    const streamUrl = isProxyUrl(item.url)
      ? yield resolveProxyUrl(item.url)
      : item.url;

    if (!streamUrl) return null;

    // Detect file details from source item details
    const cleanedTitle = cleanText(item.title || item.name || "");
    const quality = extractQuality(cleanedTitle);
    
    let serverName = "Direct";
    if (providerUrl.includes("fmftp")) serverName = "FMFTP";
    else if (providerUrl.includes("moviebox")) serverName = "MovieBox";
    else if (providerUrl.includes("netmirror")) serverName = "NetMirror";
    else if (providerUrl.includes("miruro")) serverName = "Miruro";

    // Feed directly into the stratified visual formatting engine automatically
    return makeStream(cleanedTitle, item.title || "", streamUrl, quality, serverName, providerUrl, "N/A");
  });
}

function parseStreams(data, providerUrl) {
  return __async(this, null, function* () {
    if (!Array.isArray(data?.streams) || data.streams.length === 0) return [];

    const validItems = data.streams.filter((item) => {
      if (typeof item?.url !== "string" || !item.url.startsWith("https")) return false;
      return true;
    });

    const streams = yield Promise.all(validItems.map(item => buildStream(item, providerUrl)));
    return streams.filter(Boolean);
  });
}

function fetchStreams(url) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(url);
      if (!response.ok) return [];
      const data = yield response.json();
      return yield parseStreams(data, url);
    } catch {
      return [];
    }
  });
}

function fetchFirstValid(urls) {
  return __async(this, null, function* () {
    for (const url of urls) {
      const streams = yield fetchStreams(url);
      if (streams.length > 0) return streams;
    }
    return [];
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const isSeries = mediaType === "tv" || season != null || episode != null;
    const s = season ?? 1;
    const e = episode ?? 1;

    try {
      const imdbId = yield getImdbId(tmdbId, isSeries ? "tv" : "movie");
      if (!imdbId) return [];

      let allStreams = [];

      for (const provider of PYNVIX_PROVIDERS) {
        if (!isSeries) {
          const streams = yield fetchStreams(`${provider}/stream/movie/${imdbId}.json`);
          if (streams.length > 0) allStreams = allStreams.concat(streams);
        } else {
          const streams = yield fetchFirstValid([
            `${provider}/stream/series/${imdbId}:${pad2(s)}:${pad2(e)}.json`,
            `${provider}/stream/series/${imdbId}:${parseInt(s, 10) || 1}:${parseInt(e, 10) || 1}.json`,
          ]);
          if (streams.length > 0) allStreams = allStreams.concat(streams);
        }
      }

      // --- ENGINE WEIGHT SORTING ---
      allStreams.forEach(function(s) {
          var scan = (s.title || "").toLowerCase();
          if (scan.indexOf("2160p") !== -1 || scan.indexOf("4k") !== -1) s._resWeight = 4;
          else if (scan.indexOf("1080p") !== -1) s._resWeight = 3;
          else if (scan.indexOf("720p") !== -1) s._resWeight = 2;
          else s._resWeight = 1;
      });

      allStreams.sort((a, b) => b._resWeight - a._resWeight);
      allStreams.forEach(s => delete s._resWeight);

      return allStreams;
    } catch {
      return [];
    }
  });
}

module.exports = { getStreams };
