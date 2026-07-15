// ============================================================= //
// Provider Nuvio : Cinepulse.mx (VF/VOSTFR/MULTI)               //
// Version : 1.4.0 — Authenticated Purstream-Engine Hybrid       //
// ============================================================= //

const CP_API_BASE = 'https://apiapi.cinepulse.mx'; // Base host without trailing slash
const CP_REFERER = 'https://cinepulse.mx/';
const CP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TMDB_KEY = 'f3d757824f08ea2cff45eb8f47ca3a1e';

// Emergency Fallbacks
const DEFAULTS = {
  profileId: '8b592a92-7f73-43d4-9ef3-44aec27b9246',
  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjYzdhZDZhMS05MGFjLTRmZGEtOTJlNS05Y2JjYjY0YzYzNTkiLCBzZXNzaW9uSWQiOiIxN2VjMzk4OC1mYzQxLTRlMzctOGE1My03Y2E3OTM2NmZiOGYiLCJpYXQiOjE3ODQwNzYyNDksImV4cCI6MTc4NjY2ODI0OSwiYXVkIjoiY2luZXB1bHNlLWZyb250ZW5kIiwiaXNzIjoiY2luZXB1bHNlLWJhY2tlbmQtYXBpIn0.sG-Vd5im67FBS45D6HQxYgjh9is55RHGtyatHhb9g6E'
};

let _accessToken = null;
let _refreshToken = null;
let _profileId = null;
let _tokenExpiry = 0;

// ─── Settings Parser ─────────────────────────────────────────

function getSettings() {
  const s =
    (typeof globalThis !== 'undefined' && globalThis.SCRAPER_SETTINGS) ||
    (typeof global !== 'undefined' && global.SCRAPER_SETTINGS) ||
    (typeof window !== 'undefined' && window.SCRAPER_SETTINGS) ||
    (typeof globalThis !== 'undefined' && globalThis.SETTINGS) ||
    (typeof global !== 'undefined' && global.SETTINGS) ||
    {};
    
  return {
    email: String(s.email || '').trim(),
    password: String(s.password || '').trim(),
    profileId: String(s.profileId || DEFAULTS.profileId || '').trim(),
    refreshToken: String(s.refreshToken || s.token || DEFAULTS.refreshToken || '').trim()
  };
}

// ─── Authentication Gateway ──────────────────────────────────

function performEmailLogin(settings) {
  console.log("Cinepulse Auth: Logging in via Email...");
  return fetch(CP_API_BASE + '/api/v2/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': CP_UA,
      'Referer': CP_REFERER
    },
    body: JSON.stringify({
      email: settings.email,
      password: settings.password
    })
  })
  .then(function(res) {
    if (!res.ok) throw new Error("Cinepulse Auth: Invalid login credentials.");
    return res.json();
  })
  .then(function(data) {
    if (data.type !== 'success' || !data.data || !data.data.items) {
      throw new Error("Cinepulse Auth: Unexpected response structure.");
    }
    
    _accessToken = data.data.items.accessToken;
    _refreshToken = data.data.items.refreshToken;
    _tokenExpiry = Date.now() + 870000; // 14.5 minutes

    if (settings.profileId) {
      _profileId = settings.profileId;
    } else if (data.data.items.profiles && data.data.items.profiles.length > 0) {
      _profileId = data.data.items.profiles[0].id;
    } else {
      _profileId = DEFAULTS.profileId;
    }

    console.log("Cinepulse Auth: Session established. Active Profile: " + _profileId);
    return { accessToken: _accessToken, profileId: _profileId };
  });
}

function performTokenRefresh(rToken, settings) {
  console.log("Cinepulse Auth: Refreshing Token...");
  return fetch(CP_API_BASE + '/api/v2/auth/refresh-auth-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': CP_UA,
      'Referer': CP_REFERER
    },
    body: JSON.stringify({ refreshToken: rToken })
  })
  .then(function(res) {
    if (!res.ok) throw new Error("Refresh failed");
    return res.json();
  })
  .then(function(data) {
    if (data.type === 'success' && data.data && data.data.items) {
      _accessToken = data.data.items.accessToken;
      _tokenExpiry = Date.now() + 870000;
      _profileId = settings.profileId || _profileId || DEFAULTS.profileId;
      return { accessToken: _accessToken, profileId: _profileId };
    }
    throw new Error("Invalid token payload");
  });
}

function getSession() {
  const settings = getSettings();
  const now = Date.now();

  // 1. Return current memory cache if valid
  if (_accessToken && _profileId && now < _tokenExpiry - 30000) {
    return Promise.resolve({ accessToken: _accessToken, profileId: _profileId });
  }

  // 2. Try Email & Password Login if specified
  if (settings.email && settings.password) {
    const activeRefresh = _refreshToken || settings.refreshToken;
    if (activeRefresh) {
      return performTokenRefresh(activeRefresh, settings).catch(function() {
        return performEmailLogin(settings);
      });
    }
    return performEmailLogin(settings);
  }

  // 3. Fallback to manual refresh token in Settings
  if (settings.refreshToken) {
    return performTokenRefresh(settings.refreshToken, settings);
  }

  return Promise.reject(new Error("No credentials configured in Nuvio settings. Please set up your Cinepulse account."));
}

// ─── TMDB Helpers ────────────────────────────────────────────

