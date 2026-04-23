/**
 * Movies4u - Rebuilt in AnimeWorld India Style
 * Optimized for Nuvio Android TV
 */

var TMDB_KEY = '1b3113663c9004682ed61086cf967c44'
var BASE     = 'https://new1.movies4u.style'
var M4U_PLAY = 'https://m4uplay.store'
var UA       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

function httpGet(url, headers) {
  return fetch(url, {
    headers: Object.assign({ 
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    }, headers || {})
  }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return r.text()
  })
}

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function(resolve) {
    var type = (mediaType === 'movie' || mediaType === 'movies') ? 'movie' : 'tv'
    var tmdbUrl = 'https://api.themoviedb.org/3/' + type + '/' + tmdbId + '?api_key=' + TMDB_KEY
    
    fetch(tmdbUrl)
      .then(function(r) { return r.json() })
      .then(function(data) {
        var title = data.title || data.name
        var searchUrl = BASE + '/?s=' + encodeURIComponent(title)
        return httpGet(searchUrl, { 'Referer': BASE + '/' })
      })
      .then(function(html) {
        // Find post URL - Regex needs to be extremely simple for TV
        var postRe = /href="(https:\/\/new1\.movies4u\.style\/[^"]+)"/
        var m = postRe.exec(html)
        if (!m) return null
        return httpGet(m[1], { 'Referer': BASE + '/' })
      })
      .then(function(pageHtml) {
        if (!pageHtml) return null
        
        // Find M4UPlay link
        var embedRe = /href="(https:\/\/m4uplay\.[^"]+)"/
        var m = embedRe.exec(pageHtml)
        if (!m) return null
        
        return httpGet(m[1], { 'Referer': BASE + '/' })
      })
      .then(function(embedHtml) {
        if (!embedHtml) { resolve([]); return }

        // Look for the source. M4UPlay usually uses a simple 'file:' or a direct .m3u8 link
        var streamRe = /(https?:\/\/[^"']+\.(?:m3u8|txt)(?:\?[^"']*)?)/
        var m = streamRe.exec(embedHtml)
        
        if (m) {
          var finalUrl = m[1]
          
          resolve([{
            name: '🎬 Movies4u',
            title: 'Movies4u (Instant) • 1080p',
            url: finalUrl,
            quality: '1080p',
            headers: {
              'Referer': M4U_PLAY + '/',
              'Origin': M4U_PLAY,
              'User-Agent': UA,
              'Connection': 'keep-alive'
            }
          }])
        } else {
          resolve([])
        }
      })
      .catch(function() {
        resolve([])
      })
  })
}

module.exports = { getStreams: getStreams }
