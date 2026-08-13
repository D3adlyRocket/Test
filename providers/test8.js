// ================================================================
// AnimeWorld India — Android TV Optimized
// ================================================================

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305'
var BASE     = 'https://watchanimeworld.top'
var PLAYER   = 'https://play.zephyrix.top'
var UA       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/* ----------------------------------------------------------------------------
 * HELPER & FORMATTING FUNCTIONS
 * ---------------------------------------------------------------------------- */

function getInvertedSortTag(val, maxBaseline) {
  if (!maxBaseline) maxBaseline = 999999;
  var safeVal = Math.max(0, parseInt(val, 10) || 0);
  var inverted = Math.max(0, maxBaseline - safeVal);
  var binaryStr = inverted.toString(2);
  while (binaryStr.length < 20) { binaryStr = '0' + binaryStr; }
  return binaryStr.split('').map(function(bit) {
    return bit === '1' ? '\uFEFF' : '\u200B';
  }).join('');
}

function qualityRank(qualityStr) {
  if (/2160p|4k/i.test(qualityStr)) return 4;
  if (/1080p/i.test(qualityStr)) return 3;
  if (/720p/i.test(qualityStr)) return 2;
  if (/480p/i.test(qualityStr)) return 1;
  return 0;
}

function httpGet(url, headers) {
  return fetch(url, {
    headers: Object.assign({ 'User-Agent': UA }, headers || {})
  }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return r.text()
  })
}

function httpPost(url, body, headers) {
  return fetch(url, {
    method: 'POST',
    headers: Object.assign({
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded'
    }, headers || {}),
    body: body
  }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return r.json()
  })
}

/* ----------------------------------------------------------------------------
 * SCRAPING FUNCTIONS
 * ---------------------------------------------------------------------------- */

function searchSite(title, mediaType) {
  var url = BASE + '/?s=' + encodeURIComponent(title)
  return httpGet(url, { 'Referer': BASE + '/' })
    .then(function(html) {
      var results = []
      var re = /href="(https:\/\/watchanimeworld\.top\/(series|movies)\/([^\/\"]+)\/)"/g
      var m
      while ((m = re.exec(html)) !== null) {
        var link = m[1], type = m[2], slug = m[3]
        if (slug && slug !== 'page') {
          results.push({ url: link, type: type, slug: slug })
        }
      }
      return results.filter(function(r) {
        return mediaType === 'movie' ? r.type === 'movies' : r.type === 'series'
      })
    })
}

function getEpisodeUrl(seriesUrl, season, episode) {
  return httpGet(seriesUrl, { 'Referer': BASE + '/' })
    .then(function(html) {
      var pidM = html.match(/postid-(\d+)/) || html.match(/data-post="(\d+)"/)
      if (!pidM) return null
      var ajaxUrl = BASE + '/wp-admin/admin-ajax.php?action=action_select_season&season=' + season + '&post=' + pidM[1]
      
      return httpGet(ajaxUrl, { 'Referer': seriesUrl })
        .then(function(epHtml) {
          var suffix = season + 'x' + episode + '/'
          var re = /href="(https:\/\/watchanimeworld\.top\/episode\/([^"]+))"/g
          var m
          while ((m = re.exec(epHtml)) !== null) {
            if (m[1].indexOf(suffix) !== -1) return m[1]
          }
          return null
        })
    })
}

