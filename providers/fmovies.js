// providers/idlix.js
// CommonJS ONLY
// NO import/export
// NO async/await
// Promise chain only

var https = require('https');
var http = require('http');
var url = require('url');

var BASE_URL = 'https://z1.idlixku.com';
var WORKER_BASE = 'https://free-plugin-nuvio.python-hacking19.workers.dev';
var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

function log() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[idlix]');
  console.log.apply(console, args);
}

function request(rawUrl, options) {
  options = options || {};

  return new Promise(function(resolve, reject) {
    var parsed = url.parse(rawUrl);
    var lib = parsed.protocol === 'https:' ? https : http;
    var bodyStr = options.body || null;

    var headers = Object.assign({
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://idlixku.com/',
      'Origin': 'https://idlixku.com'
    }, options.headers || {});

    if (bodyStr && typeof bodyStr !== 'string') {
      bodyStr = JSON.stringify(bodyStr);
    }

    if (bodyStr) {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    log('HTTP request =>', options.method || 'GET', rawUrl);

    var req = lib.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
      method: options.method || 'GET',
      headers: headers
    }, function(res) {
      var chunks = [];

      if (
        (res.statusCode === 301 ||
         res.statusCode === 302 ||
         res.statusCode === 303 ||
         res.statusCode === 307 ||
         res.statusCode === 308) &&
        res.headers.location
      ) {
        var nextUrl = res.headers.location.indexOf('http') === 0
          ? res.headers.location
          : parsed.protocol + '//' + parsed.host + res.headers.location;

        log('Redirect =>', rawUrl, '->', nextUrl);
        return resolve(request(nextUrl, options));
      }

      res.on('data', function(chunk) {
        chunks.push(chunk);
      });

      res.on('end', function() {
        var text = Buffer.concat(chunks).toString('utf8');
        var contentType = (res.headers['content-type'] || '').toLowerCase();
        var out = {
          statusCode: res.statusCode,
          headers: res.headers,
          body: text
        };

        log('HTTP response <=', res.statusCode, rawUrl, '| content-type:', contentType || '-');

        if (res.statusCode >= 400) {
          return reject(new Error('HTTP ' + res.statusCode + ' from ' + rawUrl + ' => ' + text.slice(0, 300)));
        }

        if (
          contentType.indexOf('application/json') !== -1 ||
          text.indexOf('{') === 0 ||
          text.indexOf('[') === 0
        ) {
          try {
            out.json = JSON.parse(text);
          } catch (e) {
            log('JSON parse skipped/failed for:', rawUrl, '|', e.message);
          }
        }

        resolve(out);
      });
    });

    req.on('error', function(err) {
      log('HTTP error =>', rawUrl, '|', err.message);
      reject(err);
    });

    if (bodyStr) {
      req.write(bodyStr);
    }

    req.end();
  });
}

function getTmdbInfo(tmdbId, mediaType) {
  var typePath = mediaType === 'series' ? 'tv' : 'movie';
  var tmdbUrl = 'https://api.themoviedb.org/3/' + typePath + '/' + tmdbId +
    '?api_key=' + encodeURIComponent(TMDB_API_KEY) + '&language=en-US';

  log('TMDB lookup =>', mediaType, tmdbId);

  return request(tmdbUrl).then(function(res) {
    var data = res.json || {};
    var title = data.title || data.name || '';
    var year = '';

    if (mediaType === 'series') {
      year = (data.first_air_date || '').slice(0, 4);
    } else {
      year = (data.release_date || '').slice(0, 4);
    }

    if (!title) {
      throw new Error('TMDB title tidak ditemukan untuk tmdbId=' + tmdbId);
    }

    log('TMDB result => title:', title, '| year:', year || '-');

    return {
      title: title,
      year: year
    };
  });
}

function searchIdlix(title) {
  var searchUrl = BASE_URL + '/api/search?q=' + encodeURIComponent(title) + '&page=1&limit=8';

  log('Search Idlix =>', title);

  return request(searchUrl).then(function(res) {
    var data = res.json || {};
    var results = [];

    if (Array.isArray(data)) {
      results = data;
    } else if (Array.isArray(data.results)) {
      results = data.results;
    } else if (Array.isArray(data.data)) {
      results = data.data;
    }

    log('Search results count =>', results.length);

    if (!results.length) {
      throw new Error('Idlix search kosong untuk title: ' + title);
    }

    return results;
  });
}

function pickBestResult(results, title, mediaType, year) {
  var wantedTitle = String(title || '').toLowerCase().trim();
  var wantedYear = String(year || '').trim();
  var wantedType = mediaType === 'series' ? 'series' : 'movie';

  var scored = results.map(function(item) {
    var itemTitle = String(item.title || item.name || '').toLowerCase().trim();
    var itemYear = String(item.year || item.release_year || '').trim();
    var itemType = String(item.type || item.media_type || '').toLowerCase().trim();
    var score = 0;

    if (itemTitle === wantedTitle) score += 10;
    else if (itemTitle.indexOf(wantedTitle) !== -1 || wantedTitle.indexOf(itemTitle) !== -1) score += 6;

    if (wantedYear && itemYear === wantedYear) score += 3;
    if (itemType === wantedType) score += 4;

    return { item: item, score: score };
  });

  scored.sort(function(a, b) {
    return b.score - a.score;
  });

  log('Best result =>', JSON.stringify(scored[0] && scored[0].item ? scored[0].item : null));

  return scored[0] && scored[0].item ? scored[0].item : null;
}

