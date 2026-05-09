/**
 * NetMirror - Optimized Bypass Version
 * Fixes "Too Many Requests" without breaking the fetch logic.
 */

var USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

var cachedBaseUrl = null;
var cachedStreamBaseUrl = null;
var cachedS1Cookies = "";
var cachedS2Cookies = "";
var cacheTimestamp = 0;
var CACHE_DURATION = 1800 * 1000; // 30 mins

function extractHiddenTokens(html) {
    var tokens = [];
    var tHashMatch = html.match(/t_hash\s*[:=]\s*['"]([^'"]+)['"]/);
    var tHashTMatch = html.match(/t_hash_t\s*[:=]\s*['"]([^'"]+)['"]/);
    var userTokenMatch = html.match(/user_token\s*[:=]\s*['"]([^'"]+)['"]/);
    if (tHashMatch) tokens.push("t_hash=" + tHashMatch[1]);
    if (tHashTMatch) tokens.push("t_hash_t=" + tHashTMatch[1]);
    if (userTokenMatch) tokens.push("user_token=" + userTokenMatch[1]);
    return tokens.join('; ');
}

function getHeaders(targetUrl, refererPath, ottTag, dynamicCookies) {
    var urlObj = new URL(targetUrl);
    return {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Referer": urlObj.origin + refererPath,
        "Origin": urlObj.origin,
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": "ott=" + ottTag + "; " + (dynamicCookies || "")
    };
}

function safeFetch(url, options) {
    return fetch(url, options || {}).then(function(res) {
        if (res.status === 429) throw new Error("RATE_LIMIT_HIT");
        if (!res.ok) throw new Error("HTTP_" + res.status);
        return res.headers.get('content-type').includes('json') ? res.json() : res.text();
    });
}

function getBaseUrlsAndCookies() {
    if (cachedBaseUrl && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return Promise.resolve({ baseUrl: cachedBaseUrl, streamBaseUrl: cachedStreamBaseUrl, s1Cookies: cachedS1Cookies, s2Cookies: cachedS2Cookies });
    }

    return safeFetch("https://netmirror.gg/2/en", { headers: { "User-Agent": USER_AGENT } })
    .then(function(html) {
        var match = html.match(/onclick="location\.href='([^']+)'"[^>]*>Go to Home/);
        var baseUrl = match ? new URL(match[1]).origin : "https://net22.cc";
        var numMatch = baseUrl.match(/net(\d+)\.cc/);
        var streamBaseUrl = numMatch ? baseUrl.replace(numMatch[1], String(parseInt(numMatch[1]) + 30)) : "https://net52.cc";

        // Fetch home to get fresh cookies (Essential for S1)
        return safeFetch(baseUrl + "/home", { headers: { "User-Agent": USER_AGENT } })
        .then(function(homeHtml) {
            cachedBaseUrl = baseUrl;
            cachedStreamBaseUrl = streamBaseUrl;
            cachedS1Cookies = extractHiddenTokens(homeHtml);
            cacheTimestamp = Date.now();
            return { baseUrl, streamBaseUrl, s1Cookies: cachedS1Cookies };
        });
    });
}

function getStreams(tmdbId, mediaType) {
    if (mediaType !== 'movie') return Promise.resolve([]);

    var tmdbUrl = "https://api.themoviedb.org/3/movie/" + tmdbId + "?api_key=d131017ccc6e5462a81c9304d21476de&language=en-US";

    return safeFetch(tmdbUrl).then(function(mediaData) {
        if (!mediaData || !mediaData.title) return [];
        var title = mediaData.title;

        return getBaseUrlsAndCookies().then(function(cfg) {
            var timestamp = Math.floor(Date.now() / 1000);
            var searchUrl = cfg.baseUrl + "/search.php?s=" + encodeURIComponent(title) + "&t=" + timestamp;

            // Step 1: Search
            return safeFetch(searchUrl, { headers: getHeaders(searchUrl, '/home', 'nf', cfg.s1Cookies) })
            .then(function(searchData) {
                if (!searchData.searchResult || !searchData.searchResult[0]) return [];
                var mid = searchData.searchResult[0].id;

                // Step 2: Get Play Hash (POST)
                return safeFetch(cfg.baseUrl + "/play.php", {
                    method: 'POST',
                    headers: Object.assign(getHeaders(cfg.baseUrl + "/play.php", '/home', 'nf', cfg.s1Cookies), { "Content-Type": "application/x-www-form-urlencoded" }),
                    body: "id=" + mid
                }).then(function(hData) {
                    var h = hData.h ? (hData.h.startsWith("in=") ? hData.h.substring(3) : hData.h) : null;
                    if (!h) return [];

                    // Step 3: Final Playlist
                    var pUrl = cfg.streamBaseUrl + "/playlist.php?id=" + mid + "&t=" + encodeURIComponent(title) + "&tm=" + timestamp + "&h=" + encodeURIComponent(h);
                    return safeFetch(pUrl, { headers: getHeaders(pUrl, '/', 'nf', cfg.s1Cookies) });
                }).then(function(pData) {
                    var streams = [];
                    if (Array.isArray(pData)) {
                        pData.forEach(function(item) {
                            (item.sources || []).forEach(function(src) {
                                streams.push({
                                    name: "NetMirror [S1]",
                                    title: title + " - " + (src.label || "HD"),
                                    url: cfg.streamBaseUrl + src.file,
                                    quality: src.label || "1080p",
                                    headers: { "Referer": cfg.streamBaseUrl + "/", "User-Agent": USER_AGENT }
                                });
                            });
                        });
                    }
                    return streams;
                });
            });
        });
    }).catch(function(err) {
        console.error("NetMirror Error: " + err.message);
        return [];
    });
}

module.exports = { getStreams: getStreams };
