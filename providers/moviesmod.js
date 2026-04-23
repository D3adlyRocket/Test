'use strict';

var WORKER_BASE = 'https://moviebox.s4nch1tt.workers.dev';

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

function buildStream(s, isTv, se, ep) {
  var streamUrl = s.proxy_url || s.url || '';
  if (!streamUrl) return null;

  var quality = s.resolution ? (String(s.resolution).match(/\d+/) ? String(s.resolution).match(/\d+/)[0] + 'p' : s.resolution) : 'Auto';

  // Attempt to find English/Original
  var lang = 'Original/English';
  var langMatch = (s.name || '').match(/\(([^)]+)\)/);
  if (langMatch) {
    lang = langMatch[1];
  } else if ((s.name || '').toLowerCase().includes('hindi')) {
    lang = 'Hindi';
  }

  var titleBase = (s.title || 'MovieBox').split(' S0')[0].split(' S1')[0].trim();
  var epTag = (isTv && se != null && ep != null) ? ' · S' + String(se).padStart(2, '0') + 'E' + String(ep).padStart(2, '0') : '';

  return {
    name: '📺 MovieBox | ' + quality + ' | ' + lang,
    title: titleBase + epTag + '\n📺 ' + quality + '  🔊 ' + lang + (s.size_mb ? '\n💾 ' + s.size_mb + ' MB' : ''),
    url: streamUrl,
    quality: quality,
    behaviorHints: { bingeGroup: 'moviebox' }
  };
}

function getStreams(tmdbId, type, season, episode) {
  var mediaType = (type === 'series') ? 'tv' : 'movie';
  var se = season ? parseInt(season) : 1;
  var ep = episode ? parseInt(episode) : 1;
  var url = WORKER_BASE + '/streams?tmdb_id=' + tmdbId + '&type=' + mediaType + '&proxy=' + encodeURIComponent(WORKER_BASE);
  if (mediaType === 'tv') url += '&se=' + se + '&ep=' + ep;

  return fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var results = Array.isArray(data) ? data : (data.streams || []);
      return results.map(function(s) { return buildStream(s, mediaType === 'tv', se, ep); }).filter(Boolean);
    })
    .catch(function() { return []; });
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { getStreams: getStreams }; } 
else { global.getStreams = getStreams; }
