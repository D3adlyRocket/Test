// --- UTILITIES ---
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

// --- RESOLVERS ---

// 1. VixSrc (The New Provider)
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
        var tokenMatch = html.match(/'token'\s*:\s*'([^']+)'/i);
        var expiresMatch = html.match(/'expires'\s*:\s*'([^']+)'/i);
        var urlMatch = html.match(/url\s*:\s*'([^']+\/playlist\/\d+[^']*)'/i);

        if (!tokenMatch || !expiresMatch || !urlMatch) return [];

        var finalStreamUrl = urlMatch[1] + "?token=" + encodeURIComponent(tokenMatch[1]) + "&expires=" + encodeURIComponent(expiresMatch[1]) + "&h=1";
        
        return [streamObject(
          'VixSrc',
          'VixSrc Player',
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

// 2. VidEasy
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

// 3. VidLink
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

// 4. Vidmody
function resolveVidmody(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType)
    .then(function (meta) {
      var imdbId = (mediaType === 'tv' ? (meta.external_ids && meta.external_ids.imdb_id) : meta.imdb_id);
      if (!imdbId) return [];
      var targetUrl = (mediaType === "movie") 
        ? "https://vidmody.com/vs/" + imdbId + "#.m3u8"
        : "https://vidmody.com/vs/" + imdbId + "/s" + (season || 1) + "/e" + ((episode || 1) < 10 ? "0" + (episode || 1) : (episode || 1)) + "#.m3u8";

      return fetch(targetUrl.replace("#.m3u8", ""), { method: "HEAD" }).then(function (res) {
        if (res.status === 200) {
          return [streamObject("Vidmody", "Vidmody Server", targetUrl, "Auto", { "Referer": "https://vidmody.com/" })];
        }
        return [];
      });
    })
    .catch(function () { return []; });
}

// 5. VidSrc
function resolveVidSrc(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType)
    .then(function (meta) {
      var imdbId = mediaType === 'tv' ? (meta.external_ids && meta.external_ids.imdb_id) : meta.imdb_id;
      if (!imdbId) return [];

      var embedUrl = mediaType === 'tv'
        ? 'https://vsrc.su/embed/tv?imdb=' + imdbId + '&season=' + (season || 1) + '&episode=' + (episode || 1)
        : 'https://vsrc.su/embed/' + imdbId;

      return getText(embedUrl).then(function (embedHtml) {
        var iframeMatch = embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        var iframeSrc = iframeMatch ? iframeMatch[1] : '';
        if (!iframeSrc) return [];

        return getText('https:' + iframeSrc, { headers: { referer: 'https://vsrc.su/' } }).then(function (iframeHtml) {
          var srcMatch = iframeHtml.match(/src:\s*['"]([^'"]+)['"]/i);
          if (!srcMatch) return [];

          return getText('https://cloudnestra.com' + srcMatch[1], { headers: { referer: 'https://cloudnestra.com/' } }).then(function (cloudHtml) {
            var divMatch = cloudHtml.match(/<div id="([^"]+)"[^>]*style=["']display\s*:\s*none;?["'][^>]*>([a-zA-Z0-9:\/.,{}\-_=+ ]+)<\/div>/i);
            if (!divMatch) return [];

            return getJson('https://enc-dec.app/api/dec-cloudnestra', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: divMatch[2], div_id: divMatch[1] })
            }).then(function (decrypted) {
              var urls = (decrypted && decrypted.result) || [];
              return Array.isArray(urls) ? urls.map(function (url, index) {
                return streamObject('VidSrc', 'VidSrc Server ' + (index + 1), url, 'Auto', { referer: 'https://cloudnestra.com/' });
              }) : [];
            });
          });
        });
      });
    })
    .catch(function () { return []; });
}

// --- MAIN FUNCTION ---

function getStreams(tmdbId, mediaType, season, episode) {
  var resolvers = [
    resolveVixSrc,
    resolveVidEasy,
    resolveVidLink,
    resolveVidmody,
    resolveVidSrc
  ];

  return Promise.all(
    resolvers.map(function (resolver) {
      // Use .catch so one failing provider doesn't kill the whole list
      return resolver(tmdbId, mediaType, season, episode).catch(function (err) { 
        console.log("Resolver failed:", err);
        return []; 
      });
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
