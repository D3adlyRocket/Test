// HDMovie2 Provider for Nuvio // Bollywood + Hollywood Hindi Dubbed + Web Series // Updated with Domain-Agnostic Iframe & HLS stream fixes
var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305'
var BASE = 'https://hdmovie2a.my/' // Updated Domain 🌐
var UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'

function httpGet(url, headers) {
    return fetch(url, {
        headers: Object.assign({ 
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Ch-Ua': '"Chromium";v="137", "Not/A)Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?1',
            'Sec-Ch-Ua-Platform': '"Android"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none'
        }, headers || {})
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
        return r.text()
    })
}

function cleanTitle(title) {
    return title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function searchSite(title, year) {
    var url = BASE + '/?s=' + encodeURIComponent(title)
    return httpGet(url, { 'Referer': BASE + '/' })
        .then(function(html) {
            var results = []
            var articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/g
            var articleMatch
            
            var escapedBase = BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            var linkRegex = new RegExp('href="(' + escapedBase + '[^"\\/]+\\/([^"\\/]+)\\/)"')

            while ((articleMatch = articleRegex.exec(html)) !== null) {
                var articleHtml = articleMatch[1]
                
                var linkMatch = articleHtml.match(linkRegex)
                if (!linkMatch) continue
                if (linkMatch[1].includes('/feed/')) continue

                var altMatch = articleHtml.match(/alt="([^"]+)"/)
                if (!altMatch) continue

                var itemUrl = linkMatch[1]
                var slug = linkMatch[2]
                var itemTitle = altMatch[1].trim()
                var yearMatch = itemTitle.match(/\((\d{4})\)/)
                var itemYear = yearMatch ? parseInt(yearMatch[1]) : null

                var exists = false
                for (var i = 0; i < results.length; i++) {
                    if (results[i].slug === slug) {
                        exists = true;
                        break
                    }
                }
                if (!exists && slug) {
                    results.push({ url: itemUrl, slug: slug, title: itemTitle, year: itemYear })
                }
            }

            console.log('[HDMovie2] Raw: ' + results.length + ' for: ' + title + ' (' + year + ')')
            
            var withYear = []
            if (year) {
                withYear = results.filter(function(r) {
                    return r.year && Math.abs(r.year - year) <= 1
                })
            }

            var candidates = withYear.length > 0 ? withYear : results
            if (candidates.length === 0) candidates = results

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
                console.log('[HDMovie2] Best: ' + candidates[0].title + ' (' + candidates[0].year + ')')
            }
            return candidates
        })
}

// Unified parser that handles ANY rotating mirror domain found in the iframe 🌀
function getGenericStream(playerUrl) {
    var origin = 'https://hdm2.ink';
    var originMatch = playerUrl.match(/^(https?:\/\/[^\/]+)/);
    if (originMatch) {
        origin = originMatch[1];
    }

    return httpGet(playerUrl, { 'Referer': BASE + '/' })
        .then(function(html) {
            // Method A: Standard data-stream-url property
            var streamMatch = html.match(/data-stream-url="([^"]+)"/)
            if (streamMatch) {
                var streamPath = streamMatch[1]
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')

                var finalUrl = streamPath.startsWith('http') ? streamPath : origin + streamPath;
                if (!finalUrl.includes('.m3u8')) {
                    finalUrl += '#index.m3u8';
                }
                console.log('[HDMovie2] Dynamic stream found!')
                return {
                    url: finalUrl,
                    headers: {
                        'Referer': origin + '/',
                        'Origin': origin,
                        'User-Agent': UA
                    }
                }
            }

            // Method B: Sniff script fallback
            var sniffMatch = html.match(/sniff\s*\(\s*["'][^"']+["']\s*,\s*["'][^"']+["']\s*,\s*["']([a-f0-9]+)["']/)
            if (sniffMatch) {
                var hash = sniffMatch[sniffMatch.length - 1]
                var m3u8Url = 'https://molop.art/m3u8/1/' + hash + '/master.m3u8?s=1&cache=1'
                console.log('[HDMovie2] Sniff stream hash located!')
                return {
                    url: m3u8Url,
                    headers: {
                        'Referer': 'https://molop.art/',
                        'Origin': 'https://molop.art',
                        'User-Agent': UA
                    }
                }
            }

            return null;
        })
}

function tryGetStream(postId, movieUrl) {
    var nume = 1
    var maxNume = 4

    function tryNume() {
        if (nume > maxNume) {
            console.log('[HDMovie2] All AJAX options exhausted')
            return Promise.resolve(null)
        }
        return httpPost(
            BASE + '/wp-admin/admin-ajax.php',
            'action=doo_player_ajax&post=' + postId + '&nume=' + nume + '&type=movie',
            { 'Referer': movieUrl }
        ).then(function(body) {
            var data
            try { data = JSON.parse(body) } catch(e) { return null }
            var embedUrl = data.embed_url || ''
            if (!embedUrl) return null
            
            var cleaned = embedUrl.replace(/\\\//g, '/')
            var srcMatch = cleaned.match(/src="([^"]+)"/)
            if (srcMatch) {
                return getGenericStream(srcMatch[1])
            }

            nume++;
            return tryNume()
        }).catch(function() {
            nume++;
            return tryNume()
        })
    }
    return tryNume()
}

function getStreamFromMoviePage(movieUrl) {
    return httpGet(movieUrl, { 'Referer': BASE + '/' })
        .then(function(html) {
            // Captures any embedded script iframe, regardless of changing mirror domains 🎯
            var embedMatch = html.match(/<iframe[^>]*src="([^"]+)"/i) || 
                             html.match(/src=['"]([^'"]*?\/play[^'"]*?)['"]/i) ||
                             html.match(/src=['"]([^'"]*?\/watch[^'"]*?)['"]/i);
            
            if (embedMatch) {
                var embedUrl = embedMatch[1].replace(/\\\//g, '/');
                if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;
                console.log('[HDMovie2] Intercepted player iframe link: ' + embedUrl);
                return getGenericStream(embedUrl);
            }

            // Fallback for database backward compatibility
            var postIdMatch = html.match(/postid-(\d+)/)
            if (postIdMatch) {
                var postId = postIdMatch[1]
                return tryGetStream(postId, movieUrl)
            }

            console.log('[HDMovie2] Clear extraction layout failure.')
            return null
        })
}

function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise(function(resolve) {
        var tmdbUrl = mediaType === 'movie' ? 
            'https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + TMDB_KEY : 
            'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + TMDB_KEY
        
        console.log('[HDMovie2] Start: ' + tmdbId + ' ' + mediaType)
        
        fetch(tmdbUrl)
            .then(function(r) { return r.json() })
            .then(function(data) {
                var title = data.title || data.name
                if (!title) throw new Error('No title')
                var releaseDate = data.release_date || data.first_air_date || ''
                var year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null
                return searchSite(title, year)
            })
            .then(function(results) {
                if (!results || results.length === 0) {
                    console.log('[HDMovie2] Not found')
                    resolve([])
                    return null
                }
                var result = results[0]
                return getStreamFromMoviePage(result.url)
            })
            .then(function(streamData) {
                if (!streamData) {
                    resolve([]);
                    return
                }
                resolve([{
                    name: '🎬 HDMovie2',
                    title: 'Hindi Dubbed • HD',
                    url: streamData.url,
                    quality: '1080p',
                    headers: streamData.headers || {
                        'Referer': BASE + '/',
                        'User-Agent': UA
                    }
                }])
            })
            .catch(function(err) {
                console.error('[HDMovie2] Error: ' + err.message)
                resolve([])
            })
    })
}

module.exports = { getStreams }
