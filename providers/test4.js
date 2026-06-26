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

// Enhanced extractor to hunt for resolutions anywhere in the provider title
const extractQuality = (titleText) => {
  const match = String(titleText ?? "").match(/(\d{3,4}p|4k|uhd)/i);
  return match ? match[0].toUpperCase() : "1080P";
};

// Enhanced extractor to pull languages, audio formats, or tags inside parentheses/brackets
const extractAudioOrLanguage = (titleText) => {
  const cleanTitle = cleanText(titleText);
  
  // Try to grab content inside brackets or parentheses first (e.g., "[ENG/SPA]" or "(Dual-Audio)")
  const bracketMatch = cleanTitle.match(/[([]([^)\]]+)[)\]]/);
  if (bracketMatch) {
    const extracted = bracketMatch[1].trim();
    if (extracted.toLowerCase() !== "hd stream") return extracted;
  }

  // Look for common audio keywords if no brackets exist
  if (/multi|dual/i.test(cleanTitle)) return "Multi-Audio";
  if (/eng/i.test(cleanTitle)) return "English";
  
  return "Default Audio";
};

// Extractor to find file sizes (e.g., "1.4 GB", "850 MB") if provided in the source title
const extractSize = (titleText) => {
  const match = String(titleText ?? "").match(/(\d+(?:\.\d+)?\s*(?:GB|MB))/i);
  return match ? match[0] : "";
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

function makeStream(item) {
  return __async(this, null, function* () {
    if (!item?.url || item.externalUrl) return null;
    if (String(item.url).includes("github.com")) return null;

    // We preserve and pass the raw upstream item.title to our smart extractors
    const rawTitle = item.title ?? "";
    const quality = extractQuality(rawTitle);
    const audio = extractAudioOrLanguage(rawTitle);
    const size = extractSize(rawTitle);

    const headers = {
      ...(item.behaviorHints?.proxyHeaders?.request ?? {}),
      ...(item.behaviorHints?.headers ?? {}),
    };

    const streamUrl = isProxyUrl(item.url)
      ? yield resolveProxyUrl(item.url)
      : item.url;

    if (!streamUrl) return null;

    // Layout configuration matched to display unique attributes per link slot:
    // Format: "Tenies.Site | Audio | Quality"
    const headerName = `Tenies.Site | ${audio} | ${quality}`;

    // The subtitle secondary block (visible when selecting/expanding streams)
    const detailLines = [`⚡ Source: Direct Link`];
    if (size) detailLines.push(`💾 Size: ${size}`);
    if (item.title) detailLines.push(`📝 Info: ${cleanText(item.title)}`);

    return {
      name: headerName,
      title: detailLines.join("\n"),
      url: streamUrl,
      behaviorHints: {
        notWebReady: false,
        bingeGroup: `tenies-${quality}-${audio}`
      },
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    };
  });
}

function parseStreams(data) {
  return __async(this, null, function* () {
    if (!Array.isArray(data?.streams) || data.streams.length === 0) return [];

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
      const response = yield fetch(url);
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

module.exports = { getStreams };
