'use strict';

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var DATA_URL = "https://api.streamflix.app/data.json";
var CONFIG_URL = "https://api.streamflix.app/config/config-streamflixapp.json";

// Safe JSON fetch for TV
function fetchJson(url) {
  return fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    .then(function(res) { return res.json(); })
    .catch(function() { return null; });
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  var isTV = (mediaType === 'tv' || mediaType === 'series');
  var tmdbUrl = 'https://api.themoviedb.org/3/' + (isTV ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

  return fetchJson(tmdbUrl).then(function(tmdbData) {
    if (!tmdbData) return [];
    
    var title = (isTV ? tmdbData.name : tmdbData.title).toLowerCase();

    return fetchJson(CONFIG_URL).then(function(config) {
      return fetchJson(DATA_URL).then(function(remoteData) {
        if (!remoteData || !remoteData.data) return [];
        
        var match = null;
        var list = remoteData.data;
        
        // Exact search logic
        for (var i = 0; i < list.length; i++) {
          if (list[i].moviename && list[i].moviename.toLowerCase() === title) {
            match = list[i];
            break;
          }
        }

        if (!match) return [];
        var streams = [];
        var hosts = (config && config.premium) ? config.premium : ["https://stream.streamflix.app/"];

        // MOVIE LOGIC
        if (!isTV && match.movielink) {
          for (var j = 0; j < hosts.length; j++) {
            streams.push({
              name: "StreamFlix | Movie",
              title: match.moviename,
              url: hosts[j] + match.movielink,
              quality: "1080p"
            });
          }
          return streams;
        }

        // TV LOGIC (The "Mobile-Style" direct data fetch)
        if (isTV && seasonNum && episodeNum) {
          // We fetch the series data directly to get the real episode links
          var seriesDataUrl = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/Data/" + match.moviekey + "/seasons/" + seasonNum + "/episodes.json";
          
          return fetchJson(seriesDataUrl).then(function(episodes) {
            if (!episodes) return [];
            
            // Firebase returns an array or object of episodes
            var epKey = (episodeNum - 1);
            var ep = episodes[epKey];
            
            if (ep && ep.link) {
              for (var k = 0; k < hosts.length; k++) {
                streams.push({
                  name: "StreamFlix | S" + seasonNum + "E" + episodeNum,
                  title: ep.name || match.moviename,
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
  }).catch(function() { return []; });
}

if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; } 
else { global.getStreams = getStreams; }
