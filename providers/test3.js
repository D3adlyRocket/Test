"use strict";

const __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    const fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    const rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    const step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const API_EN = `${MOVIEBOX_BASE}/source=v3|lang=en|res=all`;
const API_HI = `${MOVIEBOX_BASE}/source=v3|lang=hi|res=all`;
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";
const PROVIDER_NAME = "MovieBox";

const pad2 = (n) => String(Number.parseInt(n ?? 0, 10) || 0).padStart(2, "0");
const decodeEntities = (str) => String(str || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

// --- YOUR PROVEN MAKE STREAM FUNCTION ---
function makeStream(name, title, url, quality, headers, mediaInfo, lang) {
    var cleanName = decodeEntities(name || '').replace(/[\n\t]+/g, '').trim();
    var isHindi = lang === "Hindi";
    
    var label = PROVIDER_NAME + " | " + (quality || "1080p") + " | " + lang;
    var line1 = '🎦 ' + cleanName + (mediaInfo ? ' - ' + mediaInfo : '');
    var line2 = '💎 ' + (quality || "1080p") + ' | 🗣️ ' + (isHindi ? "English 🇺🇸 • Hindi 🇮🇳" : "English 🇺🇸");
    var line3 = '🎞️ MKV | 🎧 DD5.1 | 🔗 ' + PROVIDER_NAME;

    return {
        name: label,
        title: line1 + '\n' + line2 + '\n' + line3,
        url: url,
        behaviorHints: { proxyHeaders: { request: headers || { "Referer": MOVIEBOX_BASE + "/" } } }
    };
}

function getTmdbInfo(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
    try {
      const response = yield fetch(url);
      const data = yield response.json();
      return { imdbId: data?.external_ids?.imdb_id, title: data?.name || data?.title };
    } catch { return null; }
  });
}

// Fixed fetcher to map correctly using makeStream
function fetchStreams(baseUrl, imdbId, meta, isSeries, s, e, lang) {
  return __async(this, null, function* () {
    const url = isSeries 
      ? `${baseUrl}/stream/series/${imdbId}:${pad2(s)}:${pad2(e)}.json`
      : `${baseUrl}/stream/movie/${imdbId}.json`;
    
    try {
      const response = yield fetch(url);
      const data = yield response.json();
      if (!data?.streams) return [];
      return data.streams.map(item => {
        const quality = (item.title || "").match(/(2160p|1080p|720p|480p)/i)?.[0] || "1080p";
        return makeStream(meta.title, item.title, item.url, quality, null, isSeries ? `S${s}E${e}` : "", lang);
      });
    } catch { return []; }
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const isSeries = mediaType === "tv" || season != null || episode != null;
    const tmdbInfo = yield getTmdbInfo(tmdbId, isSeries ? "tv" : "movie");
    if (!tmdbInfo?.imdbId) return [];

    const meta = { title: tmdbInfo.title };

    // Fetch BOTH English and Hindi independently, then merge
    const [enStreams, hiStreams] = yield Promise.all([
      fetchStreams(API_EN, tmdbInfo.imdbId, meta, isSeries, season, episode, "English"),
      fetchStreams(API_HI, tmdbInfo.imdbId, meta, isSeries, season, episode, "Hindi")
    ]);

    return [...enStreams, ...hiStreams].filter(Boolean);
  });
}

module.exports = { getStreams };
