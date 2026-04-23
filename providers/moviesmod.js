'use strict';

var WORKER_BASE = 'https://moviebox.s4nch1tt.workers.dev';
var TAG         = '[MovieBox]';

// --- Cache Implementation ---
function Cache(max, ttl) {
  this.max = max; this.ttl = ttl; this.d = {}; this.ks = [];
}
Cache.prototype.get = function (k) {
  var e = this.d[k];
  if (!e) return undefined;
  if (Date.now() - e.t > this.ttl) { delete this.d[k]; return undefined; }
  return e.v;
};
Cache.prototype.set = function (k, v) {
  if (this.d[k]) { this.d[k] = { v: v, t: Date.now() }; return; }
  if (this.ks.length >= this.max) delete this.d[this.ks.shift()];
  this.ks.push(k);
  this.d[k] = { v: v, t: Date.now() };
};

var _cache = new Cache(300, 20 * 60 * 1000);

// --- Fetch Logic ---
function fetchFromWorker(tmdbId, mediaType, se, ep) {
  var url = WORKER_BASE + '/streams'
    + '?tmdb_id=' + encodeURIComponent(tmdbId)
    + '&type='    + encodeURIComponent(mediaType)
    + '&proxy='   + encodeURIComponent(WORKER_BASE);

  if (mediaType === 'tv') {
    url += '&se=' + (se != null ? se : 1);
    url += '&ep=' + (ep != null ? ep : 1);
  }

  return fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Nuvio/1.0' },
    redirect: 'follow',
  })
    .then(function (r) {
      if (!r.ok) throw new Error('Worker HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.streams)) return data.streams;
      return [];
    });
}

// --- Builder Logic ---
function buildStream(s, isTv, se, ep) {
  var streamUrl = s.proxy_url || s.url || '';
  if (!streamUrl) return null;

  var quality = 'Auto';
  if (s.resolution) {
    var m = String(s.resolution).match(/(\d+)/);
    quality = m ? m[1] + 'p' : String(s.resolution);
  }

  // --- Fixed Language Detection ---
  var rawName = s.name || '';
  var lang = 'Original/EN'; // Default
  
  if (rawName.toLowerCase().includes('hindi')) {
    lang = 'Hindi';
  } else if (rawName.match(/\(([^)]+)\)/)) {
    lang = rawName.match(/\(([^)]+)\)/)[1];
  }

  var streamName = '📺 MovieBox | ' + quality + ' | ' + lang;
  var titleBase = (s.title || 'MovieBox').split(' S0')[0].split(' S1')[0].trim();
  var epTag = (isTv && se != null && ep != null) ? ' · S' + String(se).padStart(2, '0') + 'E' + String(ep).padStart(2, '0') : '';

  var lines = [
    titleBase + epTag,
    '📺 ' + quality + '  🔊 ' + lang + (s.codec ? '  🎞 ' + s.codec : ''),
    (s.size_mb ? '💾 ' + s.size_mb + ' MB' : '') + (s.duration_s ? '  ⏱ ' + Math.round(s.duration_s / 60) + 'min' : ''),
    "by Sanchit · Murph's Streams"
  ];

  return {
    name: streamName,
    title: lines.filter(Boolean).join('\n'),
    url: streamUrl,
    quality: quality,
    behaviorHints: { bingeGroup: 'moviebox', notWebReady: false },
    subtitles: []
  };
}

// --- Main Export ---
function getStreams(tmdbId, type, season, episode) {
  var mediaType = (type === 'series') ? 'tv' : (type || 'movie');
  var isTv = mediaType === 'tv';
  var se = isTv ? (season ? parseInt(season) : 1) : null;
  var ep = isTv ? (episode ? parseInt(episode) : 1) : null;

  var cacheKey = 'mb_' + tmdbId + '_' + mediaType + '_' + se + '_' + ep;
  var cached = _cache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  return fetchFromWorker(tmdbId, mediaType, se, ep)
    .then(function (rawStreams) {
      if (!rawStreams || !rawStreams.length) return [];
      
      var streams = rawStreams
        .map(function (s) { return buildStream(s, isTv, se, ep); })
        .filter(Boolean);

      streams.sort(function (a, b) {
        var pa = parseInt((a.quality || '').match(/\d+/) || 0);
        var pb = parseInt((b.quality || '').match(/\d+/) || 0);
        return pb - pa;
      });

      if (streams.length) _cache.set(cacheKey, streams);
      return streams;
    })
    .catch(function (e) {
      console.error(TAG + ' Error: ' + e.message);
      return [];
    });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
