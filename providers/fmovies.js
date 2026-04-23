// ================================================================
// Embed69 — Android TV Optimized (AnimeWorld Pattern)
// ================================================================

var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";
var BASE     = "https://embed69.org";
var UA       = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function httpGet(url, headers) {
  return fetch(url, {
    headers: Object.assign({ 'User-Agent': UA }, headers || {})
  }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  });
}

function b64(str) {
  try {
    return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  } catch (e) { return null; }
}

function resolveHost(url) {
  return httpGet(url, { 'Referer': url }).then(function(html) {
    // VOE Resolver
    if (url.indexOf('voe.sx') !== -1) {
      var m = html.match(/'hls'\s*:\s*'([^']+)'/i) || html.match(/"hls"\s*:\s*"([^"]+)"/i);
      if (m) {
        var hls = m[1].indexOf('aHR0') === 0 ? b64(m[1]) : m[1];
        return { url: hls, headers: { 'Referer': url, 'User-Agent': UA } };
      }
    }
    // StreamWish Resolver
    if (url.indexOf('wish') !== -1 || url.indexOf('vix') !== -1) {
      var fm = html.match(/file\s*:\s*["']([^"']+)["']/i);
      if (fm) {
        return { url: fm[1], headers: { 'Referer': url, 'User-Agent': UA } };
      }
    }
    return null;
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function(resolve) {
    var type = (mediaType === 'series' || mediaType === 'tv') ? 'tv' : 'movie';
    var tmdbUrl = 'https://api.themoviedb.org/3/' + type + '/' + tmdbId + '/external_ids?api_key=' + TMDB_KEY;

    fetch(tmdbUrl)
      .then(function(r) { return r.json(); })
      .then(function(ids) {
        var imdbId = ids.imdb_id;
        if (!imdbId) throw new Error('No IMDB');

        var target;
        if (type === 'movie') {
          target = BASE + '/f/' + imdbId;
        } else {
          // Manual padding for Android TV (S1 E1 -> 1x01)
          var epStr = episode < 10 ? '0' + episode : episode;
          target = BASE + '/f/' + imdbId + '-' + season + 'x' + epStr;
        }
        return httpGet(target, { 'Referer': 'https://sololatino.net/' });
      })
      .then(function(html) {
        var dataM = html.match(/let\s+dataLink\s*=\s*(\[.+\]);/);
        if (!dataM) throw new Error('No Data');
        
        var dataLinks = JSON.parse(dataM[1]);
        var results = [];
        
        // We only take the first working language category to keep it fast
        // Priority: Latino (LAT) then Spanish (ESP)
        var category = null;
        for (var i = 0; i < dataLinks.length; i++) {
          if (dataLinks[i].video_language === 'LAT') { category = dataLinks[i]; break; }
        }
        if (!category && dataLinks.length > 0) category = dataLinks[0];

        if (!category || !category.sortedEmbeds) { resolve([]); return; }

        var embeds = category.sortedEmbeds;
        var firstEmbed = embeds[0]; // Try the first server (usually best)
        
        var parts = firstEmbed.link.split('.');
        if (parts.length < 2) throw new Error('Bad Link');
        
        var decoded = JSON.parse(b64(parts[1]));
        return resolveHost(decoded.link).then(function(stream) {
          if (!stream) return [];
          
          return [{
            name: '🌐 Embed69',
            title: 'Embed69 • ' + firstEmbed.servername + ' (' + category.video_language + ')',
            url: stream.url,
            quality: '1080p',
            headers: stream.headers
          }];
        });
      })
      .then(function(finalStreams) {
        resolve(finalStreams || []);
      })
      .catch(function(err) {
        console.log('Embed69 Error: ' + err.message);
        resolve([]);
      });
  });
}

module.exports = { getStreams: getStreams };
