// =============================================================
// Provider Nuvio : Nakios.art (VF / VOSTFR / MULTI)
// Version : 3.5.2 (TV Stability Update)
// =============================================================

var NAKIOS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var NAKIOS_VITRINE = 'https://nakios.online/';
var _cachedEndpoint = null;

// Helper for XHR (Universal compatibility for TV/Mobile)
function httpRequest(url, options) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', url, true);
        xhr.timeout = 10000; // 10s timeout
        
        if (options.headers) {
            for (var key in options.headers) {
                xhr.setRequestHeader(key, options.headers[key]);
            }
        }
        
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                var responseData = xhr.responseText;
                resolve({
                    text: function() { return responseData; },
                    json: function() { return JSON.parse(responseData); },
                    ok: true
                });
            } else {
                reject(new Error('HTTP ' + xhr.status));
            }
        };
        xhr.onerror = function() { reject(new Error('Network Error')); };
        xhr.ontimeout = function() { reject(new Error('Timeout')); };
        xhr.send(options.body || null);
    });
}

var safeFetch = (typeof fetch === 'function') ? fetch : httpRequest;

// Auto-detect or Fallback
function detectEndpoint() {
    if (_cachedEndpoint) return Promise.resolve(_cachedEndpoint);

    return safeFetch(NAKIOS_VITRINE)
        .then(function(res) { return res.text(); })
        .then(function(html) {
            var match = html.match(/src=["'](\/assets\/[^"']+\.js)["']/);
            if (!match) throw new Error('Bundle missing');
            return safeFetch('https://nakios.online' + match[1]);
        })
        .then(function(res) { return res.text(); })
        .then(function(js) {
            var matches = js.match(/https?:\/\/nakios\.([a-z]{2,10})/gi) || [];
            var tld = matches[0] ? matches[0].split('.').pop() : 'uno'; // Fallback to .uno if fail
            
            _cachedEndpoint = {
                base:    'https://nakios.' + tld,
                api:     'https://api.nakios.' + tld + '/api',
                referer: 'https://nakios.' + tld + '/'
            };
            return _cachedEndpoint;
        })
        .catch(function() {
            // HARD FALLBACK: If detection fails on TV, try the most stable TLD
            _cachedEndpoint = {
                base: 'https://nakios.uno',
                api: 'https://api.nakios.uno/api',
                referer: 'https://nakios.uno/'
            };
            return _cachedEndpoint;
        });
}

function getStreams(tmdbId, mediaType, season, episode) {
    return detectEndpoint().then(function(endpoint) {
        var url = (mediaType === 'tv') 
            ? endpoint.api + '/sources/tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1)
            : endpoint.api + '/sources/movie/' + tmdbId;

        return safeFetch(url, {
            headers: {
                'User-Agent': NAKIOS_UA,
                'Referer': endpoint.referer,
                'Origin': endpoint.base
            }
        });
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (!data || !data.sources) return [];
        
        return data.sources.filter(function(s) { return !s.isEmbed; }).map(function(source) {
            var streamUrl = source.url || '';
            
            // Handle relative or redirected URLs
            if (streamUrl.startsWith('/')) {
                var urlMatch = streamUrl.match(/[?&]url=([^&]+)/);
                if (urlMatch) streamUrl = decodeURIComponent(urlMatch[1]);
            }

            return {
                name: 'Nakios',
                title: (source.name || 'Nakios') + ' [' + (source.lang || 'VF').toUpperCase() + ']',
                url: streamUrl,
                quality: source.quality || 'HD',
                format: (streamUrl.indexOf('.m3u8') !== -1) ? 'm3u8' : 'mp4',
                headers: {
                    'User-Agent': NAKIOS_UA,
                    'Referer': _cachedEndpoint.referer,
                    'Origin': _cachedEndpoint.base,
                    'Connection': 'keep-alive'
                }
            };
        });
    })
    .catch(function() { return []; });
}

// Ensure it's available in every possible global scope
if (typeof module !== 'undefined') module.exports = { getStreams: getStreams };
if (typeof window !== 'undefined') window.getStreams = getStreams;
if (typeof global !== 'undefined') global.getStreams = getStreams;
this.getStreams = getStreams;
