/**
 * torbox - Built from src/torbox/
 * Generated: 2026-05-23T15:13:58.650Z
 */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
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

// src/torbox/index.js
var torbox_exports = {};
__export(torbox_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(torbox_exports);

// src/torbox/http.js
var TORBOX_BASE = "https://api.torbox.app/v1/api";
function tbGet(path, params, apiKey) {
  return __async(this, null, function* () {
    const url = new URL(TORBOX_BASE + path);
    if (params) {
      Object.keys(params).forEach((k) => {
        if (params[k] !== null && params[k] !== void 0) {
          url.searchParams.append(k, String(params[k]));
        }
      });
    }
    const res = yield fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json"
      }
    });
    if (!res.ok)
      throw new Error("TorBox GET error: " + res.status);
    return res.json();
  });
}
function tbPost(path, body, apiKey) {
  return __async(this, null, function* () {
    const res = yield fetch(TORBOX_BASE + path, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok)
      throw new Error("TorBox POST error: " + res.status);
    return res.json();
  });
}
function publicGet(url, params) {
  return __async(this, null, function* () {
    const u = new URL(url);
    if (params) {
      Object.keys(params).forEach((k) => {
        if (params[k] !== null && params[k] !== void 0) {
          u.searchParams.set(k, String(params[k]));
        }
      });
    }
    const res = yield fetch(u.toString(), {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NuvioProvider/1.0)" }
    });
    if (!res.ok)
      throw new Error("Public GET error: " + res.status + " " + url);
    return res.json();
  });
}

// src/torbox/search.js
var KNABEN_API = "https://knaben.eu/api/v1";
var QUALITY_SCORE = {
  "2160p": 8,
  "4k": 8,
  "uhd": 7,
  "remux": 6,
  "1080p": 5,
  "bluray": 4,
  "web-dl": 3,
  "webrip": 3,
  "720p": 2
};
function qualityScore(title) {
  const t = (title || "").toLowerCase();
  for (const [kw, score] of Object.entries(QUALITY_SCORE)) {
    if (t.includes(kw))
      return score;
  }
  return 0;
}
function extractHash(value) {
  if (!value)
    return null;
  if (/^[a-fA-F0-9]{40}$/.test(value))
    return value.toLowerCase();
  const m = value.match(/btih:([a-fA-F0-9]{40})/i);
  if (m)
    return m[1].toLowerCase();
  return null;
}
function searchKnaben(query, mediaType, maxResults) {
  return __async(this, null, function* () {
    const categoryId = mediaType === "tv" ? 5e3 : 2e3;
    const data = yield publicGet(KNABEN_API + "/search", {
      q: query,
      categories: categoryId,
      orderBy: "seeders",
      orderDirection: "desc",
      take: maxResults
    });
    if (!data || !Array.isArray(data.hits))
      return [];
    return data.hits.map((item) => {
      const hash = extractHash(item.infoHash || item.hash || item.magnet || "");
      if (!hash)
        return null;
      return {
        hash,
        title: item.name || item.title || "",
        size: item.bytes || item.size || 0,
        seeders: item.seeders || 0
      };
    }).filter(Boolean);
  });
}
function buildQuery(title, year, mediaType, season, episode) {
  let q = title;
  if (year)
    q += " " + year;
  if (mediaType === "tv" && season != null && episode != null) {
    const s = String(season).padStart(2, "0");
    const e = String(episode).padStart(2, "0");
    q += " S" + s + "E" + e;
  }
  return q.trim();
}
function findTorrentHashes(title, year, mediaType, season, episode) {
  return __async(this, null, function* () {
    const query = buildQuery(title, year, mediaType, season, episode);
    console.log("[TorBox/search] Query:", query);
    let results = [];
    try {
      results = yield searchKnaben(query, mediaType, 30);
      console.log("[TorBox/search] Knaben returned", results.length, "results");
    } catch (err) {
      console.log("[TorBox/search] Knaben error:", err.message);
    }
    const seen = /* @__PURE__ */ new Set();
    const unique = results.filter((r) => {
      if (seen.has(r.hash))
        return false;
      seen.add(r.hash);
      return true;
    });
    unique.sort((a, b) => {
      const qs = qualityScore(b.title) - qualityScore(a.title);
      if (qs !== 0)
        return qs;
      return (b.seeders || 0) - (a.seeders || 0);
    });
    return unique;
  });
}

