/**
 * saimo-tv - Built from src/saimo-tv/
 * Generated: 2026-05-10T17:40:17.613Z
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

// src/saimo-tv/index.js
var saimo_tv_exports = {};
__export(saimo_tv_exports, {
  getStreams: () => getStreams
});
module.exports = __toCommonJS(saimo_tv_exports);

// src/saimo-tv/http.js
var BASE_URL = "https://sfumaypqhxzjssarmyrn.supabase.co/rest/v1/rpc";
var ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmdW1heXBxaHh6anNzYXJteXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MDU1ODUsImV4cCI6MjA4Nzk4MTU4NX0.Ff3DMipcepJuFXuhaXLsievmPG-Czu6FutHZJVxJTO8";
function rpc(_0) {
  return __async(this, arguments, function* (fn, body = {}) {
    const response = yield fetch(`${BASE_URL}/${fn}`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok)
      throw new Error(`RPC ${fn} falhou: ${response.status}`);
    return response.json();
  });
}

// src/saimo-tv/extractor.js
function findItemByTmdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var _a;
    const type = mediaType === "tv" ? "series" : "movie";
    try {
      const direct = yield rpc("get_item", { p_tmdb_id: parseInt(tmdbId, 10) });
      if (direct && direct.url)
        return direct;
    } catch (e) {
    }
    const home = yield rpc("get_home", { p_type: type, p_limit: 100 });
    if (!Array.isArray(home))
      throw new Error("Resposta inesperada de get_home");
    for (const category of home) {
      if (!category.items)
        continue;
      for (const item of category.items) {
        if (String((_a = item.tmdb) == null ? void 0 : _a.id) === String(tmdbId)) {
          return yield rpc("get_item", { p_id: item.id });
        }
      }
    }
    throw new Error(`Item com TMDB ID ${tmdbId} n\xE3o encontrado.`);
  });
}
function getStreamUrl(tmdbId, mediaType, season = null, episode = null) {
  return __async(this, null, function* () {
    const item = yield findItemByTmdbId(tmdbId, mediaType);
    if (!item.url)
      throw new Error("URL do stream n\xE3o encontrada.");
    if (mediaType === "tv" && season && episode && item.episodes) {
      const seasonKey = String(season);
      const eps = item.episodes[seasonKey];
      if (!eps)
        throw new Error(`Temporada ${season} n\xE3o encontrada.`);
      const ep = eps.find((e) => e.episode === episode);
      if (!ep)
        throw new Error(`Epis\xF3dio ${episode} n\xE3o encontrado.`);
      return ep.url;
    }
    return item.url;
  });
}

// src/saimo-tv/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    console.log(`[SaimoTV] Buscando: TMDB ${tmdbId}, ${mediaType}, S${season}E${episode}`);
    if (!["movie", "tv"].includes(mediaType)) {
      console.log('[SaimoTV] Apenas "movie" ou "tv" s\xE3o suportados.');
      return [];
    }
    try {
      const url = yield getStreamUrl(tmdbId, mediaType, season, episode);
      return [{
        name: "Saimo TV",
        title: `Saimo TV Stream`,
        url,
        quality: "720p",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://saimo-tv.pages.dev/",
          "Origin": "https://saimo-tv.pages.dev"
        }
      }];
    } catch (error) {
      console.error("[SaimoTV] Erro:", error.message);
      return [];
    }
  });
}
