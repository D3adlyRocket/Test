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

// Updated base API URL (removing /manifest.json for routing)
const EINTHUSAN_API = "https://einthusan.asaddon.com/hindi";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
};

const pad2 = (n) => String(Number.parseInt(n ?? 0, 10) || 0).padStart(2, "0");

const cleanText = (str) =>
  String(str ?? "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, "")
    .trim();

const extractSourceName = (rawName) => {
  const cleaned = cleanText(rawName);
  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  const words = lines[0]?.split(/\s+/).filter(Boolean) || [];
  return words.filter((w) => !/^[$@#~%^&*()+=\[\]{}|:";'<>?,./!]+$/.test(w))[0] || "Einthusan";
};

// Relaxed quality extractor since Einthusan doesn't use the Pynvix format
const extractQualitySpecs = (description) => {
  const cleaned = cleanText(description);
  if (!cleaned) return "HD";
  // Look for common quality keywords, default to HD if none found
  if (cleaned.toLowerCase().includes("1080p")) return "1080p";
  if (cleaned.toLowerCase().includes("720p")) return "720p";
  return "HD";
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

function buildStream(item) {
  return __async(this, null, function* () {
    if (!item?.url || item.externalUrl) return null;
    if (String(item.url).includes("github.com")) return null;

    const descToParse = item.description || item.title || "";
    const sourceName = extractSourceName(item.name);
    const qualitySpecs = extractQualitySpecs(descToParse);
    
    // Default language to Hindi since this is the /hindi endpoint
    const language = "Hindi"; 

    // Construct your custom sleek layout block
    const fullLayout = 
`🎦 ${sourceName}
💎 ${qualitySpecs} | 🗣️ ${language}
🎞️ MP4/MKV | 🔗 Einthusan`;

    const headers = {
      ...(item.behaviorHints?.proxyHeaders?.request ?? {}),
      ...(item.behaviorHints?.headers ?? {}),
    };

    const streamUrl = isProxyUrl(item.url)
      ? yield resolveProxyUrl(item.url)
      : item.url;

    if (!streamUrl) return null;

    // Return the formatted object Stremio expects
    return {
      name: `Einthusan | ${qualitySpecs} | ${language}`,
      title: fullLayout,
      description: fullLayout,
      url: streamUrl,
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      behaviorHints: item.behaviorHints ?? {}
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

    const streams = yield Promise.all(validItems.map(buildStream));
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

      // Einthusan focuses heavily on Bollywood/Hindi movies, but layout handles both structures
      if (!isSeries) {
        return yield fetchStreams(`${EINTHUSAN_API}/stream/movie/${imdbId}.json`);
      }

      return yield fetchFirstValid([
        `${EINTHUSAN_API}/stream/series/${imdbId}:${pad2(s)}:${pad2(e)}.json`,
        `${EINTHUSAN_API}/stream/series/${imdbId}:${parseInt(s, 10) || 1}:${parseInt(e, 10) || 1}.json`,
      ]);
    } catch {
      return [];
    }
  });
}

module.exports = { getStreams };
