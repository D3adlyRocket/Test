// =============================================================
// Provider Nuvio : Cinepulse.mx (VF/VOSTFR/MULTI)
// Version : 1.2.5 — Native Settings Credentials Authentication
// =============================================================

const TMDB_API_KEY = '6e6ab700b6477171ee6c23d504b1e9cb';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const CP_API_BASE = 'https://apiapi.cinepulse.mx'; 
const CP_REFERER = 'https://cinepulse.mx/';
const CP_ORIGIN = 'https://cinepulse.mx';
const CP_VERSION = '3.5.2';

const CP_SCREEN = 'MzYweDgwNA=='; 
const CP_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36';

// Built-in emergency fallbacks if settings fields are completely blank
const DEFAULTS = {
  email: '',
  password: '',
  profileId: '8b592a92-7f73-43d4-9ef3-44aec27b9246',
  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjYzdhZDZhMS05MGFjLTRmZGEtOTJlNS05Y2JjYjY0YzYzNTkiLCBzZXNzaW9uSWQiOiIxN2VjMzk4OC1mYzQxLTRlMzctOGE1My03Y2E3OTM2NmZiOGYiLCJpYXQiOjE3ODQwNzYyNDksImV4cCI6MTc4NjY2ODI0OSwiYXVkIjoiY2luZXB1bHNlLWZyb250ZW5kIiwiaXNzIjoiY2luZXB1bHNlLWJhY2tlbmQtYXBpIn0.sG-Vd5im67FBS45D6HQxYgjh9is55RHGtyatHhb9g6E'
};

let _accessToken = null;
let _refreshToken = null;
let _profileId = null;
let _tokenExpiry = 0;

// ── Settings Extraction Engine ──────────────────────────────────────────────
function getSettings() {
  const s =
    (typeof globalThis !== 'undefined' && globalThis.SCRAPER_SETTINGS) ||
    (typeof global !== 'undefined' && global.SCRAPER_SETTINGS) ||
    (typeof window !== 'undefined' && window.SCRAPER_SETTINGS) ||
    (typeof globalThis !== 'undefined' && globalThis.SETTINGS) ||
    (typeof global !== 'undefined' && global.SETTINGS) ||
    {};
    
  return {
    email: String(s.email || DEFAULTS.email || '').trim(),
    password: String(s.password || DEFAULTS.password || '').trim(),
    profileId: String(s.profileId || DEFAULTS.profileId || '').trim(),
    refreshToken: String(s.refreshToken || s.token || DEFAULTS.refreshToken || '').trim()
  };
}

// ── Signature Obfuscation ───────────────────────────────────────────────────
function generateRandomKey(len) {
  len = len || 8;
  const chars = 'abceghjklmnopqrtuvwxyzABCEGHIJKLMNOPQRTUVWXYZ0123456789';
  let s = '';
  for (let r = 0; r < len; r++) s += chars.charAt(Math.floor(55 * Math.random()));
  return s;
}

function encodeValue(val, type) {
  const s = String(val);
  if (type === 'id') {
    let e = '';
    for (let i = 0; i < s.length; i++) {
      const c = s.charAt(i);
      e += /\d/.test(c) ? ((parseInt(c, 10) + 7) % 10).toString() : c;
    }
    return 'c' + Buffer.from(e).toString('base64');
  }
  if (type === 'type') {
    let e = '';
    for (let r = 0; r < s.length; r++) e += String.fromCharCode(s.charCodeAt(r) ^ 107);
    return 't' + Buffer.from(e).toString('base64');
  }
  if (type === 'season') {
    const n = parseInt(s, 10);
    const t2 = String(n + 5);
    let r2 = '';
    for (let i = 0; i < t2.length; i++) r2 += ((parseInt(t2.charAt(i), 10) + 3) % 10).toString();
    return 's' + r2;
  }
  if (type === 'episode') {
    const n = parseInt(s, 10);
    const t2 = String(n + 9);
    let r2 = '';
    for (let i = 0; i < t2.length; i++) r2 += ((parseInt(t2.charAt(i), 10) + 4) % 10).toString();
    return 'e' + r2;
  }
  if (type === 'exp') {
    const hex = s.split('').map(function(c) { return c.charCodeAt(0).toString(16); }).join('');
    return 'x' + Buffer.from(hex).toString('base64');
  }
  return 'd' + Buffer.from(s).toString('base64');
}

function obfuscateParams(params) {
  const t = {};
  t[generateRandomKey()] = encodeValue(Date.now() + 120000, 'exp');
  const km = { tmdbId: 'id', type: 'type', season: 'season', episode: 'episode', sessionId: 'sid' };
  const keys = Object.keys(params);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (params[key] == null) continue;
    t[generateRandomKey()] = encodeValue(params[key], km[key] || key.substring(0, 2));
  }
  const nc = ['q', 'w', 'p', 'z', 'h', 'j'];
  const n = 10 + Math.floor(10 * Math.random());
  for (let a = 0; a < n; a++) {
    t[generateRandomKey()] = nc[Math.floor(Math.random() * nc.length)] +
      Buffer.from(generateRandomKey(8 + Math.floor(8 * Math.random()))).toString('base64');
  }
  return t;
}

// ── Native Fetch Request Helper ─────────────────────────────────────────────
function fetchRequest(method, path, extraHeaders, body) {
  const url = CP_API_BASE + path;
  const headers = Object.assign({
    'User-Agent': CP_UA,
    'Referer': CP_REFERER,
    'Origin': CP_ORIGIN,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'Connection': 'keep-alive'
  }, extraHeaders || {});

  const config = {
    method: method,
    headers: headers
  };

  if (body) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  }

  return fetch(url, config).then(function(res) {
    if (!res.ok) throw new Error('Cinepulse gateway returned HTTP status: ' + res.status);
    return res.json();
  });
}

