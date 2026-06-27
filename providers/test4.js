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

const TENIES_API = "https://nuvio-addon.tenies.site/abckdhfik-34585674";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
};

const pad2 = (n) => String(Number.parseInt(n ?? 0, 10) || 0).padStart(2, "0");

const cleanText = (str) =>
  String(str ?? "")
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, "")
    .trim();

const getDeepUrl = (urlStr) => {
  if (!urlStr) return "";
  try {
    const decoded = decodeURIComponent(urlStr);
    const match = decoded.match(/https?:\/\/[^?]+/g);
    return match && match.length > 1 ? match[match.length - 1] : decoded;
  } catch {
    return urlStr;
  }
};

function fetchFileSize(urlStr) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(urlStr, { method: "HEAD", headers: HEADERS });
      const bytes = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
      if (!bytes || Number.isNaN(bytes)) return "";
      
      const gb = bytes / (1024 * 1024 * 1024);
      if (gb >= 1) return gb.toFixed(1) + " GB";
      
      const mb = bytes / (1024 * 1024);
      return mb.toFixed(0) + " MB";
    } catch {
      return "";
    }
  });
}

const extractQuality = (titleText, urlStr) => {
  const decodedUrl = getDeepUrl(urlStr).toLowerCase();
  const combined = `${titleText} ${decodedUrl}`.toLowerCase();
  
  if (combined.includes("4k") || combined.includes("2160p") || combined.includes("uhd")) return "2160p";
  if (combined.includes("1080p") || combined.includes("fhd")) return "1080p";
  if (combined.includes("720p") || combined.includes("hd")) return "720p";
  if (combined.includes("480p") || combined.includes("sd")) return "480p";
  
  const match = combined.match(/(\d{3,4}p)/i);
  return match ? match[0].toLowerCase() : "1080p";
};

const extractAudioOrLanguage = (titleText, urlStr) => {
  const decodedUrl = getDeepUrl(urlStr).toLowerCase();
  const titleLower = String(titleText ?? "").toLowerCase();
  const combined = `${titleLower} ${decodedUrl}`;

  if (decodedUrl.includes("/hindidub/") || combined.includes("hindi-dub") || combined.includes("hindi dub")) return "Hindi-Dub";
  if (decodedUrl.includes("/telugudub/") || combined.includes("telugu-dub") || combined.includes("telugu dub")) return "Telugu-Dub";
  if (decodedUrl.includes("/tamildub/") || combined.includes("tamil-dub") || combined.includes("tamil dub")) return "Tamil-Dub";
  if (decodedUrl.includes("/engdub/") || combined.includes("english-dub") || combined.includes("eng dub")) return "English-Dub";

  const bracketMatch = combined.match(/[([]([^)\]]+)[)\]]/);
  if (bracketMatch && bracketMatch[1].trim() !== "hd stream") {
    const rawLang = bracketMatch[1].trim();
    return rawLang.charAt(0).toUpperCase() + rawLang.slice(1);
  }

  if (/multi|dual/i.test(combined)) return "Multi-Audio";
  if (/hindi/i.test(combined)) return "Hindi";
  if (/eng/i.test(combined)) return "English";

  return "Default Audio";
};

const extractMediaNameFromUrl = (urlStr) => {
  const decodedUrl = getDeepUrl(urlStr);
  const match = decodedUrl.match(/\/movies\/[^/]+\/([^/]+)/i);
  return match ? match[1].replace(/%20/g, " ").trim() : "Project Hail Mary (2026)";
};

const extractContainerFormat = (urlStr) => {
  const cleanUrl = getDeepUrl(urlStr).split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".mp4")) return "MP4";
  if (cleanUrl.endsWith(".mkv")) return "MKV";
  if (cleanUrl.endsWith(".m3u8")) return "HLS";
  return "Video";
};

const extractServerName = (urlStr) => {
  try {
    const targetUrl = getDeepUrl(urlStr);
    const hostname = new URL(targetUrl).hostname.toUpperCase();
    
    if (hostname.includes("HUBCLOUD")) return "HubCloud Server";
    if (hostname.includes("WHISTLE")) return "HubWhistle Server";
    if (urlStr.includes("sooti.info")) return "Sooti Proxy [" + hostname.replace("WWW.", "") + "]";
    
    return hostname.replace("WWW.", "") + " Server";
  } catch {
    return "FMFTP Server";
  }
};

function getImdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const type = mediaType === "tv" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    try {
      const response = yield fetch(url, { headers: HEADERS });
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

function makeStream(item) {
  return __async(this, null, function* () {
    if (!item?.url || item.externalUrl) return null;
    if (String(item.url).includes("github.com")) return null;

    const streamUrl = isProxyUrl(item.url)
      ? yield resolveProxyUrl(item.url)
      : item.url;

    if (!streamUrl) return null;

    const rawTitle = item.title ?? "";
    const quality = extractQuality(rawTitle, streamUrl);
    const audio = extractAudioOrLanguage(rawTitle, streamUrl);
    const mediaName = extractMediaNameFromUrl(streamUrl);
    const container = extractContainerFormat(streamUrl);
    const serverName = extractServerName(streamUrl);
    
    const realSize = yield fetchFileSize(streamUrl);

    let qualityEmoji = "";
    if (quality === "2160p") qualityEmoji = "💎 2160p";
    else if (quality === "1080p") qualityEmoji = "🔥 1080p";
    else if (quality === "720p") qualityEmoji = "📺 720p";
    else qualityEmoji = `📺 ${quality}`;

    const audioFlag = audio.includes("Hindi") ? "Hindi 🇮🇳" : audio;
    
    const headerName = `TENIES.SITE | ${audio} | ${quality.toUpperCase()}`;

    const lines = [
      qualityEmoji,
      `🎬 ${mediaName}`,
      `🌍 ${audioFlag}`,
      `🎞️ ${container}`,
      `🔗 ${serverName}`
    ];
    
    if (realSize) {
      lines.push(`💾 Size: ${realSize}`);
    }
    
    const unifiedLayoutBlock = lines.join("\n");

    const computedHeaders = {
      ...(item.behaviorHints?.proxyHeaders?.request ?? {}),
      ...(item.behaviorHints?.headers ?? {}),
    };

    const streamObject = {
      name: headerName,
      url: streamUrl,
      behaviorHints: {
        notWebReady: false,
        bingeGroup: `tenies-${quality}-${audio}`
      },
      // Pass raw properties downstairs so the deduplicator layout engine can parse them
      _dedupeMeta: {
        size: realSize || "unknown",
        quality: quality,
        server: serverName
      },
      ...(Object.keys(computedHeaders).length > 0 ? { headers: computedHeaders } : {}),
    };

    try {
      Object.defineProperties(streamObject, {
        title: { get: function() { return unifiedLayoutBlock; }, enumerable: true, configurable: true },
        description: { get: function() { return unifiedLayoutBlock; }, enumerable: true, configurable: true }
      });
    } catch (e) {}

    return streamObject;
  });
}

function parseStreams(data) {
  return __async(this, null, function* () {
    if (!data || !Array.isArray(data.streams) || data.streams.length === 0) return [];

    const validItems = data.streams.filter((item) => {
      if (typeof item?.url !== "string" || !item.url.startsWith("https")) return false;

      const innerMatch = item.url.match(/[?&]url=(https?:\/\/[^&]+)/);
      return !innerMatch || innerMatch[1].startsWith("https");
    });

    const streams = yield Promise.all(validItems.map(makeStream));
    const processed = streams.filter(Boolean);

    const uniqueStreams = [];
    const seenFingerprints = new Set();

    for (const stream of processed) {
      const meta = stream._dedupeMeta;
      
      // If we got size info, compile a strict layout fingerprint string
      // Example: "29.8 GB-2160p-HubWhistle Server"
      const fingerprint = `${meta.size}-${meta.quality}-${meta.server}`.toLowerCase();
      
      // If size is unknown, drop back to safe URL checking so we don't accidentally drop valid items
      if (meta.size === "unknown") {
        const fallbackUrl = getDeepUrl(stream.url);
        if (!seenFingerprints.has(fallbackUrl)) {
          seenFingerprints.add(fallbackUrl);
          uniqueStreams.push(stream);
        }
      } else {
        // Strict deduplication matching based on file payload size and endpoint provider values
        if (!seenFingerprints.has(fingerprint)) {
          seenFingerprints.add(fingerprint);
          uniqueStreams.push(stream);
        }
      }
    }

    return uniqueStreams;
  });
}

function fetchStreams(url) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(url, { headers: HEADERS });
      if (!response.ok) return [];
      const data = yield response.json();
      return yield parseStreams(data);
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

      if (!isSeries) {
        return yield fetchStreams(`${TENIES_API}/stream/movie/${imdbId}.json`);
      }

      return yield fetchFirstValid([
        `${TENIES_API}/stream/series/${imdbId}:${pad2(s)}:${pad2(e)}.json`,
        `${TENIES_API}/stream/series/${imdbId}:${parseInt(s, 10) || 1}:${parseInt(e, 10) || 1}.json`,
      ]);
    } catch {
      return [];
    }
  });
}

const isProxyUrl = (url) =>
  String(url ?? "").includes("workers.dev") || /[?&]url=/.test(String(url ?? ""));

module.exports = { getStreams };
