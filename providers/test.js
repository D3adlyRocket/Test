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

// src/anikototv/index.js
var PROVIDER_NAME = "AnikotoTV";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
function getTMDBTitle(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const type = mediaType === "tv" || mediaType === "series" ? "tv" : "movie";
    let url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    if (String(tmdbId).startsWith("tt")) {
      url = `https://api.themoviedb.org/3/find/${tmdbId}?external_source=imdb_id&api_key=${TMDB_API_KEY}`;
      try {
        const res = yield fetch(url);
        if (res.ok) {
          const data = yield res.json();
          if (type === "tv" && data.tv_results && data.tv_results.length > 0) {
            return { title: data.tv_results[0].name, numericId: data.tv_results[0].id };
          } else if (type === "movie" && data.movie_results && data.movie_results.length > 0) {
            return { title: data.movie_results[0].title, numericId: data.movie_results[0].id };
          }
        }
      } catch (e) {
      }
      return { title: null, numericId: null };
    }
    try {
      const res = yield fetch(url);
      if (res.ok) {
        const data = yield res.json();
        return { title: type === "tv" ? data.name : data.title, numericId: tmdbId };
      }
    } catch (e) {
    }
    return { title: null, numericId: null };
  });
}
function getTMDBSeasonName(tmdbId, season) {
  return __async(this, null, function* () {
    const url = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_API_KEY}`;
    try {
      const res = yield fetch(url);
      if (res.ok) {
        const data = yield res.json();
        return data.name;
      }
    } catch (e) {
    }
    return null;
  });
}
function aniListBridge(title) {
  return __async(this, null, function* () {
    const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
        idMal
      }
    }
    `;
    try {
      const res = yield fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ query, variables: { search: title } })
      });
      const data = yield res.json();
      if (data && data.data && data.data.Media) {
        return {
          malId: data.data.Media.idMal,
          aniId: data.data.Media.id,
          absEp: null
        };
      }
    } catch (e) {
    }
    return null;
  });
}
function getMalId(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      let url = `https://arm.haglund.dev/api/v2/tmdb?id=${tmdbId}`;
      if (mediaType === "tv" || mediaType === "series") url += `&s=${season}&e=${episode}`;
      const res = yield fetch(url);
      if (res.ok) {
        const data = yield res.json();
        if (data.mal || data.mal_id || data.anilist || data.ani_id) {
          return {
            malId: data.mal || data.mal_id,
            aniId: data.anilist || data.ani_id,
            absEp: data.episode || episode
          };
        }
      }
    } catch (e) {
    }
    const tmdbData = yield getTMDBTitle(tmdbId, mediaType);
    let searchTitle = tmdbData.title;
    const numericTmdbId = tmdbData.numericId;
    if (searchTitle) {
      if ((mediaType === "tv" || mediaType === "series") && season > 1 && numericTmdbId) {
        const seasonName = yield getTMDBSeasonName(numericTmdbId, season);
        if (seasonName) {
          if (seasonName.toLowerCase().includes(searchTitle.toLowerCase())) {
            searchTitle = seasonName;
          } else {
            searchTitle = `${searchTitle} ${seasonName}`;
          }
        } else {
          searchTitle = `${searchTitle} Season ${season}`;
        }
      }
      console.log(`[${PROVIDER_NAME}] TMDB Title: ${searchTitle}`);
      const mapping = yield aniListBridge(searchTitle);
      if (mapping) {
        mapping.absEp = episode;
        return mapping;
      }
    }
    return null;
  });
}
function extractHLS(embedUrl, domain) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(embedUrl, { headers: { "Referer": `https://${domain}/` } });
      if (!res.ok) return null;
      const html = yield res.text();
      const match = html.match(/data-id="(\d+)"/);
      if (!match) return null;
      const dataId = match[1];
      const sourceUrl = `https://${domain}/stream/getSources?id=${dataId}`;
      const sourceRes = yield fetch(sourceUrl, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "Referer": embedUrl
        }
      });
      if (!sourceRes.ok) return null;
      const json = yield sourceRes.json();
      if (json.sources && json.sources.file) {
        const subtitles = [];
        if (json.tracks) {
          for (const track of json.tracks) {
            if (track.kind === "captions" || track.kind === "subtitles") {
              subtitles.push({
                url: track.file,
                lang: track.label || "Unknown"
              });
            }
          }
        }
        return {
          url: json.sources.file,
          subtitles,
          headers: {
            "Referer": `https://${domain}/`,
            "Origin": `https://${domain}`
          }
        };
      }
    } catch (e) {
      console.error(`[${PROVIDER_NAME}] Extractor Error for ${domain}:`, e.message);
    }
    return null;
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[${PROVIDER_NAME}] Fetching: ${tmdbId} S${season} E${episode}`);
      const mapping = yield getMalId(tmdbId, mediaType, season, episode);
      if (!mapping || !mapping.malId && !mapping.aniId) {
        console.log(`[${PROVIDER_NAME}] Exhausted all mapping bridges. Could not resolve ID.`);
        return [];
      }
      const isMal = !!mapping.malId;
      const targetId = isMal ? mapping.malId : mapping.aniId;
      const idType = isMal ? "mal" : "ani";
      const epNum = mediaType === "movie" ? 1 : mapping.absEp || episode;
      console.log(`[${PROVIDER_NAME}] Mapped to ${idType.toUpperCase()} ID: ${targetId} | Ep: ${epNum}`);
      const streams = [];
      const sStr = String(season).padStart(2, "0");
      const eStr = String(episode).padStart(2, "0");
      const epFormat = mediaType === "movie" ? "" : ` S${sStr}E${eStr}`;
      const domains = [
        { id: "Vidstream", domain: "megaplay.buzz" }
      ];
      for (const srv of domains) {
        const subUrl = `https://${srv.domain}/stream/${idType}/${targetId}/${epNum}/sub`;
        const subData = yield extractHLS(subUrl, srv.domain);
        if (subData) {
          streams.push({
            name: `${PROVIDER_NAME}`,
            quality: "1080p",
            title: `${srv.id}${epFormat} (SUB)`,
            url: subData.url,
            subtitles: subData.subtitles,
            headers: subData.headers
          });
        }
        const dubUrl = `https://${srv.domain}/stream/${idType}/${targetId}/${epNum}/dub`;
        const dubData = yield extractHLS(dubUrl, srv.domain);
        if (dubData) {
          streams.push({
            name: `${PROVIDER_NAME}`,
            quality: "1080p",
            title: `${srv.id}${epFormat} (DUB)`,
            url: dubData.url,
            subtitles: dubData.subtitles,
            headers: dubData.headers
          });
        }
      }
      console.log(`[${PROVIDER_NAME}] Returning ${streams.length} direct stream URLs.`);
      return streams;
    } catch (e) {
      console.error(`[${PROVIDER_NAME}] Fatal Error:`, e);
      return [];
    }
  });
}
function search(args) {
  return __async(this, null, function* () {
    return [];
  });
}
function getCatalog(args) {
  return __async(this, null, function* () {
    return [];
  });
}
function getItemDetails(args) {
  return __async(this, null, function* () {
    return [];
  });
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams, search, getCatalog, getItemDetails };
} else {
  global.getStreams = getStreams;
}
