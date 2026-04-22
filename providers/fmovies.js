// ================================================================
// ZoroLost — Android TV "Hardened" Version
// ================================================================

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE     = 'https://watchanimeworld.net';
var PLAYER   = 'https://play.zephyrflick.top';
// Use a generic Windows UA to bypass TV-specific blocks
var UA       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

function withTimeout(promise, ms) {
  var killer = new Promise(function(_, reject) {
    setTimeout(function() { reject(new Error('Timeout')); }, ms);
  });
  return Promise.race([promise, killer]);
}

function httpGet(url, extra) {
  return fetch(url, {
    headers: Object.assign({ 'User-Agent': UA }, extra || {})
  }).then(function(r) { return r.text(); });
}

function httpPost(url, body, extra) {
  return fetch(url, {
    method: 'POST',
    headers: Object.assign({
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest'
    }, extra || {}),
    body: body
  }).then(function(r) { return r.json(); });
}

// ── Search & Extraction ──────────────────────────────────────────

function searchSite(title, mediaType) {
  var url = BASE + '/?s=' + encodeURIComponent(title);
  return httpGet(url, { Referer: BASE + '/' }).then(function(html) {
    var re = /href="(https:\/\/watchanimeworld\.net\/(series|movies)\/([^\/\"]+)\/)"/g;
    var m, results = [];
    while ((m = re.exec(html)) !== null) {
      if (m[3] !== 'page') results.push({ url: m[1], type: m[2], slug: m[3] });
    }
    return results.filter(function(r) { 
        return mediaType === 'movie' ? r.type === 'movies' : r.type === 'series'; 
    });
  });
}

function getEpisodeUrl(seriesUrl, season, episode) {
  return httpGet(seriesUrl).then(function(html) {
    var pidM = html.match(/postid-(\d+)/) || html.match(/data-post="(\d+)"/);
    if (!pidM) return null;
    var ajaxUrl = BASE + '/wp-admin/admin-ajax.php?action=action_select_season&season=' + season + '&post=' + pidM[1];
    return httpGet(ajaxUrl).then(function(epHtml) {
      var suffix = season + 'x' + episode + '/';
      var re = /href="(https:\/\/watchanimeworld\.net\/episode\/([^"]+))"/g;
      var m;
      while ((m = re.exec(epHtml)) !== null) {
        if (m[1].indexOf(suffix) !== -1) return m[1];
      }
      return null;
    });
  });
}

function getStreamData(pageUrl) {
  return httpGet(pageUrl).then(function(html) {
    var iframeM = html.match(/(?:src|data-src)="(https:\/\/play\.zephyrflick\.top\/video\/([a-f0-9]+))"/);
    if (!iframeM) return null;
    var hash = iframeM[2];

    return httpPost(
      PLAYER + '/player/index.php?data=' + hash + '&do=getVideo',
      'hash=' + hash + '&r=' + encodeURIComponent(BASE + '/'),
      { Referer: PLAYER + '/', Origin: PLAYER }
    ).then(function(data) {
        return {
            url: data.videoSource || data.securedLink,
            hash: hash
        };
    });
  });
}

// ── Main Export ──────────────────────────────────────────────────

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function(resolve) {
    var chain = fetch('https://api.themoviedb.org/3/' + (mediaType === 'movie' ? 'movie' : 'tv') + '/' + tmdbId + '?api_key=' + TMDB_KEY)
    .then(function(r) { return r.json(); })
    .then(function(meta) {
      return searchSite(meta.title || meta.name, mediaType);
    })
    .then(function(results) {
      if (!results.length) return null;
      var target = results[0].url;
      return (mediaType === 'movie') ? getStreamData(target) : getEpisodeUrl(target, season, episode).then(getStreamData);
    })
    .then(function(stream) {
      if (!stream || !stream.url) return resolve([]);

      resolve([{
        name: '🗡️ ZoroLost TV',
        title: '1080p | Multi-Audio',
        url: stream.url,
        // Android TV Specific: Force headers into the player engine
        behaviorHints: {
          notInterpreted: true,
          proxyHeaders: {
            request: {
              'User-Agent': UA,
              'Referer': PLAYER + '/',
              'Origin': PLAYER,
              // Required for some Android TV HLS implementations
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'cross-site'
            }
          }
        }
      }]);
    })
    .catch(function() { resolve([]); });

    withTimeout(chain, 10000).catch(function() { resolve([]); });
  });
}

module.exports = { getStreams };
