// StreamM4U Provider for Nuvio
// Optimized for streamm4u.com.co and ppzj-youtube CDN

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305'
var BASE = 'https://streamm4u.com.co'
var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36'

function httpGet(url, headers) {
  return fetch(url, {
    headers: Object.assign({ 
        'User-Agent': UA,
        'Referer': BASE + '/' 
    }, headers || {})
  }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return r.text()
  })
}

function searchSite(title) {
  var url = BASE + '/search/' + encodeURIComponent(title).replace(/%20/g, '+')
  return httpGet(url).then(function(html) {
    var results = []
    var movieRegex = /<div class="movie-box">[\s\S]*?href="([^"]+)" title="([^"]+)"/g
    var match
    while ((match = movieRegex.exec(html)) !== null) {
      var itemTitle = match[2]
      var yearMatch = itemTitle.match(/\d{4}/)
      results.push({ 
          url: match[1], 
          title: itemTitle, 
          year: yearMatch ? parseInt(yearMatch[0]) : null 
      })
    }
    return results
  })
}

function extractFinalStream(movieUrl) {
  return httpGet(movieUrl).then(function(html) {
    // 1. Try to find the encoded source URL (mu=) inside scripts or player params
    // This targets the data found in your 'Link 2'
    var muMatch = html.match(/mu=(https%3A%2F%2F[^&"']+)/)
    if (muMatch) {
      return decodeURIComponent(muMatch[1])
    }

    // 2. Fallback: Look for the iframe that loads the ppzj player
    var iframeMatch = html.match(/<iframe[\s\S]*?src="([^"]+)"/i)
    if (iframeMatch) {
      var embedUrl = iframeMatch[1]
      if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl
      
      // We must fetch the embed page to find the real .m3u8 hidden inside
      return httpGet(embedUrl, { 'Referer': movieUrl }).then(function(embedHtml) {
        var hlsMatch = embedHtml.match(/file\s*:\s*["'](http[^"']+\.m3u8[^"']*)["']/)
        return hlsMatch ? hlsMatch[1] : null
      })
    }
    return null
  })
}

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function(resolve) {
    var tmdbUrl = mediaType === 'movie'
      ? 'https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + TMDB_KEY
      : 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + TMDB_KEY

    fetch(tmdbUrl)
      .then(function(r) { return r.json() })
      .then(function(data) {
        var title = data.title || data.name
        var releaseDate = data.release_date || data.first_air_date || ''
        var year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null
        
        console.log('[StreamM4U] Searching: ' + title)
        return searchSite(title).then(function(results) {
          var candidate = results.find(function(r) {
            return !year || (r.year && Math.abs(r.year - year) <= 1)
          }) || results[0]
          
          if (!candidate) throw new Error('Not found on site')
          return extractFinalStream(candidate.url)
        })
      })
      .then(function(streamUrl) {
        if (!streamUrl) { resolve([]); return }

        console.log('[StreamM4U] Stream Found!')
        resolve([{
          name: '🚀 StreamM4U',
          title: 'HD Multi-Server',
          url: streamUrl,
          quality: '1080p',
          headers: {
            'User-Agent': UA,
            'Referer': BASE + '/',
            'Origin': 'https://if9.ppzj-youtube.cfd', // CRITICAL: From your Link 1
            'Accept': '*/*',
            'Connection': 'keep-alive'
          }
        }])
      })
      .catch(function(err) {
        console.error('[StreamM4U] Error: ' + err.message)
        resolve([])
      })
  })
}

module.exports = { getStreams }
