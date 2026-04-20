// ... (keep all your existing utility functions: getJson, getText, etc.)

/**
 * NEW: VidFast Resolver
 */
function resolveVidFast(tmdbId, mediaType, season, episode) {
  // 1. Get the encrypted string needed for VidFast
  return getJson('https://enc-dec.app/api/enc-vidfast?text=' + encodeURIComponent(String(tmdbId)))
    .then(function (encrypted) {
      var encodedTmdb = encrypted && encrypted.result;
      if (!encodedTmdb) return [];

      // 2. Construct the API URL
      var url = mediaType === 'tv'
        ? 'https://vidfast.pro/api/b/tv/' + encodedTmdb + '/' + (season || 1) + '/' + (episode || 1)
        : 'https://vidfast.pro/api/b/movie/' + encodedTmdb;

      return getJson(url);
    })
    .then(function (payload) {
      // 3. Extract the stream information
      var playlist = payload && payload.stream && payload.stream.playlist;
      if (!playlist) return [];

      var stream = streamObject(
        'VidFast', 
        'VidFast Primary', 
        playlist, 
        'Auto', 
        { Referer: 'https://vidfast.pro' }
      );
      
      return stream ? [stream] : [];
    })
    .catch(function () {
      return [];
    });
}

// ... (keep your other resolvers: resolveVidEasy, resolveVidLink, etc.)

function getStreams(tmdbId, mediaType, season, episode) {
  // ADDED resolveVidFast to the list below
  var resolvers = [
    resolveVidEasy,
    resolveVidLink,
    resolveVidFast, // Added here
    resolveHexa,
    resolveSmashyStream,
    resolveVidSrc
  ];

  return Promise.all(
    resolvers.map(function (resolver) {
      return resolver(tmdbId, mediaType, season, episode).catch(function () {
        return [];
      });
    })
  )
    .then(function (results) {
      var merged = [];
      results.forEach(function (group) {
        if (Array.isArray(group)) {
          merged = merged.concat(group);
        }
      });
      return dedupeStreams(merged).slice(0, 50);
    })
    .catch(function () {
      return [];
    });
}

module.exports = { getStreams: getStreams };
