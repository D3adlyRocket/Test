// --- ORIGINAL UTILITIES ---
function getJson(url, options) {
  return fetch(url, options || {}).then(function (response) {
    if (!response || !response.ok) throw new Error('Request failed');
    return response.json();
  });
}

function getText(url, options) {
  return fetch(url, options || {}).then(function (response) {
    if (!response || !response.ok) throw new Error('Request failed');
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
  return { name: provider, title: title || provider, url: url, quality: quality || 'Auto', headers: headers || undefined };
}

function dedupeStreams(streams) {
  var seen = {};
  return (streams || []).filter(function (s) {
    if (!s || !s.url || seen[s.url]) return false;
    seen[s.url] = true; return true;
  });
}

function getTmdbMeta(tmdbId, mediaType) {
  var typePath = mediaType === 'tv' ? 'tv' : 'movie';
  var url = 'https://api.themoviedb.org/3/' + typePath + '/' + tmdbId + '?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885';
  return getJson(url);
}

// --- ORIGINAL RESOLVERS ---

function resolveVidEasy(tmdbId, mediaType, season, episode) {
  var type = mediaType === 'tv' ? 'tv' : 'movie';
  return getJson('https://db.videasy.net/3/' + type + '/' + tmdbId + '?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885').then(function (meta) {
    var isTv = mediaType === 'tv';
    var title = encodeURIComponent((isTv ? meta.name : meta.title) || '');
    var year = new Date(isTv ? meta.first_air_date : meta.release_date).getFullYear() || '';
    var url = 'https://api.videasy.net/cdn/sources-with-title?title=' + title + '&mediaType=' + type + '&year=' + year + '&episodeId=' + (episode || 1) + '&seasonId=' + (season || 1) + '&tmdbId=' + meta.id + '&imdbId=' + (meta.external_ids.imdb_id || '');
    return getText(url).then(function (txt) {
      return getJson('https://enc-dec.app/api/dec-videasy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: txt, id: String(tmdbId) }) });
    });
  }).then(function (res) {
    return (res.result.sources || []).map(function (s) { return streamObject('VidEasy', 'VidEasy ' + s.quality, s.url, normalizeQuality(s.quality), { Origin: 'https://player.videasy.net', Referer: 'https://player.videasy.net/' }); });
  }).catch(function () { return []; });
}

function resolveVidLink(tmdbId, mediaType, season, episode) {
  return getJson('https://enc-dec.app/api/enc-vidlink?text=' + tmdbId).then(function (enc) {
    var url = mediaType === 'tv' ? 'https://vidlink.pro/api/b/tv/' + enc.result + '/' + (season || 1) + '/' + (episode || 1) : 'https://vidlink.pro/api/b/movie/' + enc.result;
    return getJson(url + '?multiLang=0').then(function (p) {
      return [streamObject('VidLink', 'VidLink Primary', p.stream.playlist, 'Auto', { Referer: 'https://vidlink.pro' })];
    });
  }).catch(function () { return []; });
}

function resolveVidmody(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType).then(function (m) {
    var id = mediaType === 'tv' ? m.external_ids.imdb_id : m.imdb_id;
    var url = mediaType === "movie" ? "https://vidmody.com/vs/" + id + "#.m3u8" : "https://vidmody.com/vs/" + id + "/s" + (season || 1) + "/e" + (episode < 10 ? "0" + episode : episode) + "#.m3u8";
    return fetch(url.replace("#.m3u8", ""), { method: "HEAD" }).then(function (r) {
      return r.status === 200 ? [streamObject("Vidmody", "Vidmody Player", url, "Auto", { "Referer": "https://vidmody.com/" })] : [];
    });
  }).catch(function () { return []; });
}

function resolveVidSrc(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType).then(function (m) {
    var id = mediaType === 'tv' ? m.external_ids.imdb_id : m.imdb_id;
    var emb = mediaType === 'tv' ? 'https://vsrc.su/embed/tv?imdb=' + id + '&season=' + (season || 1) + '&episode=' + (episode || 1) : 'https://vsrc.su/embed/' + id;
    return getText(emb).then(function (h) {
      var ifr = h.match(/<iframe[^>]+src=["']([^"']+)["']/i)[1];
      return getText('https:' + ifr, { headers: { referer: 'https://vsrc.su/' } }).then(function (ih) {
        var src = ih.match(/src:\s*['"]([^'"]+)['"]/i)[1];
        return getText('https://cloudnestra.com' + src, { headers: { referer: 'https://cloudnestra.com/' } }).then(function (ch) {
          var d = ch.match(/<div id="([^"]+)"[^>]*style=["']display\s*:\s*none;?["'][^>]*>([a-zA-Z0-9:\/.,{}\-_=+ ]+)<\/div>/i);
          return getJson('https://enc-dec.app/api/dec-cloudnestra', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: d[2], div_id: d[1] }) }).then(function (dec) {
            return (dec.result || []).map(function (u, i) { return streamObject('VidSrc', 'VidSrc ' + (i + 1), u, 'Auto', { referer: 'https://cloudnestra.com/' }); });
          });
        });
      });
    });
  }).catch(function () { return []; });
}

// --- ADDING VIXSRC (Isolated) ---
function resolveVixSrc(tmdbId, mediaType, season, episode) {
  var baseUrl = "https://vixsrc.to";
  var api = baseUrl + '/api/' + (mediaType === 'tv' ? 'tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1) : 'movie/' + tmdbId);
  return getJson(api, { headers: { "Referer": baseUrl + "/" } }).then(function (p) {
    return getText(p.src, { headers: { "Referer": baseUrl + "/" } }).then(function (h) {
      var tok = h.match(/token['"]\s*:\s*['"]([^'"]+)/i)[1];
      var exp = h.match(/expires['"]\s*:\s*['"]([^'"]+)/i)[1];
      var uri = h.match(/url\s*:\s*['"]([^'"]+)/i)[1];
      var final = uri + "?token=" + tok + "&expires=" + exp + "&h=1";
      return [streamObject('VixSrc', 'VixSrc HD', final, '1080P', { "Referer": p.src, "Origin": baseUrl })];
    });
  }).catch(function () { return []; });
}

// --- MAIN FUNCTION ---
function getStreams(tmdbId, mediaType, season, episode) {
  var resolvers = [resolveVidEasy, resolveVidLink, resolveVidmody, resolveVidSrc, resolveVixSrc];
  
  return Promise.all(resolvers.map(function (r) { 
    return r(tmdbId, mediaType, season, episode).catch(function () { return []; }); 
  })).then(function (results) {
    var merged = [];
    for (var i = 0; i < results.length; i++) {
      if (results[i]) merged = merged.concat(results[i]);
    }
    return dedupeStreams(merged).slice(0, 50);
  }).catch(function () { return []; });
}

module.exports = { getStreams: getStreams };
