/**
 * notorrent - Built from src/notorrent/
 * Generated: 2026-05-11T13:43:18.799Z
 */
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/notorrent/constants.js
var NOTORRENT_API = "https://addon-osvh.onrender.com";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

// src/notorrent/utils.js
function getImdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var _a;
    try {
      const type = mediaType === "tv" ? "tv" : "movie";
      const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
      const response = yield fetch(url);
      if (!response.ok)
        return null;
      const data = yield response.json();
      return ((_a = data.external_ids) == null ? void 0 : _a.imdb_id) || null;
    } catch (e) {
      console.error(`[NoTorrent] Failed obtaining IMDB mapping:`, e.message);
      return null;
    }
  });
}
function cleanText(str) {
  if (!str)
    return "";
  return str.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, "").trim();
}
function extractQuality(titleText) {
  const raw = titleText || "";
  const match = raw.match(/(\d{3,4}p)/);
  if (match)
    return match[0];
  if (raw.toUpperCase().includes("FREE"))
    return "Auto";
  return "Unknown";
}

// src/notorrent/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log(`[NoTorrent] Searching for ${mediaType} ${tmdbId}`);
    const streams = [];
    try {
      const imdbId = yield getImdbId(tmdbId, mediaType);
      if (!imdbId) {
        console.warn(`[NoTorrent] Failed to map IMDB ID.`);
        return [];
      }
      let apiUrl = `${NOTORRENT_API}/stream/movie/${imdbId}.json`;
      if (mediaType === "tv" || season != null) {
        apiUrl = `${NOTORRENT_API}/stream/series/${imdbId}:${season}:${episode}.json`;
      }
      const response = yield fetch(apiUrl);
      if (!response.ok) {
        console.warn(`[NoTorrent] API down or unreachable.`);
        return [];
      }
      const data = yield response.json();
      const rawList = data.streams || [];
      rawList.forEach((item) => {
        var _a, _b, _c;
        if (item.externalUrl || !item.url)
          return;
        if (item.url.includes("github.com") || item.url.includes("googleusercontent"))
          return;
        const rawTitle = item.title || "";
        const cleanTitleString = cleanText(rawTitle);
        const quality = extractQuality(cleanTitleString);
        let language = "Default";
        const langMatch = cleanTitleString.match(/\(([^)]+)\)/);
        if (langMatch) {
          language = langMatch[1].charAt(0).toUpperCase() + langMatch[1].slice(1).toLowerCase();
        }
        const proxyHeaders = ((_b = (_a = item.behaviorHints) == null ? void 0 : _a.proxyHeaders) == null ? void 0 : _b.request) || {};
        const headers = Object.assign({}, ((_c = item.behaviorHints) == null ? void 0 : _c.headers) || {}, proxyHeaders);
        const nameParts = ["NoTorrent", language !== "Default" ? language : ""].filter((p) => p && p.trim() !== "");
        streams.push({
          name: nameParts.join(" \u2022 "),
          title: quality,
          url: item.url,
          quality,
          headers: Object.keys(headers).length > 0 ? headers : void 0,
          provider: "notorrent"
        });
      });
    } catch (e) {
      console.error(`[NoTorrent] Fetch failed:`, e.message);
    }
    console.log(`[NoTorrent] Total results found: ${streams.length}`);
    return streams;
  });
}
module.exports = { getStreams };
