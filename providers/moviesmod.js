// =============================================================
// Provider Nuvio : Nakios.art (VF / VOSTFR / MULTI)
// Version : 3.5.1 (Fixed for Android TV compatibility)
// =============================================================

var NAKIOS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var NAKIOS_VITRINE = 'https://nakios.online/';
var NAKIOS_BLACKLIST = ['online', 'health', 'png', 'svg', 'com', 'support', 'news', 'media'];

var _cachedEndpoint = null;

// Polyfill for simple XHR to replace fetch where fetch is unavailable
function httpRequest(url, options) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', url);
        if (options.headers) {
            for (var key in options.headers) {
                xhr.setRequestHeader(key, options.headers[key]);
            }
        }
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve({
                    text: function() { return xhr.responseText; },
                    json: function() { return JSON.parse(xhr.responseText); },
                    ok: true,
                    status: xhr.status
                });
            } else {
                reject(new Error('HTTP ' + xhr.status));
            }
        };
        xhr.onerror = function() { reject(new Error('Network Error')); };
        xhr.send(options.body || null);
    });
}

// Check if fetch exists, otherwise use httpRequest
var safeFetch = (typeof fetch === 'function') ? fetch : httpRequest;

function fetchBundleUrl() {
    return safeFetch(NAKIOS_VITRINE, { redirect: 'follow' })
        .then(function(res) { return res.text(); })
        .then(function(html) {
            var match = html.match(/src=["'](\/assets\/[^"']+\.js)["']/);
            if (!match) throw new Error('Bundle JS introuvable');
            return 'https://nakios.online' + match[1];
        });
}

function extractDomainsFromBundle(bundleUrl) {
    return safeFetch(bundleUrl)
        .then(function(res) { return res.text(); })
        .then(function(js) {
            var matches = js.match(/https?:\/\/nakios\.([a-z]{2,10})/gi) || [];
            var tlds = [];
            var seen = {};
            matches.forEach(function(url) {
                var tld = url.replace(/https?:\/\/nakios\./, '').toLowerCase();
                if (!seen[tld] && NAKIOS_BLACKLIST.indexOf(tld) === -1) {
                    seen[tld] = true;
                    tlds.push(tld);
                }
            });
            if (tlds.length === 0) throw new Error('Aucun domaine trouvé');
            return tlds;
        });
}

function detectEndpoint() {
    if (_cachedEndpoint) return Promise.resolve(_cachedEndpoint);

    return fetchBundleUrl()
        .then(extractDomainsFromBundle)
        .then(function(tlds) {
            var tld = tlds[0];
            _cachedEndpoint = {
                base:    'https://nakios.' + tld,
                api:     'https://api.nakios.' + tld + '/api',
                referer: 'https://nakios.' + tld + '/'
            };
            return _cachedEndpoint;
        });
}

function fetchSources(endpoint, tmdbId, mediaType, season, episode) {
    var url = mediaType === 'tv'
        ? endpoint.api + '/sources/tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1)
        : endpoint.api + '/sources/movie/' + tmdbId;

    return safeFetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': NAKIOS_UA,
            'Referer':    endpoint.referer,
            'Origin':     endpoint.base
        }
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (!data || !data.success || !data.sources) throw new Error('Pas de sources');
        return data.sources;
    });
}

function resolveSource(source) {
    var rawUrl = source.url || '';
    if (rawUrl.startsWith('http')) {
        return {
            url: rawUrl,
            format: (source.isM3U8 || rawUrl.indexOf('.m3u8') !== -1) ? 'm3u8' : 'mp4',
            referer: null,
            origin: null
        };
    }
    if (rawUrl.charAt(0) === '/') {
        var urlMatch = rawUrl.match(/[?&]url=([^&]+)/);
        if (!urlMatch) return null;
        var decoded = decodeURIComponent(urlMatch[1]);
        var match = decoded.match(/^(https?:\/\/[^\/]+)/);
        var origin = match ? match[1] : null;
        return { url: decoded, format: 'm3u8', referer: origin + '/', origin: origin };
    }
    return null;
}

function getStreams(tmdbId, mediaType, season, episode) {
    return detectEndpoint()
        .then(function(endpoint) {
            return fetchSources(endpoint, tmdbId, mediaType, season, episode);
        })
        .then(function(sources) {
            var results = [];
            for (var i = 0; i < sources.length; i++) {
                var source = sources[i];
                if (source.isEmbed) continue;
                var resolved = resolveSource(source);
                if (!resolved) continue;

                results.push({
                    name: 'Nakios',
                    title: (source.name || 'Nakios') + ' - ' + (source.lang || 'MULTI').toUpperCase() + ' ' + (source.quality || 'HD'),
                    url: resolved.url,
                    quality: source.quality || 'HD',
                    format: resolved.format,
                    headers: {
                        'User-Agent': NAKIOS_UA,
                        'Referer': resolved.referer || _cachedEndpoint.referer,
                        'Origin': resolved.origin || _cachedEndpoint.base
                    }
                });
            }
            return results;
        })
        .catch(function(err) {
            console.error('[Nakios] Error: ' + err.message);
            return [];
        });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    this.getStreams = getStreams;
}
