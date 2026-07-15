// ============================================================= //
// Provider Nuvio : Cinepulse.mx (VF/VOSTFR/MULTI)               //
// Version : 1.3.0 — Purstream-Engine Hybrid (No Auth Required)  //
// ============================================================= //

var CP_API_BASE = 'https://apiapi.cinepulse.mx/api/v1';
var CP_REFERER = 'https://cinepulse.mx/';
var CP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var TMDB_KEY = 'f3d757824f08ea2cff45eb8f47ca3a1e';

// ─── TMDB Helpers (French-focused for matching Cinepulse database) ───

function getTmdbDetails(tmdbId, type) {
  var url = 'https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=fr-FR';
  
  return fetch(url)
    .then(function(res) {
      return res.json();
    })
    .then(function(data) {
      var date = data.release_date || data.first_air_date || "";
      return {
        frName: data.title || data.name || "",
        origName: data.original_title || data.original_name || "",
        year: date ? parseInt(date.split('-')[0], 10) : null,
        duration: (type === 'movie' && data.runtime) ? data.runtime + ' min' : ""
      };
    })
    .catch(function() {
      return { frName: "", origName: "", year: null, duration: "" };
    });
}

function getEpisodeInfo(tmdbId, season, episode) {
  if (!tmdbId || !season || !episode) {
    return Promise.resolve(null);
  }
  var url = 'https://api.themoviedb.org/3/tv/' + tmdbId + '/season/' + season + '/episode/' + episode + '?api_key=' + TMDB_KEY + '&language=fr-FR';
  
  return fetch(url)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      return {
        name: data.name || null,
        duration: data.runtime ? data.runtime + ' min' : null
      };
    })
    .catch(function() { return null; });
}

// ─── UI Helper: Two-Line Title Builder ───────────────────────

function buildTitle(meta, res, lang, format, season, episode, epInfo, rawText) {
  var cleanRes = res.toLowerCase().replace(/p/g, "") + "p";
  var qIcon = '🔥'; 
  
  var displayLang = 'VF';
  var flags = '🇫🇷';
  var searchPool = (String(rawText) + " " + String(lang)).toUpperCase();
  
  if (searchPool.indexOf('MULTI') !== -1 || searchPool.indexOf('DUAL') !== -1) {
    displayLang = 'Dual-Audio';
    flags = '🇺🇸 • 🇫🇷';
  } else if (searchPool.indexOf('VOST') !== -1) {
    displayLang = 'VOSTFR';
    flags = '🇺🇸 • 🇫🇷';
  }
  
  var line1 = '🎬 ';
  if (season && episode) {
    line1 += 'S' + season + ' E' + episode + (epInfo && epInfo.name ? ' - ' + epInfo.name : '') + ' | ' + meta.frName;
  } else {
    line1 += meta.frName + (meta.year ? ' - ' + meta.year : '');
  }
  
  var line2 = qIcon + ' ' + cleanRes + ' | 🌐 ' + displayLang + ' | 🔊 ' + flags;
  
  var formatUpper = (format || 'M3U8').toUpperCase();
  var codecVal = 'H.264';
  if (searchPool.indexOf("HEVC") !== -1 || searchPool.indexOf("X265") !== -1 || searchPool.indexOf("H265") !== -1) {
    codecVal = 'H.265';
  }
  
  var finalDur = (epInfo && epInfo.duration) ? epInfo.duration : meta.duration;
  var durationStr = finalDur ? ' | ' + finalDur : '';
  
  var line3 = '🎯 ' + formatUpper + ' • ' + codecVal + ' | 🎧 AAC' + durationStr;
  
  return line1 + '\n' + line2 + '\n' + line3;
}

// ─── Search & Matching Logic ──────────────────────────────────

