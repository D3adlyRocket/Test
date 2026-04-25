// --- UTILITY (Keep your existing ones) ---
function getJson(url, options) {
  return fetch(url, options || {}).then(function (response) {
    if (!response || !response.ok) throw new Error('Request failed: ' + url);
    return response.json();
  });
}

function getText(url, options) {
  return fetch(url, options || {}).then(function (response) {
    if (!response || !response.ok) throw new Error('Request failed: ' + url);
    return response.text();
  });
}

function normalizeQuality(label) {
  var text = (label || '').toString();
  var match = text.match(/(2160p|1440p|1080p|720p|480p|360p|4K)/i);
  return match ? match[1].toUpperCase() : 'Auto';
}

function streamObject(provider, title, url, quality, headers) {
  if (!url || typeof url !== 'string') return null;
  return {
    name: provider,
    title: title || provider,
    url: url,
    quality: quality || 'Auto',
    headers: headers || undefined
  };
}

function dedupeStreams(streams) {
  var seen = {};
  return (streams || []).filter(function (stream) {
    if (!stream || !stream.url || seen[stream.url]) return false;
    seen[stream.url] = true;
    return true;
  });
}

function getTmdbMeta(tmdbId, mediaType) {
  var typePath = mediaType === 'tv' ? 'tv' : 'movie';
  var url = 'https://api.themoviedb.org/3/' + typePath + '/' + tmdbId + '?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885';
  return getJson(url);
}

// --- NEW VIXSRC RESOLVER ---

function resolveVixSrc(tmdbId, mediaType, season, episode) {
  var baseUrl = "https://vixsrc.to";
  var typePath = mediaType === 'tv' ? 'tv' : 'movie';
  var apiUrl = baseUrl + '/api/' + typePath + '/' + tmdbId + (mediaType === 'tv' ? '/' + (season || 1) + '/' + (episode || 1) : '');
  
  var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": baseUrl + "/"
  };

  return getJson(apiUrl, { headers: headers })
    .then(function (payload) {
      var embedUrl = payload && payload.src;
      if (!embedUrl) return [];

      return getText(embedUrl, { headers: headers }).then(function (html) {
        // Extracting tokens and playlist info from the script tags in HTML
        var tokenMatch = html.match(/'token'\s*:\s*'([^']+)'/i);
        var expiresMatch = html.match(/'expires'\s*:\s*'([^']+)'/i);
        var urlMatch = html.match(/url\s*:\s*'([^']+\/playlist\/\d+[^']*)'/i);

        if (!tokenMatch || !expiresMatch || !urlMatch) return [];

        var finalStreamUrl = urlMatch[1] + "?token=" + encodeURIComponent(tokenMatch[1]) + "&expires=" + encodeURIComponent(expiresMatch[1]) + "&h=1";
        
        return [streamObject(
          'VixSrc',
          'VixSrc Multi-Res',
          finalStreamUrl,
          '1080P',
          { 
            "Referer": embedUrl,
            "Origin": baseUrl,
            "User-Agent": headers["User-Agent"]
          }
        )];
      });
    })
    .catch(function () { return []; });
}

// --- EXISTING RESOLVERS (Condensed for brevity) ---

function resolveVidEasy(tmdbId, mediaType, season, episode) { /* ... existing logic ... */ }
function resolveVidLink(tmdbId, mediaType, season, episode) { /* ... existing logic ... */ }
function resolveVidmody(tmdbId, mediaType, season, episode) { /* ... existing logic ... */ }
function resolveVidSrc(tmdbId, mediaType, season, episode) { /* ... existing logic ... */ }

// --- MAIN FUNCTION ---

function getStreams(tmdbId, mediaType, season, episode) {
  var resolvers = [
    resolveVixSrc, // Added VixSrc here
    resolveVidEasy,
    resolveVidLink,
    resolveVidmody,
    resolveVidSrc
  ];

  return Promise.all(
    resolvers.map(function (resolver) {
      return resolver(tmdbId, mediaType, season, episode).catch(function () { return []; });
    })
  )
    .then(function (results) {
      var merged = [];
      results.forEach(function (group) {
        if (Array.isArray(group)) merged = merged.concat(group);
      });
      return dedupeStreams(merged).slice(0, 50);
    })
    .catch(function () { return []; });
}

module.exports = { getStreams: getStreams };
