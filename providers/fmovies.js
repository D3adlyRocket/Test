// =============================================================
// Provider Nuvio : Nakios (VF / VOSTFR / MULTI)
// Version : 3.8.1
// - Robust Domain Recovery (GitHub + Fallback)
// - Improved Error Handling for fetch operations
// =============================================================

var NAKIOS_UA       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var DOMAINS_URL     = 'https://raw.githubusercontent.com/wooodyhood/nuvio-repo/main/domains.json';
var NAKIOS_FALLBACK = 'fit'; // Just the TLD or the full domain fix

var _cachedEndpoint = null;

// ─── Construction de l'endpoint ──────────────────────────────

function buildEndpoint(tld) {
  // Ensure we don't have double dots if fallback is 'nakios.fit'
  var baseDomain = tld.includes('nakios') ? tld : 'nakios.' + tld;
  
  return {
    base:    'https://' + baseDomain,
    api:     'https://api.' + baseDomain + '/api',
    referer: 'https://' + baseDomain + '/'
  };
}

// ─── Récupération du domaine ─────────────────────────────────

function detectEndpoint() {
  if (_cachedEndpoint) return Promise.resolve(_cachedEndpoint);

  return fetch(DOMAINS_URL)
    .then(function(res) {
      if (!res.ok) throw new Error('GitHub unavailable');
      return res.json();
    })
    .then(function(data) {
      var tld = data.nakios;
      if (!tld) throw new Error('Missing key');
      _cachedEndpoint = buildEndpoint(tld);
      return _cachedEndpoint;
    })
    .catch(function(err) {
      console.warn('[Nakios] Fallback activated: ' + NAKIOS_FALLBACK);
      // We use the known working domain from your older script
      _cachedEndpoint = buildEndpoint(NAKIOS_FALLBACK);
      return _cachedEndpoint;
    });
}

// ─── Fetch sources ───────────────────────────────────────────

function fetchSources(endpoint, tmdbId, mediaType, season, episode) {
  var url = mediaType === 'tv'
    ? endpoint.api + '/sources/tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1)
    : endpoint.api + '/sources/movie/' + tmdbId;

  return fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': NAKIOS_UA,
      'Referer':    endpoint.referer,
      'Origin':     endpoint.base
    }
  })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(data) {
      if (!data || !data.success || !data.sources) throw new Error('No sources found');
      return data.sources;
    });
}

// ─── Résolution des URLs ─────────────────────────────────────

function extractOrigin(url) {
  var m = url.match(/^(https?:\/\/[^\/]+)/);
  return m ? m[1] : null;
}

function resolveSource(source, endpoint) {
  var rawUrl = source.url || '';

  if (rawUrl.startsWith('http')) {
    return {
      url:     rawUrl,
      format:  (source.isM3U8 || rawUrl.indexOf('.m3u8') !== -1) ? 'm3u8' : 'mp4',
      referer: endpoint.referer,
      origin:  endpoint.base
    };
  }

  if (rawUrl.charAt(0) === '/') {
    var urlMatch = rawUrl.match(/[?&]url=([^&]+)/);
    if (!urlMatch) return null;

    var decoded;
    try { decoded = decodeURIComponent(urlMatch[1]); }
    catch (e) { return null; }

    if (!decoded || !decoded.startsWith('http')) return null;

    var origin = extractOrigin(decoded);
    return {
      url:     decoded,
      format:  'm3u8',
      referer: origin ? origin + '/' : endpoint.referer,
      origin:  origin || endpoint.base
    };
  }
  return null;
}

// ─── Normalisation ───────────────────────────────────────────

function normalizeSources(sources, endpoint) {
  var results = [];
  for (var i = 0; i < sources.length; i++) {
    var source = sources[i];
    if (source.isEmbed) continue;

    var resolved = resolveSource(source, endpoint);
    if (!resolved) continue;

    results.push({
      name:    'Nakios',
      title:   (source.name || 'Nakios') + ' - ' + (source.lang || 'MULTI').toUpperCase() + ' ' + (source.quality || 'HD'),
      url:     resolved.url,
      quality: source.quality || 'HD',
      format:  resolved.format,
      headers: {
        'User-Agent': NAKIOS_UA,
        'Referer':    resolved.referer,
        'Origin':     resolved.origin
      }
    });
  }
  return results;
}

// ─── Point d'entrée ──────────────────────────────────────────

function getStreams(tmdbId, mediaType, season, episode) {
  return detectEndpoint()
    .then(function(endpoint) {
      return fetchSources(endpoint, tmdbId, mediaType, season, episode)
        .then(function(sources) {
          return normalizeSources(sources, endpoint);
        });
    })
    .catch(function(err) {
      console.error('[Nakios] Fatal Error: ' + err.message);
      return [];
    });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
