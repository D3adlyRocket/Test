'use strict';

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var DATA_URL = "https://api.streamflix.app/data.json";
var CONFIG_URL = "https://api.streamflix.app/config/config-streamflixapp.json";

/**
 * TV-Optimized Fetch
 * Added mode/credentials for older Android WebViews
 */
function fetchData(url) {
  return fetch(url, { 
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    headers: { 
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; TV) AppleWebKit/537.36' 
    } 
  })
  .then(function(res) { 
    if (!res.ok) return null;
    return res.json(); 
  })
  .catch(function(err) { 
    return null; 
  });
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  var isTV = (mediaType === 'tv' || mediaType === 'series');
  var tmdbUrl = 'https://api.themoviedb.org/3/' + (isTV ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

  return fetchData(tmdbUrl).then(function(tmdbData) {
    if (!tmdbData) return [];
    
    // TMDB titles can be complex; we simplify for the TV search
    var searchTitle = (isTV ? tmdbData.name : tmdbData.title).toLowerCase().trim();

    return fetchData(CONFIG_URL).then(function(config) {
      return fetchData(DATA_URL).then(function(remote) {
        if (!remote || !remote.data) return [];
        
        var match = null;
        var list = remote.data;
        
        // Simplified search for low-power TV processors
        for (var i = 0; i < list.length; i++) {
          var entry = list[i];
          if (entry.moviename) {
            var name = entry.moviename.toLowerCase();
            if (name === searchTitle || name.indexOf(searchTitle) !== -1) {
              match = entry;
              break;
            }
          }
        }

        if (!match) return [];
        var streams = [];
        var hosts = (config && config.premium) ? config.premium : ["https://stream.streamflix.app/"];

        // MOVIE
        if (!isTV && match.movielink) {
          for (var j = 0; j < hosts.length; j++) {
            streams.push({
              name: "StreamFlix 🎬",
              title: match.moviename + " [1080p]",
              url: hosts[j] + match.movielink,
              quality: "1080p"
            });
          }
          return streams;
        }

        // TV (Using the .json endpoint for Max Compatibility)
        if (isTV && seasonNum && episodeNum) {
          var fbUrl = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + 
                      match.moviekey + "/seasons/" + seasonNum + "/episodes.json";
          
          return fetchData(fbUrl).then(function(episodes) {
            if (!episodes) return [];
            
            // TV episodes can be Array or Object; this handles both
            var epIdx = (episodeNum - 1);
            var ep = episodes[epIdx] || episodes[episodeNum] || null;

            if (ep && ep.link) {
              for (var k = 0; k < hosts.length; k++) {
                streams.push({
                  name: "StreamFlix 📺",
                  title: "S" + seasonNum + "E" + episodeNum + " - " + (ep.name || match.moviename),
                  url: hosts[k] + ep.link,
                  quality: "1080p"
                });
              }
            }
            return streams;
          });
        }
        return streams;
      });
    });
  }).catch(function() {
    return [];
  });
}

// Universal Entry Points
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