function getTmdbDetails(tmdbId, type) {
  var url = 'https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=fr-FR';
  
  return fetch(url)
    .then(function(res) { return res.json(); })
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
  if (!tmdbId || !season || !episode) return Promise.resolve(null);
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

// ─── Authenticated Search & Scrape ────────────────────────────

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

function findCinepulseId(title, tmdbYear, session) {
  if (!title) return Promise.reject(new Error("Empty search query"));
  var encoded = encodeURIComponent(title);
  
  return fetch(CP_API_BASE + '/api/v1/search-bar/search/' + encoded, {
    headers: {
      'User-Agent': CP_UA,
      'Referer': CP_REFERER,
      'Authorization': 'Bearer ' + session.accessToken,
      'X-Profile-Id': session.profileId
    }
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    var items = data.data && data.data.items && data.data.items.movies && data.data.items.movies.items 
      ? data.data.items.movies.items 
      : [];
      
    if (items.length === 0) throw new Error("No matches found in Cinepulse database");
    
    var cleanTarget = cleanTitle(title);
    var match = items.find(function(item) {
      var releaseYear = item.release_date ? parseInt(item.release_date.split('-')[0], 10) : null;
      return cleanTitle(item.title) === cleanTarget && (Math.abs(tmdbYear - releaseYear) <= 1 || !tmdbYear);
    }) || items[0];
    
    return match.id;
  });
}

function fetchMovieSources(cpId, session) {
  return fetch(CP_API_BASE + '/api/v1/media/' + cpId + '/sheet', {
    headers: {
      'User-Agent': CP_UA,
      'Referer': CP_REFERER,
      'Authorization': 'Bearer ' + session.accessToken,
      'X-Profile-Id': session.profileId
    }
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    return data.data && data.data.items && data.data.items.urls ? data.data.items.urls : [];
  });
}

function fetchEpisodeSources(cpId, season, episode, session) {
  return fetch(CP_API_BASE + '/api/v1/stream/' + cpId + '/episode?season=' + (season || 1) + '&episode=' + (episode || 1), {
    headers: {
      'User-Agent': CP_UA,
      'Referer': CP_REFERER,
      'Authorization': 'Bearer ' + session.accessToken,
      'X-Profile-Id': session.profileId
    }
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    return data.data && data.data.items && data.data.items.sources ? data.data.items.sources : [];
  });
}

// ─── Normalizers ─────────────────────────────────────────────

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

function normalizeMovieSources(urls, meta, session) {
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
        'Referer': CP_REFERER,
        'Authorization': 'Bearer ' + session.accessToken,
        'X-Profile-Id': session.profileId
      }
    };
  });
}

function normalizeEpisodeSources(sources, meta, season, episode, epInfo, session) {
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
        'Referer': CP_REFERER,
        'Authorization': 'Bearer ' + session.accessToken,
        'X-Profile-Id': session.profileId
      }
    };
  });
}

// ─── Main Scraping Loop ───────────────────────────────────────

function getStreams(tmdbId, mediaType, season, episode) {
  return getSession()
    .then(function(session) {
      return Promise.all([
        getTmdbDetails(tmdbId, mediaType),
        mediaType === 'tv' ? getEpisodeInfo(tmdbId, season, episode) : Promise.resolve(null),
        Promise.resolve(session)
      ]);
    })
    .then(function(results) {
      var meta = results[0];     
      var epInfo = results[1];   
      var session = results[2];  
      
      return findCinepulseId(meta.frName, meta.year, session)
        .catch(function() {
          return findCinepulseId(meta.origName, meta.year, session);
        })
        .then(function(cpId) {
          if (mediaType === 'tv') {
            return fetchEpisodeSources(cpId, season, episode, session)
              .then(function(sources) {
                return normalizeEpisodeSources(sources, meta, season, episode, epInfo, session);
              });
          } else {
            return fetchMovieSources(cpId, session)
              .then(function(urls) {
                return normalizeMovieSources(urls, meta, session);
              });
          }
        });
    })
    .catch(function(err) {
      console.error("Cinepulse Engine Error: ", err);
      return [];
    });
}

// ─── UI Setup ────────────────────────────────────────────────

function onSettings() {
  return Promise.resolve([
    { type: 'header', label: 'Cinepulse Login Credentials' },
    {
      type: 'info',
      label: 'Using account credentials guarantees automatic token handling and continuous stream links.'
    },
    {
      type: 'text',
      key: 'email',
      label: 'Account Email',
      placeholder: 'you@example.com',
      description: 'The email address you use to log into cinepulse.mx.'
    },
    {
      type: 'text',
      isPassword: true,
      key: 'password',
      label: 'Account Password',
      placeholder: '••••••••',
      description: 'Your secure Cinepulse account password.'
    },
    { type: 'header', label: 'Profiles & Tuning (Optional)' },
    {
      type: 'text',
      key: 'profileId',
      label: 'Profile ID Bypass',
      placeholder: '8b592a92-7f73-43d4-9ef3-44aec27b9246',
      description: 'Optional. Leave blank to automatically select the primary user profile.'
    },
    {
      type: 'text',
      isPassword: true,
      key: 'refreshToken',
      label: 'Manual Refresh Token (Backup)',
      placeholder: 'eyJhbGciOi...',
      description: 'Optional backup refresh token bypass.'
    }
  ]);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams, onSettings };
} else {
  global.getStreams = getStreams;
  global.onSettings = onSettings;
}
