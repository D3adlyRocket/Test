// --- UTILITIES ---
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

// --- VIXSRC RESOLVER (Refined) ---
function resolveVixSrc(tmdbId, mediaType, season, episode) {
  var baseUrl = "https://vixsrc.to";
  // Handle both 'tv' and 'series' strings
  var typePath = (mediaType === 'tv' || mediaType === 'series') ? 'tv' : 'movie';
  var apiUrl = baseUrl + '/api/' + typePath + '/' + tmdbId + (typePath === 'tv' ? '/' + (season || 1) + '/' + (episode || 1) : '');
  
  var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": baseUrl + "/"
  };

  return getJson(apiUrl, { headers: headers })
    .then(function (payload) {
      // The API returns the embed player URL in the 'src' field
      var embedUrl = payload && payload.src;
      if (!embedUrl) return [];

      return getText(embedUrl, { headers: headers }).then(function (html) {
        // More robust regex to find the streaming parameters
        var token = (html.match(/["']?token["']?\s*:\s*["']([^"']+)["']/i) || [])[1];
        var expires = (html.match(/["']?expires["']?\s*:\s*["']([^"']+)["']/i) || [])[1];
        var playlistUrl = (html.match(/url\s*:\s*["']([^"']+\/playlist\/[^"']+)["']/i) || [])[1];

        if (!token || !expires || !playlistUrl) return [];

        // Build the final authenticated .m3u8 link
        var finalStreamUrl = playlistUrl + "?token=" + encodeURIComponent(token) + "&expires=" + encodeURIComponent(expires) + "&h=1";
        
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

// --- OTHER RESOLVERS ---
function resolveVidEasy(tmdbId, mediaType, season, episode) {
  var typePath = mediaType === 'tv' ? 'tv' : 'movie';
  var dbUrl = '
