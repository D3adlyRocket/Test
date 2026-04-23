// StreamM4U Provider for Nuvio
// Final Fix: Multi-Domain Pattern Matcher

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE = 'https://streamm4u.com.co';
var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36';

function httpGet(url, headers) {
    return fetch(url, {
        headers: Object.assign({ 
            'User-Agent': UA,
            'Referer': BASE + '/',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }, headers || {})
    }).then(function(r) { return r.text(); });
}

function getStreams(tmdbId, mediaType) {
    return new Promise(function(resolve) {
        var tmdbUrl = 'https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '?api_key=' + TMDB_KEY;

        fetch(tmdbUrl).then(function(r) { return r.json(); }).then(function(data) {
            var title = data.title || data.name;
            var searchUrl = BASE + '/search/' + encodeURIComponent(title).replace(/%20/g, '+');
            return httpGet(searchUrl);
        }).then(function(html) {
            // Find the specific movie path (e.g., avatar-fire-and-ash-2025-ybec0)
            var pathMatch = html.match(/href="(https:\/\/streamm4u\.com\.co\/(?:movies|tv)\/[^"]+)"/);
            if (!pathMatch) throw new Error('Search failed');
            return httpGet(pathMatch[1]);
        }).then(function(moviePage) {
            var streams = [];

            // 1. Check for SV-Vr (NeonHorizon) Pattern
            var neonMatch = moviePage.match(/(https:\/\/tmstr[^"']+\.neonhorizonworkshops\.com\/[^"']+\.m3u8[^"']*)/i);
            if (neonMatch) {
                streams.push({
                    name: '🎬 SV-Vr (Neon)',
                    title: 'Full HD • NeonHorizon',
                    url: neonMatch[1].replace(/\\/g, ''),
                    quality: '1080p',
                    headers: {
                        'User-Agent': UA,
                        'Referer': 'https://cloudnestra.com/',
                        'Origin': 'https://cloudnestra.com',
                        'Accept': '*/*',
                        'sec-ch-ua-platform': '"Android"'
                    }
                });
            }

            // 2. Check for SV-Emb1 (RPMVIP) Pattern
            var rpmMatch = moviePage.match(/(https:\/\/youtube-prime\.rpmvip\.com\/[^"']+\.m3u8[^"']*)/i);
            if (rpmMatch) {
                streams.push({
                    name: '🎬 SV-Emb1 (RPM)',
                    title: 'Full HD • RPMVIP',
                    url: rpmMatch[1].replace(/\\/g, ''),
                    quality: '1080p',
                    headers: {
                        'User-Agent': UA,
                        'Referer': 'https://youtube-prime.rpmvip.com/',
                        'Origin': 'https://youtube-prime.rpmvip.com',
                        'Accept': '*/*',
                        'sec-ch-ua-platform': '"Android"'
                    }
                });
            }

            // 3. Check for the general ppzj-youtube pattern (Link 1)
            var ppzjMatch = moviePage.match(/(https:\/\/[^"']+ppzj-youtube\.cfd\/[^"']+\.m3u8[^"']*)/i);
            if (ppzjMatch) {
                streams.push({
                    name: '🎬 SV-M3U8',
                    title: 'Full HD • PPZJ',
                    url: ppzjMatch[1].replace(/\\/g, ''),
                    quality: '1080p',
                    headers: {
                        'User-Agent': UA,
                        'Referer': 'https://streamm4u.com.co/',
                        'Origin': 'https://if9.ppzj-youtube.cfd',
                        'Accept': '*/*',
                        'sec-ch-ua-platform': '"Android"'
                    }
                });
            }

            if (streams.length === 0) throw new Error('No compatible stream found in page source');
            resolve(streams);

        }).catch(function(err) {
            console.error('[StreamM4U] ' + err.message);
            resolve([]);
        });
    });
}

module.exports = { getStreams };
