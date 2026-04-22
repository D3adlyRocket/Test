// ================================================================
// ZoroLost — Android TV "Nuclear Option"
// ================================================================

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE     = 'https://watchanimeworld.net';
var PLAYER   = 'https://play.zephyrflick.top';

// A "Legacy" User-Agent often forces servers into a more compatible HLS mode
var UA = 'Mozilla/5.0 (Linux; Android 10; BRAVIA 4K UR3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function httpGet(url) {
  return fetch(url, { headers: { 'User-Agent': UA } }).then(r => r.text());
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
  }).then(r => r.json());
}

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise((resolve) => {
    // Hardcoded 15-second limit for slow TV hardware
    const timeout = setTimeout(() => resolve([]), 15000);

    fetch(`https://api.themoviedb.org/3/${mediaType === 'movie' ? 'movie' : 'tv'}/${tmdbId}?api_key=${TMDB_KEY}`)
      .then(r => r.json())
      .then(meta => {
        const title = meta.title || meta.name;
        return httpGet(`${BASE}/?s=${encodeURIComponent(title)}`);
      })
      .then(html => {
        const typeStr = (mediaType === 'movie' ? 'movies' : 'series');
        const match = html.match(new RegExp(`href="(https:\\/\\/watchanimeworld\\.net\\/${typeStr}\\/([^\\/\\"]+)\\/)"`));
        if (!match) return null;
        
        const url = match[1];
        if (mediaType === 'movie') return url;
        
        return httpGet(url).then(sHtml => {
          const id = sHtml.match(/postid-(\d+)/)[1];
          const ajax = `${BASE}/wp-admin/admin-ajax.php?action=action_select_season&season=${season}&post=${id}`;
          return httpGet(ajax).then(eHtml => {
            const m = eHtml.match(new RegExp(`href="(https:\\/\\/watchanimeworld\\.net\\/episode\\/[^"]*${season}x${episode}\\/)"`));
            return m ? m[1] : null;
          });
        });
      })
      .then(finalPage => {
        if (!finalPage) return null;
        return httpGet(finalPage);
      })
      .then(html => {
        const m = html.match(/src="(https:\/\/play\.zephyrflick\.top\/video\/([a-f0-9]+))"/);
        if (!m) return null;
        const hash = m[2];
        return httpPost(`${PLAYER}/player/index.php?data=${hash}&do=getVideo`, `hash=${hash}&r=${encodeURIComponent(BASE + '/')}`);
      })
      .then(res => {
        const stream = res ? (res.videoSource || res.securedLink) : null;
        if (!stream) {
          clearTimeout(timeout);
          return resolve([]);
        }

        clearTimeout(timeout);
        resolve([{
          name: '🗡️ ZoroLost [TV-HARDENED]',
          title: 'Direct Link | Multi-Audio',
          url: stream,
          behaviorHints: {
            notInterpreted: true,
            // TV-specific networking hints
            proxyHeaders: {
              request: {
                'User-Agent': UA,
                'Referer': 'https://play.zephyrflick.top/',
                'Origin': 'https://play.zephyrflick.top',
                'Connection': 'keep-alive'
              }
            }
          }
        }]);
      })
      .catch(() => {
        clearTimeout(timeout);
        resolve([]);
      });
  });
}

module.exports = { getStreams };
