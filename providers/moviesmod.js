// --- UTILITY FUNCTIONS ---

function getJson(url, options) {
  return fetch(url, options || {}).then(response => {
    if (!response || !response.ok) throw new Error('Request failed: ' + url);
    return response.json();
  });
}

function getTmdbMeta(tmdbId, mediaType) {
  const typePath = mediaType === 'tv' ? 'tv' : 'movie';
  const url = `https://api.themoviedb.org/3/${typePath}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`;
  return getJson(url);
}

function streamObject(provider, title, url, quality, headers) {
  return {
    name: provider,
    title: title || provider,
    url: url,
    quality: quality || 'Auto',
    headers: headers || undefined
  };
}

// --- RESOLVERS ---

function resolveVidLink(tmdbId, mediaType, season, episode) {
  return getJson('https://enc-dec.app/api/enc-vidlink?text=' + encodeURIComponent(String(tmdbId)))
    .then(encrypted => {
      const encodedTmdb = encrypted?.result;
      if (!encodedTmdb) return [];
      
      const url = mediaType === 'tv'
        ? `https://vidlink.pro/api/b/tv/${encodedTmdb}/${season || 1}/${episode || 1}?multiLang=0`
        : `https://vidlink.pro/api/b/movie/${encodedTmdb}?multiLang=0`;

      return getJson(url).then(payload => {
        const playlist = payload?.stream?.playlist;
        // Adding a log to inspect VidLink playlist format
        console.log("[VidLink Test] Playlist URL:", playlist);
        
        const stream = streamObject('VidLink', 'VidLink Primary', playlist, 'Auto', { Referer: 'https://vidlink.pro' });
        return stream ? [stream] : [];
      });
    })
    .catch(() => []);
}

function resolveVidMody(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType)
    .then(meta => {
      const imdbId = mediaType === 'tv' ? meta.external_ids?.imdb_id : meta.imdb_id;
      if (!imdbId) return [];

      const sStr = "s" + (season || 1);
      const eNum = episode || 1;
      const eStr = "e" + (eNum < 10 ? "0" + eNum : eNum);
      
      const targetUrl = mediaType === "movie"
        ? `https://vidmody.com/vs/${imdbId}#.m3u8`
        : `https://vidmody.com/vs/${imdbId}/${sStr}/${eStr}#.m3u8`;

      // GET request to inspect the manifest for quality tags
      return fetch(targetUrl.replace("#.m3u8", ""), { method: "GET" })
        .then(res => {
          if (res.status === 200) {
            return res.text().then(content => {
              console.log("[VidMody Test] Manifest Content:", content.substring(0, 300));
              
              return [streamObject(
                "VidMody", 
                `${meta.title || meta.name} (VidMody)`, 
                targetUrl, 
                "Auto", 
                { "Referer": "https://vidmody.com/", "User-Agent": "Mozilla/5.0" }
              )];
            });
          }
          return [];
        });
    })
    .catch(() => []);
}

// --- MAIN CONTROLLER ---

function getStreams(tmdbId, mediaType, season, episode) {
  const resolvers = [
    resolveVidLink,
    resolveVidMody
  ];

  return Promise.all(
    resolvers.map(resolver => resolver(tmdbId, mediaType, season, episode).catch(() => []))
  )
  .then(results => {
    return results.flat().slice(0, 50);
  });
}

module.exports = { getStreams };
