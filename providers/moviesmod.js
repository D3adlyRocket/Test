'use strict';

/**
 * StreamFlix — Android TV Optimized
 * Features: ES5 Syntax, Native WebSocket, Memory-efficient caching
 */

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var STREAMFLIX_API_BASE = "https://api.streamflix.app";
var CONFIG_URL = STREAMFLIX_API_BASE + "/config/config-streamflixapp.json";
var DATA_URL = STREAMFLIX_API_BASE + "/data.json";

// Global cache (using var for TV compatibility)
var _cache = {
  config: null,
  data: null,
  lastFetched: 0
};

var DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

// --- Core API Helpers ---

function fetchJson(url) {
  return fetch(url, { headers: DEFAULT_HEADERS })
    .then(function(res) { return res.json(); })
    .catch(function(err) { 
      console.log('[StreamFlix] Fetch Error: ' + err.message); 
      return null; 
    });
}

function getRemoteData() {
  var now = Date.now();
  if (_cache.data && (now - _cache.lastFetched < 300000)) {
    return Promise.resolve({ config: _cache.config, data: _cache.data });
  }

  return fetchJson(CONFIG_URL).then(function(config) {
    return fetchJson(DATA_URL).then(function(data) {
      _cache.config = config;
      _cache.data = data;
      _cache.lastFetched = now;
      return { config: config, data: data };
    });
  });
}

// --- WebSocket Episode Handler (TV Compatible) ---

function getEpisodesWS(movieKey, targetSeason) {
  return new Promise(function(resolve, reject) {
    // Android TV native WebSocket check
    var WS = typeof WebSocket !== 'undefined' ? WebSocket : null;
    if (!WS) return resolve({});

    var url = "wss://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/.ws?ns=chilflix-410be-default-rtdb&v=5";
    var ws = new WS(url);
    var episodes = {};
    var timeout = setTimeout(function() { try { ws.close(); } catch(e){} resolve({}); }, 10000);

    ws.onopen = function() {
      var query = {
        t: 'd',
        d: { a: 'q', r: 1, b: { p: 'Data/' + movieKey + '/seasons/' + targetSeason + '/episodes', h: '' } }
      };
      ws.send(JSON.stringify(query));
    };

    ws.onmessage = function(event) {
      try {
        var msg = JSON.parse(event.data);
        if (msg.t === 'd' && msg.d && msg.d.b && msg.d.b.d) {
          clearTimeout(timeout);
          ws.close();
          resolve(msg.d.b.d);
        }
      } catch(e) {}
    };

    ws.onerror = function() { resolve({}); };
  });
}

// --- Main Entry Point ---

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  var type = (mediaType === 'tv' || mediaType === 'series') ? 'tv' : 'movie';
  var tmdbUrl = 'https://api.themoviedb.org/3/' + type + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

  return fetchJson(tmdbUrl).then(function(tmdbData) {
    if (!tmdbData) return [];
    
    var title = (type === 'tv' ? tmdbData.name : tmdbData.title).toLowerCase();
    
    return getRemoteData().then(function(remote) {
      if (!remote.data || !remote.data.data) return [];

      // Find Best Match
      var match = null;
      var items = remote.data.data;
      for (var i = 0; i < items.length; i++) {
        if (items[i].moviename && items[i].moviename.toLowerCase() === title) {
          match = items[i];
          break;
        }
      }

      if (!match) return [];

      // Process Movie
      if (type === 'movie') {
        var streams = [];
        var hosts = remote.config.premium || [];
        for (var j = 0; j < hosts.length; j++) {
          streams.push({
            name: "StreamFlix | Movie",
            title: match.moviename + "\nPremium Direct Server",
            url: hosts[j] + match.movielink,
            quality: "1080p",
            behaviorHints: { notWebReady: false }
          });
        }
        return streams;
      } 
      
      // Process TV
      if (type === 'tv' && seasonNum && episodeNum) {
        return getEpisodesWS(match.moviekey, seasonNum).then(function(epData) {
          var streams = [];
          var epKey = (episodeNum - 1).toString();
          var ep = epData[epKey];
          
          if (ep && ep.link) {
            var hosts = remote.config.premium || [];
            for (var k = 0; k < hosts.length; k++) {
              streams.push({
                name: "StreamFlix | S" + seasonNum + " E" + episodeNum,
                title: ep.name || match.moviename,
                url: hosts[k] + ep.link,
                quality: "1080p",
                behaviorHints: { notWebReady: false }
              });
            }
          }
          return streams;
        });
      }

      return [];
    });
  }).catch(function(err) {
    console.log('[StreamFlix] Fatal Error: ' + err.message);
    return [];
  });
}

// Export for Universal Use
if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; } 
else { global.getStreams = getStreams; }
