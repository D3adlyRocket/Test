/**
 * moviebox - Built from src/moviebox/
 * Generated: 2026-05-11T13:43:18.796Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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

// src/moviebox/constants.js
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var MOVIEBOX_HOST = "h5.aoneroom.com";
var MOVIEBOX_API = `https://${MOVIEBOX_HOST}`;
var BASE_HEADERS = {
  "X-Client-Info": '{"timezone":"Africa/Nairobi"}',
  "Accept-Language": "en-US,en;q=0.5",
  "Accept": "application/json",
  "Referer": `${MOVIEBOX_API}/`,
  "Host": MOVIEBOX_HOST,
  "Connection": "keep-alive",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

// src/moviebox/extractors.js
function getMediaDetails(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const type = mediaType === "tv" ? "tv" : "movie";
    const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const response = yield fetch(url);
    const data = yield response.json();
    let year = null;
    if (mediaType === "tv" && data.first_air_date) {
      year = parseInt(data.first_air_date.split("-")[0]);
    } else if (mediaType === "movie" && data.release_date) {
      year = parseInt(data.release_date.split("-")[0]);
    }
    return __spreadProps(__spreadValues({}, data), {
      year
    });
  });
}

// src/moviebox/index.js
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function unwrapData(json) {
  if (!json)
    return {};
  const data = json.data || json;
  return data.data || data;
}
function fetchWithHeaders(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const headers = Object.assign({}, BASE_HEADERS, options.headers || {});
    const fetchOptions = Object.assign({}, options, { headers });
    console.log(`[MovieBox] Fetching: ${url}`);
    try {
      const response = yield fetch(url, fetchOptions);
      console.log(`[MovieBox] Status: ${response.status}`);
      if (!response.ok) {
        const text = yield response.text();
        console.log(`[MovieBox] Error response: ${text.substring(0, 200)}`);
      }
      return response;
    } catch (err) {
      console.log(`[MovieBox] Fetch error: ${err.message}`);
      throw err;
    }
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log(`[MovieBox] Fetching streams for ${mediaType} ${tmdbId}`);
    try {
      const mediaData = yield getMediaDetails(tmdbId, mediaType);
      const title = mediaType === "movie" ? mediaData.title : mediaData.name;
      if (!title) {
        console.log(`[MovieBox] Could not fetch title`);
        return [];
      }
      console.log(`[MovieBox] Searching for: ${title}`);
      const streams = yield fetchMovieboxStreams(title, mediaType, season, episode);
      if (!streams || streams.length === 0) {
        console.log(`[MovieBox] No streams found for ${title}`);
        return [];
      }
      console.log(`[MovieBox] Found ${streams.length} streams for ${title}`);
      return streams;
    } catch (error) {
      console.error(`[MovieBox] Error: ${error.message}`);
      return [];
    }
  });
}
function fetchMovieboxStreams(title, mediaType, season, episode) {
  return __async(this, null, function* () {
    const streams = [];
    try {
      yield fetchWithHeaders(`${MOVIEBOX_API}/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox`).catch(() => {
      });
      const subjectType = season != null ? 2 : 1;
      const searchResp = yield fetchWithHeaders(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: title,
          page: 1,
          perPage: 24,
          subjectType
        })
      });
      const searchJson = yield searchResp.json();
      const searchData = unwrapData(searchJson);
      console.log(`[MovieBox] Search raw: ${JSON.stringify(searchJson).substring(0, 500)}`);
      const items = searchData.items || [];
      console.log(`[MovieBox] Found ${items.length} items`);
      items.forEach((i) => console.log(`  - ${i.title} (${i.subjectId})`));
      if (items.length === 0)
        return [];
      const SEASON_SUFFIX_REGEX = /\sS\d+(?:-S?\d+)*$/i;
      const escapedTitle = escapeRegExp(title);
      const titleMatchRegex = new RegExp(`^${escapedTitle}(?: \\[([^\\]]+)\\])?$`, "i");
      const uniqueIdsWithLang = [];
      const seenIds = /* @__PURE__ */ new Set();
      for (const item of items) {
        const id = item.subjectId;
        if (!id || seenIds.has(id))
          continue;
        const rawItemTitle = item.title || "";
        const cleanTitle = rawItemTitle.replace(SEASON_SUFFIX_REGEX, "");
        console.log(`[MovieBox] Checking: "${rawItemTitle}" -> "${cleanTitle}"`);
        const match = cleanTitle.match(titleMatchRegex);
        if (!match) {
          console.log(`[MovieBox] No match for: ${cleanTitle}`);
          continue;
        }
        const language = match[1] || "Original";
        console.log(`[MovieBox] MATCHED: ${id} - "${language}"`);
        seenIds.add(id);
        uniqueIdsWithLang.push({ id, language });
      }
      uniqueIdsWithLang.sort((a, b) => {
        if (a.language === "Original")
          return -1;
        if (b.language === "Original")
          return 1;
        return 0;
      });
      if (uniqueIdsWithLang.length === 0)
        return [];
      for (const { id: subjectId, language } of uniqueIdsWithLang) {
        try {
          const detailResp = yield fetchWithHeaders(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/detail?subjectId=${subjectId}`);
          const detailJson = yield detailResp.json();
          const detailData = unwrapData(detailJson);
          const subject = detailData.subject || {};
          const detailPath = subject.detailPath || "";
          let params = `subjectId=${subjectId}`;
          if (season != null) {
            params += `&se=${season}&ep=${episode}`;
          }
          const downloadHeaders = {
            "Referer": `https://fmoviesunblocked.net/spa/videoPlayPage/movies/${detailPath}?id=${subjectId}&type=/movie/detail`,
            "Origin": "https://fmoviesunblocked.net"
          };
          const sourceResp = yield fetchWithHeaders(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/download?${params}`, {
            headers: downloadHeaders
          });
          const sourceJson = yield sourceResp.json();
          const sourceData = unwrapData(sourceJson);
          const downloads = sourceData.downloads || [];
          downloads.forEach((d) => {
            const dlink = d.url;
            if (dlink) {
              const res = d.resolution || 720;
              const qualityStr = `${res}p`;
              const nameParts = ["MovieBox", language].filter((p) => p && p.trim() !== "");
              streams.push({
                name: nameParts.join(" \u2022 "),
                title: qualityStr,
                url: dlink,
                quality: qualityStr,
                headers: {
                  "Referer": "https://fmoviesunblocked.net/",
                  "Origin": "https://fmoviesunblocked.net"
                },
                provider: "moviebox"
              });
            }
          });
        } catch (e) {
          console.error(`[MovieBox] Error processing subject ${subjectId}:`, e);
        }
      }
    } catch (err) {
      console.error(`[MovieBox] fetchMovieboxStreams failed:`, err);
    }
    return streams;
  });
}
module.exports = { getStreams };
