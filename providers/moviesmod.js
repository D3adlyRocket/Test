'use strict';

var WORKER_BASE = 'https://moviebox.s4nch1tt.workers.dev';

// --- Cache Logic ---
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
  
  // Detection Logic: Default to English unless Hindi is found
  var rawName = (s.name || '').toLowerCase();
  var lang = 'English'; 
  
  if (rawName.includes('hindi')) {
    lang = 'Hindi';
  } else if (rawName.match(/\(([^)]+)\)/)) {
    lang = (s.name || '').match(/\(([^)]+)\)/)[1];
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
  
  // Added &lang=en in case the worker supports it
  var url = WORKER_BASE + '/streams?tmdb_id=' + tmdbId + '&type=' + mediaType + '&lang=en&proxy=' + encodeURIComponent(WORKER_BASE);
  if (mediaType === 'tv') url += '&se=' + se + '&ep=' + ep;

  return fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var results = Array.isArray(data) ? data : (data.streams || []);
      
      var streams = results.map(function(s) { 
        return buildStream(s, mediaType === 'tv', se, ep); 
      }).filter(Boolean);

      // Sorting Logic: Put English/Non-Hindi at the top
      streams.sort(function(a, b) {
        var aIsHindi = a.name.toLowerCase().indexOf('hindi') !== -1;
        var bIsHindi = b.name.toLowerCase().indexOf('hindi') !== -1;
        if (aIsHindi && !bIsHindi) return 1;
        if (!aIsHindi && bIsHindi) return -1;
        return 0;
      });

      return streams;
    })
    .catch(function() { return []; });
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { getStreams: getStreams }; } 
else { global.getStreams = getStreams; }
