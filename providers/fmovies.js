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

/**
 * VidFast - 5th Provider
 */
function resolveVidFast(tmdbId, mediaType, season, episode) {
  var baseUrl = 'https://vidfast.pro';
  var pageUrl = mediaType === 'tv' 
    ? baseUrl + '/tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1)
    : baseUrl + '/movie/' + tmdbId;

  var headers = {
    'Origin': baseUrl,
    'Referer': pageUrl,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest'
  };

  return getText(pageUrl, { headers: headers })
    .then(function (html) {
      var rawData = null;
      var nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
      if (nextMatch) {
        try {
          var props = JSON.parse(nextMatch[1]).props.pageProps;
          rawData = props.en || props.data;
        } catch (e) {}
      }
      if (!rawData) {
        var reg = html.match(/"en":"([^"]+)"/) || html.match(/data\s*=\s*"([^"]+)"/);
        if (reg) rawData = reg[1];
      }
      if (!rawData) throw new Error('No data');

      return getJson('https://enc-dec.app/api/enc-vidfast?text=' + encodeURIComponent(rawData) + '&version=1');
    })
    .then(function (api) {
      if (!api || !api.result) return [];
      var res = api.result;
      if (res.token) headers['X-CSRF-Token'] = res.token;

      return getText(res.servers, { method: 'POST', headers: headers })
        .then(function (enc) {
          return getJson('https://enc-dec.app/api/dec-vidfast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: enc, version: '1' })
          });
        })
        .then(function (decServers) {
          var servers = decServers.result || [];
          var promises = servers.map(function (srv) {
            return getText(res.stream + '/' + srv.data, { method: 'POST', headers: headers })
              .then(function (eStr) {
                return getJson('https://enc-dec.app/api/dec-vidfast', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: eStr, version: '1' })
                });
              })
              .then(function (dStr) {
                if (dStr.result && dStr.result.url) {
                  return streamObject('VidFast', 'VidFast ' + srv.name, dStr.result.url, normalizeQuality(dStr.result.quality || dStr.result.label), { 'Referer': baseUrl + '/', 'Origin': baseUrl });
                }
                return null;
              }).catch(function() { return null; });
          });
          return Promise.all(promises);
        });
    })
    .then(function (results) { return results.filter(Boolean); })
    .catch(function () { return []; });
}

function resolveVidEasy(tmdbId, mediaType, season, episode) {
  var typePath = mediaType === 'tv' ? 'tv' : 'movie';
  var dbUrl = 'https://db.videasy.net/3/' + typePath + '/' + tmdbId + '?append_to_response=external_ids&language=en&api_key=ad301b7cc82ffe19273e55e4d4206885';
  return getJson(dbUrl).then(function (meta) {
    var isTv = mediaType === 'tv';
    var title = encodeURIComponent((isTv ? meta.name : meta.title) || '');
    var dateText = isTv ? meta.first_air_date : meta.release_date;
    var year = dateText ? new Date(dateText).getFullYear() : '';
    var imdbId = (meta.external_ids && meta.external_ids.imdb_id) || '';
    var fullUrl = 'https://api.videasy.net/cdn/sources-with-title?title=' + title + '&mediaType=' + (isTv ? 'tv' : 'movie') + '&year=' + year + '&episodeId=' + (isTv ? (episode || 1) : 1) + '&seasonId=' + (isTv ? (season || 1) : 1) + '&tmdbId=' + meta.id + '&imdbId=' + imdbId;
    return getText(fullUrl).then(function (enc) {
      return getJson('https://enc-dec.app/api/dec-videasy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: enc, id: String(tmdbId) })
      });
    });
  }).then(function (dec) {
    var sources = (dec && dec.result && dec.result.sources) || [];
    return sources.map(function (s) {
      return streamObject('VidEasy', 'VidEasy ' + s.quality, s.url, normalizeQuality(s.quality), { Origin: 'https://player.videasy.net', Referer: 'https://player.videasy.net/' });
    }).filter(Boolean);
  }).catch(function () { return []; });
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
    }).catch(function () { return []; });
}

function resolveVidmody(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType).then(function (meta) {
    var imdbId = (mediaType === 'tv' ? (meta.external_ids && meta.external_ids.imdb_id) : meta.imdb_id);
    if (!imdbId) return [];
    var targetUrl = mediaType === "movie" 
      ? "https://vidmody.com/vs/" + imdbId + "#.m3u8"
      : "https://vidmody.com/vs/" + imdbId + "/s" + (season || 1) + "/e" + ((episode < 10 ? "0" : "") + (episode || 1)) + "#.m3u8";
    return fetch(targetUrl.replace("#.m3u8", ""), { method: "HEAD" }).then(function (res) {
      if (res.status === 200) {
        return [streamObject("Vidmody", "Vidmody Server", targetUrl, "Auto", { "Referer": "https://vidmody.com/", "User-Agent": "Mozilla/5.0" })];
      }
      return [];
    });
  }).catch(function () { return []; });
}

function resolveVidSrc(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType).then(function (meta) {
    var imdbId = mediaType === 'tv' ? (meta.external_ids && meta.external_ids.imdb_id) : meta.imdb_id;
    if (!imdbId) return [];
    var embedUrl = mediaType === 'tv' ? 'https://vsrc.su/embed/tv?imdb=' + imdbId + '&season=' + (season || 1) + '&episode=' + (episode || 1) : 'https://vsrc.su/embed/' + imdbId;
    return getText(embedUrl).then(function (html) {
      var iframe = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (!iframe) return [];
      return getText('https:' + iframe[1], { headers: { referer: 'https://vsrc.su/' } }).then(function (ihtml) {
        var src = ihtml.match(/src:\s*['"]([^'"]+)['"]/i);
        if (!src) return [];
        return getText('https://cloudnestra.com' + src[1], { headers: { referer: 'https://cloudnestra.com/' } }).then(function (chtml) {
          var div = chtml.match(/<div id="([^"]+)"[^>]*style=["']display\s*:\s*none;?["'][^>]*>([a-zA-Z0-9:\/.,{}\-_=+ ]+)<\/div>/i);
          if (!div) return [];
          return getJson('https://enc-dec.app/api/dec-cloudnestra', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: div[2], div_id: div[1] })
          }).then(function (d) {
            return (d.result || []).map(function (u, i) {
              return streamObject('VidSrc', 'VidSrc Server ' + (i + 1), u, 'Auto', { referer: 'https://cloudnestra.com/', origin: 'https://cloudnestra.com' });
            });
          });
        });
      });
    });
  }).catch(function () { return []; });
}

// --- MAIN ---

function getStreams(tmdbId, mediaType, season, episode) {
  var resolvers = [resolveVidFast, resolveVidEasy, resolveVidLink, resolveVidmody, resolveVidSrc];
  return Promise.all(resolvers.map(function (r) {
    return Promise.resolve(r(tmdbId, mediaType, season, episode)).catch(function () { return []; });
  })).then(function (results) {
    var merged = [];
    results.forEach(function (g) { if (Array.isArray(g)) merged = merged.concat(g); });
    return dedupeStreams(merged).slice(0, 50);
  });
}

module.exports = { getStreams: getStreams };
