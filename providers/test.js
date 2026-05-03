// =========================================================================
// NUVIO PROVIDER: NETVLYX
// Special compatibility for Next.js 14 Client-Side Rendering
// ES5 Syntax / global fetch() / No Cheerio required
// =========================================================================

var BASE_URL = 'https://netvlyx.pages.dev';
// Minimal required headers
var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.111 Mobile Safari/537.36';

// -------------------------------------------------------------------------
// HTTP HELPER
// -------------------------------------------------------------------------
function httpGet(url, referer) {
    var headers = { 'User-Agent': UA, 'Accept': 'text/html,*/*' };
    if (referer) { headers['Referer'] = referer; }

    console.log('[NetVlyx] Fetching URL: ' + url);
    return fetch(url, { headers: headers }).then(function(res) {
        if (!res.ok) { throw new Error('HTTP ' + res.status); }
        return res.text();
    });
}

// -------------------------------------------------------------------------
// DECODING HELPERS
// -------------------------------------------------------------------------

/**
 * Robust Base64 Decoder (Fallback for older engines)
 */
var Decoder = {
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    fromBase64: function(e) {
        if (typeof atob === 'function') { return atob(e); }
        var t = ""; var n, r, i; var s, o, u, a; var f = 0; e = e.replace(/[^A-Za-z0-9+/=]/g, "");
        while (f < e.length) {
            s = this._keyStr.indexOf(e.charAt(f++)); o = this._keyStr.indexOf(e.charAt(f++));
            u = this._keyStr.indexOf(e.charAt(f++)); a = this._keyStr.indexOf(e.charAt(f++));
            n = s << 2 | o >> 4; r = (o & 15) << 4 | u >> 2; i = (u & 3) << 6 | a;
            t = t + String.fromCharCode(n);
            if (u != 64) { t = t + String.fromCharCode(r); }
            if (a != 64) { t = t + String.fromCharCode(i); }
        }
        return this._utf8_decode(t);
    },
    _utf8_decode: function(e) {
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

/**
 * Extracts links matching 'hub.hailmary.lat' pattern from HTML.
 */
function extractHubLinks(html) {
    var regex = /https:\/\/hub\.hailmary\.lat\/[a-zA-Z0-9\-_?=&]+/g;
    return html.match(regex) || [];
}

/**
 * Specialized parser for Next.js hydration data.
 * NetVlyx uses React/Next.js to render client-side, so traditional HTML parsing fails.
 * We extract the pre-rendered JSON data to find the links.
 */
function extractSourceIdsFromNextJs(html) {
    console.log('[NetVlyx] Parsing Next.js hydration data...');
    
    // Step 1: Locate the special script tag containing pre-rendered JSON
    // Look for <script id="__NEXT_DATA__" type="application/json">...</script>
    var dataRegex = /<script\s+id="__NEXT_DATA__"\s+type="application\/json">\s*({[\s\S]+?})\s*<\/script>/;
    var match = dataRegex.exec(html);
    
    if (!match || !match[1]) {
        console.error('[NetVlyx] FAILED to extract Next.js data bundle.');
        return [];
    }
    
    // Step 2: Parse the raw JSON string
    var fullJson;
    try {
        fullJson = JSON.parse(match[1]);
    } catch(e) {
        console.error('[NetVlyx] FAILED to parse Next.js JSON: ' + e.message);
        return [];
    }
    
    // Step 3: Traverse the JSON object to the results.
    // The exact path varies by Next.js version and app architecture.
    // Assuming a standard path: props.pageProps.results
    var pageProps = (fullJson.props && fullJson.props.pageProps) || {};
    var results = pageProps.results || [];
    
    console.log('[NetVlyx] Pre-rendered results found in Next.js: ' + results.length);
    
    // Step 4: Extract relevant fields (title, and especially the source_id)
    var ids = [];
    for (var i = 0; i < results.length; i++) {
        var res = results[i];
        if (res.title && res.source_id) {
            ids.push({
                title: res.title,
                source_id: res.source_id // This is the encrypted Base64 string
            });
        }
    }
    
    return ids;
}

// -------------------------------------------------------------------------
// MAIN FUNCTION (getStreams)
// -------------------------------------------------------------------------
function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise(function(resolve) {
        // NetVlyx is title-based, requiring TMDB lookups.
        // Using common TMDB key for lookups
        var TMDB_KEY = '5a687352f7f95d8525b682b6e1b6f007'; 
        var tmdbUrl = mediaType === 'movie'
            ? 'https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + TMDB_KEY
            : 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + TMDB_KEY;

        console.log('[NetVlyx] Querying TMDB ID: ' + tmdbId);

        // PHASE 1: TMDB LOOKUP
        fetch(tmdbUrl)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var title = data.title || data.name;
                if (!title) throw new Error('No title found on TMDB lookup.');
                console.log('[NetVlyx] Title identified: ' + title);
                
                // PHASE 2: SEARCH NETVLYX
                // MUST encode URI to prevent site-level errors.
                var searchUrl = BASE_URL + '/?search=' + encodeURIComponent(title);
                console.log('[NetVlyx] Initiating Next.js data fetch from search: ' + searchUrl);
                // MUST include NetVlyx Referer
                return httpGet(searchUrl, BASE_URL + '/');
            })
            .then(function(searchHtml) {
                // PHASE 3: PARSE RESULTS FROM NEXT.JS BUNDLE (Replaces Regex)
                if (!searchHtml || searchHtml.length < 200) { throw new Error('Blank search results received.'); }
                var resultsData = extractSourceIdsFromNextJs(searchHtml);
                
                if (!resultsData || resultsData.length === 0) {
                    console.log('[NetVlyx] Movie not indexed by NetVlyx (No pre-rendered data match).');
                    return null;
                }
                
                // For movies, we assume the first match is correct. (NetVlyx often provides one exact match)
                var bestMatch = resultsData[0];
                var encryptedSourceId = bestMatch.source_id;
                
                console.log('[NetVlyx] Successfully extracted encrypted source ID for: ' + bestMatch.title);
                return encryptedSourceId;
            })
            .then(function(encryptedSourceId) {
                if (!encryptedSourceId) return null;
                
                // PHASE 4: DECODE SOURCE & FETCH STREAMS
                var sourcePageUrl;
                try {
                    console.log('[NetVlyx] Phase 4 - Decoding ID');
                    sourcePageUrl = Decoder.fromBase64(encryptedSourceId);
                } catch(e) {
                    console.error('[NetVlyx] Phase 4 FAILED - Base64 decode failed.');
                    throw new Error('Failed to decode source ID');
                }
                
                // Defensive URI check
                if (!sourcePageUrl || sourcePageUrl.indexOf('http') !== 0) {
                     console.error('[NetVlyx] Phase 4 FAILED - Decoded URL is invalid.');
                     throw new Error('Decoded source ID is not a valid URL');
                }
                
                console.log('[NetVlyx] Decoded Direct Source Page: ' + sourcePageUrl);
                
                // PHASE 5: SCRAPE SOURCE PAGE FOR HUB LINKS
                // Mandatory headers must be included to avoid 403 blocks.
                console.log('[NetVlyx] Requesting direct source page: ' + sourcePageUrl);
                return httpGet(sourcePageUrl, BASE_URL + '/');
            })
            .then(function(sourcePageHtml) {
                if (!sourcePageHtml) { 
                    console.warn('[NetVlyx] Phase 5 FAILED - Source page is blank.');
                    resolve([]); 
                    return; 
                }
                
                console.log('[NetVlyx] Phase 5 - Scrambling for final hub links.');

                // Use the pattern matching regex on the raw HTML.
                var finalLinks = extractHubLinks(sourcePageHtml);
                
                if (!finalLinks || finalLinks.length === 0) {
                    console.log('[NetVlyx] Phase 5 FAILED - No playable links found in source page HTML.');
                    resolve([]);
                    return;
                }
                
                console.log('[NetVlyx] Valid links found: ' + finalLinks.length);
                
                // PHASE 6: FORM THE FINAL STREAM OBJECT FOR NUVIO PLAYER
                // Headers are crucial here (User-Agent, Referer)
                var formattedStreams = finalLinks.map(function(link, index) {
                    return {
                        name: '🔗 NetVlyx Hub',
                        title: 'HQ Stream ' + (index + 1) + ' (Next.js Validated)',
                        url: link,
                        quality: '1080p', 
                        headers: {
                            'User-Agent': UA,
                            'Referer': BASE_URL + '/',
                            'Accept-Encoding': 'identity;q=1, *;q=0',
                            'Range': 'bytes=0-'
                        }
                    };
                });
                
                console.log('[NetVlyx] Resolving streams to player!');
                resolve(formattedStreams);
            })
            .catch(function(err) {
                console.error('[NetVlyx] MAIN ERROR: ' + err.message);
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
