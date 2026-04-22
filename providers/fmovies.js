// ================================================================
// ZoroLost — Android TV Optimized Version
// ================================================================

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305'
var BASE     = 'https://watchanimeworld.net'
var PLAYER   = 'https://play.zephyrflick.top'

// Optimized UA: Using a generic Chrome Windows UA is safer than Android TV UAs 
// to avoid being served "Mobile-only" low bitrate streams or bot detection.
var UA       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ── Timeout helper ────────────────────────────────────────────────
function withTimeout(promise, ms) {
  var killer = new Promise(function(_, reject) {
    setTimeout(function() {
      reject(new Error('[ZoroLost] Timed out after ' + ms + 'ms'))
    }, ms)
  })
  return Promise.race([promise, killer])
}

// ── HTTP helpers ──────────────────────────────────────────────────
function httpGet(url, extra) {
  return fetch(url, {
    headers: Object.assign({ 'User-Agent': UA }, extra || {})
  }).then(function(r) {
    if (!r.ok) throw new Error('GET ' + r.status + ' → ' + url)
    return r.text()
  })
}

function httpPost(url, body, extra) {
  return fetch(url, {
    method: 'POST',
    headers: Object.assign({
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded'
    }, extra || {}),
    body: body
  }).then(function(r) {
    if (!r.ok) throw new Error('POST ' + r.status + ' → ' + url)
    return r.json()
  })
}

// ── Title scoring ─────────────────────────────────────────────────
function cleanStr(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

function scoreMatch(slug, query, itemYear, year) {
  var slugTitle = slug.replace(/-/g, ' ').replace(/\d{4}$/, '').trim()
  var c = cleanStr(slugTitle), q = cleanStr(query)
  var s = 0
  if (c === q) s += 100
  else if (c.indexOf(q) === 0) s += 70
  else if (c.indexOf(q) >= 0) s += 40
  if (year && itemYear) {
    if (itemYear === year) s += 20
    else if (Math.abs(itemYear-year)<=1) s += 10
  }
  return s
}

// ── Step 1 : Search ──────────────────────────────────────────────
function searchSite(title, mediaType, year) {
  var url = BASE + '/?s=' + encodeURIComponent(title)
  return httpGet(url, { Referer: BASE + '/' })
    .then(function(html) {
      var results = []
      var re = /href="(https:\/\/watchanimeworld\.net\/(series|movies)\/([^\/\"]+)\/)"/g
      var m
      while ((m = re.exec(html)) !== null) {
        var link = m[1], type = m[2], slug = m[3]
        if (!slug || slug === 'page') continue
        var ym = slug.match(/-(\d{4})$/)
        results.push({ url: link, type: type, slug: slug, year: ym ? parseInt(ym[1]) : null })
      }
      var typed = results.filter(function(r) { 
        return mediaType === 'movie' ? r.type === 'movies' : r.type === 'series' 
      })
      typed.sort(function(a, b) { return scoreMatch(b.slug, title, b.year, year) - scoreMatch(a.slug, title, a.year, year) })
      return typed
    })
}

// ── Step 2 : Episode logic ──────────────────────────────────────
function getEpisodeUrl(seriesUrl, season, episode) {
  return httpGet(seriesUrl, { Referer: BASE + '/' })
    .then(function(html) {
      var pidM = html.match(/postid-(\d+)/) || html.match(/data-post="(\d+)"/)
      if (!pidM) return null
      var ajaxUrl = BASE + '/wp-admin/admin-ajax.php?action=action_select_season&season=' + season + '&post=' + pidM[1]
      return httpGet(ajaxUrl, { Referer: seriesUrl }).then(function(epHtml) {
        var suffix = season + 'x' + episode + '/'
        var re = /href="(https:\/\/watchanimeworld\.net\/episode\/([^"]+))"/g
        var m
        while ((m = re.exec(epHtml)) !== null) {
          if (m[1].slice(-suffix.length) === suffix) return m[1]
        }
        return null
      })
    })
}

// ── Step 3 : Stream Extraction ──────────────────────────────────
function getStreamFromPage(pageUrl) {
  return httpGet(pageUrl, { Referer: BASE + '/' })
    .then(function(html) {
      var iframeM = html.match(/(?:src|data-src)="(https:\/\/play\.zephyrflick\.top\/video\/([a-f0-9]+))"/)
      if (!iframeM) return null
      var videoHash = iframeM[2]

      return httpPost(
        PLAYER + '/player/index.php?data=' + videoHash + '&do=getVideo',
        'hash=' + videoHash + '&r=' + encodeURIComponent(BASE + '/'),
        { Referer: PLAYER + '/', Origin: PLAYER, 'X-Requested-With': 'XMLHttpRequest' }
      ).then(function(data) {
        var m3u8 = data.videoSource || data.securedLink
        if (!m3u8) return null
        
        var contentHashM = m3u8.match(/\/cdn\/hls\/([a-f0-9]+)\//)
        var contentHash  = contentHashM ? contentHashM[1] : videoHash
        var subCdn = PLAYER
        if (data.videoImage && data.videoImage.match(/^(https:\/\/[^\/]+)/)) subCdn = data.videoImage.match(/^(https:\/\/[^\/]+)/)[1]

        return {
          m3u8: m3u8,
          subtitleUrl: subCdn + '/cdn/down/' + contentHash + '/Subtitle/subtitle_eng.srt'
        }
      })
    })
}

// ── Main Export ──────────────────────────────────────────────────
function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function(resolve) {
    var chain = fetch('https://api.themoviedb.org/3/' + (mediaType === 'movie' ? 'movie' : 'tv') + '/' + tmdbId + '?api_key=' + TMDB_KEY)
    .then(function(r) { return r.json() })
    .then(function(meta) {
      var title = meta.title || meta.name
      var dateStr = meta.release_date || meta.first_air_date || ''
      var year = dateStr ? parseInt(dateStr.split('-')[0]) : null
      return searchSite(title, mediaType, year)
    })
    .then(function(results) {
      if (!results || results.length === 0) return resolve([])
      return (mediaType === 'movie') ? getStreamFromPage(results[0].url) : getEpisodeUrl(results[0].url, season, episode).then(function(url) { return url ? getStreamFromPage(url) : null })
    })
    .then(function(streamData) {
      if (!streamData) return resolve([])

      resolve([{
        name: '🗡️ ZoroLost [TV]',
        title: 'Multi-Audio | 1080p | Zephyrflick',
        description: 'Optimized for Android TV Playback',
        url: streamData.m3u8,
        quality: '1080p',
        behaviorHints: {
          bingeGroup: 'zorolost-tv-1080p',
          // CRITICAL FOR TV: Explicitly set headers for the system player (ExoPlayer/VLC)
          proxyHeaders: {
            request: {
              'User-Agent': UA,
              'Referer': PLAYER + '/',
              'Origin': PLAYER
            }
          },
          // Tells TV apps this is a direct video link
          notInterpreted: true 
        },
        subtitles: streamData.subtitleUrl ? [{ url: streamData.subtitleUrl, lang: 'en', name: 'English' }] : []
      }])
    })
    .catch(function() { resolve([]) })

    withTimeout(chain, 9000).catch(function() { resolve([]) })
  })
}

module.exports = { getStreams }
