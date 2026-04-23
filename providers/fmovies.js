'use strict';

var BASE_URL     = 'https://hindmovie.ltd';
var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
var PLUGIN_TAG   = '[HindMoviez]';
var HM_WORKER    = 'https://hindmoviez.s4nch1tt.workers.dev';

var DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// Helper: Ensure we have a valid URL
function hmProxyUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  return HM_WORKER + '/hm/proxy?url=' + encodeURIComponent(rawUrl);
}

// Logic: Extract Metadata from text
function getInfo(text) {
  var q = text.match(/\b(2160p|1080p|720p|480p|4K)\b/i);
  var s = text.match(/\[([0-9.]+\s*(?:MB|GB))\]/i);
  return {
    quality: q ? q[1].replace(/4K/i, '2160p') : '720p',
    size: s ? s[1] : ''
  };
}

function getStreams(tmdbId, type, season, episode) {
  var isSeries = (type === 'series' || type === 'tv');
  var tmdbUrl = 'https://api.themoviedb.org/3/' + (isSeries ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

  return fetch(tmdbUrl)
    .then(function(res) { return res.json(); })
    .then(function(details) {
      if (!details) throw new Error('TMDB Failed');
      var query = isSeries ? details.name : details.title;
      console.log(PLUGIN_TAG + ' Searching: ' + query);
      return fetch(BASE_URL + '/?s=' + encodeURIComponent(query), { headers: DEFAULT_HEADERS });
    })
    .then(function(res) { return res.text(); })
    .then(function(html) {
      // Find the first article link
      var match = html.match(/<h2 class="entry-title"><a href="([^"]+)"/i);
      if (!match) return [];
      return fetch(match[1], { headers: DEFAULT_HEADERS }).then(function(res) { return res.text(); });
    })
    .then(function(pageHtml) {
      if (!pageHtml || typeof pageHtml !== 'string') return [];
      
      var streams = [];
      var resolvePromises = [];
      // Split by H3 to get quality-specific sections
      var sections = pageHtml.split(/<h3/i);

      for (var i = 0; i < sections.length; i++) {
        var section = sections[i];
        var mvMatch = section.match(/href="(https:\/\/mvlink\.site\/[^"]+)"/i);
        
        if (mvMatch) {
          var meta = getInfo(section);
          (function(mUrl, info) {
            var p = fetch(mUrl, { headers: DEFAULT_HEADERS })
              .then(function(r) { return r.text(); })
              .then(function(mvHtml) {
                var hshare = mvHtml.match(/href="(https:\/\/hshare\.ink\/[^"]+)"/i);
                if (!hshare) return null;
                return fetch(hshare[1], { headers: DEFAULT_HEADERS }).then(function(r) { return r.text(); });
              })
              .then(function(hsHtml) {
                if (!hsHtml) return null;
                var hpage = hsHtml.match(/href="([^"]+)"[^>]*>HPage<\/a>/i);
                if (!hpage) return null;
                return fetch(hpage[1], { headers: DEFAULT_HEADERS }).then(function(r) { return r.text(); });
              })
              .then(function(hcHtml) {
                if (!hcHtml) return;
                // Find all Server Links
                var srvRe = /<a[^>]*href="([^"]+)"[^>]*>(Server\s+\d+)<\/a>/gi;
                var sMatch;
                while ((sMatch = srvRe.exec(hcHtml)) !== null) {
                  streams.push({
                    name: '🎬 HindMoviez | ' + sMatch[2] + ' | ' + info.quality,
                    title: '📺 ' + info.quality + ' | 💾 ' + info.size + '\nBy Sanchit',
                    url: hmProxyUrl(sMatch[1]),
                    quality: info.quality.toLowerCase(),
                    behaviorHints: { notWebReady: false }
                  });
                }
              })
              .catch(function(e) { console.log('Chain error'); });
            resolvePromises.push(p);
          })(mvMatch[1], meta);
        }
      }

      return Promise.all(resolvePromises).then(function() {
        console.log(PLUGIN_TAG + ' Found ' + streams.length + ' streams');
        return streams;
      });
    })
    .catch(function(err) {
      console.log(PLUGIN_TAG + ' Error: ' + err);
      return [];
    });
}

// Standard Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