// src/torbox/torbox.js
var TORBOX_BASE2 = "https://api.torbox.app/v1/api";
function isVideoFile(name) {
  if (!name)
    return false;
  const ext = (name.split(".").pop() || "").toLowerCase();
  return ["mkv", "mp4", "avi", "mov", "m4v", "ts", "webm", "wmv"].includes(ext);
}
function parseQuality(s) {
  const t = (s || "").toLowerCase();
  if (t.includes("2160p") || t.includes("4k") || t.includes("uhd"))
    return "4K";
  if (t.includes("1080p"))
    return "1080p";
  if (t.includes("720p"))
    return "720p";
  if (t.includes("480p"))
    return "480p";
  return "Unknown";
}
function checkCached(hashes, apiKey) {
  return __async(this, null, function* () {
    const cached = /* @__PURE__ */ new Set();
    if (!hashes || hashes.length === 0)
      return cached;
    const BATCH = 100;
    for (let i = 0; i < hashes.length; i += BATCH) {
      const batch = hashes.slice(i, i + BATCH);
      try {
        const resp = yield tbGet(
          "/torrents/checkcached",
          { hash: batch.join(","), format: "list" },
          apiKey
        );
        if (!resp.success || !resp.data)
          continue;
        const data = resp.data;
        if (Array.isArray(data)) {
          data.forEach((h) => cached.add(String(h).toLowerCase()));
        } else if (typeof data === "object") {
          Object.keys(data).forEach((h) => cached.add(h.toLowerCase()));
        }
      } catch (err) {
        console.log("[TorBox/cache] checkcached error:", err.message);
      }
    }
    return cached;
  });
}
function addTorrent(hash, name, apiKey) {
  return __async(this, null, function* () {
    const magnet = "magnet:?xt=urn:btih:" + hash;
    try {
      const resp = yield tbPost(
        "/torrents/createtorrent",
        { magnet, name: name || hash, as_queued: false },
        apiKey
      );
      if (resp.success && resp.data) {
        return resp.data.torrent_id || resp.data.id || null;
      }
      if (resp.error === "DUPLICATE_ITEM" && resp.data) {
        return resp.data.torrent_id || resp.data.id || null;
      }
      console.log("[TorBox] addTorrent failed:", resp.detail);
      return null;
    } catch (err) {
      console.log("[TorBox] addTorrent error:", err.message);
      return null;
    }
  });
}
function getTorrentFiles(torrentId, apiKey) {
  return __async(this, null, function* () {
    try {
      const resp = yield tbGet(
        "/torrents/mylist",
        { id: torrentId, bypass_cache: "true" },
        apiKey
      );
      if (!resp.success || !resp.data)
        return [];
      const torrent = Array.isArray(resp.data) ? resp.data[0] : resp.data;
      return torrent && torrent.files ? torrent.files : [];
    } catch (err) {
      console.log("[TorBox] getTorrentFiles error:", err.message);
      return [];
    }
  });
}
function buildStreamUrl(apiKey, torrentId, fileId) {
  return TORBOX_BASE2 + "/torrents/requestdl?token=" + apiKey + "&torrent_id=" + torrentId + "&file_id=" + fileId + "&redirect=true";
}
function debridHash(hash, torrentTitle, apiKey) {
  return __async(this, null, function* () {
    const streams = [];
    const torrentId = yield addTorrent(hash, torrentTitle, apiKey);
    if (!torrentId)
      return streams;
    const files = yield getTorrentFiles(torrentId, apiKey);
    const videos = files.filter((f) => isVideoFile(f.name || f.short_name || ""));
    if (videos.length === 0) {
      const url = buildStreamUrl(apiKey, torrentId, 0);
      const q = parseQuality(torrentTitle);
      streams.push({
        name: "TorBox",
        title: q + " \xB7 " + (torrentTitle || "").substring(0, 60),
        url,
        quality: q
      });
      return streams;
    }
    for (const file of videos) {
      const fileId = file.id;
      const fileName = file.name || file.short_name || "";
      const url = buildStreamUrl(apiKey, torrentId, fileId);
      const q = parseQuality(torrentTitle + " " + fileName);
      streams.push({
        name: "TorBox",
        title: q + " \xB7 " + fileName.substring(0, 60),
        url,
        quality: q
      });
    }
    return streams;
  });
}

