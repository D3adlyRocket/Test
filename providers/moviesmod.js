'use strict';

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var DATA_URL = "https://api.streamflix.app/data.json";
var CONFIG_URL = "https://api.streamflix.app/config/config-streamflixapp.json";

// Standard Fetch Helper
function fetchData(url) {
  return fetch(url, { 
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } 
  })
  .then(function(res) { return res.json(); })
  .catch(function(err) { 
    console.log('[StreamFlix] Fetch Error: ' + err.message);
    return null; 
  });
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  var isTV = (mediaType === 'tv' || mediaType === 'series');
  var tmdbUrl = 'https://api.themoviedb.org/3/' + (isTV ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

  return fetchData(tmdbUrl).then(function(tmdbData) {
    if (!tmdbData) return [];
    
    var searchTitle = (isTV ? tmdbData.name : tmdbData.title).toLowerCase();

    return fetchData(CONFIG_URL).then(function(config) {
      return fetchData(DATA_URL).then(function(remote) {
        if (!remote || !remote.data) return [];
        
        var match = null;
        var list = remote.data;
        
        // Improved Search Logic
        for (var i = 0; i < list.length; i++) {
          if (list[i].moviename) {
            var entryName = list[i].moviename.toLowerCase();
            if (entryName === searchTitle || entryName.indexOf(searchTitle) !== -1 || searchTitle.indexOf(entryName) !== -1) {
              match = list[i];
              break;
            }
          }
        }

        if (!match) return [];
        var streams = [];
        var hosts = (config && config.premium) ? config.premium : ["https://stream.streamflix.app/"];

        // MOVIE HANDLING
        if (!isTV && match.movielink) {
          for (var j = 0; j < hosts.length; j++) {
            streams.push({
              name: "StreamFlix | Movie",
              title: match.moviename + " [1080p]",
              url: hosts[j] + match.movielink,
              quality: "1080p",
              behaviorHints: { notWebReady: false }
            });
          }
          return streams;
        }

        // TV HANDLING (Bypassing WebSocket for stability)
        if (isTV && seasonNum && episodeNum) {
          // Construct direct Firebase JSON URL
          var fbUrl = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + 
                      match.moviekey + "/seasons/" + seasonNum + "/episodes.json";
          
          return fetchData(fbUrl).then(function(episodes) {
            if (!episodes) return [];
            
            // Firebase can return an object or an array
            var epKey = (episodeNum - 1);
            var ep = episodes[epKey] || null;
            
            // If the array index didn't work, try finding by key
            if (!ep) {
                for (var key in episodes) {
                    if (parseInt(key) === epKey) { ep = episodes[key]; break; }
                }
            }

            if (ep && ep.link) {
              for (var k = 0; k < hosts.length; k++) {
                streams.push({
                  name: "StreamFlix | TV",
                  title: "S" + seasonNum + "E" + episodeNum + " - " + (ep.name || match.moviename),
                  url: hosts[k] + ep.link,
                  quality: "1080p",
                  behaviorHints: { notWebReady: false }
                });
              }
            }
            return streams;
          });
        }
        return streams;
      });
    });
  }).catch(function(err) {
    console.log('[StreamFlix] Fatal Error: ' + err.message);
    return [];
  });
}

// Export Logic
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
