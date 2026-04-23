'use strict';

var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var DATA_URL = "https://api.streamflix.app/data.json";
var CONFIG_URL = "https://api.streamflix.app/config/config-streamflixapp.json";
var HM_WORKER = 'https://hindmoviez.s4nch1tt.workers.dev'; // Using your working worker

function hmProxyUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  return HM_WORKER + '/hm/proxy?url=' + encodeURIComponent(rawUrl);
}

function fetchJson(url) {
  // We proxy the JSON fetch too, because TV IPs are often flagged
  return fetch(hmProxyUrl(url), { 
    headers: { 'User-Agent': 'Mozilla/5.0' } 
  })
  .then(function(res) { return res.json(); })
  .catch(function() { return null; });
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  var isTV = (mediaType === 'tv' || mediaType === 'series');
  var tmdbUrl = 'https://api.themoviedb.org/3/' + (isTV ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

  return fetchJson(tmdbUrl).then(function(tmdbData) {
    if (!tmdbData) return [];
    
    // Clean Title (removes special chars that break search)
    var targetTitle = (isTV ? tmdbData.name : tmdbData.title).toLowerCase().replace(/[^a-z0-9\s]/g, '');

    return fetchJson(CONFIG_URL).then(function(config) {
      return fetchJson(DATA_URL).then(function(remoteData) {
        if (!remoteData || !remoteData.data) return [];
        
        var match = null;
        var list = remoteData.data;
        
        // Robust Search
        for (var i = 0; i < list.length; i++) {
          if (list[i].moviename) {
            var entryName = list[i].moviename.toLowerCase().replace(/[^a-z0-9\s]/g, '');
            if (entryName === targetTitle || entryName.indexOf(targetTitle) !== -1) {
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
              title: match.moviename + "\n1080p Premium",
              url: hmProxyUrl(hosts[j] + match.movielink), // Proxing the video link
              quality: "1080p"
            });
          }
        }

        // TV 
        // Note: Without WebSocket, we use the fallback link which is most reliable on TV
        if (isTV && seasonNum && episodeNum) {
          var epIndex = episodeNum - 1; 
          for (var k = 0; k < hosts.length; k++) {
            // Updated Fallback path
            var directUrl = hosts[k] + "tv/" + match.moviekey + "/s" + seasonNum + "/episode" + epIndex + ".mkv";
            streams.push({
              name: "StreamFlix | S" + seasonNum + " E" + episodeNum,
              title: match.moviename + " - Episode " + episodeNum,
              url: hmProxyUrl(directUrl), // Proxing the video link
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
