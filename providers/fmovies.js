// =============================================================
// Provider Nuvio : Nakios (VF / VOSTFR / MULTI)
// Version : 4.6.0
// - STABLE: Reverted to original network logic to fix playback
// - Layout: Header (Quality) | Line 1 (Name + Year) | Line 2 (Specs)
// - Added: ⏱️ Duration & Episode Name support
// =============================================================

var TMDB_KEY = 'f3d757824f08ea2cff45eb8f47ca3a1e';
var NAKIOS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var DOMAINS_URL = 'https://raw.githubusercontent.com/wooodyhood/nuvio-repo/main/domains.json';
var NAKIOS_FALLBACK = 'fit';

var _cachedEndpoint = null;

// ─── 1. Metadata Helper (Only for Display) ──────────────────

function getMetadata(tmdbId, type, season, episode) {
  var url = 'https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=en-US';
  
  return fetch(url).then(function(res) { return res.json(); }).then(function(data) {
    var meta = {
      name: data.title || data.name || "Nakios",
      year: (data.release_date || data.first_air_date || "").split('-')[0],
      duration: type === 'movie' ? (data.runtime ? data.runtime + ' min' : '') : (data.episode_run_time && data.episode_run_time[0] ? data.episode_run_time[0] + ' min' : ''),
      epName: null
    };

    if (type === 'tv' && season && episode) {
      var epUrl = 'https://api.themoviedb.org/3/tv/' + tmdbId + '/season/' + season + '/episode/' + episode + '?api_key=' + TMDB_KEY + '&language=en-US';
      return fetch(epUrl).then(function(r) { return r.json(); }).then(function(epData) {
        meta.epName = epData.name || null;
        return meta;
      }).catch(function() { return meta; });
    }
    return meta;
  }).catch(function() { return { name: "Nakios", year: "", duration: "", epName: null }; });
}

// ─── 2. Formatting (Your Requested Two-Line Layout) ──────────

function formatNakiosTitle(s, meta, season, episode) {
    var quality = s.quality || 'HD';
    var rawLang = (s.lang || 'MULTI').toUpperCase();
    var lIcon = '🇫🇷', lLab = 'VF';
    if (rawLang.indexOf('MULTI') !== -1) { lIcon = '🌍'; lLab = 'MULTI'; }
    else if (rawLang.indexOf('VOST') !== -1) { lIcon = '🔡'; lLab = 'VOSTFR'; }

    // Line 1: Identity
    var line1 = '🎬 ';
    if (season && episode) {
      line1 += 'S' + season + ' E' + episode + (meta.epName ? ' - ' + meta.epName : '') + ' | ' + meta.name;
    } else {
      line1 += meta.name + (meta.year ? ' - ' + meta.year : '');
    }

    // Line 2: Technical Specs
    var specs = [
        '📺 ' + quality,
        lIcon + ' ' + lLab
    ];
    if (s.size) specs.push('💾 ' + s.size);
    specs.push('🎞️ ' + (s.url.indexOf('.m3u8') !== -1 ? 'M3U8' : 'MP4'));
    if (meta.duration) specs.push('⏱️ ' + meta.duration);

    return line1 + '\n' + specs.join(' | ');
}

// ─── 3. Original Network Logic (DO NOT TOUCH) ───────────────

function detectEndpoint() {
  if (_cachedEndpoint) return Promise.resolve(_cachedEndpoint);
  return fetch(DOMAINS_URL)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var tld = data.nakios || NAKIOS_FALLBACK;
      var base = 'https://nakios.' + tld;
      _cachedEndpoint = { base: base, api: base + '/api', referer: base + '/' };
      return _cachedEndpoint;
    }).catch(function() {
      var base = 'https://nakios.' + NAKIOS_FALLBACK;
      return { base: base, api: base + '/api', referer: base + '/' };
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
  // We run detectEndpoint and getMetadata, but keep the fetch structure original
  return detectEndpoint().then(function(endpoint) {
    return getMetadata(tmdbId, mediaType, season, episode).then(function(meta) {
      
      var url = mediaType === 'tv'
        ? endpoint.api + '/sources/tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1)
        : endpoint.api + '/sources/movie/' + tmdbId;

      return fetch(url, { headers: { 'User-Agent': NAKIOS_UA, 'Referer': endpoint.referer } })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (!data || !data.sources) return [];
          
          return data.sources.map(function(s) {
            if (s.isEmbed) return null;
            return {
              name: 'Nakios - ' + (s.quality || 'HD'),
              title: formatNakiosTitle(s, meta, season, episode),
              url: s.url,
              quality: s.quality || 'HD',
              format: s.url.indexOf('.m3u8') !== -1 ? 'm3u8' : 'mp4',
              headers: {
                'User-Agent': NAKIOS_UA,
                'Referer': endpoint.referer,
                'Origin': endpoint.base
              }
            };
          }).filter(function(x) { return x !== null; });
        });
    });
  }).catch(function() { return []; });
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { getStreams: getStreams }; }
else { global.getStreams = getStreams; }
