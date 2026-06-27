"use strict";

const __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    const fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    const rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    const step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

const PROVIDER_NAME = "MovieBox";
const MOVIEBOX_BASE = "https://moviebox-cfa7.onrender.com";
const TMDB_API_KEY = "6e6ab700b6477171ee6c23d504b1e9cb";

const decodeEntities = (str) => String(str || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

// YOUR FULL ORIGINAL MAKE STREAM FUNCTION
function makeStream(name, title, url, quality, headers, mediaInfo, lang) {
    var cleanName = decodeEntities(name || '').replace(/[\n\t]+/g, '').trim();
    var cleanTitle = decodeEntities(title || "").replace(/[\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    
    var lowerContext = cleanTitle.toLowerCase();
    var lowerUrl = (url || "").toLowerCase();

    // METADATA ENGINE
    var sizeMatch = cleanTitle.match(/(\d+(?:\.\d+)?\s*[MG]B)/i);
    var fileSizeOnly = sizeMatch ? sizeMatch[1].toUpperCase() : "N/A";
    var fileFormat = lowerUrl.includes(".mp4") ? "MP4" : "MKV";
    var codecTag = (/\b(hevc|x265|h265)\b/i.test(lowerContext)) ? "HEVC" : "H.264";
    var isHindi = lang === "Hindi";

    // LAYOUT FOR MOBILE
    // We put the full formatted layout into the 'name' field so mobile sees it.
    var line1 = '🎦 ' + cleanName + (mediaInfo ? ' - ' + mediaInfo : '');
    var line2 = '💎 ' + (quality || "1080p") + ' | 🗣️ ' + (isHindi ? "English 🇺🇸 • Hindi 🇮🇳" : "English 🇺🇸");
    var line3 = '🎞️ ' + fileFormat + ' | ⚡ ' + codecTag + ' | 💾 ' + fileSizeOnly;
    var line4 = '🔗 ' + PROVIDER_NAME;

    var fullLayout = line1 + '\n' + line2 + '\n' + line3 + '\n' + line4;

    return {
        name: fullLayout, // Mobile UI renders this line
        title: fullLayout,
        url: url,
        behaviorHints: { proxyHeaders: { request: headers || { "Referer": MOVIEBOX_BASE + "/" } } }
    };
}

function fetchStreams(url, lang, meta, isSeries, imdbId, s, e) {
    return __async(this, null, function* () {
        const fullUrl = isSeries 
            ? `${url}/stream/series/${imdbId}:${s.toString().padStart(2, '0')}:${e.toString().padStart(2, '0')}.json`
            : `${url}/stream/movie/${imdbId}.json`;
        try {
            const res = yield fetch(fullUrl);
            const data = yield res.json();
            return (data.streams || []).map(s => {
                const q = (s.title || "").match(/(\d{3,4}p)/i)?.[0] || "1080p";
                return makeStream(meta.title, s.title, s.url, q, null, meta.info, lang);
            });
        } catch { return []; }
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
    return __async(this, null, function* () {
        const isSeries = mediaType === "tv" || season != null || episode != null;
        const metaRes = yield fetch(`https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`).then(r => r.json());
        const imdbId = metaRes?.external_ids?.imdb_id || metaRes?.imdb_id;
        if (!imdbId) return [];

        const meta = { title: metaRes.title || metaRes.name, info: isSeries ? `S${season}E${episode}` : "" };

        // Sequential merge of both languages
        const en = yield fetchStreams(`${MOVIEBOX_BASE}/source=v3|lang=en|res=all`, "English", meta, isSeries, imdbId, season || 1, episode || 1);
        const hi = yield fetchStreams(`${MOVIEBOX_BASE}/source=v3|lang=hi|res=all`, "Hindi", meta, isSeries, imdbId, season || 1, episode || 1);

        return [...en, ...hi];
    });
}

module.exports = { getStreams };
