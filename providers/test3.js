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

const MOVIEBOX_API = "https://moviebox-cfa7.onrender.com/source=all%7Clang=all%7Cres=all";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
};

const pad2 = (n) => String(Number.parseInt(n ?? 0, 10) || 0).padStart(2, "0");

// --- EXTRACTION & FORMATTING HELPERS ---

const extractQuality = (text) => {
  const match = text.match(/(2160p|1080p|720p|480p|360p|4k)/i);
  return match ? match[1].toLowerCase() : "Unknown Quality";
};

const formatQualityEmoji = (quality) => {
  const q = quality.toLowerCase();
  if (q.includes("2160") || q.includes("4k")) return `🔥 ${quality}`;
  if (q.includes("1080")) return `💎 ${quality}`;
  if (q.includes("720")) return `📺 ${quality}`;
  if (q.includes("unknown")) return `✨ Unknown`;
  return `📱 ${quality}`; 
};

const extractLanguage = (text) => {
  const t = text.toLowerCase();
  // Scanning the entire string for language keywords instead of relying on parentheses
  if (t.includes("hindi")) return "Hindi";
  if (t.includes("tamil")) return "Tamil";
  if (t.includes("telugu")) return "Telugu";
  if (t.includes("malayalam")) return "Malayalam";
  if (t.includes("korean")) return "Korean";
  if (t.includes("japanese")) return "Japanese";
  if (t.includes("french")) return "French";
  if (t.includes("spanish")) return "Spanish";
  if (t.includes("multi")) return "Multi-Audio";
  if (t.includes("dual")) return "Dual-Audio";
  return "English"; // Fallback
};

const formatLanguageEmoji = (language) => {
  const l = language.toLowerCase();
  if (l.includes("english")) return "🇺🇲 [English]";
  if (l.includes("hindi")) return "🇮🇳 [Hindi]";
  if (l.includes("tamil") || l.includes("telugu") || l.includes("malayalam")) return `🇮🇳 [${language}]`;
  if (l.includes("multi") || l.includes("dual")) return `🌍 [${language}]`;
  if (l.includes("korean")) return `🇰🇷 [${language}]`;
  if (l.includes("japanese")) return `🇯🇵 [${language}]`;
  return `🗣️ [${language}]`;
};

const extractCodec = (text) => {
  const t = text.toLowerCase();
  if (/hevc|x265|h265/.test(t)) return "HEVC/x265";
  if (/x264|h264/.test(t)) return "x264";
  return "Auto";
};

const extractFormat = (text) => {
  const t = text.toLowerCase();
  if (t.includes(".mkv") || t.includes("mkv")) return "MKV";
  if (t.includes(".mp4") || t.includes("mp4")) return "MP4";
  if (t.includes(".avi") || t.includes("avi")) return "AVI";
  return "Stream";
};

// --- END HELPERS ---

const isProxyUrl = (url) =>
  String(url ?? "").includes("workers.dev") || /[?&]url=/.test(String(url ?? ""));

// Modified to fetch Title and Year alongside the IMDB ID directly from TMDB
function getTmdbInfo(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const type = mediaType === "tv" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    try {
      const response = yield fetch(url);
      if (!response.ok) return null;
      const data = yield response.json();
      
      const imdbId = data?.external_ids?.imdb_id ?? null;
      const title = data?.name || data?.title || "Unknown Title";
      const year = (data?.release_date || data?.first_air_date || "").split("-")[0] || "";
      
      return { imdbId, title, year };
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

// Meta object is passed down to properly map the true TMDB Title
function buildStream(item, meta) {
  return __async(this, null, function* () {
    if (!item?.url || item.externalUrl) return null;
    if (String(item.url).includes("github.com")) return null;

    const streamUrl = isProxyUrl(item.url)
      ? yield resolveProxyUrl(item.url)
      : item.url;

    if (!streamUrl) return null;

    // Combine any text fields MovieBox sends to search for codecs/languages
    const fullText = (String(item.title || "") + " " + String(item.name || "")).toLowerCase();
    
    // Extracted Data
    const rawQuality = extractQuality(fullText);
    const rawLanguage = extractLanguage(fullText);
    const codec = extractCodec(fullText);
    const format = extractFormat(fullText) || extractFormat(streamUrl);
    
    // Formatted Strings (Emojis mapped)
    const formattedQuality = formatQualityEmoji(rawQuality);
    const formattedLanguage = formatLanguageEmoji(rawLanguage);
    const serverName = "MovieBox"; 

    // Construct precise Movie/Series Title Header
    let nameYear = `🎬 ${meta.title}`;
    if (meta.year) nameYear += ` - (${meta.year})`;
    if (meta.isSeries) nameYear += ` [S${pad2(meta.season)}E${pad2(meta.episode)}]`;

    // Header: MovieBox | Quality | English or Hindi
    const displayQuality = rawQuality === "Unknown Quality" ? "Unknown" : rawQuality;
    const headerString = `${serverName} | ${displayQuality} | ${rawLanguage}`;

    // Subheadings
    const subHeadingString = `${nameYear}\n${formattedQuality} | ${formattedLanguage}\n⚡${codec} 🎞️ ${format} | 🔗 ${serverName}`;

    const headers = {
      ...(item.behaviorHints?.proxyHeaders?.request ?? {}),
      ...(item.behaviorHints?.headers ?? {}),
    };

    return {
      name: headerString,
      title: subHeadingString,
      description: subHeadingString, // <-- CRITICAL: Stremio Mobile requires 'description' for multiline text
      url: streamUrl,
      ...(Object.keys(headers).length > 0 ? { behaviorHints: { proxyHeaders: { request: headers } } } : {})
    };
  });
}

function parseStreams(data, meta) {
  return __async(this, null, function* () {
    if (!Array.isArray(data?.streams) || data.streams.length === 0) return [];

    const validItems = data.streams.filter((item) => {
      if (typeof item?.url !== "string" || !item.url.startsWith("https")) return false;
      const innerMatch = item.url.match(/[?&]url=(https?:\/\/[^&]+)/);
      return !innerMatch || innerMatch[1].startsWith("https");
    });

    const streams = yield Promise.all(validItems.map(item => buildStream(item, meta)));
    return streams.filter(Boolean);
  });
}

function fetchStreams(url, meta) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(url);
      if (!response.ok) return [];
      const data = yield response.json();
      return yield parseStreams(data, meta);
    } catch {
      return [];
    }
  });
}

function fetchFirstValid(urls, meta) {
  return __async(this, null, function* () {
    for (const url of urls) {
      const streams = yield fetchStreams(url, meta);
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
      // Fetch TMDB Metadata alongside IMDB conversion
      const tmdbInfo = yield getTmdbInfo(tmdbId, isSeries ? "tv" : "movie");
      if (!tmdbInfo || !tmdbInfo.imdbId) return [];

      // Pack metadata to pass to the stream builder
      const meta = {
        title: tmdbInfo.title,
        year: tmdbInfo.year,
        isSeries,
        season: s,
        episode: e
      };

      if (!isSeries) {
        return yield fetchStreams(`${MOVIEBOX_API}/stream/movie/${tmdbInfo.imdbId}.json`, meta);
      }

      return yield fetchFirstValid([
        `${MOVIEBOX_API}/stream/series/${tmdbInfo.imdbId}:${pad2(s)}:${pad2(e)}.json`,
        `${MOVIEBOX_API}/stream/series/${tmdbInfo.imdbId}:${parseInt(s, 10) || 1}:${parseInt(e, 10) || 1}.json`,
      ], meta);
    } catch {
      return [];
    }
  });
}

module.exports = { getStreams };
