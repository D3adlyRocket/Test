// StreamM4U Provider for Nuvio
// Updated for streamm4u.com.co 🌐

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

function cleanTitle(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function searchSite(title) {
  // StreamM4U search endpoint
  var url = BASE + '/search/' + encodeURIComponent(title).replace(/%20/g, '+')
  return httpGet(url)
    .then(function(html) {
      var results = []
      // Matches the movie boxes in the search results
      var movieRegex = /<div class="movie-box">[\s\S]*?href="([^"]+)" title="([^"]+)"/g
      var match

      while ((match = movieRegex.exec(html)) !== null) {
        var itemUrl = match[1]
        var itemTitle = match[2]
        
        // Basic year extraction from title if present
        var yearMatch = itemTitle.match(/\d{4}/)
        var itemYear = yearMatch ? parseInt(yearMatch[0]) : null

        results.push({ 
            url: itemUrl, 
            title: itemTitle, 
            year: itemYear 
        })
      }
      return results
    })
}

function extractStream(movieUrl) {
  return httpGet(movieUrl)
    .then(function(html) {
      // StreamM4U often uses an iframe or a specific player script
      // We look for the source URL or the encoded 'mu' parameter from your Link 2
      var iframeMatch = html.match(/<iframe[\s\S]*?src="([^"]+)"/i)
      if (!iframeMatch) {
          // Fallback: look for the HLS link directly in the scripts if rendered
          var hlsMatch = html.match(/mu=(https%3A%2F%2F[^&"']+)/)
          if (hlsMatch) return decodeURIComponent(hlsMatch[1])
          return null
      }
      
      var playerUrl = iframeMatch[1]
      if (playerUrl.startsWith('//')) playerUrl = 'https:' + playerUrl
      
      return playerUrl
    })
}

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function(resolve) {
    var tmdbUrl = mediaType === 'movie'
      ? 'https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + TMDB_KEY
      : 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + TMDB_KEY

    console.log('[StreamM4U] Searching for TMDB ID: ' + tmdbId)

    fetch(tmdbUrl)
      .then(function(r) { return r.json() })
      .then(function(data) {
        var title = data.title || data.name
        var releaseDate = data.release_date || data.first_air_date || ''
        var year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null
        
        return searchSite(title).then(function(results) {
            // Filter by year if available
            var candidate = results.find(function(r) {
                return !year || (r.year && Math.abs(r.year - year) <= 1)
            }) || results[0]
            
            if (!candidate) throw new Error('No results found')
            return extractStream(candidate.url)
        })
      })
      .then(function(finalStreamUrl) {
        if (!finalStreamUrl) { resolve([]); return }

        resolve([{
          name: '🚀 StreamM4U',
          title: 'Multi-Server • 1080p',
          url: finalStreamUrl,
          quality: '1080p',
          headers: {
            'User-Agent': UA,
            'Referer': BASE + '/',
            'Origin': 'https://if9.ppzj-youtube.cfd', // As per your Link 1 data
            'Accept': '*/*'
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