function getMovieDetail(slug) {
  var detailUrl = BASE_URL + '/api/movies/' + encodeURIComponent(slug);

  log('Movie detail => slug:', slug);

  return request(detailUrl).then(function(res) {
    var data = res.json || {};
    var id = data.id || (data.data && data.data.id) || data.movie_id;

    if (!id) {
      throw new Error('Movie ID tidak ditemukan untuk slug: ' + slug);
    }

    log('Movie detail => id:', id);

    return { id: id };
  });
}

function getSeriesEpisodeId(slug, season, episode) {
  var seasonUrl = BASE_URL + '/api/series/' + encodeURIComponent(slug) + '/season/' + season;

  log('Series season lookup => slug:', slug, '| season:', season, '| episode:', episode);

  return request(seasonUrl).then(function(res) {
    var data = res.json || {};
    var episodes = [];

    if (Array.isArray(data)) episodes = data;
    else if (Array.isArray(data.episodes)) episodes = data.episodes;
    else if (Array.isArray(data.data)) episodes = data.data;

    log('Episode count =>', episodes.length);

    if (!episodes.length) {
      throw new Error('Episode list kosong untuk slug=' + slug + ' season=' + season);
    }

    var found = null;

    episodes.forEach(function(ep) {
      var epNum = parseInt(ep.episode_number || ep.number || ep.episode || ep.ep || 0, 10);
      if (epNum === parseInt(episode, 10)) {
        found = ep;
      }
    });

    if (!found) {
      throw new Error('Episode tidak ditemukan untuk S' + season + 'E' + episode);
    }

    var epId = found.id || found.episode_id;
    if (!epId) {
      throw new Error('Episode ID tidak ditemukan untuk S' + season + 'E' + episode);
    }

    log('Episode found => id:', epId);

    return epId;
  });
}

function getPlayInfo(type, id) {
  var playInfoUrl = BASE_URL + '/api/watch/play-info/' + type + '/' + id;

  log('Play-info => type:', type, '| id:', id);

  return request(playInfoUrl).then(function(res) {
    var data = res.json || {};
    var claim = data.claim || (data.data && data.data.claim);
    var redeemUrl = data.redeemUrl || data.redeem_url || (data.data && (data.data.redeemUrl || data.data.redeem_url));

    if (!claim || !redeemUrl) {
      throw new Error('claim atau redeemUrl tidak ditemukan dari play-info');
    }

    log('Play-info OK => redeemUrl:', redeemUrl);

    return {
      claim: claim,
      redeemUrl: redeemUrl
    };
  });
}

function redeemClaim(redeemUrl, claim) {
  log('Redeem =>', redeemUrl);

  return request(redeemUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://idlixku.com/',
      'Origin': 'https://idlixku.com'
    },
    body: JSON.stringify({ claim: claim })
  }).then(function(res) {
    var data = res.json || {};
    var streamUrl = data.url || data.stream_url || data.hls || (data.data && (data.data.url || data.data.stream_url));
    var subtitles = [];

    if (!streamUrl) {
      throw new Error('URL stream tidak ditemukan dari redeem response');
    }

    if (Array.isArray(data.subtitles)) {
      subtitles = data.subtitles.map(function(s, idx) {
        return {
          id: String(idx + 1),
          lang: s.lang || s.label || s.language || 'Unknown',
          url: s.url || s.file || ''
        };
      }).filter(function(s) {
        return !!s.url;
      });
    }

    log('Redeem OK => streamUrl:', streamUrl);
    log('Redeem subtitles =>', subtitles.length);

    return {
      streamUrl: streamUrl,
      subtitles: subtitles
    };
  });
}

function toWorkerUrl(streamUrl) {
  var parsed = new URL(streamUrl);
  var proxied = WORKER_BASE + parsed.pathname + parsed.search;
  log('Proxy URL =>', proxied);
  return proxied;
}

function getStreams(tmdbId, mediaType, season, episode) {
  var tmdbInfo = null;
  var best = null;

  log('getStreams called => tmdbId:', tmdbId, '| mediaType:', mediaType, '| season:', season, '| episode:', episode);

  return getTmdbInfo(tmdbId, mediaType)
    .then(function(info) {
      tmdbInfo = info;
      return searchIdlix(info.title);
    })
    .then(function(results) {
      best = pickBestResult(results, tmdbInfo.title, mediaType, tmdbInfo.year);

      if (!best) {
        throw new Error('Hasil Idlix terbaik tidak ditemukan');
      }

      if (!best.slug) {
        throw new Error('Slug hasil search tidak ditemukan');
      }

      log('Selected result => slug:', best.slug, '| raw:', JSON.stringify(best));

      if (mediaType === 'series') {
        return getSeriesEpisodeId(best.slug, season, episode)
          .then(function(epId) {
            return getPlayInfo('episode', epId);
          });
      }

      return getMovieDetail(best.slug)
        .then(function(movie) {
          return getPlayInfo('movie', movie.id);
        });
    })
    .then(function(playInfo) {
      return redeemClaim(playInfo.redeemUrl, playInfo.claim);
    })
    .then(function(streamData) {
      var proxiedUrl = toWorkerUrl(streamData.streamUrl);

      var stream = {
        name: 'Idlix',
        title: '🎬 Idlix',
        url: proxiedUrl,
        behaviorHints: {
          notWebReady: false,
          bingeGroup: 'idlix'
        }
      };

      if (streamData.subtitles && streamData.subtitles.length) {
        stream.subtitles = streamData.subtitles;
      }

      log('Final stream object =>', JSON.stringify(stream));

      return {
        streams: [stream]
      };
    })
    .catch(function(err) {
      log('getStreams ERROR =>', err && err.message ? err.message : err);
      return { streams: [] };
    });
}

module.exports = {
  getStreams: getStreams
};
