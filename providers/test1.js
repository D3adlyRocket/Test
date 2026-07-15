// ============================================================= //
// Provider Nuvio : Movix (VF/VOSTFR français)                  //
// Version : 4.6.1                                              //
// - Header: Movix | Quality | Language (No Emojis)             //
// - Line 1: 🎬 Movie Name - Year (or S/E info)                  //
// - Line 2: ⚡ Quality | 💬 LangType | 🎵 Flags                 //
// - Line 3: 💿 Format • Codec | 🎧 AAC | Duration              //
// ============================================================= //

var TMDB_KEY = 'f3d757824f08ea2cff45eb8f47ca3a1e';
var DOMAINS_URL = 'https://raw.githubusercontent.com/wooodyhood/nuvio-repo/main/domains.json';
var MOVIX_FALLBACK = 'cash';
var _cachedEndpoint = null;

// ─── TMDB Helpers (Updated for Year & Duration) ──────────────

function getTmdbMetadata(tmdbId, type) {
  var url = 'https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=en-US';
  
  return fetch(url)
    .then(function(res) {
      return res.json();
    })
    .then(function(data) {
      var date = data.release_date || data.first_air_date || "";
      return {
        name: data.title || data.name || "Movix",
        year: date ? date.split('-')[0] : "",
        duration: (type === 'movie' && data.runtime) ? data.runtime + ' min' : (type === 'tv' && data.episode_run_time && data.episode_run_time.length > 0 ? data.episode_run_time[0] + ' min' : "")
      };
    })
    .catch(function() {
      return {
        name: "Movix",
        year: "",
        duration: ""
      };
    });
}

function getEpisodeInfo(tmdbId, season, episode) {
  if (!tmdbId || !season || !episode) {
    return Promise.resolve(null);
  }
  
  var url = 'https://api.themoviedb.org/3/tv/' + tmdbId + '/season/' + season + '/episode/' + episode + '?api_key=' + TMDB_KEY + '&language=en-US';
  
  return fetch(url)
    .then(function(res) {
      return res.json();
    })
    .then(function(data) {
      return {
        name: data.name || null,
        duration: data.runtime ? data.runtime + ' min' : null
      };
    })
    .catch(function() {
      return null;
    });
}

// ─── UI / Formatting (Updated for Movix Custom Emoji Profile) ─────────────

function buildTitle(meta, res, lang, format, size, extra, season, episode, epInfo) {
  var cleanRes = res.toLowerCase().replace(/p/g, "") + "p";
  var qIcon = '⚡'; // Movix custom speed/quality icon
  
  var displayLang = 'VF';
  var flags = '🇫🇷';
  var searchPool = (String(lang) + " " + String(res) + " " + String(extra)).toUpperCase();
  
  if (searchPool.indexOf('MULTI') !== -1 || searchPool.indexOf('DUAL') !== -1) {
    displayLang = 'Dual-Audio';
    flags = '🇺🇸 • 🇫🇷';
  } else if (searchPool.indexOf('VOST') !== -1) {
    displayLang = 'VOSTFR';
    flags = '🇺🇸 • 🇫🇷';
  }
  
  // Line 1: Identity (Untouched)
  var line1 = '🎬 ';
  if (season && episode) {
    line1 += 'S' + season + ' E' + episode + (epInfo && epInfo.name ? ' - ' + epInfo.name : '') + ' | ' + meta.name;
  } else {
    line1 += meta.name + (meta.year ? ' - ' + meta.year : '');
  }
  
  // Line 2: ⚡ Quality | 💬 LangType | 🎵 Flags
  var line2 = qIcon + ' ' + cleanRes + ' | 💬 ' + displayLang + ' | 🎵 ' + flags;
  
  // Line 3: 💿 Format • Codec | 🎧 AAC | Duration
  var formatUpper = (format || 'M3U8').toUpperCase();
  var codecVal = 'H.264';
  if (searchPool.indexOf("HEVC") !== -1 || searchPool.indexOf("X265") !== -1 || searchPool.indexOf("H265") !== -1) {
    codecVal = 'H.265';
  }
  
  var finalDur = (epInfo && epInfo.duration) ? epInfo.duration : meta.duration;
  var durationStr = finalDur ? ' | ' + finalDur : '';
  
  var line3 = '💿 ' + formatUpper + ' • ' + codecVal + ' | 🎧 AAC' + durationStr;
  
  return line1 + '\n' + line2 + '\n' + line3;
}

// ─── Network Logic (Untouched) ───────────────────────────────

function detectApi() {
  if (_cachedEndpoint) {
    return Promise.resolve(_cachedEndpoint);
  }
  
  return fetch(DOMAINS_URL)
    .then(function(res) {
      return res.ok ? res.json() : Promise.reject();
    })
    .then(function(data) {
      var tld = data.movix || MOVIX_FALLBACK;
      _cachedEndpoint = {
        api: 'https://api.movix.' + tld,
        referer: 'https://movix.' + tld + '/'
      };
      return _cachedEndpoint;
    })
    .catch(function() {
      _cachedEndpoint = {
        api: 'https://api.movix.' + MOVIX_FALLBACK,
        referer: 'https://movix.' + MOVIX_FALLBACK + '/'
      };
      return _cachedEndpoint;
    });
}