function getStreamFromPage(pageUrl) {
  return httpGet(pageUrl, { 'Referer': BASE + '/' })
    .then(function(html) {
      var iframeM = html.match(/(?:src|data-src)="(https:\/\/play\.zephyrix\.top\/video\/([a-f0-9]+))"/)
      if (!iframeM) return null
      
      var videoHash = iframeM[2]
      return httpPost(
        PLAYER + '/player/index.php?data=' + videoHash + '&do=getVideo',
        'hash=' + videoHash + '&r=' + encodeURIComponent(BASE + '/'),
        {
          'Referer': BASE + '/',
          'Origin': PLAYER,
          'X-Requested-With': 'XMLHttpRequest'
        }
      ).then(function(data) {
        var m3u8 = data.videoSource || data.securedLink
        if (!m3u8) return null
        
        var contentHashM = m3u8.match(/\/cdn\/hls\/([a-f0-9]+)\//)
        var contentHash  = contentHashM ? contentHashM[1] : videoHash
        var subtitleUrl = PLAYER + '/cdn/down/' + contentHash + '/Subtitle/subtitle_eng.srt'

        return { url: m3u8, subtitle: subtitleUrl }
      })
    })
}

/* ----------------------------------------------------------------------------
 * MAIN ENTRY POINT
 * ---------------------------------------------------------------------------- */

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function(resolve) {
    var tmdbUrl = 'https://api.themoviedb.org/3/' + (mediaType === 'movie' ? 'movie' : 'tv') + '/' + tmdbId + '?api_key=' + TMDB_KEY
    var metaInfo = { title: 'Unknown', year: null, episodeTitle: '' }
    
    fetch(tmdbUrl)
      .then(function(r) { return r.json() })
      .then(function(data) {
        var title = data.title || data.name
        if (!title) throw new Error('No title')
        var releaseDate = data.release_date || data.first_air_date || ''
        var year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null

        metaInfo.title = title
        metaInfo.year = year

        if (mediaType === 'tv' && season) {
          var seasonUrl = 'https://api.themoviedb.org/3/tv/' + tmdbId + '/season/' + season + '?api_key=' + TMDB_KEY
          return fetch(seasonUrl)
            .then(function(sr) { return sr.json() })
            .then(function(sData) {
              if (sData && sData.episodes) {
                var epNum = parseInt(episode) || 1
                for (var i = 0; i < sData.episodes.length; i++) {
                  if (sData.episodes[i].episode_number === epNum) {
                    metaInfo.episodeTitle = sData.episodes[i].name || ''
                    break
                  }
                }
              }
              return searchSite(title, mediaType)
            })
            .catch(function() {
              return searchSite(title, mediaType)
            })
        }

        return searchSite(title, mediaType)
      })
      .then(function(results) {
        if (!results || results.length === 0) { resolve([]); return null }
        var target = results[0].url
        
        if (mediaType === 'movie') return getStreamFromPage(target)
        return getEpisodeUrl(target, season, episode).then(function(epUrl) {
          return epUrl ? getStreamFromPage(epUrl) : null
        })
      })
      .then(function(streamData) {
        if (!streamData) { resolve([]); return }

        var qualityStr = '1080p'
        var qRank = qualityRank(qualityStr)

        /* --- ZERO-WIDTH SORTING & HEADER --- */
        var sortTag = getInvertedSortTag(qRank * 100000, 999999)
        var headerLayout = sortTag + 'AnimeWorld • ' + qualityStr + ' • Multi-Audio'

        /* --- FULL SUBHEADING LAYOUT LINES --- */
        var line1 = '🗡️ ' + metaInfo.title + (metaInfo.year ? ' (' + metaInfo.year + ')' : '')
        
        var line2 = null
        if (mediaType === 'tv' && season && episode) {
          line2 = '📋 S' + season + ' E' + episode + (metaInfo.episodeTitle ? ' - ' + metaInfo.episodeTitle : '')
        }

        var line3 = '🔥 1080p | 🗣️ Multi-Audio | 🎧 AAC'
        var line4 = '🎞️ M3U8 | ⚡ H.264 | 🎥 HLS'
        var line5 = '🔗 AnimeWorld | 🌐 Zephyrix CDN'

        var fullLayout = [line1, line2, line3, line4, line5].filter(Boolean).join('\n')

        resolve([{
          name: headerLayout,
          title: fullLayout,
          size: fullLayout,           // CRITICAL FOR NUVIO MOBILE
          description: fullLayout,    // CRITICAL FOR NUVIO MOBILE
          url: streamData.url,
          headers: {
            'Referer': PLAYER + '/',
            'Origin': PLAYER,
            'User-Agent': UA,
            'Connection': 'keep-alive'
          },
          subtitles: streamData.subtitle 
            ? [{ url: streamData.subtitle, lang: 'en', name: 'English' }] 
            : []
        }])
      })
      .catch(function() {
        resolve([])
      })
  })
}

module.exports = { getStreams }