// ── Account Direct Authentication Logic ─────────────────────────────────────
function performEmailLogin(settings) {
  console.log("Cinepulse: Authing via Settings Email/Password credentials...");
  return fetchRequest('POST', '/api/v2/auth/login', {}, {
    email: settings.email,
    password: settings.password
  })
  .then(function(data) {
    if (data.type !== 'success' || !data.data || !data.data.items) {
      throw new Error('Authentication failed. Verify email and password are correct.');
    }
    
    _accessToken = data.data.items.accessToken;
    _refreshToken = data.data.items.refreshToken;
    _tokenExpiry = Date.now() + 870000; // 14.5 mins

    // Determine the user's correct profile ID automatically
    if (settings.profileId) {
      _profileId = settings.profileId;
    } else if (data.data.items.profiles && data.data.items.profiles.length > 0) {
      _profileId = data.data.items.profiles[0].id;
    } else {
      _profileId = DEFAULTS.profileId;
    }

    console.log("Cinepulse: Authentication active. Active profile: " + _profileId);
    return { accessToken: _accessToken, profileId: _profileId };
  });
}

// ── Token Refresh Flow ──────────────────────────────────────────────────────
function performTokenRefresh(rToken, settings) {
  return fetchRequest('POST', '/api/v2/auth/refresh-auth-token', {}, { refreshToken: rToken })
    .then(function(data) {
      if (data.type === 'success' && data.data && data.data.items) {
        _accessToken = data.data.items.accessToken;
        _tokenExpiry = Date.now() + 870000;
        _profileId = settings.profileId || _profileId || DEFAULTS.profileId;
        return { accessToken: _accessToken, profileId: _profileId };
      }
      throw new Error('Fallback to full authentication sequence.');
    });
}

// ── Safe Unified Session Controller ─────────────────────────────────────────
function getSession() {
  const settings = getSettings();
  const now = Date.now();

  // 1. Current token is active and unexpired
  if (_accessToken && _profileId && now < _tokenExpiry - 30000) {
    return Promise.resolve({ accessToken: _accessToken, profileId: _profileId });
  }

  // 2. We have configured email and password credentials (highly preferred!)
  if (settings.email && settings.password) {
    // If we already had a running refresh token, try to refresh first to save resources
    const activeRefresh = _refreshToken || settings.refreshToken;
    if (activeRefresh) {
      return performTokenRefresh(activeRefresh, settings).catch(function() {
        return performEmailLogin(settings);
      });
    }
    return performEmailLogin(settings);
  }

  // 3. fallback to manual Token inputs only
  if (settings.refreshToken) {
    return performTokenRefresh(settings.refreshToken, settings);
  }

  return Promise.reject(new Error("No account credentials or session tokens available in Settings."));
}

// ── TMDB Details Extraction ──────────────────────────────────────────────────
function getTMDBDetails(tmdbId, mediaType) {
  const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
  const url = TMDB_BASE + '/' + endpoint + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

  return fetch(url, { headers: { Accept: 'application/json' } })
    .then(function(res) {
      if (!res.ok) throw new Error('TMDB API request failed with status: ' + res.status);
      return res.json();
    });
}

// ── Core Scraper Integration ────────────────────────────────────────────────
function getStreams(tmdbId, mediaType, season, episode) {
  mediaType = mediaType || 'movie';

  return getTMDBDetails(tmdbId, mediaType)
    .then(function(metadata) {
      if (!metadata) throw new Error('Could not pull metadata.');

      return getSession().then(function(session) {
        const params = { tmdbId: Number(tmdbId), type: mediaType === 'tv' ? 'tv' : 'movie' };
        if (mediaType === 'tv' && season != null) params.season = Number(season);
        if (mediaType === 'tv' && episode != null) params.episode = Number(episode);

        const obf = obfuscateParams(params);
        const qs = Object.keys(obf).map(function(k) {
          return encodeURIComponent(k) + '=' + encodeURIComponent(obf[k]);
        }).join('&');

        return fetchRequest('GET', '/watch/sources?' + qs, {
          'Authorization': 'Bearer ' + session.accessToken,
          'X-Profile-Id': session.profileId,
          'X-Client-Version': CP_VERSION,
          'X-Screen-Size': CP_SCREEN,
          'X-Request-Time': String(Date.now()),
          'X-Requested-With': 'cinepulse.frontend'
        });
      });
    })
    .then(function(data) {
      if (data.type !== 'success' || !data.data || !Array.isArray(data.data.items)) {
        console.warn("No streams found or unexpected payload format:", JSON.stringify(data).slice(0, 200));
        return [];
      }
      const results = [];
      const items = data.data.items;
      for (let i = 0; i < items.length; i++) {
        const s = items[i];
        if (!s.url) continue;
        const lang = (s.language || '').toUpperCase();
        const quality = s.quality || 'HD';
        const langIcon = lang === 'VF' ? '🇫🇷' : lang === 'VOSTFR' ? '🔡' : lang === 'MULTI' ? '🌐' : '🎬';
        results.push({
          name: 'Cinepulse \u2022 ' + quality,
          title: langIcon + ' ' + lang + ' | \uD83D\uDCFA ' + quality + ' | ' + (s.type || 'hls').toUpperCase(),
          url: s.url
        });
      }
      return results;
    })
    .catch(function(err) { 
      console.error("Cinepulse Fetch Failure:", err.message || err);
      return []; 
    });
}

// ── Native Nuvio Settings Layout ─────────────────────────────────────────────
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
  module.exports = {
    getStreams: getStreams,
    onSettings: onSettings
  };
} else if (typeof global !== 'undefined') {
  global.getStreams = getStreams;
  global.onSettings = onSettings;
}
