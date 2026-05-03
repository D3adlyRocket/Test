// =========================================================================
// NUVIO PROVIDER: NETVLYX
// Compatible with ES5 environment and global fetch()
// =========================================================================

// 1. CONFIGURATION
var BASE = 'https://netvlyx.pages.dev';
// Minimal required headers extracted from provided example.
var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36';

// -------------------------------------------------------------------------
// 2. HTTP HELPERS (Adapted from example)
// -------------------------------------------------------------------------
function httpGet(url, headers) {
    // Merge provided headers with mandatory User-Agent and Referer
    var finalHeaders = Object.assign({
        'User-Agent': UA,
        'Referer': BASE + '/'
    }, headers || {});

    return fetch(url, { headers: finalHeaders }).then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
    });
}

// -------------------------------------------------------------------------
// 3. PARSING & DECODING HELPERS
// -------------------------------------------------------------------------

/**
 * Encapsulated Base64 decoder.
 * Older engines often lack atob(), so we include a lightweight implementation.
 */
var Base64 = {
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    decode: function (e) {
        var t = "";
        var n, r, i;
        var s, o, u, a;
        var f = 0;
        e = e.replace(/[^A-Za-z0-9+/=]/g, "");
        while (f < e.length) {
            s = this._keyStr.indexOf(e.charAt(f++));
            o = this._keyStr.indexOf(e.charAt(f++));
            u = this._keyStr.indexOf(e.charAt(f++));
            a = this._keyStr.indexOf(e.charAt(f++));
            n = s << 2 | o >> 4;
            r = (o & 15) << 4 | u >> 2;
            i = (u & 3) << 6 | a;
            t = t + String.fromCharCode(n);
            if (u != 64) {
                t = t + String.fromCharCode(r);
            }
            if (a != 64) {
                t = t + String.fromCharCode(i);
            }
        }
        t = this._utf8_decode(t);
        return t;
    },
    _utf8_decode: function (e) {
        var t = "";
        var n = 0;
        var r = 0, c1 = 0, c2 = 0, c3 = 0;
        while (n < e.length) {
            r = e.charCodeAt(n);
            if (r < 128) {
                t += String.fromCharCode(r);
                n++;
            } else if (r > 191 && r < 224) {
                c2 = e.charCodeAt(n + 1);
                t += String.fromCharCode((r & 31) << 6 | c2 & 63);
                n += 2;
            } else {
                c2 = e.charCodeAt(n + 1);
                c3 = e.charCodeAt(n + 2);
                t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
                n += 3;
            }
        }
        return t;
    }
};

/**
 * Extracts links matching 'hub.hailmary.lat' pattern.
 */
function extractHubLinks(html) {
    var regex = /https:\/\/hub\.hailmary\.lat\/[a-zA-Z0-9\-_?=&]+/g;
    return html.match(regex) || [];
}

// -------------------------------------------------------------------------
// 4. MAIN LOGIC FLOW
// -------------------------------------------------------------------------

/**
 * Steps:
 * 1. Convert TMDB ID to Title via TMDB API.
 * 2. Search NetVlyx using Title.
 * 3. Extract Encrypted ID from search results.
 * 4. Decode ID to find Source Page.
 * 5. Scrape Source Page for final Hub links.
 */
function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise(function(resolve) {
        // NetVlyx uses title-based searching, requiring TMDB lookup first.
        var TMDB_KEY = 'd80ba92bc7cefe3359668d30d06f3305'; // Reusing key from example
        var tmdbUrl = mediaType === 'movie'
            ? 'https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + TMDB_KEY
            : 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + TMDB_KEY;

        console.log('[NetVlyx] Start: ' + tmdbId + ' ' + mediaType);

        // --- PHASE 1: TMDB LOOKUP ---
        fetch(tmdbUrl)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var title = data.title || data.name;
                if (!title) throw new Error('No title found on TMDB');
                console.log('[NetVlyx] Title: ' + title);
                
                // --- PHASE 2: SEARCH NETVLYX ---
                var searchUrl = BASE + '/?search=' + encodeURIComponent(title);
                return httpGet(searchUrl);
            })
            .then(function(searchHtml) {
                // --- PHASE 3: PARSE SEARCH RESULTS ---
                // Regex matches <a class="result-item" href="/h?id=[ENCRYPTED_ID]">...
                var regex = /<a\s+class="result-item"\s+href="\/h\?id=([a-zA-Z0-9+=/]+)">/g;
                var match = regex.exec(searchHtml);
                
                if (!match) {
                    console.log('[NetVlyx] Not found on site.');
                    return null; // Return null to skip next step
                }
                
                var encryptedId = match[1];
                console.log('[NetVlyx] Found encrypted ID: ' + encryptedId.substring(0, 20) + '...');
                return encryptedId;
            })
            .then(function(encryptedId) {
                if (!encryptedId) return null;
                
                // --- PHASE 4: DECODE & FETCH SOURCE PAGE ---
                var sourcePageUrl;
                try {
                    sourcePageUrl = Base64.decode(encryptedId);
                } catch(e) {
                    throw new Error('Failed to decode ID');
                }
                
                if (!sourcePageUrl || sourcePageUrl.indexOf('http') !== 0) {
                     throw new Error('Decoded ID is not a valid URL');
                }
                
                console.log('[NetVlyx] Decoded Source Page: ' + sourcePageUrl);
                
                // Fetch the source page (e.g., HDHub4U) using mandatory headers
                return httpGet(sourcePageUrl);
            })
            .then(function(sourcePageHtml) {
                if (!sourcePageHtml) { resolve([]); return; }
                
                // --- PHASE 5: EXTRACT FINAL STREAM LINKS ---
                var rawLinks = extractHubLinks(sourcePageHtml);
                
                if (!rawLinks || rawLinks.length === 0) {
                    console.log('[NetVlyx] No playable links found on source page.');
                    resolve([]);
                    return;
                }
                
                console.log('[NetVlyx] Found ' + rawLinks.length + ' potential streams.');
                
                // Structure the streams for the Nuvio player.
                var formattedStreams = rawLinks.map(function(link, index) {
                    return {
                        name: '🔗 NetVlyx Hub',
                        title: 'Stream ' + (index + 1) + ' • Direct HQ',
                        url: link,
                        quality: '1080p', // The hub links are usually HQ
                        // Pass required headers with the stream object
                        headers: {
                            'User-Agent': UA,
                            'Referer': BASE + '/',
                            'Accept-Encoding': 'identity;q=1, *;q=0',
                            'Range': 'bytes=0-'
                        }
                    };
                });
                
                console.log('[NetVlyx] Resolving streams!');
                resolve(formattedStreams);
            })
            .catch(function(err) {
                console.error('[NetVlyx] Error: ' + err.message);
                resolve([]);
            });
    });
}

// -------------------------------------------------------------------------
// 5. EXPORT
// -------------------------------------------------------------------------
module.exports = {
    getStreams: getStreams
};
