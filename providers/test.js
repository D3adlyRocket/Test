// =========================================================================
// NUVIO PROVIDER: NETVLYX (DEBUGGER VERSION)
// Paste this to find where the link extraction is breaking.
// =========================================================================

var BASE = 'https://netvlyx.pages.dev';
var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36';

function httpGet(url, headers) {
    console.log('[DEBUG] httpGet requesting: ' + url);
    var finalHeaders = Object.assign({
        'User-Agent': UA,
        'Referer': BASE + '/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    }, headers || {});

    return fetch(url, { headers: finalHeaders }).then(function(r) {
        if (!r.ok) {
            console.log('[DEBUG] httpGet FAILED with status: ' + r.status);
            throw new Error('HTTP ' + r.status);
        }
        return r.text();
    });
}

// Minimal Base64 fallback in case atob is not present
var Base64 = {
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    decode: function (e) {
        if (typeof atob === 'function') { return atob(e); } // Try native first
        var t = ""; var n, r, i; var s, o, u, a; var f = 0;
        e = e.replace(/[^A-Za-z0-9+/=]/g, "");
        while (f < e.length) {
            s = this._keyStr.indexOf(e.charAt(f++));
            o = this._keyStr.indexOf(e.charAt(f++));
            u = this._keyStr.indexOf(e.charAt(f++));
            a = this._keyStr.indexOf(e.charAt(f++));
            n = s << 2 | o >> 4; r = (o & 15) << 4 | u >> 2; i = (u & 3) << 6 | a;
            t = t + String.fromCharCode(n);
            if (u != 64) { t = t + String.fromCharCode(r); }
            if (a != 64) { t = t + String.fromCharCode(i); }
        }
        return this._utf8_decode(t);
    },
    _utf8_decode: function (e) {
        var t = ""; var n = 0; var r = 0, c1 = 0, c2 = 0, c3 = 0;
        while (n < e.length) {
            r = e.charCodeAt(n);
            if (r < 128) { t += String.fromCharCode(r); n++; }
            else if (r > 191 && r < 224) { c2 = e.charCodeAt(n + 1); t += String.fromCharCode((r & 31) << 6 | c2 & 63); n += 2; }
            else { c2 = e.charCodeAt(n + 1); c3 = e.charCodeAt(n + 2); t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63); n += 3; }
        }
        return t;
    }
};

function extractHubLinks(html) {
    console.log('[DEBUG] Scanning HTML for Hub links. HTML length: ' + html.length);
    var regex = /https:\/\/hub\.hailmary\.lat\/[a-zA-Z0-9\-_?=&]+/g;
    var links = html.match(regex) || [];
    console.log('[DEBUG] Hub links found: ' + links.length);
    return links;
}

function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise(function(resolve) {
        var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305'; 
        var tmdbUrl = mediaType === 'movie'
            ? 'https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + TMDB_KEY
            : 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + TMDB_KEY;

        console.log('[DEBUG] Phase 1 - TMDB Lookup: ' + tmdbId);

        // --- PHASE 1: TMDB LOOKUP ---
        fetch(tmdbUrl)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var title = data.title || data.name;
                if (!title) throw new Error('No title found on TMDB');
                console.log('[DEBUG] TMDB Title found: ' + title);
                
                // --- PHASE 2: SEARCH NETVLYX ---
                var searchUrl = BASE + '/?search=' + encodeURIComponent(title);
                console.log('[DEBUG] Phase 2 - Searching NetVlyx: ' + searchUrl);
                return httpGet(searchUrl);
            })
            .then(function(searchHtml) {
                if (!searchHtml || searchHtml.length < 100) {
                     console.log('[DEBUG] Phase 2 FAILED - NetVlyx search HTML is empty or too short.');
                     throw new Error('Empty search results');
                }
                console.log('[DEBUG] Phase 2 COMPLETE - Search HTML loaded. Parsing...');

                // --- PHASE 3: PARSE SEARCH RESULTS ---
                // We will try two different regexes in case of space variations
                var regex1 = /<a class="result-item" href="\/h\?id=([a-zA-Z0-9+=/]+)">/g;
                var match = regex1.exec(searchHtml);
                
                if (!match) {
                    console.log('[DEBUG] Phase 3 Regex 1 failed. Trying Regex 2...');
                    var regex2 = /<a\s+class=["']result-item["']\s+href=["']\/h\?id=([a-zA-Z0-9+=/]+)["']>/g;
                    match = regex2.exec(searchHtml);
                }
                
                if (!match) {
                    console.log('[DEBUG] Phase 3 FAILED - Title not found in NetVlyx search HTML.');
                    return null;
                }
                
                var encryptedId = match[1];
                console.log('[DEBUG] Phase 3 COMPLETE - Encrypted ID: ' + encryptedId);
                return encryptedId;
            })
            .then(function(encryptedId) {
                if (!encryptedId) return null;
                
                // --- PHASE 4: DECODE & FETCH SOURCE PAGE ---
                var sourcePageUrl;
                try {
                    console.log('[DEBUG] Phase 4 - Decoding ID');
                    sourcePageUrl = Base64.decode(encryptedId);
                } catch(e) {
                    console.log('[DEBUG] Phase 4 FAILED - Base64 decode failed: ' + e.message);
                    throw new Error('Failed to decode ID');
                }
                
                if (!sourcePageUrl || sourcePageUrl.indexOf('http') !== 0) {
                     console.log('[DEBUG] Phase 4 FAILED - Decoded URL invalid: ' + sourcePageUrl);
                     throw new Error('Decoded ID is not a valid URL');
                }
                
                console.log('[DEBUG] Phase 4 COMPLETE - Decoded Source Page: ' + sourcePageUrl);
                
                // Fetch the source page using mandatory headers
                console.log('[DEBUG] Requesting source page...');
                return httpGet(sourcePageUrl);
            })
            .then(function(sourcePageHtml) {
                if (!sourcePageHtml) { 
                    console.log('[DEBUG] Phase 5 FAILED - Source page is empty.');
                    resolve([]); 
                    return; 
                }
                
                console.log('[DEBUG] Phase 5 - Scrambling for hub links.');

                // --- PHASE 5: EXTRACT FINAL STREAM LINKS ---
                var rawLinks = extractHubLinks(sourcePageHtml);
                
                if (!rawLinks || rawLinks.length === 0) {
                    console.log('[DEBUG] Phase 5 FAILED - No playable links found in source page.');
                    resolve([]);
                    return;
                }
                
                console.log('[DEBUG] Phase 5 COMPLETE - Valid links found: ' + rawLinks.length);
                
                var formattedStreams = rawLinks.map(function(link, index) {
                    return {
                        name: '🔗 NetVlyx Debug',
                        title: 'HQ Stream ' + (index + 1),
                        url: link,
                        quality: '1080p', 
                        headers: {
                            'User-Agent': UA,
                            'Referer': BASE + '/',
                            'Accept-Encoding': 'identity;q=1, *;q=0',
                            'Range': 'bytes=0-'
                        }
                    };
                });
                
                resolve(formattedStreams);
            })
            .catch(function(err) {
                console.error('[DEBUG] MAIN ERROR: ' + err.message);
                resolve([]);
            });
    });
}

module.exports = {
    getStreams: getStreams
};
