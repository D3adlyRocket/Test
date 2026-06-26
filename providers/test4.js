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

const extractQuality = (titleText, urlStr) => {
  const combined = `${titleText} ${urlStr}`.toLowerCase();
  if (combined.includes("4k") || combined.includes("2160p")) return "2160p";
  if (combined.includes("1080p")) return "1080p";
  if (combined.includes("720p")) return "720p";
  if (combined.includes("480p")) return "480p";
  const match = combined.match(/(\d{3,4}p)/i);
  return match ? match[0].toLowerCase() : "1080p";
};

const extractAudioOrLanguage = (titleText, urlStr) => {
  const decodedUrl = decodeURIComponent(urlStr ?? "").toLowerCase();
  const titleLower = String(titleText ?? "").toLowerCase();

  if (decodedUrl.includes("/hindidub/") || titleLower.includes("hindi dub")) return "Hindi-Dub";
  if (decodedUrl.includes("/telugudub/") || titleLower.includes("telugu dub")) return "Telugu-Dub";
  if (decodedUrl.includes("/tamildub/") || titleLower.includes("tamil dub")) return "Tamil-Dub";
  if (decodedUrl.includes("/engdub/") || titleLower.includes("eng dub")) return "English-Dub";

  const bracketMatch = titleLower.match(/[([]([^)\]]+)[)\]]/);
  if (bracketMatch && bracketMatch[1].trim() !== "hd stream") {
    const rawLang = bracketMatch[1].trim();
    return rawLang.charAt(0).toUpperCase() + rawLang.slice(1);
  }

  if (/multi|dual/i.test(titleLower + decodedUrl)) return "Multi-Audio";
  if (/hindi/i.test(titleLower + decodedUrl)) return "Hindi";
  if (/eng/i.test(titleLower + decodedUrl)) return "English";

  return "Default Audio";
};

const extractMediaNameFromUrl = (urlStr) => {
  const decodedUrl = decodeURIComponent(urlStr ?? "");
  const match = decodedUrl.match(/\/movies\/[^/]+\/([^/]+)/i);
  return match ? match[1].replace(/%20/g, " ").trim() : "Project Hail Mary (2026)";
};

const extractContainerFormat = (urlStr) => {
  const cleanUrl = String(urlStr ?? "").split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".mp4")) return "MP4";
  if (cleanUrl.endsWith(".mkv")) return "MKV";
  if (cleanUrl.endsWith(".m3u8")) return "HLS";
  return "Video";
};

const extractServerName = (urlStr) => {
  try {
    const hostname = new URL(urlStr).hostname.toUpperCase();
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

    // Dynamic resolution emoji assignment logic
    let qualityEmoji = "";
    if (quality === "2160p") qualityEmoji = "💎 2160p";
    else if (quality === "1080p") qualityEmoji = "🔥 1080p";
    else if (quality === "720p") qualityEmoji = "📺 720p";
    else qualityEmoji = `📺 ${quality}`;

    const audioFlag = audio.includes("Hindi") ? "Hindi 🇮🇳" : audio;

    // Header structure: TENIES.SITE | Audio | Quality
    const headerName = `TENIES.SITE | ${audio} | ${quality.toUpperCase()}`;

    // Line-by-line subtitle mapping matching your specifications
    const lines = [
      qualityEmoji,
      `🎬 ${mediaName}`,
      `🌍 ${audioFlag}`,
      `🎞️ ${container}`,
      `🔗 ${serverName}`
    ];
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
      ...(Object.keys(computedHeaders).length > 0 ? { headers: computedHeaders } : {}),
    };

    // NATIVE PROPERTY INTERCEPTOR ENGINE
    // Forces Nuvio to read the custom formatted lines on both TV and Mobile layouts
    try {
      Object.defineProperties(streamObject, {
        title: { get: function() { return unifiedLayoutBlock; }, enumerable: true, configurable: true },
        description: { get: function() { return unifiedLayoutBlock; }, enumerable: true, configurable: true },
        size: { get: function() { return unifiedLayoutBlock; }, enumerable: true, configurable: true },
        qualityTag: { get: function() { return ""; }, enumerable: true, configurable: true },
        quality: { get: function() { return "\x08"; }, enumerable: true, configurable: true },
        language: { get: function() { return ""; }, enumerable: true, configurable: true }
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
    return streams.filter(Boolean);
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
