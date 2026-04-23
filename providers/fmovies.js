// StreamM4U Provider for Nuvio
// Support for SV-Vr (NeonHorizon) and SV-Emb1 (RPMVIP)

var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305';
var BASE = 'https://streamm4u.com.co';
var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36';

function httpGet(url, headers) {
    return fetch(url, {
        headers: Object.assign({ 'User-Agent': UA }, headers || {})
    }).then(function(r) { return r.text(); });
}

function getStreams(tmdbId, mediaType) {
    return new Promise(function(resolve) {
        var tmdbUrl = 'https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '?api_key=' + TMDB_KEY;

        fetch(tmdbUrl).then(function(r) { return r.json(); }).then(function(data) {
            var title = data.title || data.name;
            var searchUrl = BASE + '/search/' + encodeURIComponent(title).replace(/%20/g, '+');
            return httpGet(searchUrl, { 'Referer': BASE + '/' });
        }).then(function(html) {
            var match = html.match(/href="(https:\/\/streamm4u\.com\.co\/movies\/[^"]+)"/);
            if (!match) throw new Error('Movie not found');
            return httpGet(match[1], { 'Referer': BASE + '/' });
        }).then(function(moviePage) {
            // Attempt to find the stream URL in the page source
            // This regex looks for master.m3u8 links from neonhorizon or rpmvip
            var streamRegex = /(https:\/\/[^"']+(?:neonhorizonworkshops|rpmvip|ppzj-youtube)[^"']+\.m3u8[^"']*)/i;
            var streamMatch = moviePage.match(streamRegex);

            if (!streamMatch) {
                // If not directly in source, look for the iframe source to Cloudnestra/NeonHorizon
                var iframeMatch = moviePage.match(/src="(https:\/\/(?:cloudnestra|youtube-prime|tmstr)[^"]+)"/i);
                if (iframeMatch) {
                    return httpGet(iframeMatch[1], { 'Referer': BASE + '/' }).then(function(iframeHtml) {
                        var innerMatch = iframeHtml.match(streamRegex);
                        return innerMatch ? innerMatch[1] : null;
                    });
                }
            }
            return streamMatch ? streamMatch[1] : null;
        }).then(function(finalUrl) {
            if (!finalUrl) { resolve([]); return; }

            // Determine headers based on the URL found
            var isNeon = finalUrl.includes('neonhorizonworkshops');
            
            resolve([{
                name: isNeon ? '🎬 SV-Vr (Neon)' : '🎬 SV-Emb1 (RPM)',
                title: 'Full HD • Multi-Source',
                url: finalUrl,
                quality: '1080p',
                headers: {
                    'User-Agent': UA,
                    'Referer': isNeon ? 'https://cloudnestra.com/' : 'https://youtube-prime.rpmvip.com/',
                    'Origin': isNeon ? 'https://cloudnestra.com' : 'https://youtube-prime.rpmvip.com',
                    'Accept': '*/*',
                    'sec-ch-ua': '"Android WebView";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
                    'sec-ch-ua-platform': '"Android"'
                }
            }]);
        }).catch(function(err) {
            console.log('[StreamM4U] Search failed or link hidden');
            resolve([]);
        });
    });
}

module.exports = { getStreams };
