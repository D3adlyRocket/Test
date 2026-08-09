// AnimeSalt Provider for Nuvio
// NO async/await! Only .then() chains!

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c'
var BASE = 'https://animesalt.link'
var CDN = 'https://as-cdn21.top'
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'

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

function getResolutionEmoji(res) {
  var clean = String(res || '').toLowerCase();
  if (clean.includes("2160") || clean.includes("4k") || clean.includes("uhd")) return "🌟 4K";
  if (clean.includes("1080") || clean.includes("fhd")) return "🔥 1080p";
  if (clean.includes("720") || clean.includes("hd")) return "💎 720p";
  if (clean.includes("480") || clean.includes("sd")) return "📱 480p";
  return "📺 " + (res || "1080p");
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

function cleanTitle(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/* ----------------------------------------------------------------------------
 * ANIME SALT EXTRACTION & PARSING
 * ---------------------------------------------------------------------------- */

function searchSite(title, mediaType, year) {
  var url = BASE + '/?s=' + encodeURIComponent(title)
  return httpGet(url, { 'Referer': BASE + '/' })
    .then(function(html) {
      var results = []
      var containerMatch = html.match(/id="movies-a"([\s\S]*?)(?=<footer|id="footer|class="footer)/m)
      var searchHtml = containerMatch ? containerMatch[1] : html

      var articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/g
      var articleMatch
      while ((articleMatch = articleRegex.exec(searchHtml)) !== null) {
        var articleHtml = articleMatch[1]
        var linkMatch = articleHtml.match(/href="(https:\/\/animesalt\.link\/(series|movies)\/([^\/\"]+)\/?)\"/)
        var titleMatch = articleHtml.match(/class="entry-title"[^>]*>([^<]+)</)
        var yearMatch = articleHtml.match(/class="year"[^>]*>(\d{4})</)

        if (linkMatch && titleMatch) {
          var slug = linkMatch[3]
          var type = linkMatch[2]
          var itemTitle = titleMatch[1].trim()
          var itemYear = yearMatch ? parseInt(yearMatch[1]) : null
          var exists = false
          for (var i = 0; i < results.length; i++) {
            if (results[i].slug === slug) { exists = true; break }
          }
          if (!exists && slug && slug !== 'page') {
            results.push({ url: linkMatch[1], type: type, slug: slug, title: itemTitle, year: itemYear })
          }
        }
      }

      console.log('[AnimeSalt] Raw: ' + results.length + ' for: ' + title + ' (' + year + ')')

      var filtered = results
      if (mediaType === 'movie') {
        var movies = results.filter(function(r) { return r.type === 'movies' })
        if (movies.length > 0) filtered = movies
      } else {
        var series = results.filter(function(r) { return r.type === 'series' })
        if (series.length > 0) filtered = series
      }

      var withYear = []
      var withoutYear = []
      if (year) {
        withYear = filtered.filter(function(r) {
          return r.year && Math.abs(r.year - year) <= 1
        })
        withoutYear = filtered.filter(function(r) { return !r.year })
      }

      var candidates = withYear.length > 0 ? withYear : (year ? withoutYear : filtered)
      if (candidates.length === 0) candidates = filtered

      var cleanSearch = cleanTitle(title)
      candidates.sort(function(a, b) {
        var cleanA = cleanTitle(a.title)
        var cleanB = cleanTitle(b.title)
        var exactA = cleanA === cleanSearch ? 0 : 1
        var exactB = cleanB === cleanSearch ? 0 : 1
        if (exactA !== exactB) return exactA - exactB
        var startsA = cleanA.indexOf(cleanSearch) === 0 ? 0 : 1
        var startsB = cleanB.indexOf(cleanSearch) === 0 ? 0 : 1
        if (startsA !== startsB) return startsA - startsB
        return cleanA.length - cleanB.length
      })

      if (candidates.length > 0) {
        console.log('[AnimeSalt] Best: ' + candidates[0].title + ' (' + candidates[0].year + ')')
      }
      return candidates
    })
}

function getEpisodeUrl(seriesUrl, season, episode) {
  return httpGet(seriesUrl, { 'Referer': BASE + '/' })
    .then(function(html) {
      var seasons = []
      var seasonRegex = /data-post="(\d+)"\s+data-season="(\d+)"/g
      var m
      while ((m = seasonRegex.exec(html)) !== null) {
        seasons.push({ post: m[1], season: parseInt(m[2]) })
      }
      if (seasons.length === 0) {
        return getEpisodeUrlFromHtml(html, season, episode)
      }
      var target = null
      for (var i = 0; i < seasons.length; i++) {
        if (seasons[i].season === parseInt(season)) { target = seasons[i]; break }
      }
      if (!target) return null
      var ajaxUrl = BASE + '/wp-admin/admin-ajax.php?action=action_select_season&season=' + season + '&post=' + target.post
      return httpGet(ajaxUrl, { 'Referer': seriesUrl })
        .then(function(epHtml) {
          return getEpisodeUrlFromHtml(epHtml, season, episode)
        })
    })
}

function getEpisodeUrlFromHtml(html, season, episode) {
  var epRegex = new RegExp('href="(https://animesalt\\.link/episode/[^"]*' + season + 'x' + episode + '[^"]*)"')
  var epMatch = html.match(epRegex)
  if (epMatch) return epMatch[1]
  return null
}

function getStreamFromPage(pageUrl) {
  return httpGet(pageUrl, { 'Referer': BASE + '/' })
    .then(function(html) {
      var iframeMatch = html.match(/src="(https:\/\/as-cdn\d+\.top\/video\/([a-f0-9]+))"/)
      if (!iframeMatch) {
        console.log('[AnimeSalt] No player on: ' + pageUrl)
        return null
      }
      var playerUrl = iframeMatch[1]
      var hash = iframeMatch[2]
      var playerCdn = playerUrl.split('/video/')[0]
      console.log('[AnimeSalt] Hash: ' + hash)
      return httpPost(
        playerCdn + '/player/index.php?data=' + hash + '&do=getVideo',
        'hash=' + hash + '&r=' + encodeURIComponent(BASE + '/'),
        {
          'Referer': BASE + '/',
          'Origin': playerCdn,
          'X-Requested-With': 'XMLHttpRequest'
        }
      ).then(function(data) {
        var m3u8 = data.videoSource || data.securedLink
        if (!m3u8) return null
        var contentHashMatch = m3u8.match(/\/hls\/([a-f0-9]+)\//)
        var contentHash = contentHashMatch ? contentHashMatch[1] : hash
        var cdnBase = m3u8.split('/cdn/hls/')[0]
        var subtitle = cdnBase + '/cdn/down/' + contentHash + '/Subtitle/subtitle_eng.srt'
        console.log('[AnimeSalt] Stream found!')
        return { url: m3u8, subtitle: subtitle, cdnBase: cdnBase }
      })
    })
}

/* ----------------------------------------------------------------------------
 * MAIN ENTRY POINT
 * ---------------------------------------------------------------------------- */

function getStreams(tmdbId, mediaType, season, episode) {
  return new Promise(function(resolve) {
    var tmdbUrl = mediaType === 'movie'
      ? 'https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + TMDB_KEY
      : 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + TMDB_KEY

    console.log('[AnimeSalt] Start: ' + tmdbId + ' ' + mediaType + ' S' + season + 'E' + episode)

    var metaInfo = { title: 'Unknown', year: null }

    fetch(tmdbUrl)
      .then(function(r) { return r.json() })
      .then(function(data) {
        var title = data.title || data.name
        if (!title) throw new Error('No title')
        var releaseDate = data.release_date || data.first_air_date || ''
        var year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null
        
        metaInfo.title = title
        metaInfo.year = year
        
        console.log('[AnimeSalt] Title: ' + title + ' Year: ' + year)
        return searchSite(title, mediaType, year)
      })
      .then(function(results) {
        if (!results || results.length === 0) { resolve([]); return null }
        var result = results[0]
        console.log('[AnimeSalt] Using: ' + result.url)
        if (mediaType === 'movie') return getStreamFromPage(result.url)
        return getEpisodeUrl(result.url, season, episode)
          .then(function(epUrl) {
            if (!epUrl) return null
            return getStreamFromPage(epUrl)
          })
      })
      .then(function(streamData) {
        if (!streamData) { resolve([]); return }
        var cdnDomain = streamData.cdnBase || CDN
        var qualityStr = '1080p'
        var qEmoji = getResolutionEmoji(qualityStr)
        var qRank = qualityRank(qualityStr)

        /* --- ZERO-WIDTH SORTING & HEADER --- */
        var sortTag = getInvertedSortTag(qRank * 100000, 999999)
        var headerLayout = sortTag + 'AnimeSalt • ' + qualityStr + ' • Multi-Audio'

        /* --- FULL SUBHEADING LAYOUT LINES --- */
        var line1 = '🧂 ' + metaInfo.title + (metaInfo.year ? ' (' + metaInfo.year + ')' : '')
        var line2 = (mediaType === 'tv' && season && episode) ? '📋 S' + season + ' E' + episode : null
        var line3 = qEmoji + ' | 🗣️ Multi-Audio'
        var line4 = '🎞️ HLS | ⚡ H.264 | 🎧 AAC'
        var line5 = '🔗 AnimeSalt | 🌐 Direct CDN | 📥 WEB-DL'

        var fullLayout = [line1, line2, line3, line4, line5].filter(Boolean).join('\n')

        resolve([{
          name: headerLayout,
          title: fullLayout,
          size: fullLayout,           // CRITICAL FOR NUVIO MOBILE
          description: fullLayout,    // CRITICAL FOR NUVIO MOBILE
          url: streamData.url,
          quality: qualityStr,
          behaviorHints: {
            notWebReady: true,
            proxyHeaders: {
              request: {
                'Referer': cdnDomain + '/',
                'Origin': cdnDomain,
                'User-Agent': UA
              }
            }
          },
          subtitles: streamData.subtitle ? [{ url: streamData.subtitle, lang: 'en', name: 'English' }] : []
        }])
      })
      .catch(function(err) {
        console.error('[AnimeSalt] Error: ' + err.message)
        resolve([])
      })
  })
}

module.exports = { getStreams }
