// --- VIXSRC RESOLVER (Refined for vixsrc.to) ---
function resolveVixSrc(tmdbId, mediaType, season, episode) {
  var baseUrl = "https://vixsrc.to";
  var type = (mediaType === 'tv' || mediaType === 'series') ? 'tv' : 'movie';
  
  // Construct the API URL based on your provided logic
  var apiUrl = baseUrl + '/api/' + type + '/' + tmdbId;
  if (type === 'tv') {
    apiUrl += '/' + (season || 1) + '/' + (episode || 1);
  }
  
  var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": baseUrl + "/",
    "Accept": "application/json"
  };

  return getJson(apiUrl, { headers: headers })
    .then(function (payload) {
      // payload.src is the embed player URL (e.g., vixsrc.to/embed/...)
      var embedUrl = payload && payload.src;
      if (!embedUrl) return [];

      return getText(embedUrl, { headers: headers }).then(function (html) {
        // These regex look for 'token', 'expires', and the 'url' inside the player script
        var tokenMatch = html.match(/['"]token['"]\s*:\s*['"]([^'"]+)['"]/i);
        var expiresMatch = html.match(/['"]expires['"]\s*:\s*['"]([^'"]+)['"]/i);
        var urlMatch = html.match(/url\s*:\s*['"]([^'"]+)['"]/i);

        if (!tokenMatch || !expiresMatch || !urlMatch) return [];

        // Build the final link. Often requires ?lang=it or ?h=1
        var finalUrl = urlMatch[1] + "?token=" + tokenMatch[1] + "&expires=" + expiresMatch[1] + "&h=1";
        
        return [streamObject(
          'VixSrc',
          'VixSrc Player',
          finalUrl,
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

// --- UPDATED MAIN FUNCTION ---
function getStreams(tmdbId, mediaType, season, episode) {
  var resolvers = [
    resolveVidEasy,
    resolveVidLink,
    resolveVidmody,
    resolveVidSrc,
    resolveVixSrc // Moved to end so it doesn't delay others
  ];

  return Promise.all(
    resolvers.map(function (resolver) {
      // Each resolver is wrapped to prevent one failure from killing the list
      return resolver(tmdbId, mediaType, season, episode).catch(function () { return []; });
    })
  ).then(function (results) {
    var merged = [];
    results.forEach(function (group) { 
      if (Array.isArray(group)) merged = merged.concat(group); 
    });
    return dedupeStreams(merged).slice(0, 50);
  }).catch(function () { return []; });
}
