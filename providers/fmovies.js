"use strict";
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
const ENABLE_PROXY = true;
const PROXY_WORKER_URL = "https://hlspxy.dpdns.org";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const ENABLE_STREAM_CACHE = false;
const CACHE_WORKER_URL = "https://cache.leokimpese.workers.dev";
const CACHE_TTL_SECONDS = 3600;
const PLUGIN_TAG = "[NetMirror TV v2.0]";
const COOKIE_EXPIRY_MS = 15 * 60 * 60 * 1e3;
const API_EXPIRY_MS = 24 * 60 * 60 * 1e3;
let _cachedToken = "";
let _tokenTimestamp = 0;
let _dynamicApiBase = "https://tv.imgcdn.kim";
let _apiBaseTimestamp = 0;
const _nmInFlight = {};
const PLATFORM_OTT = { netflix: "nf", primevideo: "pv", disney: "hs" };
const PLATFORM_LABEL = { netflix: "Netflix", primevideo: "Prime Video", disney: "JioHotstar" };
const APP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0 /OS.GatuNewTV v1.0";
const API_HEADERS = {
  "User-Agent": APP_UA,
  "Accept": "application/json, text/plain, */*",
  "X-Requested-With": "NetmirrorNewTV v1.0"
};
const decodeBase64 = (str) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  str = String(str).replace(/=+$/, "");
  for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
};
const unixNow = () => Math.floor(Date.now() / 1e3);
const makeCookieString = (obj) => Object.keys(obj).filter((k) => obj[k] != null).map((k) => k + "=" + obj[k]).join("; ");
const decodeHtmlEntities = (str) => str.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10))).replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
const absoluteUrl = (raw, base) => {
  if (!raw || raw.startsWith("data:"))
    return raw;
  if (raw.startsWith("https://") || raw.startsWith("http://"))
    return raw;
  if (raw.startsWith("//"))
    return "https:" + raw;
  if (raw.startsWith("/"))
    return new URL(base).origin + raw;
  const baseDir = base.replace(/\?.*$/, "").replace(/\/[^/]*$/, "/");
  return baseDir + raw;
};
const request = (url, opts = {}) => fetch(url, { redirect: "follow", headers: Object.assign({}, API_HEADERS, opts.headers || {}) }).then((res) => {
  if (!res.ok)
    throw new Error("HTTP " + res.status + " for " + url);
  return res;
});
const buildPlayerUrl = (originalUrl) => {
  if (!ENABLE_PROXY)
    return originalUrl;
  const base = PROXY_WORKER_URL.replace(/\/$/, "");
  return base + "/proxy?url=" + encodeURIComponent(originalUrl);
};
const nmCacheKey = (tmdbId, type, season, episode) => `nm_v13_${tmdbId}_${type}_${season != null ? season : "null"}_${episode != null ? episode : "null"}`;
const nmGetCachedStreams = (tmdbId, type, season, episode) => {
  const key = nmCacheKey(tmdbId, type, season, episode);
  console.log(PLUGIN_TAG + " [CACHE] Checking: " + key);
  return fetch(CACHE_WORKER_URL + "/" + key, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  }).then((res) => {
    if (res.status === 404)
      return null;
    if (!res.ok)
      throw new Error("Cache HTTP " + res.status);
    return res.json();
  }).then((data) => {
    if (!data || !Array.isArray(data.streams) || !data.streams.length)
      return null;
    console.log(PLUGIN_TAG + " [CACHE] \u26A1 Hit (" + data.streams.length + " stream(s))");
    return data.streams;
  }).catch(() => null);
};
const nmSetCachedStreams = (tmdbId, type, season, episode, streams) => {
  if (!streams.length)
    return Promise.resolve();
  const key = nmCacheKey(tmdbId, type, season, episode);
  return fetch(CACHE_WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key,
      streams,
      ttl: CACHE_TTL_SECONDS,
      metadata: { tmdbId, type, season, episode, savedAt: Date.now(), plugin: "netmirror-v13" }
    })
  }).then((res) => {
    console.log(PLUGIN_TAG + " [CACHE] Save " + (res.ok ? "\u2713" : "failed"));
  }).catch(() => {
  });
};
const getApiBase = () => {
  const now = Date.now();
  if (_dynamicApiBase && now - _apiBaseTimestamp < API_EXPIRY_MS)
    return Promise.resolve(_dynamicApiBase);
  console.log(PLUGIN_TAG + " Checking dynamic TV API base...");
  return fetch("https://mobiledetects.com/checknewtv.php", { headers: API_HEADERS }).then((res) => res.json()).then((data) => {
    if (data && data.token_hash) {
      _dynamicApiBase = decodeBase64(data.token_hash);
      _apiBaseTimestamp = Date.now();
      console.log(PLUGIN_TAG + " TV API Base Updated: " + _dynamicApiBase);
    }
    return _dynamicApiBase;
  }).catch(() => {
    console.log(PLUGIN_TAG + " Failed to check API base, using fallback: " + _dynamicApiBase);
    return _dynamicApiBase;
  });
};
const bypass = () => {
  const now = Date.now();
  if (_cachedToken && now - _tokenTimestamp < COOKIE_EXPIRY_MS)
    return Promise.resolve(_cachedToken);
  return getApiBase().then((apiBase) => {
    console.log(PLUGIN_TAG + " Requesting TV Token (1-Step OTP)...");
    return fetch(apiBase + "/newtv/otp.php?otp=111111", {
      headers: Object.assign({}, API_HEADERS, { "otp": "111111" })
    }).then((res) => {
      if (!res.ok)
        throw new Error("HTTP " + res.status);
      return res.json();
    }).then((data) => {
      if (data.status === "ok" && data.usertoken) {
        _cachedToken = data.usertoken;
        _tokenTimestamp = Date.now();
        console.log(PLUGIN_TAG + " TV Token Acquired");
        return _cachedToken;
      }
      throw new Error("Token extraction failed");
    });
  });
};
const seqRatio = (a, b) => {
  if (!a || !b)
    return 0;
  const la = a.length, lb = b.length;
  if (la === 0 && lb === 0)
    return 1;
  const dp = Array.from({ length: la + 1 }, () => new Array(lb + 1).fill(0));
  let best = 0;
  for (let i = 1; i <= la; i++)
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : 0;
      if (dp[i][j] > best)
        best = dp[i][j];
    }
  return 2 * best / (la + lb);
};
const jaccardWords = (a, b) => {
  const sa = new Set(a.split(/\s+/).filter(Boolean));
  const sb = new Set(b.split(/\s+/).filter(Boolean));
  let inter = 0;
  sa.forEach((w) => {
    if (sb.has(w))
      inter++;
  });
  const union = (/* @__PURE__ */ new Set([...sa, ...sb])).size;
  return union === 0 ? 0 : inter / union;
};
const normTitle = (s) => s.replace(/&amp;/gi, "&").toLowerCase().replace(/\s*&\s*/g, " and ").replace(/\(\d{4}\)/g, "").replace(/\bseason\s*\d+\b/gi, "").replace(/\bs\d{1,2}\b/gi, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
const calcTitleSim = (query, candidate) => {
  const q = normTitle(query), c = normTitle(candidate);
  if (!q || !c)
    return 0;
  if (q === c)
    return 1;
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp("^" + esc + "\\b").test(c))
    return 0.65;
  if (new RegExp("\\b" + esc + "\\b").test(c))
    return 0.6;
  return Math.max(seqRatio(q, c), jaccardWords(q, c)) * 0.8;
};
const scoreResult = (query, resultTitle, targetYear, resultYear) => {
  let rank = calcTitleSim(query, resultTitle);
  const rYear = resultYear || (resultTitle.match(/\b(19|20)\d{2}\b/) || [])[0];
  if (targetYear && rYear) {
    const d = Math.abs(parseInt(targetYear) - parseInt(rYear));
    if (d === 0)
      rank += 0.15;
    else if (d === 1)
      rank += 0.05;
    else
      rank -= 0.3;
  } else if (targetYear && !rYear && rank < 1)
    rank -= 0.1;
  return rank >= 0.72 ? rank : 0;
};
const resolveIds = (rawId, type) => __async(exports, null, function* () {
  const isTv = type === "series" || type === "tv";
  const mediaType = isTv ? "tv" : "movie";
  let imdbId = null, title = "", year = "";
  if (rawId && rawId.startsWith("tt")) {
    imdbId = rawId;
    try {
      const iRes = yield fetch("https://api.imdbapi.dev/titles/" + rawId).then((r) => r.json());
      title = iRes.originalTitle || iRes.primaryTitle || "";
      year = iRes.startYear ? String(iRes.startYear) : "";
    } catch (e) {
    }
  } else {
    const tmdbId = (rawId || "").replace(/^tmdb:/i, "");
    try {
      const info = yield fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`).then((r) => r.json());
      imdbId = info.imdb_id || info.external_ids && info.external_ids.imdb_id || null;
      title = (isTv ? info.name : info.title) || "";
      year = ((isTv ? info.first_air_date : info.release_date) || "").slice(0, 4);
    } catch (e) {
    }
  }
  const searchQueue = [];
  if (imdbId) {
    try {
      const [imdbInfo, akasData] = yield Promise.all([
        fetch("https://api.imdbapi.dev/titles/" + imdbId).then((r) => r.json()).catch(() => null),
        fetch("https://api.imdbapi.dev/titles/" + imdbId + "/akas").then((r) => r.json()).catch(() => ({ akas: [] }))
      ]);
      if (imdbInfo) {
        if (imdbInfo.originalTitle)
          searchQueue.push(imdbInfo.originalTitle);
        if (imdbInfo.primaryTitle && imdbInfo.primaryTitle !== imdbInfo.originalTitle)
          searchQueue.push(imdbInfo.primaryTitle);
      }
      (akasData.akas || []).filter((a) => a.country && a.country.code === "IN").forEach((a) => {
        if (!searchQueue.includes(a.text))
          searchQueue.push(a.text);
      });
    } catch (e) {
    }
  }
  if (!searchQueue.length)
    searchQueue.push(title || rawId);
  console.log(PLUGIN_TAG + " search queue: " + JSON.stringify(searchQueue));
  return { title, year, isTv, imdbId, searchQueue };
});
const searchPlatform = (fullTitle, targetYear, platform, usertoken) => {
  const ott = PLATFORM_OTT[platform];
  const hdrs = Object.assign({}, API_HEADERS, { "ott": ott, "usertoken": usertoken });
  const rawSearch = (q) => request(_dynamicApiBase + "/newtv/search.php?s=" + encodeURIComponent(q), { headers: hdrs }).then((res) => res.json()).then((data) => data.searchResult || []).catch(() => []);
  const fetchMeta = (id) => request(_dynamicApiBase + "/newtv/post.php?id=" + id, { headers: hdrs }).then((res) => res.json()).then((data) => ({
    id: data.main_id,
    // main_id is the canonical id
    title: data.title,
    year: parseInt(data.year) || null,
    lang: (data.lang || []).map((l) => (l.l || "").toLowerCase()),
    type: data.type,
    raw: data
  })).catch(() => null);
  const stopWords = /* @__PURE__ */ new Set([
    "the",
    "a",
    "an",
    "of",
    "in",
    "on",
    "to",
    "for",
    "and",
    "or",
    "is",
    "it",
    "at",
    "as",
    "by",
    "with",
    "from",
    "this",
    "that",
    "those",
    "these",
    "much",
    "more",
    "very",
    "just",
    "some",
    "any",
    "each",
    "every",
    "all",
    "both",
    "few",
    "most",
    "other",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very"
  ]);
  const words = fullTitle.split(/\s+/).filter((w) => !stopWords.has(w.toLowerCase()) && w.length > 2);
  const strong = words.filter((w) => /^[A-Z]/.test(w) || /\d/.test(w));
  const keywords = strong.length >= 2 ? strong.slice(0, 3) : words.slice(0, 2);
  console.log(PLUGIN_TAG + " [" + platform + "] keywords: " + keywords.join(", "));
  const candidateMap = /* @__PURE__ */ new Map();
  return Promise.all(keywords.map(
    (kw) => rawSearch(kw).then(
      (results) => results.forEach((r) => {
        if (!candidateMap.has(r.id))
          candidateMap.set(r.id, { id: r.id, title: r.t });
      })
    )
  )).then(() => __async(exports, null, function* () {
    const candidates = Array.from(candidateMap.values());
    if (!candidates.length) {
      console.log(PLUGIN_TAG + " [" + platform + "] no candidates from keywords");
      return null;
    }
    const scored = candidates.map((c) => __spreadProps(__spreadValues({}, c), {
      titleScore: calcTitleSim(fullTitle, c.title)
    })).filter((c) => c.titleScore >= 0.45);
    if (!scored.length) {
      console.log(PLUGIN_TAG + " [" + platform + "] no candidate above title threshold");
      return null;
    }
    scored.sort((a, b) => b.titleScore - a.titleScore);
    const topCandidates = scored.slice(0, 5);
    const detailed = yield Promise.all(topCandidates.map((c) => __async(exports, null, function* () {
      const meta = yield fetchMeta(c.id);
      if (!meta)
        return null;
      let score = c.titleScore;
      if (targetYear && meta.year) {
        const diff = Math.abs(targetYear - meta.year);
        if (diff === 0)
          score += 0.25;
        else if (diff === 1)
          score += 0.1;
        else
          score -= 0.2;
      }
      if (meta.lang && meta.lang.includes("hindi")) {
        score += 0.15;
      }
      if (c.titleScore >= 0.9)
        score += 0.1;
      console.log(PLUGIN_TAG + " [" + platform + "] detail: '" + meta.title + "' year=" + meta.year + " langs=" + meta.lang.join(",") + " -> final score " + score.toFixed(3));
      return { id: meta.id, title: meta.title, score, meta };
    }))).then((arr) => arr.filter(Boolean));
    if (!detailed.length)
      return null;
    const best = detailed.reduce((a, b) => b.score > a.score ? b : a);
    console.log(PLUGIN_TAG + " [" + platform + "] selected: " + best.title + " (score=" + best.score.toFixed(3) + ")");
    return { id: best.id, title: best.title, score: best.score };
  }));
};
const LANG_MAP = {
  /* same mapping as before */
};
const parseLangArray = (langs) => {
  if (!Array.isArray(langs) || !langs.length)
    return [];
  const seen = {}, out = [];
  langs.forEach((e) => {
    const l = e.l || LANG_MAP[(e.s || "").toLowerCase()] || null;
    if (l && !seen[l]) {
      seen[l] = true;
      out.push(l);
    }
  });
  return out;
};
const formatLangs = (langs) => langs && langs.length ? langs.slice(0, 5).join(" - ") + (langs.length > 5 ? " +" + (langs.length - 5) + " more" : "") : null;
const loadContent = (contentId, platform, usertoken) => {
  const ott = PLATFORM_OTT[platform];
  const hdrs = Object.assign({}, API_HEADERS, { "ott": ott, "usertoken": usertoken });
  return request(_dynamicApiBase + "/newtv/post.php?id=" + contentId, { headers: hdrs }).then((res) => res.json()).then((data) => ({
    id: contentId,
    title: data.title,
    year: data.year,
    type: data.type,
    episodes: (data.episodes || []).filter(Boolean),
    seasons: data.season || [],
    langs: parseLangArray(data.lang || []),
    raw: data
  }));
};
const fetchEpisodesForSeason = (seasonId, platform, usertoken) => {
  const ott = PLATFORM_OTT[platform];
  const hdrs = Object.assign({}, API_HEADERS, { "ott": ott, "usertoken": usertoken });
  return request(_dynamicApiBase + "/newtv/episodes.php?id=" + seasonId, { headers: hdrs }).then((res) => res.json()).then((data) => (data.episodes || []).filter(Boolean)).catch(() => []);
};
const findEpisode = (episodes, targetSeason, targetEpisode) => {
  const s = parseInt(targetSeason), e = parseInt(targetEpisode);
  return (episodes || []).find((ep) => {
    if (!ep)
      return false;
    let epS = -1, epE = -1;
    const rawEp = ep.ep || ep.episode || "";
    const eMatch = (rawEp + "").match(/\d+/);
    epE = eMatch ? parseInt(eMatch[0]) : -1;
    const rawS = ep.s || ep.season || "";
    const sMatch = (rawS + "").match(/\d+/);
    if (sMatch)
      epS = parseInt(sMatch[0]);
    else if (Array.isArray(ep.info) && ep.info.length > 0) {
      const disneyMatch = (ep.info[0] + "").match(/:S(\d+)/i);
      if (disneyMatch)
        epS = parseInt(disneyMatch[1]);
      else if (ep.info.length >= 2) {
        const netMatch = (ep.info[1] + "").match(/S(\d+)/i);
        if (netMatch)
          epS = parseInt(netMatch[1]);
      }
    }
    if (epS === -1)
      return false;
    return epS === s && epE === e;
  }) || null;
};
const getPlaylist = (contentId, title, platform, usertoken) => __async(exports, null, function* () {
  const ott = PLATFORM_OTT[platform];
  const hdrs = Object.assign({}, API_HEADERS, { "ott": ott, "usertoken": usertoken });
  const playerData = yield fetch(
    _dynamicApiBase + "/newtv/player.php?id=" + contentId,
    { headers: hdrs }
  ).then((r) => r.json());
  if (playerData.status !== "ok" || !playerData.video_link)
    return { sources: [], subtitles: [] };
  const masterUrl = playerData.video_link.replace(/\\\//g, "/");
  const masterText = yield fetch(masterUrl, { headers: API_HEADERS }).then((r) => r.text());
  const lines = masterText.split("\n");
  const videoVariants = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#EXT-X-STREAM-INF")) {
      const videoUrl = lines[i + 1] ? lines[i + 1].trim() : "";
      if (videoUrl && !videoUrl.startsWith("#")) {
        videoVariants.push({ line, videoUrl });
        i++;
      }
    }
  }
  const sources = videoVariants.map((variant) => {
    const resMatch = variant.line.match(/RESOLUTION=(\d+x\d+)/i);
    let label = "Auto";
    if (resMatch) {
      const height = parseInt(resMatch[1].split("x")[1]) || 0;
      if (height >= 1080)
        label = "1080p";
      else if (height >= 720)
        label = "720p";
      else if (height >= 480)
        label = "480p";
      else
        label = height + "p";
    }
    const proxiedUrl = buildPlayerUrl(masterUrl) + "&q=" + encodeURIComponent(label);
    return {
      url: proxiedUrl,
      label,
      type: "application/x-mpegURL",
      isDefault: false
    };
  });
  if (!sources.length) {
    sources.push({
      url: buildPlayerUrl(masterUrl),
      label: "Auto",
      type: "application/x-mpegURL",
      isDefault: true
    });
  }
  return {
    sources: sources.sort((a, b) => (parseInt(b.label) || 0) - (parseInt(a.label) || 0)),
    subtitles: []
  };
});
const buildStreamLine = (platform, content, resolved, ep) => {
  let titleLine = content.title || resolved.title;
  if (content.year || resolved.year)
    titleLine += " (" + (content.year || resolved.year) + ")";
  if (resolved.isTv && ep) {
    let epS = "?", epE = "?";
    const m = (ep.ep || ep.episode || "").toString().match(/\d+/);
    if (m)
      epE = m[0];
    const sMatch = (ep.s || ep.season || "").toString().match(/\d+/);
    if (sMatch)
      epS = sMatch[0];
    else if (Array.isArray(ep.info) && ep.info.length > 0) {
      const dm = ep.info[0].match(/:S(\d+)/i);
      const nm = ep.info.length >= 2 ? ep.info[1].match(/S(\d+)/i) : null;
      epS = dm ? dm[1] : nm ? nm[1] : "?";
    }
    titleLine += " - S" + epS + "E" + epE;
    if (ep.t)
      titleLine += " - " + decodeHtmlEntities(ep.t);
  }
  const langs = formatLangs(content.langs);
  return langs ? titleLine + "\n" + langs : titleLine;
};
const makeStream = (platform, qualityName, finalUrl, titleLine) => {
  console.log(PLUGIN_TAG + " [stream] " + qualityName + " \u2192 " + finalUrl.slice(0, 80) + "\u2026");
  return {
    name: (PLATFORM_LABEL[platform] || platform) + " | " + qualityName,
    title: titleLine,
    url: finalUrl,
    // already proxied
    type: "hls",
    headers: {},
    behaviorHints: { bingeGroup: "netmirror-" + platform }
  };
};
const loadPlatformContent = (platform, hit, resolved, season, episode, usertoken) => __async(exports, null, function* () {
  console.log(PLUGIN_TAG + " >> Pipeline: " + PLATFORM_LABEL[platform]);
  const content = yield loadContent(hit.id, platform, usertoken);
  if (!content)
    return null;
  let episodes = content.episodes;
  if (resolved.isTv) {
    const sNum = parseInt(season) || 1;
    let targetSeasonId = null;
    (content.seasons || []).forEach((se) => {
      const m = (se.s || "").match(/\d+/);
      if (m && parseInt(m[0]) === sNum)
        targetSeasonId = se.id;
    });
    if (targetSeasonId && (!episodes.length || targetSeasonId !== content.raw.nextPageSeason)) {
      const more = yield fetchEpisodesForSeason(targetSeasonId, platform, usertoken);
      episodes = more.length ? more : episodes;
    }
    if (!episodes.length && content.raw.nextPageSeason) {
      episodes = yield fetchEpisodesForSeason(content.raw.nextPageSeason, platform, usertoken);
    }
  }
  const epObj = resolved.isTv ? findEpisode(episodes, season, episode) : null;
  if (resolved.isTv && !epObj) {
    console.log(PLUGIN_TAG + " S" + season + "E" + episode + " not found on " + PLATFORM_LABEL[platform]);
    return null;
  }
  const targetId = epObj ? epObj.id : hit.id;
  const { sources } = yield getPlaylist(targetId, content.title, platform, usertoken);
  if (!sources.length)
    return null;
  const titleLine = buildStreamLine(platform, content, resolved, epObj);
  return sources.map((src) => makeStream(platform, src.label, src.url, titleLine));
});
const getStreams = (tmdbId, type, season, episode) => __async(exports, null, function* () {
  const s = season ? parseInt(season) : null;
  const e = episode ? parseInt(episode) : null;
  const contentType = type === "series" || type === "tv" ? "tv" : "movie";
  const flightKey = nmCacheKey(tmdbId, contentType, s, e);
  if (_nmInFlight[flightKey])
    return _nmInFlight[flightKey];
  const promise = (() => __async(exports, null, function* () {
    console.log(PLUGIN_TAG + " Request: " + tmdbId + " " + type + (s ? " S" + s + "E" + e : ""));
    if (ENABLE_STREAM_CACHE) {
      const cached = yield nmGetCachedStreams(tmdbId, contentType, s, e);
      if (cached)
        return cached;
    }
    const resolved = yield resolveIds(tmdbId, type);
    if (!resolved.title)
      return [];
    const usertoken = yield bypass();
    const platforms = Object.keys(PLATFORM_OTT);
    const searches = yield Promise.all(
      platforms.map(
        (p) => searchPlatform(resolved.title, resolved.year, p, usertoken).then((hit) => ({ platform: p, hit }))
      )
    );
    const maxScore = searches.reduce((max, r) => r.hit && r.hit.score > max ? r.hit.score : max, 0);
    if (maxScore === 0)
      return [];
    const threshold = maxScore >= 1 ? 1 : maxScore;
    const winners = searches.filter((r) => r.hit && r.hit.score >= threshold);
    console.log(PLUGIN_TAG + " \u{1F3C6} " + winners.length + " winner(s) at score=" + maxScore.toFixed(3));
    const streamsArrays = yield Promise.all(
      winners.map((w) => loadPlatformContent(w.platform, w.hit, resolved, s, e, usertoken))
    );
    const allStreams = [];
    streamsArrays.forEach((arr) => {
      if (arr)
        allStreams.push(...arr);
    });
    if (ENABLE_STREAM_CACHE && allStreams.length) {
      yield nmSetCachedStreams(tmdbId, contentType, s, e, allStreams);
    }
    return allStreams;
  }))();
  _nmInFlight[flightKey] = promise;
  promise.finally(() => delete _nmInFlight[flightKey]);
  return promise;
});
module.exports = { getStreams };