function cleanTitle(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findCinepulseId(title, tmdbYear) {
  if (!title) return Promise.reject(new Error("Empty search query"));
  var encoded = encodeURIComponent(title);
  
  return fetch(CP_API_BASE + '/search-bar/search/' + encoded, {
    headers: {
      'User-Agent': CP_UA,
      'Referer': CP_REFERER
    }
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    var items = data.data && data.data.items && data.data.items.movies && data.data.items.movies.items 
      ? data.data.items.movies.items 
      : [];
      
    if (items.length === 0) throw new Error("No Cinepulse matches found");
    
    var cleanTarget = cleanTitle(title);
    var match = items.find(function(item) {
      var releaseYear = item.release_date ? parseInt(item.release_date.split('-')[0], 10) : null;
      return cleanTitle(item.title) === cleanTarget && (Math.abs(tmdbYear - releaseYear) <= 1 || !tmdbYear);
    }) || items[0];
    
    return match.id;
  });
}

function fetchMovieSources(cpId) {
  return fetch(CP_API_BASE + '/media/' + cpId + '/sheet', {
    headers: {
      'User-Agent': CP_UA,
      'Referer': CP_REFERER
    }
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    return data.data && data.data.items && data.data.items.urls ? data.data.items.urls : [];
  });
}

function fetchEpisodeSources(cpId, season, episode) {
  return fetch(CP_API_BASE + '/stream/' + cpId + '/episode?season=' + (season || 1) + '&episode=' + (episode || 1), {
    headers: {
      'User-Agent': CP_UA,
      'Referer': CP_REFERER
    }
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    return data.data && data.data.items && data.data.items.sources ? data.data.items.sources : [];
  });
}

// ─── Stream Format Normalization ──────────────────────────────

function parseLang(name) {
  var n = (name || '').toUpperCase();
  if (n.indexOf('VOSTFR') !== -1) return 'VOSTFR';
  if (n.indexOf('VF') !== -1) return 'VF';
  return 'Dual-Audio';
}

function parseQuality(name) {
  var n = (name || '').toUpperCase();
  if (n.indexOf('4K') !== -1) return '4K';
  if (n.indexOf('1080') !== -1) return '1080p';
  if (n.indexOf('720') !== -1) return '720p';
  return 'HD';
}

function normalizeMovieSources(urls, meta) {
  return urls.filter(function(item) {
    return item.url && (item.url.match(/\.m3u8/i) || item.url.match(/\.mp4/i));
  })
  .map(function(item) {
    var q = parseQuality(item.name);
    var format = item.url.match(/\.mp4/i) ? 'mp4' : 'm3u8';
    var displayLang = parseLang(item.name);
    var details = buildTitle(meta, q, displayLang, format, null, null, null, item.name);
    
    return {
      name: 'Cinepulse \u2022 ' + q,
      title: details,
      url: item.url,
      headers: {
        'User-Agent': CP_UA,
        'Referer': CP_REFERER
      }
    };
  });
}

function normalizeEpisodeSources(sources, meta, season, episode, epInfo) {
  return sources.map(function(item) {
    var q = parseQuality(item.source_name);
    var format = item.format || 'm3u8';
    var displayLang = parseLang(item.source_name);
    var details = buildTitle(meta, q, displayLang, format, season, episode, epInfo, item.source_name);
    
    return {
      name: 'Cinepulse \u2022 ' + q,
      title: details,
      url: item.stream_url,
      headers: {
        'User-Agent': CP_UA,
        'Referer': CP_REFERER
      }
    };
  });
}

// ─── Core Execution Handler ───────────────────────────────────

function getStreams(tmdbId, mediaType, season, episode) {
  return Promise.all([
    getTmdbDetails(tmdbId, mediaType),
    mediaType === 'tv' ? getEpisodeInfo(tmdbId, season, episode) : Promise.resolve(null)
  ])
  .then(function(results) {
    var meta = results[0];     // frName, origName, year, duration
    var epInfo = results[1];   // episode name, duration
    
    // Attempt search using French title first, fallback to original title
    return findCinepulseId(meta.frName, meta.year)
      .catch(function() {
        return findCinepulseId(meta.origName, meta.year);
      })
      .then(function(cpId) {
        if (mediaType === 'tv') {
          return fetchEpisodeSources(cpId, season, episode)
            .then(function(sources) {
              return normalizeEpisodeSources(sources, meta, season, episode, epInfo);
            });
        } else {
          return fetchMovieSources(cpId)
            .then(function(urls) {
              return normalizeMovieSources(urls, meta);
            });
        }
      });
  })
  .catch(function(err) {
    console.error("Cinepulse Engine Error: ", err);
    return [];
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
