/**
 * netmirror - Built from src/netmirror/
 * Generated: 2026-08-16T18:04:18.361Z
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

// src/netmirror/constants.js
var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
var PLATFORM_MAP = {
  netflix: {
    ott: "nf",
    search: "/search.php",
    post: "/post.php",
    episodes: "/episodes.php",
    playlist: "/playlist2.php",
    img: "poster/v",
    epImg: "epimg/150"
  },
  primevideo: {
    ott: "pv",
    search: "/pv/search.php",
    post: "/pv/post.php",
    episodes: "/pv/episodes.php",
    playlist: "/pv/playlist2.php",
    img: "pv/v",
    epImg: "pvepimg"
  },
  hotstar: {
    ott: "hs",
    search: "/hs/search.php",
    post: "/hs/post.php",
    episodes: "/hs/episodes.php",
    playlist: "/hs/playlist2.php",
    img: "hs/v",
    epImg: "hsepimg"
  },
  disney: {
    ott: "hs",
    search: "/hs/search.php",
    post: "/hs/post.php",
    episodes: "/hs/episodes.php",
    playlist: "/hs/playlist2.php",
    img: "hs/v",
    epImg: "hsepimg"
  }
};

// src/netmirror/index.js
var NETMIRROR_ROOT = "https://net77.cc";
var BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0";
var API_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "User-Agent": BROWSER_UA
};
var STREAM_HEADERS = {
  Origin: NETMIRROR_ROOT,
  Referer: `${NETMIRROR_ROOT}/`,
  "User-Agent": BROWSER_UA
};
function normalizeTitle(value) {
  return String(value || "").normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
function parseNumber(value) {
  if (value == null)
    return null;
  const match = String(value).match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}
function getYear(date) {
  if (!date)
    return null;
  const year = Number.parseInt(String(date).slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}
function scoreSearchResult(result, title, year, mediaType) {
  const wanted = normalizeTitle(title);
  const got = normalizeTitle(result == null ? void 0 : result.t);
  let score = 0;
  if (got === wanted) {
    score += 100;
  } else if (got.includes(wanted) || wanted.includes(got)) {
    score += 50;
  }
  const resultYear = parseNumber(result == null ? void 0 : result.y);
  if (year && resultYear === year) {
    score += 40;
  } else if (year && resultYear && Math.abs(resultYear - year) === 1) {
    score += 10;
  }
  const type = String((result == null ? void 0 : result.r) || "").toLowerCase();
  if (mediaType === "tv" && type === "series") {
    score += 25;
  }
  if (mediaType !== "tv" && type !== "series") {
    score += 25;
  }
  return score;
}
function getJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    console.log("\n[NETMIRROR] REQUEST");
    console.log(url);
    const response = yield fetch(url, options);
    console.log(
      `[NETMIRROR] HTTP ${response.status} ${response.statusText}`
    );
    if (!response.ok) {
      throw new Error(
        `NetMirror HTTP ${response.status}: ${url}`
      );
    }
    return response.json();
  });
}

var AUTH_COOKIE_CACHE = {};
var NEW_TV_BASE_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
  "X-Requested-With": "NetmirrorNewTV v1.0",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0 /OS.GatuNewTV v1.0",
  "Accept": "application/json, text/plain, */*"
};
var NEW_TV_DOMAINS = [
  "aHR0cHM6Ly9tb2JpbGVkZXRlY3RzLmNvbQ==",
  "aHR0cHM6Ly9tb2JpbGVkZXRlY3QuYXBw",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LmFydA==",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LmNj",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LmNsaWNr",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0Lmluaw==",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LmxpdmU=",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LnBybw==",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LnNob3A=",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LnNpdGU="
];
var resolvedApiUrl = null;
function safeAtob(value) {
  return Buffer.from(value, "base64").toString("binary");
}
function resolveApiUrl() {
  return __async(this, null, function* () {
    if (resolvedApiUrl) return resolvedApiUrl;
    for (const encoded of NEW_TV_DOMAINS) {
      const base = safeAtob(encoded).replace(/\/$/, "");
      try {
        const response = yield fetch(`${base}/checknewtv.php`, {
          headers: {
            ...NEW_TV_BASE_HEADERS,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        const data = yield response.json();
        if (data && data.token_hash) {
          resolvedApiUrl = safeAtob(data.token_hash).replace(/\/$/, "");
          console.log("[NETMIRROR] NEWTV API:", resolvedApiUrl);
          return resolvedApiUrl;
        }
      } catch (e) {}
    }
    throw new Error("Failed to resolve NewTV API base URL");
  });
}
function buildNewTvHeaders(ott, extra = {}) {
  return { ...NEW_TV_BASE_HEADERS, Ott: ott, ...extra };
}

var NETMIRROR_AUTH_ROOT = (globalThis.SCRAPER_SETTINGS && globalThis.SCRAPER_SETTINGS.authRoot) || "https://net52.cc";

function getAuthCookie(_0) {
  return __async(this, arguments, function* (platformKey) {
    if (AUTH_COOKIE_CACHE[platformKey]) {
      return AUTH_COOKIE_CACHE[platformKey];
    }

    const platform = PLATFORM_MAP[platformKey];
    if (!platform) {
      throw new Error(`Unknown NetMirror platform: ${platformKey}`);
    }

    const authUA =
      "Mozilla/5.0 (Linux; Android 12; RMX2117 Build/SP1A.210812.016; wv) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 " +
      "Chrome/147.0.7727.55 Mobile Safari/537.36 /OS.Gatu v3.0";

    const authHeaders = {
      "User-Agent": authUA,
      "X-Requested-With": "app.netmirror.netmirrornew"
    };

    console.log("\n[NETMIRROR] AUTH START:", platformKey);

    const homeUrl = `${NETMIRROR_AUTH_ROOT}/mobile/home?app=1`;
    const homeResponse = yield fetch(homeUrl, {
      headers: authHeaders
    });

    if (!homeResponse.ok) {
      throw new Error(`NetMirror auth home HTTP ${homeResponse.status}`);
    }

    const homeHtml = yield homeResponse.text();
    const match = homeHtml.match(
      /<body[^>]*data-addhash=["']([^"']+)["']/i
    );

    if (!match) {
      throw new Error("NetMirror auth: data-addhash not found");
    }

    const addhash = match[1];
    console.log("[NETMIRROR] AUTH ADDHASH:", addhash);

    const authHost = new URL(NETMIRROR_AUTH_ROOT).hostname;
    const userver = `https://userver.${authHost}`;

    const triggerUrl =
      `${userver}/?jjoii=${encodeURIComponent(addhash)}` +
      `&a=y&t=${Math.floor(Date.now() / 1000)}`;

    const triggerResponse = yield fetch(triggerUrl, {
      headers: authHeaders
    });

    console.log(
      "[NETMIRROR] AUTH TRIGGER HTTP:",
      triggerResponse.status
    );

    let tHash = null;

    for (let attempt = 1; attempt <= 7; attempt++) {
      console.log(
        `[NETMIRROR] AUTH VERIFY ${attempt}/7`
      );

      const verifyResponse = yield fetch(
        `${NETMIRROR_AUTH_ROOT}/mobile/verify2.php`,
        {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: `verify=${encodeURIComponent(addhash)}`
        }
      );

      const verifyText = yield verifyResponse.text();

      console.log(
        "[NETMIRROR] AUTH VERIFY RESPONSE:",
        verifyText
      );

      const setCookies =
        typeof verifyResponse.headers.getSetCookie === "function"
          ? verifyResponse.headers.getSetCookie()
          : [verifyResponse.headers.get("set-cookie") || ""];

      for (const setCookie of setCookies) {
        const m = setCookie.match(
          /(?:^|;\s*)t_hash_t=([^;]+)/i
        );

        if (m) {
          tHash = m[1];
        }
      }

      if (/["']statusup["']\s*:\s*["']All Done["']/i.test(verifyText)) {
        break;
      }

      if (attempt < 7) {
        yield new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }

    if (!tHash) {
      throw new Error(
        "NetMirror auth: t_hash_t was not returned"
      );
    }

    const cookie = `t_hash_t=${tHash}; addhash=${encodeURIComponent(addhash)}`;

    AUTH_COOKIE_CACHE[platformKey] = cookie;

    console.log("[NETMIRROR] AUTH COMPLETE:", platformKey);

    return cookie;
  });
}

function getAuthenticatedHeaders(_0) {
  return __async(this, arguments, function* (platformKey, extra = {}) {
    const platform = PLATFORM_MAP[platformKey];
    const cookie = yield getAuthCookie(platformKey);

    return {
      ...API_HEADERS,
      "X-Requested-With": "app.netmirror.netmirrornew",
      Ott: platform.ott,
      Cookie: cookie,
      ...extra
    };
  });
}

function getTmdbDetails(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const type = mediaType === "tv" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${type}/${encodeURIComponent(tmdbId)}?api_key=${encodeURIComponent(TMDB_API_KEY)}`;
    console.log("\n[NETMIRROR] TMDB");
    console.log(url);
    return getJson(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": BROWSER_UA
      }
    });
  });
}
function searchPlatform(platformKey, title, year, mediaType) {
  return __async(this, null, function* () {
    const platform = PLATFORM_MAP[platformKey];
    if (!platform) {
      throw new Error(
        `Unknown NetMirror platform: ${platformKey}`
      );
    }
    const url = `${NETMIRROR_ROOT}${platform.search}?s=${encodeURIComponent(title)}`;
    console.log(
      `
[NETMIRROR] ${platformKey.toUpperCase()} SEARCH`
    );
    console.log(url);
    const headers = yield getAuthenticatedHeaders(platformKey);
    const data = yield getJson(url, {
      headers
    });
    console.log(
      "[NETMIRROR] SEARCH RESULTS:",
      data == null ? void 0 : data.searchResult
    );
    const results = Array.isArray(data == null ? void 0 : data.searchResult) ? data.searchResult : [];
    if (!results.length) {
      return null;
    }
    return results.map((result) => ({
      result,
      score: scoreSearchResult(
        result,
        title,
        year,
        mediaType
      )
    })).sort((a, b) => b.score - a.score)[0].result;
  });
}
function getPostData(platformKey, contentId) {
  return __async(this, null, function* () {
    const platform = PLATFORM_MAP[platformKey];
    const url = `${NETMIRROR_ROOT}${platform.post}?id=${encodeURIComponent(contentId)}&t=${Math.floor(Date.now() / 1e3)}`;
    console.log(
      `
[NETMIRROR] ${platformKey.toUpperCase()} POST`
    );
    console.log(url);

    const headers = yield getAuthenticatedHeaders(platformKey);
    headers.Host = new URL(NETMIRROR_ROOT).hostname;
    headers.Referer = `${NETMIRROR_ROOT}/series`;

    return getJson(url, {
      headers
    });
  });
}

function collectEpisodes(postData) {
  var _a, _b, _c, _d, _e;
  const episodes = [];
  if (!Array.isArray(postData == null ? void 0 : postData.episodes)) {
    return episodes;
  }
  for (const ep of postData.episodes) {
    if (!ep || !ep.id) {
      continue;
    }
    const season = (_b = (_a = parseNumber(ep.sNum)) != null ? _a : parseNumber(ep.season)) != null ? _b : parseNumber(ep.s);
    const episode = (_e = (_d = (_c = parseNumber(ep.ep)) != null ? _c : parseNumber(ep.epNum)) != null ? _d : parseNumber(ep.episode)) != null ? _e : parseNumber(ep.e);
    if (episode == null) {
      continue;
    }
    episodes.push({
      id: ep.id,
      season,
      episode
    });
  }
  return episodes;
}
function getAdditionalEpisodes(platformKey, seasonId, seriesId, page = 1) {
  return __async(this, null, function* () {
    const platform = PLATFORM_MAP[platformKey];
    if (!platform.episodes) {
      return {
        episodes: [],
        hasNext: false
      };
    }
    const url = `${NETMIRROR_ROOT}${platform.episodes}?s=${encodeURIComponent(seasonId)}&series=${encodeURIComponent(seriesId)}&page=${page}&t=${Math.floor(Date.now() / 1e3)}`;
    console.log(
      `
[NETMIRROR] ${platformKey.toUpperCase()} EPISODES PAGE ${page}`
    );
    console.log(url);
    const headers = yield getAuthenticatedHeaders(platformKey);
    const data = yield getJson(url, {
      headers
    });
    console.log(
      `[NETMIRROR] ${platformKey.toUpperCase()} EPISODES DATA:`,
      data
    );
    const episodes = Array.isArray(data == null ? void 0 : data.episodes) ? data.episodes.filter(Boolean).map((ep) => {
      var _a, _b, _c, _d, _e;
      return {
        id: ep.id,
        season: (_b = (_a = parseNumber(ep.sNum)) != null ? _a : parseNumber(ep.season)) != null ? _b : parseNumber(ep.s),
        episode: (_e = (_d = (_c = parseNumber(ep.ep)) != null ? _c : parseNumber(ep.epNum)) != null ? _d : parseNumber(ep.episode)) != null ? _e : parseNumber(ep.e)
      };
    }).filter((ep) => ep.id && ep.episode != null) : [];
    const nextPage = parseNumber(data == null ? void 0 : data.nextPage);
    return {
      episodes,
      hasNext: nextPage != null && nextPage > page
    };
  });
}
function resolveEpisode(platformKey, contentId, postData, season, episode) {
  return __async(this, null, function* () {
    let wantedSeason = parseNumber(season);
    let wantedEpisode = parseNumber(episode);
    for (const value of [season, episode]) {
      if (wantedSeason != null && wantedEpisode != null)
        break;
      if (typeof value !== "string")
        continue;
      const pair = value.match(/S?(\d+)\s*[:x./-]\s*E?(\d+)/i);
      if (pair) {
        wantedSeason = Number(pair[1]);
        wantedEpisode = Number(pair[2]);
      }
    }
    if (wantedSeason == null || wantedEpisode == null) {
      console.log("[NETMIRROR] Invalid TV episode arguments:", {
        season,
        episode
      });
      return null;
    }
    console.log(
      `
[NETMIRROR] RESOLVING S${wantedSeason}E${wantedEpisode}`
    );
    const rawSeasons = postData == null ? void 0 : postData.season;
    const seasons = Array.isArray(rawSeasons) ? rawSeasons : rawSeasons && typeof rawSeasons === "object" ? Object.values(rawSeasons) : [];
    console.log("[NETMIRROR] SEASONS:", seasons);
    const seasonEntry = seasons.find((s) => {
      var _a, _b, _c, _d;
      const n = (_d = (_c = (_b = (_a = parseNumber(s == null ? void 0 : s.s)) != null ? _a : parseNumber(s == null ? void 0 : s.season)) != null ? _b : parseNumber(s == null ? void 0 : s.season_number)) != null ? _c : parseNumber(s == null ? void 0 : s.sNum)) != null ? _d : parseNumber(s == null ? void 0 : s.name);
      return n === wantedSeason;
    });
    const seasonId = seasonEntry == null ? void 0 : seasonEntry.id;
    if (!seasonId) {
      console.log(
        `[NETMIRROR] No NetMirror season ID found for S${wantedSeason}`
      );
      return null;
    }
    console.log(
      `[NETMIRROR] S${wantedSeason} CONTENT ID:`,
      seasonId
    );
    const directEpisodes = collectEpisodes(postData);
    const directMatch = directEpisodes.find(
      (ep) => (ep.season == null || ep.season === wantedSeason) && Number(ep.episode) === wantedEpisode
    );
    if (directMatch) {
      console.log(
        `[NETMIRROR] SELECTED S${wantedSeason}E${wantedEpisode}:`,
        directMatch.id
      );
      return directMatch.id;
    }
    for (let page = 1; ; page++) {
      const pageData = yield getAdditionalEpisodes(
        platformKey,
        seasonId,
        contentId,
        page
      );
      console.log(
        `[NETMIRROR] SEARCHING S${wantedSeason}E${wantedEpisode} ON PAGE ${page}:`,
        pageData.episodes
      );
      const match = pageData.episodes.find(
        (ep) => (ep.season == null || ep.season === wantedSeason) && Number(ep.episode) === wantedEpisode
      );
      if (match) {
        console.log(
          `[NETMIRROR] SELECTED S${wantedSeason}E${wantedEpisode}:`,
          match.id
        );
        return match.id;
      }
      if (!pageData.hasNext) {
        break;
      }
    }
    console.log(
      `[NETMIRROR] Episode S${wantedSeason}E${wantedEpisode} not found`
    );
    return null;
  });
}
function getPlaylist(platformKey, targetId) {
  return __async(this, null, function* () {
    const platform = PLATFORM_MAP[platformKey];
    const url = `${NETMIRROR_ROOT}${platform.playlist}?id=${encodeURIComponent(targetId)}`;
    console.log(
      `
[NETMIRROR] ${platformKey.toUpperCase()} PLAYLIST`
    );
    console.log(url);
    const headers = yield getAuthenticatedHeaders(platformKey, {
      Origin: NETMIRROR_ROOT,
      Referer: `${NETMIRROR_ROOT}/`
    });
    return getJson(url, {
      headers
    });
  });
}
function playlistToStreams(playlist, platformKey, title) {
  if (!Array.isArray(playlist)) {
    return [];
  }
  const streams = [];
  for (const item of playlist) {
    if (!Array.isArray(item == null ? void 0 : item.sources)) {
      continue;
    }
    for (const source of item.sources) {
      if (!(source == null ? void 0 : source.file)) {
        continue;
      }
      const streamUrl = new URL(
        source.file,
        NETMIRROR_ROOT
      ).toString();
      let quality = "Auto";
      if (source.file.includes("q=1080p")) {
        quality = "1080p";
      } else if (source.file.includes("q=720p")) {
        quality = "720p";
      } else if (source.file.includes("q=480p")) {
        quality = "480p";
      } else if (source.label) {
        quality = source.label;
      }
      const stream = {
        name: `NetMirror (${platformKey})`,
        title: `${title} \u2022 ${source.label || quality}`,
        url: streamUrl,
        quality,
        headers: STREAM_HEADERS,
        behaviorHints: {
          notWebReady: true,
          proxyHeaders: {
            request: STREAM_HEADERS
          }
        }
      };
      if (Array.isArray(item.tracks)) {
        stream.subtitles = item.tracks.filter((track) => track == null ? void 0 : track.file).map((track) => ({
          url: new URL(
            track.file,
            NETMIRROR_ROOT
          ).toString(),
          lang: track.lang || track.label || "English",
          label: track.label || track.lang || "English"
        }));
      }
      streams.push(stream);
    }
  }
  return streams;
}
function bypass(ott) {
  return __async(this, null, function* () {
    if (AUTH_COOKIE_CACHE.__tHash && Date.now() - AUTH_COOKIE_CACHE.__time < 54e6) {
      return AUTH_COOKIE_CACHE.__tHash;
    }
    const newUrl = "https://net52.cc";
    const userAgent = "Mozilla/5.0 (Linux; Android 12; RMX2117 Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36 /OS.Gatu v3.0";
    console.log("[NETMIRROR] Running NetMirror Mobile auth...");
    const homeResponse = yield fetch(`${newUrl}/mobile/home?app=1`, {
      headers: { "User-Agent": userAgent, "X-Requested-With": "app.netmirror.netmirrornew" }
    });
    const homeHtml = yield homeResponse.text();
    const match = homeHtml.match(/<body[^>]*data-addhash=["']([^"']+)["']/i);
    if (!match) throw new Error("NetMirror auth: data-addhash not found");
    const addhash = match[1];
    console.log("[NETMIRROR] AUTH ADDHASH:", addhash);
    yield fetch(`https://userver.net52.cc/?jjoii=${encodeURIComponent(addhash)}&a=y&t=${Math.floor(Date.now()/1000)}`, { headers: { "User-Agent": userAgent } });
    let tHash = "";
    for (let attempt = 1; attempt <= 7; attempt++) {
      console.log(`[NETMIRROR] AUTH VERIFY ${attempt}/7`);
      const verifyResponse = yield fetch(`${newUrl}/mobile/verify2.php`, {
        method: "POST",
        headers: { "User-Agent": userAgent, "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded" },
        body: `verify=${encodeURIComponent(addhash)}`
      });
      const verifyText = yield verifyResponse.text();
      console.log("[NETMIRROR] AUTH VERIFY RESPONSE:", verifyText);
      const setCookie = typeof verifyResponse.headers.getSetCookie === "function" ? verifyResponse.headers.getSetCookie().join("; ") : (verifyResponse.headers.get("set-cookie") || "");
      const m = setCookie.match(/(?:^|;\s*)t_hash_t=([^;]+)/i);
      if (m) tHash = m[1];
      if (/statusup\"\s*:\s*\"All Done/i.test(verifyText)) break;
      if (attempt < 7) yield new Promise(r => setTimeout(r, 10000));
    }
    if (!tHash) throw new Error("NetMirror auth: t_hash_t was not returned");
    AUTH_COOKIE_CACHE.__tHash = tHash;
    AUTH_COOKIE_CACHE.__time = Date.now();
    console.log("[NETMIRROR] AUTH COMPLETE");
    return tHash;
  });
}
function fetchEpisodesPageNewTv(seasonId, page, seasonNumber, ott, apiBase) {
  return __async(this, null, function* () {
    const episodes = [];
    let pg = page;
    while (true) {
      const url = `${apiBase}/newtv/episodes.php?id=${encodeURIComponent(seasonId)}&page=${pg}`;
      const data = yield (yield fetch(url, { headers: buildNewTvHeaders(ott) })).json();
      if (Array.isArray(data.episodes)) {
        for (const ep of data.episodes.filter(Boolean)) {
          const epNum = ep.ep ? parseInt(ep.ep) : ep.epNum ? parseInt(String(ep.epNum).replace("E", "")) : null;
          const sNum = seasonNumber || (ep.sNum ? parseInt(String(ep.sNum).replace("S", "")) : null);
          if (ep.id && epNum != null) episodes.push({ id: ep.id, s: sNum, ep: epNum });
        }
      }
      if (data.nextPageShow !== 1) break;
      pg++;
    }
    return episodes;
  });
}
function getAllEpisodesNewTv(contentId, postData, platform, apiBase, season, episode) {
  return __async(this, null, function* () {
    const episodes = [];
    const seasons = Array.isArray(postData.season) ? postData.season : [];
    const selectedIdx = seasons.findIndex(s => s && s.selected === true);
    const selectedSeasonId = selectedIdx >= 0 ? seasons[selectedIdx].id : postData.nextPageSeason;
    const selectedSeasonNumber = selectedIdx >= 0 ? selectedIdx + 1 : null;
    if (Array.isArray(postData.episodes)) {
      for (const ep of postData.episodes.filter(Boolean)) {
        const epNum = ep.ep ? parseInt(ep.ep) : ep.epNum ? parseInt(String(ep.epNum).replace("E", "")) : null;
        const sNum = selectedSeasonNumber || (ep.sNum ? parseInt(String(ep.sNum).replace("S", "")) : null);
        if (ep.id && epNum != null) episodes.push({ id: ep.id, s: sNum, ep: epNum });
      }
    }
    if (postData.nextPageShow === 1 && selectedSeasonId) {
      episodes.push(...(yield fetchEpisodesPageNewTv(selectedSeasonId, 2, selectedSeasonNumber, platform.ott, apiBase)));
    }
    for (let i = 0; i < seasons.length; i++) {
      const s = seasons[i];
      if (s && s.id && s.id !== selectedSeasonId) {
        episodes.push(...(yield fetchEpisodesPageNewTv(s.id, 1, i + 1, platform.ott, apiBase)));
      }
    }
    return episodes;
  });
}
function fetchFromPlatform(platformKey, title, year, mediaType, season, episode) {
  return __async(this, null, function* () {
    const platform = PLATFORM_MAP[platformKey];
    if (!platform) return null;
    console.log(`\n========================================`);
    console.log(`[NETMIRROR] PLATFORM: ${platformKey}`);
    console.log(`========================================`);
    const apiBase = yield resolveApiUrl();
    const cookie = yield bypass(platform.ott);
    const settings = globalThis.SCRAPER_SETTINGS || {};
    const reqCookies = cookie ? [`t_hash_t=${cookie}`] : [];
    if (settings.forceHd !== false) reqCookies.push("hd=on");
    const cookieHeader = reqCookies.length ? { Cookie: reqCookies.join("; ") } : {};
    const searchUrl = `${apiBase}/newtv/search.php?s=${encodeURIComponent(title)}`;
    console.log("[NETMIRROR] NEWTV SEARCH", searchUrl);
    const searchResp = yield fetch(searchUrl, { headers: buildNewTvHeaders(platform.ott, cookieHeader) });
    const searchData = yield searchResp.json();
    console.log("[NETMIRROR] SEARCH RESULTS:", searchData == null ? void 0 : searchData.searchResult);
    const results = Array.isArray(searchData == null ? void 0 : searchData.searchResult) ? searchData.searchResult : [];
    if (!results.length) return null;
    const result = results.map(r => ({ result: r, score: scoreSearchResult(r, title, year, mediaType) })).sort((a,b) => b.score-a.score)[0].result;
    console.log("[NETMIRROR] SELECTED RESULT:", result);
    const contentId = result.id;
    const postUrl = `${apiBase}/newtv/post.php?id=${encodeURIComponent(contentId)}`;
    console.log("[NETMIRROR] NEWTV POST", postUrl);
    const postResp = yield fetch(postUrl, { headers: buildNewTvHeaders(platform.ott, { Lastep: "", Usertoken: "", ...cookieHeader }) });
    const postData = yield postResp.json();
    console.log("[NETMIRROR] POST DATA:", postData);
    let targetId = contentId;
    if (mediaType === "tv") {
      const episodes = yield getAllEpisodesNewTv(contentId, postData, platform, apiBase, season, episode);
      const targetEp = episodes.find(ep => ep && ep.s === parseNumber(season) && ep.ep === parseNumber(episode));
      if (!targetEp) { console.log(`[NETMIRROR] Episode S${season}E${episode} not found`); return null; }
      targetId = targetEp.id;
      console.log("[NETMIRROR] SELECTED EPISODE ID:", targetId);
    } else {
      if (postData.type === "t" || (Array.isArray(postData.episodes) && postData.episodes.some(Boolean))) return null;
      targetId = postData.main_id || contentId;
    }
    const playlistUrl = `https://net52.cc/mobile/playlist.php?id=${encodeURIComponent(targetId)}&t=${encodeURIComponent(title)}&tm=${Math.floor(Date.now()/1000)}`;
    const playlistHeaders = { "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 5 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/149.0.7827.91 Safari/537.36 /OS.Gatu v3.0", "X-Requested-With": "app.netmirror.netmirrornew", Accept: "*/*" };
    if (cookie) playlistHeaders.Cookie = `t_hash_t=${decodeURIComponent(cookie)}; ott=${platform.ott}`;
    const playlistResp = yield fetch(playlistUrl, { headers: playlistHeaders });
    const playlistData = yield playlistResp.json();
    console.log("[NETMIRROR] PLAYLIST:", playlistData);
    if (!Array.isArray(playlistData) || !playlistData.length) return null;
    const item = playlistData[0];
    if (!Array.isArray(item.sources) || !item.sources.length) return null;
    return item.sources.map(source => {
      const streamUrl = source.file.startsWith("http") ? source.file : `${apiBase}${source.file}`;
      const qMatch = source.file.match(/[?&]q=([^&]+)/);
      const quality = qMatch ? qMatch[1] : source.label === "Auto" ? "Auto" : source.label;
      return { name: `NetMirror (${platformKey})`, title: `${title} - ${source.label}`, url: streamUrl, quality, headers: { Referer: `${apiBase}/mobile/home?app=1`, "User-Agent": BROWSER_UA }, behaviorHints: { notWebReady: true, proxyHeaders: { request: { Referer: `${apiBase}/mobile/home?app=1`, "User-Agent": BROWSER_UA } } }, subtitles: Array.isArray(item.tracks) ? item.tracks.filter(t => t && t.file).map(t => ({ url: new URL(t.file, apiBase).toString(), lang: t.lang || t.label || "English", label: t.label || t.lang || "English" })) : undefined };
    });
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const normalizedMediaType = mediaType === "tv" || mediaType === "series" ? "tv" : "movie";
      console.log(
        "\n========================================"
      );
      console.log(
        "[NETMIRROR] GET STREAMS"
      );
      console.log(
        `TMDB=${tmdbId} TYPE=${mediaType} NORMALIZED=${normalizedMediaType} S=${season} E=${episode}`
      );
      console.log(
        "[NETMIRROR] APP CALL:",
        {
          tmdbId,
          mediaType,
          normalizedMediaType,
          season,
          episode
        }
      );
      console.log(
        "[NETMIRROR] ARG TYPES:",
        {
          tmdbId: typeof tmdbId,
          mediaType: typeof mediaType,
          season: typeof season,
          episode: typeof episode
        }
      );
      console.log(
        "========================================"
      );
      const tmdbData = yield getTmdbDetails(
        tmdbId,
        normalizedMediaType
      );
      const title = normalizedMediaType === "tv" ? tmdbData == null ? void 0 : tmdbData.name : tmdbData == null ? void 0 : tmdbData.title;
      const date = normalizedMediaType === "tv" ? tmdbData == null ? void 0 : tmdbData.first_air_date : tmdbData == null ? void 0 : tmdbData.release_date;
      const year = getYear(date);
      if (!title) {
        throw new Error(
          "TMDB title not found"
        );
      }
      console.log(
        "[NETMIRROR] TMDB TITLE:",
        title
      );
      console.log(
        "[NETMIRROR] TMDB YEAR:",
        year
      );
      const settings = globalThis.SCRAPER_SETTINGS || {};
      const preferred = settings.preferredPlatform || "all";
      let platforms = [
        "netflix",
        "primevideo",
        "hotstar",
        "disney"
      ];
      if (preferred !== "all" && PLATFORM_MAP[preferred]) {
        platforms = [
          preferred,
          ...platforms.filter(
            (p) => p !== preferred
          )
        ];
      }
      for (const platformKey of platforms) {
        try {
          const streams = yield fetchFromPlatform(
            platformKey,
            title,
            year,
            normalizedMediaType,
            season,
            episode
          );
          if (streams && streams.length > 0) {
            return streams;
          }
        } catch (error) {
          console.error(
            `[NETMIRROR] ${platformKey} failed:`,
            error.message
          );
        }
      }
      return [];
    } catch (error) {
      console.error(
        "[NETMIRROR] getStreams failed:",
        error
      );
      return [];
    }
  });
}
function onSettings() {
  return __async(this, null, function* () {
    return [
      {
        type: "header",
        label: "Source Selection"
      },
      {
        type: "select",
        key: "preferredPlatform",
        label: "Preferred Streaming Source",
        description: "Select which platform to try first. If content is not found, others are searched as fallback.",
        options: [
          {
            label: "All Sources (Ordered)",
            value: "all"
          },
          {
            label: "Netflix",
            value: "netflix"
          },
          {
            label: "Prime Video",
            value: "primevideo"
          },
          {
            label: "Hotstar / Disney+",
            value: "hotstar"
          }
        ],
        defaultValue: "all"
      },
      {
        type: "header",
        label: "Advanced"
      },
      {
        type: "toggle",
        key: "forceHd",
        label: "Force HD Quality",
        description: "Attempts to force the player into HD quality when possible.",
        defaultValue: true
      }
    ];
  });
}
module.exports = {
  getStreams,
  onSettings
};
