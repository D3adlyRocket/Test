// ================================================================
// ZoroLost — Android TV "Barebones" Version (Maximum Compatibility)
// ================================================================

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE     = 'https://watchanimeworld.net';
var PLAYER   = 'https://play.zephyrflick.top';
var UA       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function httpGet(url, extra) {
  return fetch(url, {
    headers: Object.assign({ 'User-Agent': UA }, extra || {})
  }).then(function(r) { return r.text(); });
}

function httpPost(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': PLAYER + '/'
    },
    body: body
  }).then(function(r) { return r.json(); });
}

// ── Search & Extraction ──────────────────────────────────────────

function searchSite(title, type) {
  return httpGet(BASE + '/?s=' + encodeURIComponent(title)).then(function(html) {
    var match = html.match(new RegExp('href="(https:\\/\\/watchanimeworld\\.net\\/' + (type === 'movie' ? 'movies' : 'series') + '\\/([^\\/\\"]+)\\/)"'));
    return match ? match[1] : null;
  });
}

function getEp(url, s, e) {
  return httpGet(url).then(function(html) {
    var id = (html.match(/postid-(\d+)/) || html.match(/data-post="(\d+)"/))[1];
    var ajax = BASE + '/wp-admin/admin-ajax.php?action=action_select_season&season=' + s + '&post=' + id;
    return httpGet(ajax).then(function(h) {
      var m = h.match(new RegExp('href="(https:\\/\\/watchanimeworld\\.net\\/episode\\/[^"]*' + s + 'x' + e + '\\/)"'));
      return m ? m[1] : null;
    });
  });
}

function getFinal(url) {
  return httpGet(url).then(function(html) {
    var m = html.match(/src="(https:\/\/play\.zephyrflick\.top\/video\/([a-f0-9]+))"/);
    if (!m) return null;
    return httpPost(PLAYER + '/player/index.php?data=' + m[2] + '&do=getVideo', 'hash=' + m[2] + '&r=' + encodeURIComponent(BASE + '/'));
  });
}

// ── Main ─────────────────────────────────────────────────────────

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function(resolve) {
    fetch('https://api.themoviedb.org/3/' + (mediaType === 'movie' ? 'movie' : 'tv') + '/' + tmdbId + '?api_key=' + TMDB_KEY)
    .then(function(r) { return r.json(); })
    .then(function(meta) {
      return searchSite(meta.title || meta.name, mediaType);
    })
    .then(function(url) {
      if (!url) return null;
      return (mediaType === 'movie') ? getFinal(url) : getEp(url, season, episode).then(getFinal);
    })
    .then(function(res) {
      var streamUrl = res ? (res.videoSource || res.securedLink) : null;
      if (!streamUrl) return resolve([]);

      resolve([{
        name: '🗡️ ZoroLost TV',
        title: 'Multi-Audio | 1080p',
        url: streamUrl,
        behaviorHints: {
          notInterpreted: true,
          proxyHeaders: {
            request: {
              'User-Agent': UA,
              'Referer': PLAYER + '/',
              'Origin': PLAYER,
              'Connection': 'keep-alive'
            }
          }
        }
      }]);
    })
    .catch(function() { resolve([]); });
    
    // Safety timeout
    setTimeout(function() { resolve([]); }, 12000);
  });
}

module.exports = { getStreams };