// src/torbox/extractor.js
var TMDB_API = "https://api.themoviedb.org/3";
function resolveTmdbTitle(tmdbId, mediaType, tmdbApiKey) {
  return __async(this, null, function* () {
    if (!tmdbApiKey)
      return null;
    try {
      const endpoint = mediaType === "tv" ? TMDB_API + "/tv/" + tmdbId + "?api_key=" + tmdbApiKey + "&language=en-US" : TMDB_API + "/movie/" + tmdbId + "?api_key=" + tmdbApiKey + "&language=en-US";
      const res = yield fetch(endpoint);
      if (!res.ok)
        return null;
      const data = yield res.json();
      const title = data.title || data.name || null;
      const rawDate = data.release_date || data.first_air_date || "";
      const year = rawDate ? parseInt(rawDate.substring(0, 4), 10) : null;
      return title ? { title, year } : null;
    } catch (err) {
      console.log("[TorBox/tmdb] resolve error:", err.message);
      return null;
    }
  });
}
function extractStreams(tmdbId, mediaType, season, episode, apiKey, tmdbApiKey) {
  return __async(this, null, function* () {
    let title = null;
    let year = null;
    const resolved = yield resolveTmdbTitle(tmdbId, mediaType, tmdbApiKey);
    if (resolved) {
      title = resolved.title;
      year = resolved.year;
      console.log("[TorBox] Resolved title:", title, year);
    } else {
      title = "tmdb" + tmdbId;
      console.log("[TorBox] No TMDB key, searching by ID:", title);
    }
    const candidates = yield findTorrentHashes(title, year, mediaType, season, episode);
    if (candidates.length === 0) {
      console.log("[TorBox] No torrents found");
      return [];
    }
    console.log("[TorBox] Found", candidates.length, "torrent candidates");
    const hashes = candidates.map((c) => c.hash);
    const cachedSet = yield checkCached(hashes, apiKey);
    console.log("[TorBox] Cached hashes:", cachedSet.size, "/", hashes.length);
    const cachedCandidates = candidates.filter((c) => cachedSet.has(c.hash));
    if (cachedCandidates.length === 0) {
      console.log("[TorBox] No cached hits, falling back to top 3 uncached");
      const fallback = candidates.slice(0, 3);
      const streams2 = [];
      for (const c of fallback) {
        const s = yield debridHash(c.hash, c.title, apiKey);
        streams2.push(...s);
      }
      return streams2;
    }
    const toDebrid = cachedCandidates.slice(0, 5);
    const streams = [];
    for (const candidate of toDebrid) {
      const s = yield debridHash(candidate.hash, candidate.title, apiKey);
      streams.push(...s);
    }
    console.log("[TorBox] Total streams:", streams.length);
    return streams;
  });
}

// src/torbox/index.js
function getSetting(key) {
  if (typeof globalThis !== "undefined" && globalThis.SCRAPER_SETTINGS && globalThis.SCRAPER_SETTINGS[key]) {
    return globalThis.SCRAPER_SETTINGS[key];
  }
  return null;
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const apiKey = getSetting("torbox_api_key");
    if (!apiKey) {
      console.log("[TorBox] Missing torbox_api_key in SCRAPER_SETTINGS");
      return [];
    }
    const tmdbApiKey = "01926d2187b6a5d861eefc750e9df3e3";
    try {
      return yield extractStreams(tmdbId, mediaType, season, episode, apiKey, tmdbApiKey);
    } catch (err) {
      console.log("[TorBox] Fatal error in getStreams:", err.message);
      return [];
    }
  });
}
