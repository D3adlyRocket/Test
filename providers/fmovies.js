// ================================================================
// ZoroLost — Android TV "Final Fix" (ExoPlayer Optimized)
// ================================================================

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE     = 'https://watchanimeworld.net';
var PLAYER   = 'https://play.zephyrflick.top';

// Using an older, more "Standard" Chrome UA that ExoPlayer handles better
var UA       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36';

function withTimeout(promise, ms) {
  var killer = new Promise(function(_, reject) {
    setTimeout(function() { reject(new Error('Timeout')); }, ms);
  });
  return Promise.race([promise, killer]);
}

function httpGet(url, extra) {
  return fetch(url, {
    headers: Object.assign({ 'User-Agent': UA, 'Accept': '*/*' }, extra || {})
  }).then(function(r) { return r.text(); });
}

function httpPost(url, body, extra) {
  return fetch(url, {
    method: 'POST',
    headers: Object.assign({
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': PLAYER,
      'Referer': PLAYER + '/'
    }, extra || {}),
    body: body
  }).then(function(r) { return r.json(); });
}

// ── Extraction Logic ─────────────────────────────────────────────

function searchSite(title, mediaType) {
  var url = BASE + '/?s=' + encodeURIComponent(title);
  return httpGet(url).then(function(html) {
    var re = /href="(https:\/\/watchanimeworld\.net\/(series|movies)\/([^\/\"]+)\/)"/g;
    var m, results = [];
    while ((m = re.exec(html)) !== null) {
      if (m[3] !== 'page') results.push({ url: m[1], type: m[2] });
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
        if (m[1].includes(suffix)) return m[1];
      }
      return null;
    });
  });
}

// ── Stream Fetching ──────────────────────────────────────────────

function getFinalStream(pageUrl) {
  return httpGet(pageUrl).then(function(html) {
    var iframeM = html.match(/src="(https:\/\/play\.zephyrflick\.top\/video\/([a-f0-9]+))"/);
    if (!iframeM) return null;
    var hash = iframeM[2];

    return httpPost(
      PLAYER + '/player/index.php?data=' + hash + '&do=getVideo',
      'hash=' + hash + '&r=' + encodeURIComponent(BASE + '/')
    ).then(function(data) {
        return data.videoSource || data.securedLink || null;
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
      if (!results || !results.length) return null;
      var target = results[0].url;
      return (mediaType === 'movie') ? getFinalStream(target) : getEpisodeUrl(target, season, episode).then(function(u) { return u ? getFinalStream(u) : null; });
    })
    .then(function(m3u8Url) {
      if (!m3u8Url) return resolve([]);

      resolve([{
        name: '🗡️ ZoroLost [TV-FIX]',
        title: 'Multi-Audio | 1080p',
        url: m3u8Url,
        behaviorHints: {
          notInterpreted: true,
          // TV players need these headers passed directly to the networking stack
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

    withTimeout(chain, 12000).catch(function() { resolve([]); });
  });
}

module.exports = { getStreams };
