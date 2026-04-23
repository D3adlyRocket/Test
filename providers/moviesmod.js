'use strict';

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var STREAMFLIX_API_BASE = "https://api.streamflix.app";
var CONFIG_URL = STREAMFLIX_API_BASE + "/config/config-streamflixapp.json";
var DATA_URL = STREAMFLIX_API_BASE + "/data.json";

var _cache = { config: null, data: null, last: 0 };

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
        for (var i = 0; i < list.length; i++) {
          if (list[i].moviename && list[i].moviename.toLowerCase() === title) {
            match = list[i];
            break;
          }
        }

        if (!match) return [];
        var streams = [];
        var hosts = config.premium || ["https://stream.streamflix.app/"];

        // MOVIE LOGIC
        if (!isTV) {
          for (var j = 0; j < hosts.length; j++) {
            streams.push({
              name: "StreamFlix | Movie",
              title: match.moviename + "\n1080p Premium",
              url: hosts[j] + match.movielink,
              quality: "1080p"
            });
          }
          return streams;
        }

        // TV LOGIC (Using the direct path fallback)
        // Format: {host}/tv/{moviekey}/s{season}/episode{index}.mkv
        if (isTV && seasonNum && episodeNum) {
          var epIndex = episodeNum - 1; 
          for (var k = 0; k < hosts.length; k++) {
            var directUrl = hosts[k] + "tv/" + match.moviekey + "/s" + seasonNum + "/episode" + epIndex + ".mkv";
            streams.push({
              name: "StreamFlix | S" + seasonNum + " E" + episodeNum,
              title: match.moviename + " - Episode " + episodeNum,
              url: directUrl,
              quality: "1080p"
            });
          }
        }

        return streams;
      });
    });
  }).catch(function() { return []; });
}

if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; } 
else { global.getStreams = getStreams; }
