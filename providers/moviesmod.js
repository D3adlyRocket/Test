'use strict';

/**
 * ULTRA-LEAN TV CLIENT
 * This version offloads all heavy scraping/parsing to the proxy worker.
 * It prevents the TV engine from crashing and bypasses ISP blocks.
 */

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const HM_WORKER = 'https://hindmoviez.s4nch1tt.workers.dev';

function getStreams(tmdbId, type, season, episode) {
  var endpoint = (type === 'movie') ? 'movie' : 'tv';
  var tmdbUrl = 'https://api.themoviedb.org/3/' + endpoint + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

  return fetch(tmdbUrl)
    .then(function(res) { return res.json(); })
    .then(function(details) {
      var query = details.title || details.name;
      
      // We send the query to the worker. The worker does the cheerio/node stuff 
      // on high-speed servers and sends back a clean list of streams to the TV.
      var workerUrl = HM_WORKER + '/hm/search?q=' + encodeURIComponent(query) + 
                      '&type=' + type + 
                      '&s=' + (season || '') + 
                      '&e=' + (episode || '');

      return fetch(workerUrl);
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      // Data is already formatted for Nuvio by the worker
      return data.streams || [];
    })
    .catch(function(err) {
      console.log("TV Connection Error: " + err.message);
      return [];
    });
}

if (typeof module !== 'undefined') module.exports = { getStreams: getStreams };
if (typeof self !== 'undefined') self.getStreams = getStreams;
