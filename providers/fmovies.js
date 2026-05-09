// =============================================================
// Provider Nuvio : Nakios (VF / VOSTFR / MULTI)
// Version : 4.1.0
// - Header: Nakios - Quality
// - Line 1: Movie Name - Year (or S1 E1 - Ep Name)
// - Line 2: Tech Specs (Res, Lang, Size, Format, Duration)
// =============================================================

var TMDB_KEY = 'f3d757824f08ea2cff45eb8f47ca3a1e';
var NAKIOS_UA       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var DOMAINS_URL     = 'https://raw.githubusercontent.com/wooodyhood/nuvio-repo/main/domains.json';
var NAKIOS_FALLBACK = 'fit';

var _cachedEndpoint = null;

// ─── TMDB Helpers ───────────────────────────────────────────

function getTmdbDetails(tmdbId, type) {
  var url = 'https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=en-US';
  return fetch(url)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var name = data.title || data.name || "Nakios";
      var date = data.release_date || data.first_air_date || "";
      var year = date ? date.split('-')[0] : "";
      return { name: name, year: year };
    })
    .catch(function() { return { name: "Nakios", year: "" }; });
}

function getEpisodeName(tmdbId, season, episode) {
  if (!tmdbId || !season || !episode) return Promise.resolve(null);
  var url = 'https://api.themoviedb.org/3/tv/' + tmdbId + '/season/' + season + '/episode/' + episode + '?api_key=' + TMDB_KEY + '&language=en-US';
  return fetch(url).then(function(res) { return res.json(); }).then(function(data) { return data.name || null; }).catch(function() { return null; });
}

// ─── Construction de l'endpoint ──────────────────────────────

function detectEndpoint() {
  if (_cachedEndpoint) return Promise.resolve(_cachedEndpoint);
  return fetch(DOMAINS_URL)
    .then(function(res) { return res.ok ? res.json() : Promise.reject(); })
    .then(function(data) {
      var tld = data.nakios || NAKIOS_FALLBACK;
      var baseDomain = tld.includes('nakios') ? tld : 'nakios.' + tld;
      _cachedEndpoint = { base: 'https://' + baseDomain, api: 'https://api.' + baseDomain + '/api', referer: 'https://' + baseDomain + '/' };
      return _cachedEndpoint;
    })
    .catch(function() {
      var baseDomain = 'nakios.' + NAKIOS_FALLBACK;
      _cachedEndpoint = { base: 'https://' + baseDomain, api: 'https://api.' + baseDomain + '/api', referer: 'https://' + baseDomain + '/' };
      return _cachedEndpoint;
    });
}

// ─── UI / Formatting ─────────────────────────────────────────

function normalizeSources(sources, endpoint, meta, season, episode, epName) {
  var results = [];
  for (var i = 0; i < sources.length; i++) {
    var s = sources[i];
    if (s.isEmbed) continue;

    var rawUrl = s.url || '';
    var format = (s.isM3U8 || rawUrl.indexOf('.m3u8') !== -1) ? 'M3U8' : 'MP4';
    var quality = s.quality || 'HD';
    
    // Language Logic
    var rawLang = (s.lang || 'MULTI').toUpperCase();
    var lIcon = '🇫🇷', lLab = 'VF';
    if (rawLang.indexOf('MULTI') !== -1 || (s.name && s.name.toUpperCase().indexOf('MULTI') !== -1)) {
        lIcon = '🌍'; lLab = 'MULTI';
    } else if (rawLang.indexOf('VOST') !== -1) {
        lIcon = '🔡'; lLab = 'VOSTFR';
    }

    // --- Line 1: Identity ---
    var line1 = '🎬 ';
    if (season && episode) {
        line1 += 'S' + season + ' E' + episode + (epName ? ' - ' + epName : '') + ' | ' + meta.name;
    } else {
        line1 += meta.name + (meta.year ? ' - ' + meta.year : '');
    }

    // --- Line 2: Technical Specs ---
    var specs = [
        '📺 ' + quality,
        lIcon + ' ' + lLab,
        '🎞️ ' + format
    ];
    if (s.size) specs.push('💾 ' + s.size);
    if (s.duration) specs.push('⏱️ ' + s.duration); // Added duration support

    results.push({
      name: 'Nakios - ' + quality, 
      title: line1 + '\n' + specs.join(' | '), // \n creates the second line
      url: rawUrl,
      quality: quality,
      format: format.toLowerCase(),
      headers: {
        'User-Agent': NAKIOS_UA,
        'Referer': endpoint.referer,
        'Origin': endpoint.base
      }
    });
  }
  return results;
}

// ─── Entry Point ─────────────────────────────────────────────

function getStreams(tmdbId, mediaType, season, episode) {
  return Promise.all([
    getTmdbDetails(tmdbId, mediaType),
    mediaType === 'tv' ? getEpisodeName(tmdbId, season, episode) : Promise.resolve(null),
    detectEndpoint()
  ]).then(function(results) {
    var meta = results[0];
    var epName = results[1];
    var endpoint = results[2];

    var url = mediaType === 'tv'
      ? endpoint.api + '/sources/tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1)
      : endpoint.api + '/sources/movie/' + tmdbId;

    return fetch(url, { headers: { 'User-Agent': NAKIOS_UA, 'Referer': endpoint.referer } })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data.success || !data.sources) return [];
        return normalizeSources(data.sources, endpoint, meta, season, episode, epName);
      });
  }).catch(function() { return []; });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