function resolveRedirect(url, referer) {
  return fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': referer
    }
  })
  .then(function(res) {
    return res.url || url;
  })
  .catch(function() {
    return url;
  });
}

function resolveEmbed(embedUrl, referer) {
  return fetch(embedUrl, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': referer
    }
  })
  .then(function(res) {
    return res.text();
  })
  .then(function(html) {
    var patterns = [
      /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
      /source\s+src=["']([^"']+\.m3u8[^"']*)["']/i,
      /["']([^"']*\.m3u8(?:\?[^"']*)?)["']/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var match = html.match(patterns[i]);
      if (match) return match[1].startsWith('//') ? 'https:' + match[1] : match[1];
    }
    return null;
  })
  .catch(function() {
    return null;
  });
}

// ─── API Fetches ─────────────────────────────────────────────

function fetchPurstream(apiBase, referer, tmdbId, mediaType, season, episode) {
  var url = mediaType === 'tv' 
    ? apiBase + '/api/purstream/tv/' + tmdbId + '/stream?season=' + (season || 1) + '&episode=' + (episode || 1) 
    : apiBase + '/api/purstream/movie/' + tmdbId + '/stream';
    
  return fetch(url, {
    headers: { 'Referer': referer }
  })
  .then(function(res) {
    return res.json();
  })
  .then(function(data) {
    return data.sources || [];
  });
}

function fetchCpasmal(apiBase, referer, tmdbId, mediaType, season, episode) {
  var url = mediaType === 'tv' 
    ? apiBase + '/api/cpasmal/tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1) 
    : apiBase + '/api/cpasmal/movie/' + tmdbId;
    
  return fetch(url, {
    headers: { 'Referer': referer }
  })
  .then(function(res) {
    return res.json();
  })
  .then(function(data) {
    var sources = [];
    ['vf', 'vostfr'].forEach(function(l) {
      if (data.links && data.links[l]) {
        data.links[l].forEach(function(link) {
          sources.push({ url: link.url, name: 'Movix', player: link.server, lang: l });
        });
      }
    });
    return sources;
  });
}

// ─── Processing ──────────────────────────────────────────────

function tryFetchAll(apiBase, referer, tmdbId, mediaType, season, episode, meta, epInfo) {
  return fetchPurstream(apiBase, referer, tmdbId, mediaType, season, episode)
    .then(function(sources) {
      return Promise.all(sources.map(function(source) {
        return resolveRedirect(source.url, referer).then(function(resolvedUrl) {
          var qual = (source.name || "").indexOf('1080') !== -1 ? '1080p' : '720p';
          var displayLang = (source.name || "").indexOf('VOST') !== -1 ? 'VOSTFR' : ((source.name || "").indexOf('VF') !== -1 ? 'VF' : 'Dual-Audio');
          var details = buildTitle(meta, qual, displayLang, source.format || 'm3u8', null, null, season, episode, epInfo);
          
          return {
            name: 'Movix | ' + qual.toLowerCase() + ' | ' + displayLang,
            title: details,
            size: details,
            description: details,
            url: resolvedUrl,
            quality: "",
            language: "",
            format: source.format || 'm3u8',
            headers: { 'User-Agent': 'Mozilla/5.0' }
          };
        });
      }));
    })
    .catch(function() {
      return fetchCpasmal(apiBase, referer, tmdbId, mediaType, season, episode).then(function(sources) {
        return Promise.all(sources.slice(0, 5).map(function(s) {
          return resolveEmbed(s.url, referer).then(function(directUrl) {
            if (!directUrl) return null;
            var displayLang = s.lang && s.lang.toUpperCase() === 'VOSTFR' ? 'VOSTFR' : 'VF';
            var details = buildTitle(meta, 'HD', displayLang, 'm3u8', '', s.player, season, episode, epInfo);
            
            return {
              name: 'Movix | hd | ' + displayLang,
              title: details,
              size: details,
              description: details,
              url: directUrl,
              quality: "",
              language: "",
              format: 'm3u8',
              headers: { 'Referer': referer }
            };
          });
        }))
        .then(function(res) {
          return res.filter(function(r) { return r !== null; });
        });
      });
    });
}

// ─── Entry Point ─────────────────────────────────────────────

function getStreams(tmdbId, mediaType, season, episode) {
  return Promise.all([
    getTmdbMetadata(tmdbId, mediaType),
    mediaType === 'tv' ? getEpisodeInfo(tmdbId, season, episode) : Promise.resolve(null),
    detectApi()
  ])
  .then(function(results) {
    var meta = results[0];
    var epInfo = results[1];
    var endpoint = results[2];
    
    return tryFetchAll(endpoint.api, endpoint.referer, tmdbId, mediaType, season, episode, meta, epInfo);
  })
  .catch(function() {
    return [];
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
