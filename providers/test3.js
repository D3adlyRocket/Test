"use strict";

const __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    const fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    const rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    const step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const PROVIDER_NAME = "MovieBox";

const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36" };

const pad2 = (n) => String(Number.parseInt(n ?? 0, 10) || 0).padStart(2, "0");
const decodeEntities = (str) => String(str || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

// YOUR WORKING MAKE STREAM FUNCTION
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

function getImdbId(tmdbId, mediaType) {
    return __async(this, null, function* () {
        const type = mediaType === "tv" ? "tv" : "movie";
        const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
        try {
            const response = yield fetch(url);
            const data = yield response.json();
            return { imdb: data?.external_ids?.imdb_id, title: data?.title || data?.name };
        } catch { return null; }
    });
}

function fetchStreams(baseUrl, imdbId, isSeries, s, e, lang, title) {
    return __async(this, null, function* () {
        const url = isSeries 
            ? `${baseUrl}/stream/series/${imdbId}:${pad2(s)}:${pad2(e)}.json`
            : `${baseUrl}/stream/movie/${imdbId}.json`;
        try {
            const response = yield fetch(url);
            const data = yield response.json();
            if (!data?.streams) return [];
            return data.streams.map(s => {
                const q = (s.title || "").match(/(\d{3,4}p)/i)?.[0] || "1080p";
                return makeStream(title, s.title, s.url, q, null, isSeries ? `S${s}E${e}` : "", lang);
            });
        } catch { return []; }
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
    return __async(this, null, function* () {
        const isSeries = mediaType === "tv" || season != null || episode != null;
        const meta = yield getImdbId(tmdbId, isSeries ? "tv" : "movie");
        if (!meta?.imdb) return [];

        const apiEn = `${MOVIEBOX_BASE}/source=v3|lang=en|res=all`;
        const apiHi = `${MOVIEBOX_BASE}/source=v3|lang=hi|res=all`;

        const [en, hi] = yield Promise.all([
            fetchStreams(apiEn, meta.imdb, isSeries, season, episode, "English", meta.title),
            fetchStreams(apiHi, meta.imdb, isSeries, season, episode, "Hindi", meta.title)
        ]);

        return [...en, ...hi];
    });
}

module.exports = { getStreams };
