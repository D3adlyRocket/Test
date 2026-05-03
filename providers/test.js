// =========================================================================
// NUVIO PROVIDER: NETVLYX
// High-Fidelity Header Match (WebView Emulation)
// Full ES5 Compatibility / global fetch()
// =========================================================================

var BASE_URL = 'https://netvlyx.pages.dev';

// MANDATORY HEADERS (WebView Emulation)
// These must precisely match the headers you provided initially.
var UA_STRING = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36';

// -------------------------------------------------------------------------
// HTTP HELPERS
// Conservatively constructed for maximum compatibility with older engines
// -------------------------------------------------------------------------
function httpGet(url, includeOrigin) {
    console.log('[NetVlyx] Fetching: ' + url);

    // Build headers object manually for ES5 compatibility
    var h = {};
    h['User-Agent'] = UA_STRING;
    h['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
    h['Referer'] = BASE_URL + '/';
    
    // Crucial WebView and origin verification headers
    h['sec-ch-ua'] = '"Android WebView";v="147", "Not.A/Brand";v="8", "Chromium";v="147"';
    h['sec-ch-ua-mobile'] = '?1';
    h['sec-ch-ua-platform'] = '"Android"';
    h['X-Requested-With'] = 'com.netskyx.browser'; // Emulating the native app/browser
    
    // Required for modern Vercel/PWA hosting checks
    if (includeOrigin) {
        h['Origin'] = BASE_URL;
    }

    return fetch(url, { headers: h }).then(function(res) {
        console.log('[NetVlyx] Status: ' + res.status);
        if (!res.ok) {
            throw new Error('HTTP status ' + res.status);
        }
        return res.text();
    });
}

// -------------------------------------------------------------------------
// DECODING HELPERS
// -------------------------------------------------------------------------

/**
 * Highly compatible standalone Base64 fallback
 */
var InternalDecoder = {
    _k: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    fromB64: function(e) {
        if (typeof atob === 'function') { return atob(e); }
        var t = ""; var n, r, i, s, o, u, a, f = 0; e = e.replace(/[^A-Za-z0-9+/=]/g, "");
        while (f < e.length) {
            s = this._k.indexOf(e.charAt(f++)); o = this._k.indexOf(e.charAt(f++));
            u = this._k.indexOf(e.charAt(f++)); a = this._k.indexOf(e.charAt(f++));
            n = s << 2 | o >> 4; r = (o & 15) << 4 | u >> 2; i = (u & 3) << 6 | a;
            t = t + String.fromCharCode(n);
            if (u != 64) { t = t + String.fromCharCode(r); }
            if (a != 64) { t = t + String.fromCharCode(i); }
        }
        return this._ud(t);
    },
    _ud: function(e) {
        var t = ""; var n = 0; var r = 0, c2 = 0, c3 = 0;
        while (n < e.length) {
            r = e.charCodeAt(n);
            if (r < 128) { t += String.fromCharCode(r); n++; }
            else if (r > 191 && r < 224) { c2 = e.charCodeAt(n + 1); t += String.fromCharCode((r & 31) << 6 | c2 & 63); n += 2; }
            else { c2 = e.charCodeAt(n + 1); c3 = e.charCodeAt(n + 2); t += String.fromCharCode((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63); n += 3; }
        }
        return t;
    }
};

/**
 * Extracts links matching 'hub.hailmary.lat' pattern.
 */
function extractHubLinks(html) {
    // Regex for matching 'hub.hailmary.lat' URLs in raw HTML
    var regex = /https:\/\/hub\.hailmary\.lat\/[a-zA-Z0-9\-_?=&]+/gi;
    return html.match(regex) || [];
}

/**
 * Traverses Next.js pre-rendered JSON. Highly defensive pathing.
 */
function findSourceIdInProps(obj) {
    if (!obj || typeof obj !== 'object') return null;
    
    // Defensively check Props > pageProps > results
    if (obj.props && obj.props.pageProps && obj.props.pageProps.results) {
        var r = obj.props.pageProps.results;
        for (var i = 0; i < r.length; i++) {
            if (r[i] && r[i].source_id) {
                return r[i].source_id;
            }
        }
    }
    // Deep fallback if the path changes (common in Next.js patches)
    if (obj.results && Array.isArray(obj.results)) {
        for (var j = 0; j < obj.results.length; j++) {
            if (obj.results[j] && obj.results[j].source_id) {
                return obj.results[j].source_id;
            }
        }
    }
    return null;
}

// -------------------------------------------------------------------------
// MAIN STREAM FUNCTION (getStreams)
// -------------------------------------------------------------------------
function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise(function(resolve) {
        // Reuse common TMDB Key
        var TMDB_KEY = '5a687352f7f95d8525b682b6e1b6f007'; 
        var tmdbUrl = mediaType === 'movie'
            ? 'https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + TMDB_KEY
            : 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + TMDB_KEY;

        console.log('[NetVlyx] getStreams started for ID: ' + tmdbId);

        // --- PHASE 1: TMDB LOOKUP ---
        fetch(tmdbUrl)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                // Must extract title, as NetVlyx only supports title searching.
                var title = data.title || data.name;
                if (!title) { throw new Error('No title found via TMDB.'); }
                console.log('[NetVlyx] Title identified: ' + title);
                
                // --- PHASE 2: NETVLYX SEARCH ---
                // We encode URI to prevent site errors.
                var searchUrl = BASE_URL + '/?search=' + encodeURIComponent(title);
                console.log('[NetVlyx] Phase 2 - Requesting Search: ' + searchUrl);
                // MUST include Origin for PWA validation bypass
                return httpGet(searchUrl, true);
            })
            .then(function(searchHtml) {
                if (!searchHtml) { throw new Error('Blank search results received.'); }
                console.log('[NetVlyx] Phase 3 - Search HTML loaded. Size: ' + searchHtml.length);
                
                // --- PHASE 3: PARSE RESULTS (Next.js Hydration Bypass) ---
                console.log('[NetVlyx] Attempting Next.js data bundle extraction...');
                
                // Next.js embeds pre-rendered JSON data here to hydate the client.
                // We bypass client-side rendering by grabbing this data directly.
                var nextDataRegex = /<script\s+id="__NEXT_DATA__"\s+type="application\/json">\s*({[\s\S]+?})\s*<\/script>/i;
                var match = nextDataRegex.exec(searchHtml);
                
                if (!match || !match[1]) {
                    // This failure means NetVlyx is still detecting and blocking Nuvio.
                    console.error('[NetVlyx] FAILED to extract Next.js data bundle. Nuvio is likely being blocked.');
                    throw new Error('Nuvio Blocked (NextData)');
                }
                
                var dataBundle;
                try {
                    dataBundle = JSON.parse(match[1]);
                } catch(e) {
                    console.error('[NetVlyx] FAILED to parse Next.js JSON: ' + e.message);
                    throw new Error('JSON parse failed');
                }
                
                // Traverse JSON to find the source ID for the first result
                var encryptedId = findSourceIdInProps(dataBundle);
                
                if (!encryptedId) {
                    console.log('[NetVlyx] Phase 3 FAILED - Movie results not found in JSON.');
                    return null; // Return null to skip to next then
                }
                
                console.log('[NetVlyx] Phase 3 COMPLETE - Extracted encrypted ID: ' + encryptedId.substring(0, 15) + '...');
                return encryptedId;
            })
            .then(function(encryptedId) {
                if (!encryptedId) { return null; }
                
                // --- PHASE 4: ID DECODING ---
                var sourcePageUrl;
                try {
                    console.log('[NetVlyx] Phase 4 - Decoding ID');
                    sourcePageUrl = InternalDecoder.fromB64(encryptedId);
                } catch(e) {
                    console.error('[NetVlyx] Phase 4 FAILED - Base64 decode broke: ' + e.message);
                    throw new Error('ID decode failed');
                }
                
                if (!sourcePageUrl || sourcePageUrl.indexOf('http') !== 0) {
                     console.error('[NetVlyx] Phase 4 FAILED - Decoded URL is invalid.');
                     throw new Error('ID Decode invalid URL');
                }
                
                console.log('[NetVlyx] Phase 4 COMPLETE - Source Page identified: ' + sourcePageUrl);
                
                // --- PHASE 5: FETCH DIRECT SOURCE PAGE ---
                // Now requesting the stream page (e.g., HDHub4U)
                console.log('[NetVlyx] Phase 5 - Requesting source page...');
                // Origin not required for this request.
                return httpGet(sourcePageUrl, false);
            })
            .then(function(sourcePageHtml) {
                if (!sourcePageHtml) { 
                    console.warn('[NetVlyx] Phase 5 FAILED - Source page is blank.');
                    resolve([]); 
                    return; 
                }
                
                console.log('[NetVlyx] Phase 5 - Scrambling for final hub links.');

                // --- PHASE 6: FINAL LINK EXTRACTION ---
                // Regex for 'hub.hailmary.lat' URLs
                var streamLinks = extractHubLinks(sourcePageHtml);
                
                if (!streamLinks || streamLinks.length === 0) {
                    console.log('[NetVlyx] Phase 5 FAILED - No playable links found in source page HTML.');
                    resolve([]);
                    return;
                }
                
                console.log('[NetVlyx] Phase 5 COMPLETE - Valid links found: ' + streamLinks.length);
                
                // --- PHASE 7: STRUCTURE FOR PLAYER ---
                var finalStreams = [];
                for (var i = 0; i < streamLinks.length; i++) {
                    finalStreams.push({
                        name: '🎬 NetVlyx Bypasser',
                        title: 'Stream ' + (i + 1) + ' (WV-Valid)',
                        url: streamLinks[i],
                        quality: '1080p', 
                        // It is crucial to attach all mandatory headers with the stream object.
                        headers: {
                            'User-Agent': UA_STRING,
                            'Referer': BASE_URL + '/',
                            'Origin': BASE_URL,
                            'sec-ch-ua': '"Android WebView";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
                            'Accept-Encoding': 'identity;q=1, *;q=0',
                            'Range': 'bytes=0-'
                        }
                    });
                }
                
                console.log('[NetVlyx] Resolving streams to player!');
                resolve(finalStreams);
            })
            .catch(function(err) {
                // Catches ALL errors in the Promise chain.
                console.error('[NetVlyx] CRITICAL FAILURE: ' + err.message);
                resolve([]);
            });
    });
}

// -------------------------------------------------------------------------
// EXPORT
// -------------------------------------------------------------------------
module.exports = {
    getStreams: getStreams
};
