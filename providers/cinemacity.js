// HDMovie2 Provider for Nuvio // Bollywood + Hollywood Hindi Dubbed + Web Series // Updated with .equipment domain and HLS stream fixes
var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305'
var BASE = 'https://hdmovie2a.my/' // Updated Domain 🌐
var CDN = 'https://hdm2.ink'
// Updated to a modern User-Agent to match the client environment
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'

function httpGet(url, headers) {
    return fetch(url, {
        headers: Object.assign({ 'User-Agent': UA }, headers || {})
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
            
            // Dynamic URL matching to handle any structural change or domain shifts smoothly 🛠️
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

function getHdm2Stream(playerUrl) {
    return httpGet(playerUrl, { 'Referer': BASE + '/' })
        .then(function(html) {
            var streamMatch = html.match(/data-stream-url="([^"]+)"/)
            if (!streamMatch) {
                console.log('[HDMovie2] No data-stream-url in hdm2 page')
                return null
            }
            var streamPath = streamMatch[1]
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')

            // Fix: Force .m3u8 extension extension for modern players 📺
            var finalUrl = CDN + streamPath;
            if (!finalUrl.includes('.m3u8')) {
                finalUrl += '#index.m3u8';
            }
            console.log('[HDMovie2] hdm2 stream found!')
            return {
                url: finalUrl,
                headers: {
                    'Referer': CDN + '/',
                    'Origin': CDN,
                    'User-Agent': UA
                }
            }
        })
}

function getMolopStream(playerUrl) {
    return httpGet(playerUrl, { 'Referer': BASE + '/' })
        .then(function(html) {
            var sniffMatch = html.match(/sniff\s*\(\s*["'][^"']+["']\s*,\s*["'][^"']+["']\s*,\s*["']([a-f0-9]+)["']/)
            if (!sniffMatch) {
                console.log('[HDMovie2] No sniff hash in molop page')
                return null
            }
            
            // Fixed the variable casing error that caused the crash here ✅
            var hash = sniffMatch[sniffMatch.length - 1]
            var m3u8Url = 'https://molop.art/m3u8/1/' + hash + '/master.m3u8?s=1&cache=1'
            console.log('[HDMovie2] molop hash: ' + hash)
            return {
                url: m3u8Url,
                headers: {
                    'Referer': 'https://molop.art/',
                    'Origin': 'https://molop.art',
                    'User-Agent': UA
                }
            }
        })
}

function getStreamFromMoviePage(movieUrl) {
    return httpGet(movieUrl, { 'Referer': BASE + '/' })
        .then(function(html) {
            // New direct-extraction routine based on DevTools observation 🎯
            var hdm2Match = html.match(/src="(https:\/\/hdm2\.ink\/play\?v=[^"]+)"/)
            if (hdm2Match) {
                console.log('[HDMovie2] Found hdm2 stream directly in HTML: ' + hdm2Match[1])
                return getHdm2Stream(hdm2Match[1])
            }

            var molopMatch = html.match(/src="(https:\/\/molop\.art\/watch\?v=[^"]+)"/)
            if (molopMatch) {
                console.log('[HDMovie2] Found molop stream directly in HTML: ' + molopMatch[1])
                return getMolopStream(molopMatch[1])
            }

            // Fallback checking strategy for dynamic/lazy source parameters
            var lazyMatch = html.match(/src=['"]([^'"]*?(?:hdm2\.ink|molop\.art)[^'"]*?)['"]/)
            if (lazyMatch) {
                var embedUrl = lazyMatch[1].replace(/\\\//g, '/')
                console.log('[HDMovie2] Found fallback stream link: ' + embedUrl)
                if (embedUrl.includes('hdm2.ink')) return getHdm2Stream(embedUrl)
                if (embedUrl.includes('molop.art')) return getMolopStream(embedUrl)
            }

            console.log('[HDMovie2] No direct stream embeds found in page source')
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
                console.log('[HDMovie2] Title: ' + title + ' Year: ' + year)
                return searchSite(title, year)
            })
            .then(function(results) {
                if (!results || results.length === 0) {
                    console.log('[HDMovie2] Not found')
                    resolve([])
                    return null
                }
                var result = results[0]
                console.log('[HDMovie2] Using: ' + result.url)
                return getStreamFromMoviePage(result.url)
            })
            .then(function(streamData) {
                if (!streamData) {
                    resolve([]);
                    return
                }
                console.log('[HDMovie2] Resolving stream!')
                resolve([{
                    name: '🎬 HDMovie2',
                    title: 'Hindi Dubbed • HD',
                    url: streamData.url,
                    quality: '1080p',
                    headers: streamData.headers || {
                        'Referer': CDN + '/',
                        'Origin': CDN,
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
