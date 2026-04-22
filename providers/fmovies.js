// ================================================================
// ZoroLost — Android TV "Final Stand" Version
// ================================================================

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE     = 'https://watchanimeworld.net';
var PLAYER   = 'https://play.zephyrflick.top';

// Using a UA that mimics a generic Android Tablet to get better compatibility
var UA = 'Mozilla/5.0 (Linux; Android 13; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36';

function httpGet(url) {
  return fetch(url, { headers: { 'User-Agent': UA } }).then(function(r) { return r.text(); });
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

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function(resolve) {
    // 1. Get Title from TMDB
    fetch('https://api.themoviedb.org/3/' + (mediaType === 'movie' ? 'movie' : 'tv') + '/' + tmdbId + '?api_key=' + TMDB_KEY)
    .then(function(r) { return r.json(); })
    .then(function(meta) {
      var title = meta.title || meta.name;
      // 2. Search Site
      return httpGet(BASE + '/?s=' + encodeURIComponent(title));
    })
    .then(function(html) {
      var typeStr = (mediaType === 'movie' ? 'movies' : 'series');
      var match = html.match(new RegExp('href="(https:\\/\\/watchanimeworld\\.net\\/' + typeStr + '\\/([^\\/\\"]+)\\/)"'));
      if (!match) throw new Error('Not Found');
      var url = match[1];

      // 3. Get Episode or Direct Movie Page
      if (mediaType === 'movie') return url;
      return httpGet(url).then(function(sHtml) {
        var id = sHtml.match(/postid-(\d+)/)[1];
        var ajax = BASE + '/wp-admin/admin-ajax.php?action=action_select_season&season=' + season + '&post=' + id;
        return httpGet(ajax).then(function(eHtml) {
          var m = eHtml.match(new RegExp('href="(https:\\/\\/watchanimeworld\\.net\\/episode\\/[^"]*' + season + 'x' + episode + '\\/)"'));
          return m ? m[1] : null;
        });
      });
    })
    .then(function(finalPage) {
      if (!finalPage) return null;
      return httpGet(finalPage);
    })
    .then(function(html) {
      // 4. Extract Video Data
      var m = html.match(/src="(https:\/\/play\.zephyrflick\.top\/video\/([a-f0-9]+))"/);
      if (!m) return null;
      var hash = m[2];
      return httpPost(PLAYER + '/player/index.php?data=' + hash + '&do=getVideo', 'hash=' + hash + '&r=' + encodeURIComponent(BASE + '/'));
    })
    .then(function(res) {
      var stream = res ? (res.videoSource || res.securedLink) : null;
      if (!stream) return resolve([]);

      resolve([{
        name: '🗡️ ZoroLost [TV-PRO]',
        title: 'Multi-Audio | 1080p | Fix Applied',
        url: stream,
        behaviorHints: {
          notInterpreted: true,
          bingeGroup: 'zorolost-tv-final', // Changed to clear cache
          proxyHeaders: {
            request: {
              'User-Agent': UA,
              'Referer': PLAYER + '/',
              'Origin': PLAYER,
              'Connection': 'keep-alive',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          }
        }
      }]);
    })
    .catch(function() { resolve([]); });

    setTimeout(function() { resolve([]); }, 15000); // 15s timeout for slow TV hardware
  });
}

module.exports = { getStreams };
