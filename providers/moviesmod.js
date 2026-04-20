/**
 * CORRECTED: VidFast Resolver
 * Note: VidFast often uses a direct 'enc-vidfast' path or requires 
 * the ID to be sent as a plain string if the encryption API is down.
 */
function resolveVidFast(tmdbId, mediaType, season, episode) {
  // We use the specific VidFast encoding endpoint
  return getJson('https://enc-dec.app/api/enc-vidfast?text=' + encodeURIComponent(String(tmdbId)))
    .then(function (encrypted) {
      var encodedTmdb = encrypted && encrypted.result;
      
      // Fallback: If encryption fails, some versions of the API accept the raw ID
      var idToUse = encodedTmdb || tmdbId;

      var url = mediaType === 'tv'
        ? 'https://vidfast.pro/api/b/tv/' + idToUse + '/' + (season || 1) + '/' + (episode || 1)
        : 'https://vidfast.pro/api/b/movie/' + idToUse;

      return getJson(url);
    })
    .then(function (payload) {
      // VidFast sometimes wraps the stream in a 'data' or 'stream' object
      var streamData = payload && (payload.stream || payload.data);
      var playlist = streamData && streamData.playlist;
      
      if (!playlist) return [];

      var stream = streamObject(
        'VidFast', 
        'VidFast Primary', 
        playlist, 
        'Auto', 
        { 
          'Referer': 'https://vidfast.pro/',
          'Origin': 'https://vidfast.pro' 
        }
      );
      
      return stream ? [stream] : [];
    })
    .catch(function (err) {
      console.error("VidFast Error:", err.message);
      return [];
    });
}

/**
 * Updated getStreams to handle the new resolver
 */
function getStreams(tmdbId, mediaType, season, episode) {
  var resolvers = [
    resolveVidEasy,
    resolveVidLink,
    resolveVidFast, // Added correctly here
    resolveHexa,
    resolveSmashyStream,
    resolveVidSrc
  ];

  return Promise.all(
    resolvers.map(function (resolver) {
      // Ensure every resolver is wrapped in a catch so one crash doesn't stop all
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
