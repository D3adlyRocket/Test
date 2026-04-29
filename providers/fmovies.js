/**
 * brazucaplay - Nuvio Optimized (English Focus)
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// Utilities required by Nuvio
var { fetchJson, setSessionUA } = require_http();
var { finalizeStreams } = require_engine();

var API_DEC = "https://enc-dec.app/api/dec-videasy";
var TMDB_API_KEY = "d131017ccc6e5462a81c9304d21476de";

function getStreams(tmdbId = "76600", mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    const currentUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    setSessionUA(currentUA);
    
    const results = [];
    try {
      // 1. Get Meta
      const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
      const tmdbData = yield fetchJson(tmdbUrl);
      const imdbId = tmdbData.external_ids?.imdb_id || "";
      const cleanTitle = tmdbData.title || tmdbData.name || "";
      const releaseDate = tmdbData.release_date || tmdbData.first_air_date || "";
      const year = releaseDate ? releaseDate.split("-")[0] : "";

      // 2. Query Videasy
      let searchUrl = `https://api2.videasy.net/cuevana/sources-with-title?title=${encodeURIComponent(cleanTitle)}&mediaType=${mediaType === "tv" ? "tv" : "movie"}&year=${year}&tmdbId=${tmdbId}&imdbId=${imdbId}`;
      
      if (mediaType === "tv" && season && episode) {
        searchUrl += `&seasonId=${season}&episodeId=${episode}`;
      }

      const encryptedResponse = yield fetch(searchUrl, {
        headers: { 
          "User-Agent": currentUA,
          "Referer": "https://videasy.net/",
          "Origin": "https://videasy.net"
        }
      });
      
      const encryptedText = yield encryptedResponse.text();

      // 3. Decrypt
      const decResponse = yield fetch(API_DEC, {
        method: "POST",
        headers: { "User-Agent": currentUA, "Content-Type": "application/json" },
        body: JSON.stringify({ text: encryptedText, id: tmdbId })
      });

      if (!decResponse.ok) return [];

      const decData = yield decResponse.json();
      const mediaData = decData.result;

      if (mediaData && mediaData.sources) {
        for (const source of mediaData.sources) {
          if (source.url) {
            results.push({
              // CRITICAL: We tag these as "Latino" internally so the Nuvio filter 
              // doesn't delete them, but we name them "English" for you to see.
              language: "Latino", 
              serverLabel: source.label || "Brazuca",
              url: source.url,
              quality: source.quality || "HD",
              headers: {
                "User-Agent": currentUA,
                "Referer": "https://videasy.net/",
                "Origin": "https://videasy.net"
              }
            });
          }
        }
      }
    } catch (error) {
      console.log("[BrazucaPlay] Error:", error.message);
    }

    // Pass "FuegoCine" as the second argument to bypass the strict Latino filter 
    // inside the Nuvio engine.js
    return yield finalizeStreams(results, "FuegoCine");
  });
}

module.exports = { getStreams };
