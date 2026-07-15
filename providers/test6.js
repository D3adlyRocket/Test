// =============================================================
// Provider Nuvio : Cinepulse.mx (VF/VOSTFR/MULTI)
// Version : 1.1.0 — Native Settings & Metadata Integration
// =============================================================

var https = require('https');
var zlib = require('zlib');

const TMDB_API_KEY = '6e6ab700b6477171ee6c23d504b1e9cb';
const TMDB_BASE = 'https://api.themoviedb.org/3';

var CP_API_HOST = 'apiapi.cinepulse.mx'; 
var CP_REFERER = 'https://cinepulse.mx/';
var CP_ORIGIN = 'https://cinepulse.mx';
var CP_VERSION = '3.5.2';

var CP_SCREEN = 'MzYweDgwNA=='; 
var CP_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36';

// Global defaults (replaces manual hardcoding)
var DEFAULTS = {
  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjYzdhZDZhMS05MGFjLTRmZGEtOTJlNS05Y2JjYjY0YzYzNTkiLCBzZXNzaW9uSWQiOiIxN2VjMzk4OC1mYzQxLTRlMzctOGE1My03Y2E3OTM2NmZiOGYiLCJpYXQiOjE3ODQwNzYyNDksImV4cCI6MTc4NjY2ODI0OSwiYXVkIjoiY2luZXB1bHNlLWZyb250ZW5kIiwiaXNzIjoiY2luZXB1bHNlLWJhY2tlbmQtYXBpIn0.sG-Vd5im67FBS45D6HQxYgjh9is55RHGtyatHhb9g6E',
  profileId: '8b592a92-7f73-43d4-9ef3-44aec27b9246'
};

var _accessToken = null;
var _tokenExpiry = 0;

// ── Dynamically Retrieve Settings ──────────────────────────────────────────
function getSettings() {
  const s =
    (typeof globalThis !== 'undefined' && globalThis.SCRAPER_SETTINGS) ||
    (typeof global !== 'undefined' && global.SCRAPER_SETTINGS) ||
    (typeof window !== 'undefined' && window.SCRAPER_SETTINGS) ||
    {};
  return {
    refreshToken: String(s.refreshToken || DEFAULTS.refreshToken || '').trim(),
    profileId: String(s.profileId || DEFAULTS.profileId || '').trim()
  };
}

// ── Obfuscation Engine ──────────────────────────────────────────────────────
function generateRandomKey(len) {
  len = len || 8;
  var chars = 'abceghjklmnopqrtuvwxyzABCEGHIJKLMNOPQRTUVWXYZ0123456789';
  var s = '';
  for (var r = 0; r < len; r++) s += chars.charAt(Math.floor(55 * Math.random()));
  return s;
}

function encodeValue(val, type) {
  var s = String(val);
  if (type === 'id') {
    var e = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      e += /\d/.test(c) ? ((parseInt(c, 10) + 7) % 10).toString() : c;
    }
    return 'c' + Buffer.from(e).toString('base64');
  }
  if (type === 'type') {
    var e = '';
    for (var r = 0; r < s.length; r++) e += String.fromCharCode(s.charCodeAt(r) ^ 107);
    return 't' + Buffer.from(e).toString('base64');
  }
  if (type === 'season') {
    var n = parseInt(s, 10);
    var t2 = String(n + 5);
    var r2 = '';
    for (var i = 0; i < t2.length; i++) r2 += ((parseInt(t2.charAt(i), 10) + 3) % 10).toString();
    return 's' + r2;
  }
  if (type === 'episode') {
    var n = parseInt(s, 10);
    var t2 = String(n + 9);
    var r2 = '';
    for (var i = 0; i < t2.length; i++) r2 += ((parseInt(t2.charAt(i), 10) + 4) % 10).toString();
    return 'e' + r2;
  }
  if (type === 'exp') {
    var hex = s.split('').map(function(c) { return c.charCodeAt(0).toString(16); }).join('');
    return 'x' + Buffer.from(hex).toString('base64');
  }
  return 'd' + Buffer.from(s).toString('base64');
}

function obfuscateParams(params) {
  var t = {};
  t[generateRandomKey()] = encodeValue(Date.now() + 120000, 'exp');
  var km = { tmdbId: 'id', type: 'type', season: 'season', episode: 'episode', sessionId: 'sid' };
  var keys = Object.keys(params);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (params[key] == null) continue;
    t[generateRandomKey()] = encodeValue(params[key], km[key] || key.substring(0, 2));
  }
  var nc = ['q', 'w', 'p', 'z', 'h', 'j'];
  var n = 10 + Math.floor(10 * Math.random());
  for (var a = 0; a < n; a++) {
    t[generateRandomKey()] = nc[Math.floor(Math.random() * nc.length)] +
      Buffer.from(generateRandomKey(8 + Math.floor(8 * Math.random()))).toString('base64');
  }
  return t;
}

