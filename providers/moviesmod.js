// --- UTILS ---

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

// --- RESOLVERS ---

function resolveVidFast(tmdbId, mediaType, season, episode) {
  var VIDFAST_BASE = 'https://vidfast.pro';
  var ALLOWED_SERVERS = ['Alpha', 'Cobra', 'Kirito', 'Max', 'Meliodas', 'Oscar', 'vEdge', 'vFast', 'vRapid', 'Bollywood'];

  var pageUrl = mediaType === 'tv' 
    ? VIDFAST_BASE + '/tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1)
    : VIDFAST_BASE + '/movie/' + tmdbId;

  var headers = {
    'Referer': pageUrl,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'X-Requested-With': 'XMLHttpRequest'
  };

  return getText(pageUrl, { headers: headers })
    .then(function(pageText) {
      var rawData = null;
      
      // 1. Try to find inside __NEXT_DATA__ JSON block first
      var nextMatch = pageText.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextMatch) {
          try {
              var jsonData = JSON.parse(nextMatch[1]);
              // Look deep into props for the "en" key
              var strData = JSON.stringify(jsonData);
              var enMatch = strData.match(/"en":"([^"]+)"/);
              if (enMatch) rawData = enMatch[1];
          } catch(e) {}
      }

      // 2. Fallback to broad regex patterns if script parsing fails
      if (!rawData) {
        var patterns = [
            /"en":"([^"]+)"/, 
            /'en':'([^']+)'/, 
            /\\"en\\":\\"([^"]+)\\"/,
            /data\s*=\s*"([^"]+)"/
        ];
        for (var i = 0; i < patterns.length; i++) {
          var match = pageText.match(patterns[i]);
          if (match) { rawData = match[1]; break; }
        }
      }
      
      if (!rawData) throw new Error('VidFast source data not found');

      return getJson('https://enc-dec.app/api/enc-vidfast?text=' + encodeURIComponent(rawData) + '&version=1');
    })
    .then(function(apiData) {
      if (!apiData.result) return [];
      var apiServers = apiData.result.servers;
      var streamBase = apiData.result.stream;
      if (apiData.result.token) headers['X-CSRF-Token'] = apiData.result.token;

      return getText(apiServers, { method: 'POST', headers: headers })
        .then(function(encServers) {
          return getJson('https://enc-dec.app/api/dec-vidfast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: encServers, version: '1' })
          });
        })
        .then(function(decServers) {
          var serverList = decServers.result || [];
          var filtered = serverList.filter(function(s) { return ALLOWED_SERVERS.indexOf(s.name) !== -1; });

          var streamPromises = filtered.map(function(serverObj) {
            return getText(streamBase + '/' + serverObj.data, { method: 'POST', headers: headers })
              .then(function(encStream) {
                return getJson('https://enc-dec.app/api/dec-vidfast', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: encStream, version: '1' })
                });
              })
              .then(function(decStream) {
                var data = decStream.result;
                if (!data || !data.url) return null;
                return streamObject(
                  'VidFast',
                  'VidFast ' + serverObj.name,
                  data.url,
                  normalizeQuality(data.quality || data.label),
                  { 'Referer': 'https://vidfast.pro/', 'User-Agent': 'Mozilla/5.0' }
                );
              })
              .catch(function() { return null; });
          });
          return Promise.all(streamPromises);
        });
    })
    .then(function(results) { return results.filter(Boolean); })
    .catch(function() { return []; });
}

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
      var displayTitle = (mediaType === 'tv' ? meta.name : meta.title) || "Vidmody";

      if (mediaType === "movie") {
        targetUrl = "https://vidmody.com/vs/" + imdbId + "#.m3u8";
      } else {
        var sStr = "s" + (season || 1);
        var eNum = episode || 1;
        var eStr = "e" + (eNum < 10 ? "0" + eNum : eNum);
        targetUrl = "https://vidmody.com/vs/" + imdbId + "/" + sStr + "/" + eStr + "#.m3u8";
        displayTitle += " - " + sStr.toUpperCase() + eStr.toUpperCase();
      }

      return fetch(targetUrl.replace("#.m3u8", ""), { method: "HEAD" })
        .then(function (res) {
          if (res.status === 200) {
            return [streamObject(
              "Vidmody",
              displayTitle + " (Vidmody)",
              targetUrl,
              "Auto",
              { "Referer": "https://vidmody.com/", "User-Agent": "Mozilla/5.0" }
            )];
          }
          return [];
        });
    })
    .catch(function () { return
