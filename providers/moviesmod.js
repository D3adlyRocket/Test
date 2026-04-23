'use strict';

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var DATA_URL = "https://api.streamflix.app/data.json";
var CONFIG_URL = "https://api.streamflix.app/config/config-streamflixapp.json";

// We only proxy the JSON data, not the video streams
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
    
    // Clean Title: "Spider-Man: No Way Home" -> "spiderman no way home"
    var title = (isTV ? tmdbData.name : tmdbData.title).toLowerCase().replace(/[^a-z0-9\s]/g, '');

    return fetchJson(CONFIG_URL).then(function(config) {
      return fetchJson(DATA_URL).then(function(remoteData) {
        if (!remoteData || !remoteData.data) return [];
        
        var match = null;
        var list = remoteData.data;
        
        // Manual search loop (Fast & TV-friendly)
        for (var i = 0; i < list.length; i++) {
          if (list[i].moviename) {
            var entryName = list[i].moviename.toLowerCase().replace(/[^a-z0-9\s]/g, '');
            // Exact match or partial match
            if (entryName === title || entryName.indexOf(title) !== -1 || title.indexOf(entryName) !== -1) {
              match = list[i];
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
              name: "StreamFlix | Movie",
              title: match.moviename + "\nPremium Direct Server",
              url: hosts[j] + match.movielink, // Direct Link (No Proxy)
              quality: "1080p",
              behaviorHints: { notWebReady: false }
            });
          }
        }

        // TV 
        if (isTV && seasonNum && episodeNum) {
          var epIndex = episodeNum - 1; 
          for (var k = 0; k < hosts.length; k++) {
            // Using the standard StreamFlix TV link format
            var directUrl = hosts[k] + "tv/" + match.moviekey + "/s" + seasonNum + "/episode" + epIndex + ".mkv";
            streams.push({
              name: "StreamFlix | TV",
              title: match.moviename + " - S" + seasonNum + "E" + episodeNum,
              url: directUrl, // Direct Link (No Proxy)
              quality: "1080p",
              behaviorHints: { notWebReady: false }
            });
          }
        }

        return streams;
      });
    });
  }).catch(function() {
    return [];
  });
}

// Universal Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
