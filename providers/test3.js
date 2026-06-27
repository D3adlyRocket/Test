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

// Updated API endpoints
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const API_EN = `${MOVIEBOX_BASE}/source=v3|lang=en|res=all`;
const API_HI = `${MOVIEBOX_BASE}/source=v3|lang=hi|res=all`;
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36" };

const pad2 = (n) => String(Number.parseInt(n ?? 0, 10) || 0).padStart(2, "0");

// --- HELPERS (Kept from previous) ---
const extractQuality = (text) => {
  const match = text.match(/(2160p|1080p|720p|480p|360p|4k)/i);
  return match ? match[1].toLowerCase() : "Unknown Quality";
};

const formatQualityEmoji = (quality) => {
  const q = quality.toLowerCase();
  if (q.includes("2160") || q.includes("4k")) return `🔥 ${quality}`;
  if (q.includes("1080")) return `💎 ${quality}`;
  if (q.includes("720")) return `📺 ${quality}`;
  return `📱 ${quality}`; 
};

const formatLanguageEmoji = (lang) => (lang === "Hindi" ? "🇮🇳 [Hindi]" : "🇺🇲 [English]");

const extractCodec = (text) => (/hevc|x265|h265/.test(text.toLowerCase()) ? "HEVC/x265" : "x264");

const extractFormat = (text) => (text.toLowerCase().includes("mkv") ? "MKV" : "MP4");

const isProxyUrl = (url) => String(url ?? "").includes("workers.dev") || /[?&]url=/.test(String(url ?? ""));

function getTmdbInfo(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    try {
      const response = yield fetch(url);
      const data = yield response.json();
      return { imdbId: data?.external_ids?.imdb_id, title: data?.name || data?.title, year: (data?.release_date || data?.first_air_date || "").split("-")[0] };
    } catch { return null; }
  });
}

function resolveProxyUrl(url) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(url, { redirect: "follow", headers: { ...HEADERS, "Referer": url } });
      const finalUrl = response.url;
      if (finalUrl.includes(".m3u8") || finalUrl.includes(".mp4")) return finalUrl;
      const data = yield response.json();
      return data?.url ?? data?.stream ?? null;
    } catch { return null; }
  });
}

// buildStream now takes 'language' as a parameter to ensure accuracy
function buildStream(item, meta, language) {
  return __async(this, null, function* () {
    if (!item?.url) return null;
    const streamUrl = isProxyUrl(item.url) ? yield resolveProxyUrl(item.url) : item.url;
    if (!streamUrl) return null;

    const fullText = (item.title || "").toLowerCase();
    const rawQuality = extractQuality(fullText);
    
    let nameYear = `🎬 ${meta.title} - (${meta.year})`;
    if (meta.isSeries) nameYear += ` [S${pad2(meta.season)}E${pad2(meta.episode)}]`;

    const header = `MovieBox | ${rawQuality} | ${language}`;
    const desc = `${nameYear}\n${formatQualityEmoji(rawQuality)} | ${formatLanguageEmoji(language)}\n⚡${extractCodec(fullText)} 🎞️ ${extractFormat(streamUrl)} | 🔗 MovieBox`;

    return { name: header, title: desc, description: desc, url: streamUrl, quality: rawQuality };
  });
}

function fetchStreams(baseUrl, imdbId, meta, isSeries, s, e, language) {
  return __async(this, null, function* () {
    const url = isSeries 
      ? `${baseUrl}/stream/series/${imdbId}:${pad2(s)}:${pad2(e)}.json`
      : `${baseUrl}/stream/movie/${imdbId}.json`;
    
    try {
      const response = yield fetch(url);
      const data = yield response.json();
      if (!data?.streams) return [];
      return yield Promise.all(data.streams.map(item => buildStream(item, meta, language)));
    } catch { return []; }
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const isSeries = mediaType === "tv" || season != null || episode != null;
    const tmdbInfo = yield getTmdbInfo(tmdbId, isSeries ? "tv" : "movie");
    if (!tmdbInfo?.imdbId) return [];

    const meta = { title: tmdbInfo.title, year: tmdbInfo.year, isSeries, season: season ?? 1, episode: episode ?? 1 };

    // Fetch BOTH English and Hindi streams and merge them
    const [enStreams, hiStreams] = yield Promise.all([
      fetchStreams(API_EN, tmdbInfo.imdbId, meta, isSeries, meta.season, meta.episode, "English"),
      fetchStreams(API_HI, tmdbInfo.imdbId, meta, isSeries, meta.season, meta.episode, "Hindi")
    ]);

    return [...enStreams, ...hiStreams].filter(Boolean);
  });
}

module.exports = { getStreams };