// ── Native HTTPS Request ──────────────────────────────────────────────────────
function httpsRequest(method, path, extraHeaders, body) {
  return new Promise(function(resolve, reject) {
    var bodyStr = body ? JSON.stringify(body) : null;
    var options = {
      hostname: CP_API_HOST,
      path: path,
      method: method,
      headers: Object.assign({
        'User-Agent': CP_UA,
        'Referer': CP_REFERER,
        'Origin': CP_ORIGIN,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      }, extraHeaders || {}, bodyStr ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      } : {})
    };
    var req = https.request(options, function(res) {
      var chunks = [];
      var enc = res.headers['content-encoding'] || '';
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        var buf = Buffer.concat(chunks);
        function parse(b) {
          try { resolve(JSON.parse(b.toString('utf8'))); }
          catch(e) { reject(new Error('bad JSON: ' + b.toString('utf8').slice(0, 100))); }
        }
        if (enc === 'gzip') zlib.gunzip(buf, function(e, d) { e ? reject(e) : parse(d); });
        else if (enc === 'br') zlib.brotliDecompress(buf, function(e, d) { e ? reject(e) : parse(d); });
        else if (enc === 'deflate') zlib.inflate(buf, function(e, d) { e ? reject(e) : parse(d); });
        else parse(buf);
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, function() { req.destroy(new Error('timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Auth Token Auto-Refresh ───────────────────────────────────────────────────
function getAccessToken() {
  var settings = getSettings();
  var now = Date.now();
  if (_accessToken && now < _tokenExpiry - 30000) return Promise.resolve(_accessToken);
  return httpsRequest('POST', '/api/v2/auth/refresh-auth-token', {}, { refreshToken: settings.refreshToken })
    .then(function(data) {
      if (data.type !== 'success' || !data.data) {
        throw new Error('Token refresh failed: ' + JSON.stringify(data).slice(0, 150));
      }
      _accessToken = data.data.items.accessToken;
      _tokenExpiry = Date.now() + 870000;
      return _accessToken;
    });
}

// ── Metadata Lookup ───────────────────────────────────────────────────────────
function getTMDBDetails(tmdbId, mediaType) {
  const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
  const url = TMDB_BASE + '/' + endpoint + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

  return new Promise(function(resolve, reject) {
    https.get(url, { headers: { Accept: 'application/json' } }, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        try {
          var data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          resolve(data);
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ── Stream Fetcher Execution ──────────────────────────────────────────────────
function getStreams(tmdbId, mediaType, season, episode) {
  mediaType = mediaType || 'movie';
  var settings = getSettings();

  return getTMDBDetails(tmdbId, mediaType)
    .then(function(metadata) {
      if (!metadata) throw new Error('Metadata query failed');

      return getAccessToken().then(function(token) {
        var params = { tmdbId: Number(tmdbId), type: mediaType === 'tv' ? 'tv' : 'movie' };
        if (mediaType === 'tv' && season != null) params.season = Number(season);
        if (mediaType === 'tv' && episode != null) params.episode = Number(episode);

        var obf = obfuscateParams(params);
        var qs = Object.keys(obf).map(function(k) {
          return encodeURIComponent(k) + '=' + encodeURIComponent(obf[k]);
        }).join('&');

        return httpsRequest('GET', '/watch/sources?' + qs, {
          'Authorization': 'Bearer ' + token,
          'X-Profile-Id': settings.profileId,
          'X-Client-Version': CP_VERSION,
          'X-Screen-Size': CP_SCREEN,
          'X-Request-Time': String(Date.now()),
          'X-Requested-With': 'cinepulse.frontend'
        });
      });
    })
    .then(function(data) {
      if (data.type !== 'success' || !data.data || !Array.isArray(data.data.items)) {
        console.warn("No streams found or unexpected payload:", JSON.stringify(data).slice(0, 200));
        return [];
      }
      var results = [];
      var items = data.data.items;
      for (var i = 0; i < items.length; i++) {
        var s = items[i];
        if (!s.url) continue;
        var lang = (s.language || '').toUpperCase();
        var quality = s.quality || 'HD';
        var langIcon = lang === 'VF' ? '🇫🇷' : lang === 'VOSTFR' ? '🔡' : lang === 'MULTI' ? '🌐' : '🎬';
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

// ── Setting Configurations UI Layout ──────────────────────────────────────────
function onSettings() {
  return Promise.resolve([
    { type: 'header', label: 'Cinepulse Session Credentials' },
    {
      type: 'info',
      label: 'To update your session, copy the parameters from your browser DevTools Local Storage.'
    },
    {
      type: 'text',
      isPassword: true,
      key: 'refreshToken',
      label: 'Refresh Token',
      placeholder: 'Paste the 30-day refreshToken JWT...',
      description: 'Used to automatically refresh the short-term API Bearer Token.'
    },
    {
      type: 'text',
      key: 'profileId',
      label: 'Profile ID',
      placeholder: '8b592a92-7f73-43d4-9ef3-44aec27b9246',
      description: 'Your specific profile ID string (must align with your User session).'
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
