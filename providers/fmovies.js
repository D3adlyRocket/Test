function getJson(url, options) {
  return fetch(url, options || {}).then(function (response) {
    if (!response || !response.ok) {
      throw new Error('Request failed: ' + url);
    }
    return response.json();
  });
}

function getText(url, options) {
  return fetch(url, options || {}).then(function (response) {
    if (!response || !response.ok) {
      throw new Error('Request failed: ' + url);
    }
    return response.text();
  });
}

function normalizeQuality(label) {
  var text = (label || '').toString();
  var match = text.match(/(2160p|1440p|1080p|720p|480p|360p|4K)/i);
  return match ? match[1].toUpperCase() : 'Auto';
}

function streamObject(provider, title, url, quality, headers) {
  if (!url || typeof url !== 'string') {
    return null;
  }
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
    if (!stream || !stream.url) return false;
    if (seen[stream.url]) return false;
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
  
  return getJson(apiUrl, {
    headers: { "User-Agent": "Mozilla/5.0", "Referer": baseUrl + "/" }
  }).then(function (payload) {
    var embedUrl = payload && payload.src;
    if (!embedUrl) return [];

    return getText(embedUrl, {
      headers: { "User-Agent": "Mozilla/5.0", "Referer": baseUrl + "/" }
    }).then(function (html) {
      var tokenMatch = html.match(/['"]token['"]\s*:\s*['"]([^'"]+)['"]/i);
      var expiresMatch = html.match(/['"]expires['"]\s*:\s*['"]([^'"]+)['"]/i);
      var urlMatch = html.match(/url\s*:\s*['"]([^'"]+)['"]/i);

      if (!tokenMatch || !expiresMatch || !urlMatch) return [];

      var finalUrl = urlMatch[1] + "?token=" + tokenMatch[1] + "&expires=" + expiresMatch[1] + "&h=1";
      
      return [streamObject(
        'VixSrc',
        'VixSrc Player',
        finalUrl,
        '1080P',
        { "Referer": embedUrl, "Origin": baseUrl }
      )];
    });
  }).catch(function () { return []; });
}

// --- ORIGINAL RESOLVERS ---

function resolveVidEasy(tmdbId, mediaType, season, episode) {
  var typePath = mediaType === 'tv' ? 'tv' : 'movie';
  var dbUrl = 'https://db.videasy.net/3/' + typePath + '/' + tmdbId + '?append_to_response=external_ids&language=en&api_key=ad301b7cc82ffe19273e55e4d4206885';

  return getJson(dbUrl)
    .then(function (meta) {
      var isTv = mediaType === 'tv';
      var title = encodeURIComponent((isTv ? meta.name : meta.title) || '');
      var dateText = isTv ? meta.first_air_date : meta.release_date;
      var year = dateText ? new Date(dateText).getFullYear() : '';
      var imdbId = (meta.external_ids && meta.external_ids.imdb_id) || '';
      var fullUrl = 'https://api.videasy.net/cdn/sources-with-title?title=' + title + '&mediaType=' + (isTv ? 'tv' : 'movie') + '&year=' + year + '&episodeId=' + (isTv ? (episode || 1) : 1) + '&seasonId=' + (isTv ? (season || 1) : 1) + '&tmdbId=' + meta.id + '&imdbId=' + imdbId;
      return getText(fullUrl).then(function (encryptedText) {
        var body = JSON.stringify({ text: encryptedText, id: String(tmdbId) });
        return getJson('https://enc-dec.app/api/dec-videasy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: body
        });
      });
    })
    .then(function (decryptedData) {
      var result = (decryptedData && decryptedData.result) || {};
      var sources = Array.isArray(result.sources) ? result.sources : [];
      return sources
        .filter(function (source) {
          return source && source.url && !(source.quality || '').toUpperCase().includes('HDR');
        })
        .map(function (source) {
          return streamObject(
            'VidEasy',
            'VidEasy ' + (source.quality || 'Auto'),
            source.url,
            normalizeQuality(source.quality),
            { Origin: 'https://player.videasy.net', Referer: 'https://player.videasy.net/' }
          );
        })
        .filter(Boolean);
    })
    .catch(function () { return []; });
}

function resolveVidLink(tmdbId, mediaType, season, episode) {
  return getJson('https://enc-dec.app/api/enc-vidlink?text=' + encodeURIComponent(String(tmdbId)))
    .then(function (encrypted) {
      var encodedTmdb = encrypted && encrypted.result;
      if (!encodedTmdb) return [];
      var url = mediaType === 'tv'
        ? 'https://vidlink.pro/api/b/tv/' + encodedTmdb + '/' + (season || 1) + '/' + (episode || 1) + '?multiLang=0'
        : 'https://vidlink.pro/api/b/movie/' + encodedTmdb + '?multiLang=0';
      return getJson(url).then(function (payload) {
        var playlist = payload && payload.stream && payload.stream.playlist;
        var stream = streamObject('VidLink', 'VidLink Primary', playlist, 'Auto', { Referer: 'https://vidlink.pro' });
        return stream ? [stream] : [];
      });
    })
    .catch(function () { return []; });
}

function resolveVidmody(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType)
    .then(function (meta) {
      var imdbId = (mediaType === 'tv' ? (meta.external_ids && meta.external_ids.imdb_id) : meta.imdb_id);
      if (!imdbId) return [];

      var targetUrl = "";
      if (mediaType === "movie") {
        targetUrl = "https://vidmody.com/vs/" + imdbId + "#.m3u8";
      } else {
        var sStr = "s" + (season || 1);
        var eNum = episode || 1;
        var eStr = "e" + (eNum < 10 ? "0" + eNum : eNum);
        targetUrl = "https://vidmody.com/vs/" + imdbId + "/" + sStr + "/" + eStr + "#.m3u8";
      }

      return fetch(targetUrl.replace("#.m3u8", ""), { method: "HEAD" })
        .then(function (res) {
          if (res.status === 200) {
            return [streamObject(
              "Vidmody",
              "Vidmody Player",
              targetUrl,
              "Auto",
              { "Referer": "https://vidmody.com/" }
            )];
          }
          return [];
        });
    })
    .catch(function () { return []; });
