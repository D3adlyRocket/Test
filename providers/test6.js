/**
 * netmirror - Built from src/netmirror/
 * Generated: 2026-06-11T06:35:58.725Z
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

// src/netmirror/index.js
var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
var PLATFORMS = [
  { key: "nf", name: "Netflix" },
  { key: "pv", name: "Prime Video" },
  { key: "hs", name: "Hotstar / Disney+" }
];
var NEWTV_HEADERS = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
  "X-Requested-With": "NetmirrorNewTV v1.0",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0 /OS.GatuNewTV v1.0",
  "Accept": "application/json, text/plain, */*"
};
var NEWTV_DOMAINS = [
  "aHR0cHM6Ly9tb2JpbGVkZXRlY3RzLmNvbQ==",
  "aHR0cHM6Ly9tb2JpbGVkZXRlY3QuYXBw",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LmFydA==",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LmNj",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LmNsaWNr",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0Lmluaw==",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LmxpdmU=",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LnBybw==",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LnNob3A=",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LnNpdGU=",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LnNwYWNl",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LnN0b3Jl",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0LnZpcA==",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0Lndpa2k=",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0Lnh5eg==",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0cy5hcnQ=",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0cy5jYw==",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0cy5pbmZv",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0cy5pbms=",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0cy5saXZl",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0cy5wcm8=",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0cy5zdG9yZQ==",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0cy50b3A=",
  "aHR0cHM6Ly9tb2JpZGV0ZWN0cy54eXo="
];
var resolvedApiUrl = "";
function safeAtob(encoded) {
  if (typeof atob === "function")
    return atob(encoded);
  return Buffer.from(encoded, "base64").toString("binary");
}
function buildHeaders(ott, extra) {
  const h = {};
  const keys = Object.keys(NEWTV_HEADERS);
  for (let i = 0; i < keys.length; i++)
    h[keys[i]] = NEWTV_HEADERS[keys[i]];
  h["Ott"] = ott;
  if (extra) {
    const ek = Object.keys(extra);
    for (let i = 0; i < ek.length; i++)
      h[ek[i]] = extra[ek[i]];
  }
  return h;
}
function resolveApiUrl() {
  return __async(this, null, function* () {
    if (resolvedApiUrl)
      return resolvedApiUrl;
    for (let di = 0; di < NEWTV_DOMAINS.length; di++) {
      const base = safeAtob(NEWTV_DOMAINS[di]).replace(/\/$/, "");
      try {
        const r = yield fetch(base + "/checknewtv.php", { headers: NEWTV_HEADERS });
        const d = yield r.json();
        if (d.token_hash) {
          resolvedApiUrl = safeAtob(d.token_hash).replace(/\/$/, "");
          return resolvedApiUrl;
        }
      } catch (_) {
      }
    }
    throw new Error("NetMirror: failed to resolve API URL");
  });
}
function fetchEpisodesPage(seasonId, startPage, seasonNumber, ott, apiBase) {
  return __async(this, null, function* () {
    const episodes = [];
    let pg = startPage;
    while (true) {
      const r = yield fetch(apiBase + "/newtv/episodes.php?id=" + seasonId + "&page=" + pg, {
        headers: buildHeaders(ott)
      });
      const data = yield r.json();
      const epList = data.episodes || [];
      for (let ei = 0; ei < epList.length; ei++) {
        const ep = epList[ei];
        if (!ep)
          continue;
        const epNum = ep.ep ? parseInt(ep.ep, 10) : null;
        episodes.push({ id: ep.id, s: seasonNumber, ep: epNum });
      }
      if (data.nextPageShow !== 1)
        break;
      pg++;
    }
    return episodes;
  });
}
function getAllEpisodes(postData, ott, apiBase) {
  return __async(this, null, function* () {
    const episodes = [];
    const seasonList = postData.season || [];
    let selectedIdx = -1;
    for (let i = 0; i < seasonList.length; i++) {
      if (seasonList[i].selected === true) {
        selectedIdx = i;
        break;
      }
    }
    const selectedSeasonId = selectedIdx >= 0 ? seasonList[selectedIdx].id : postData.nextPageSeason;
    const selectedSeasonNumber = selectedIdx >= 0 ? selectedIdx + 1 : null;
    const embedded = postData.episodes || [];
    for (let i = 0; i < embedded.length; i++) {
      const ep = embedded[i];
      if (!ep)
        continue;
      const epNum = ep.ep ? parseInt(ep.ep, 10) : null;
      episodes.push({ id: ep.id, s: selectedSeasonNumber, ep: epNum });
    }
    if (postData.nextPageShow === 1 && selectedSeasonId) {
      const more = yield fetchEpisodesPage(selectedSeasonId, 2, selectedSeasonNumber, ott, apiBase);
      for (let i = 0; i < more.length; i++)
        episodes.push(more[i]);
    }
    for (let idx = 0; idx < seasonList.length; idx++) {
      const s = seasonList[idx];
      if (s.id !== selectedSeasonId && s.id) {
        const more = yield fetchEpisodesPage(s.id, 1, idx + 1, ott, apiBase);
        for (let i = 0; i < more.length; i++)
          episodes.push(more[i]);
      }
    }
    return episodes;
  });
}
function fetchFromPlatform(ott, platformName, title, mediaType, season, episode) {
  return __async(this, null, function* () {
    const apiBase = yield resolveApiUrl();
    const searchR = yield fetch(apiBase + "/newtv/search.php?s=" + encodeURIComponent(title), {
      headers: buildHeaders(ott)
    });
    const searchData = yield searchR.json();
    if (!searchData.searchResult || searchData.searchResult.length === 0)
      return null;
    const contentId = searchData.searchResult[0].id;
    const postR = yield fetch(apiBase + "/newtv/post.php?id=" + contentId, {
      headers: buildHeaders(ott, { Lastep: "", Usertoken: "" })
    });
    const postData = yield postR.json();
    let targetId;
    if (mediaType === "tv") {
      const allEps = yield getAllEpisodes(postData, ott, apiBase);
      let found = null;
      for (let i = 0; i < allEps.length; i++) {
        if (allEps[i] && allEps[i].s === season && allEps[i].ep === episode) {
          found = allEps[i];
          break;
        }
      }
      if (!found)
        return null;
      targetId = found.id;
    } else {
      const isSeries = postData.type === "t" || postData.episodes && postData.episodes.filter(function(e) {
        return e !== null;
      }).length > 0;
      if (isSeries)
        return null;
      targetId = postData.main_id || contentId;
    }
    const playerR = yield fetch(apiBase + "/newtv/player.php?id=" + targetId, {
      headers: buildHeaders(ott, { Usertoken: "" })
    });
    const player = yield playerR.json();
    if (player.status === "ok" && player.video_link) {
      return {
        name: "NetMirror / " + platformName,
        title: mediaType === "tv" ? "S" + String(season).padStart(2, "0") + "E" + String(episode).padStart(2, "0") + " \u2022 HLS" : title + " \u2022 HLS",
        url: player.video_link,
        quality: "Auto",
        headers: { Referer: player.referer || apiBase }
      };
    }
    return null;
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const tmdbType = mediaType === "tv" ? "tv" : "movie";
      const tmdbR = yield fetch(
        "https://api.themoviedb.org/3/" + tmdbType + "/" + tmdbId + "?api_key=" + TMDB_API_KEY,
        { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } }
      );
      const tmdbData = yield tmdbR.json();
      const title = mediaType === "tv" ? tmdbData.name : tmdbData.title;
      if (!title)
        return [];
      console.log("[NetMirror] " + mediaType + ' "' + title + '" S' + season + "E" + episode);
      const streams = [];
      for (let pi = 0; pi < PLATFORMS.length; pi++) {
        const p = PLATFORMS[pi];
        try {
          const result = yield fetchFromPlatform(p.key, p.name, title, mediaType, season, episode);
          if (result) {
            streams.push(result);
            console.log("[NetMirror] " + p.key + " ok: " + result.url);
          }
        } catch (e) {
          console.log("[NetMirror] " + p.key + " failed: " + e.message);
        }
      }
      console.log("[NetMirror] " + streams.length + " stream(s) found");
      return streams;
    } catch (e) {
      console.error("[NetMirror] Fatal: " + e.message);
      return [];
    }
  });
}
module.exports = { getStreams };
