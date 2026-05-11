/**
 * NetMirror - Pure Promise Version (Dynamic Cookies + WAF Bypass)
 */

var USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1";

var cachedBaseUrl = null;
var cachedStreamBaseUrl = null;
var cachedS1Cookies = "";
var cachedS2Cookies = "";
var cacheTimestamp = 0;
var CACHE_DURATION = 3600 * 1000;

// FALLBACK EXPLOIT: Generates randomized tokens if the live scrape fails
function generateSpoofedCookies() {
    var now = Math.floor(Date.now() / 1000);
    var mutateHex = function(hexStr) {
        var chars = hexStr.split('');
        for(var i = chars.length - 4; i < chars.length; i++) {
            chars[i] = Math.floor(Math.random() * 16).toString(16);
        }
        return chars.join('');
    };

    var baseUserToken = "70616185895ea8507acfe05437a9d4fc";
    var baseHash1 = "779fc597851aa6b05d46d86583ef647d";
    var baseHash2 = "5185938f776f1b181082230868049087";
    var baseHash3 = "a478b84982c0b0920a91838c5df6c5f4";

    var userToken = mutateHex(baseUserToken);
    var tHash = mutateHex(baseHash3) + "::" + now + "::ac";
    var tHashT = mutateHex(baseHash1) + "::" + mutateHex(baseHash2) + "::" + now + "::ac::p";

    return "t_hash_t=" + encodeURIComponent(tHashT) + "; t_hash=" + encodeURIComponent(tHash) + "; user_token=" + userToken;
}

// PRIMARY METHOD: Aggressively extracts hidden cryptographic tokens from HTML source code
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

// Generates matching browser headers for WAF bypass
function getHeaders(targetUrl, refererPath, ottTag, dynamicCookies) {
    var urlObj = new URL(targetUrl);
    // If the live scraper failed, fall back to the spoofed hex exploit
    var finalCookies = dynamicCookies ? dynamicCookies : generateSpoofedCookies();
    
    return {
        "User-Agent": USER_AGENT, 
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-CA,en-US;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate", 
        "Referer": urlObj.origin + refererPath, 
        "Origin": urlObj.origin,
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        "X-Requested-With": "XMLHttpRequest",
        "Connection": "keep-alive",
        "Cookie": "ott=" + ottTag + "; " + finalCookies
    };
}

// Helpers
function safeFetchText(url, options) {
    return fetch(url, options || {}).then(function(res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
    });
}

function safeFetchJson(url, options) {
    return fetch(url, options || {}).then(function(res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
    });
}

// Derives backend URLs AND automatically scrapes the live cookies
function getBaseUrlsAndCookies() {
    if (cachedBaseUrl && cachedS1Cookies && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return Promise.resolve({ 
            baseUrl: cachedBaseUrl, 
            streamBaseUrl: cachedStreamBaseUrl,
            s1Cookies: cachedS1Cookies,
            s2Cookies: cachedS2Cookies
        });
    }
    
    return safeFetchText("https://netmirror.gg/2/en", {
        headers: { "User-Agent": USER_AGENT, "Accept": "text/html" }
    }).then(function(html) {
        var match = html.match(/onclick="location\.href='([^']+)'"[^>]*>Go to Home/);
        var baseUrl = "https://net22.cc";
        var streamBaseUrl = "https://net52.cc";
        
        if (match && match[1]) {
            var parsedUrl = new URL(match[1]);
            baseUrl = parsedUrl.protocol + "//" + parsedUrl.host;
            var numMatch = baseUrl.match(/net(\d+)\.cc/);
            if (numMatch) {
                var num = parseInt(numMatch[1]);
                streamBaseUrl = baseUrl.replace(numMatch[1], String(num + 30));
            }
        }

        // Simultaneously fetch the homepages of both servers to scrape the cookies
        var p1 = safeFetchText(baseUrl + "/home", { headers: { "User-Agent": USER_AGENT } })
            .then(extractHiddenTokens).catch(function() { return ""; });
            
        var p2 = safeFetchText(streamBaseUrl + "/search", { headers: { "User-Agent": USER_AGENT } })
            .then(extractHiddenTokens).catch(function() { return ""; });

        return Promise.all([p1, p2]).then(function(cookies) {
            cachedBaseUrl = baseUrl;
            cachedStreamBaseUrl = streamBaseUrl;
            cachedS1Cookies = cookies[0];
            cachedS2Cookies = cookies[1];
            cacheTimestamp = Date.now();
            
            return { 
                baseUrl: baseUrl, 
                streamBaseUrl: streamBaseUrl,
                s1Cookies: cookies[0],
                s2Cookies: cookies[1]
            };
        });
    }).catch(function(e) {
        console.error("[NetMirror] Init Error: " + e.message);
        return { baseUrl: "https://net22.cc", streamBaseUrl: "https://net52.cc", s1Cookies: "", s2Cookies: "" };
    });
}

function fetchServer1(title, baseUrl, streamBaseUrl, s1Cookies) {
    var timestamp = Math.floor(Date.now() / 1000);
    var searchUrl = baseUrl + "/search.php?s=" + encodeURIComponent(title) + "&t=" + timestamp;
    var searchHeaders = getHeaders(searchUrl, '/home', 'nf', s1Cookies);

    return safeFetchJson(searchUrl, { headers: searchHeaders }).then(function(searchData) {
        if (!searchData.searchResult || searchData.searchResult.length === 0) return [];
        var movieId = searchData.searchResult[0].id;

        var hashUrl = baseUrl + "/play.php";
        return safeFetchJson(hashUrl, {
            method: 'POST',
            headers: Object.assign({}, searchHeaders, { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }),
            body: "id=" + movieId
        }).then(function(hashData) {
            if (!hashData.h) return [];
            var actualHash = hashData.h.indexOf("in=") === 0 ? hashData.h.substring(3) : hashData.h;

            var playlistUrl = streamBaseUrl + "/playlist.php?id=" + movieId + "&t=" + encodeURIComponent(title) + "&tm=" + timestamp + "&h=" + actualHash;
            var playlistHeaders = getHeaders(playlistUrl, '/', 'nf', s1Cookies);

            return safeFetchJson(playlistUrl, { headers: playlistHeaders }).then(function(playlistData) {
                var streams = [];
                playlistData.forEach(function(item) {
                    if (item.sources) {
                        item.sources.forEach(function(source) {
                            streams.push({
                                name: "NetMirror [S1]",
                                title: "Netflix Server - " + (source.label || 'HD'),
                                url: streamBaseUrl + source.file,
                                quality: source.label || "1080p",
                                headers: {
                                    "Referer": streamBaseUrl + "/",
                                    "Origin": streamBaseUrl,
                                    "User-Agent": USER_AGENT
                                }
                            });
                        });
                    }
                });
                return streams;
            });
        });
    }).catch(function(e) {
        console.error("[NetMirror S1 Error]: " + e.message);
        return [];
    });
}

function fetchServer2(title, streamBaseUrl, s2Cookies) {
    var timestamp = Math.floor(Date.now() / 1000);
    var searchUrl = streamBaseUrl + "/pv/search.php?s=" + encodeURIComponent(title);
    var searchHeaders = getHeaders(searchUrl, '/search', 'pv', s2Cookies);

    return safeFetchJson(searchUrl, { headers: searchHeaders }).then(function(searchData) {
        if (!searchData.searchResult || searchData.searchResult.length === 0) return [];
        var movieId = searchData.searchResult[0].id;

        var playlistUrl = streamBaseUrl + "/pv/playlist.php?id=" + movieId + "&tm=" + timestamp;
        return safeFetchJson(playlistUrl, { headers: searchHeaders }).then(function(playlistData) {
            var streams = [];
            playlistData.forEach(function(item) {
                if (item.sources) {
                    item.sources.forEach(function(source) {
                        streams.push({
                            name: "NetMirror [S2]",
                            title: "Prime Server - " + (source.label || 'HD'),
                            url: streamBaseUrl + source.file,
                            quality: source.label || "1080p",
                            headers: {
                                "Referer": streamBaseUrl + "/",
                                "Origin": streamBaseUrl,
                                "User-Agent": USER_AGENT
                            }
                        });
                    });
                }
            });
            return streams;
        });
    }).catch(function(e) {
        console.error("[NetMirror S2 Error]: " + e.message);
        return [];
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
    console.log("[NetMirror] getStreams: " + tmdbId + " | Type: " + mediaType);
    
    if (mediaType !== 'movie') return Promise.resolve([]);

    var isImdb = String(tmdbId).indexOf("tt") === 0;
    
    var tmdbUrl = isImdb 
        ? "https://api.themoviedb.org/3/find/" + tmdbId + "?api_key=d131017ccc6e5462a81c9304d21476de&external_source=imdb_id&language=en-US"
        : "https://api.themoviedb.org/3/movie/" + tmdbId + "?api_key=d131017ccc6e5462a81c9304d21476de&language=en-US";

    return safeFetchJson(tmdbUrl).then(function(tmdbData) {
        var mediaData;
        if (isImdb) {
            mediaData = tmdbData.movie_results && tmdbData.movie_results[0];
        } else {
            mediaData = tmdbData;
        }
        
        if (!mediaData || !mediaData.title) return [];
        var title = mediaData.title;

        return getBaseUrlsAndCookies().then(function(config) {
            return Promise.all([
                fetchServer1(title, config.baseUrl, config.streamBaseUrl, config.s1Cookies),
                fetchServer2(title, config.streamBaseUrl, config.s2Cookies)
            ]).then(function(results) {
                var streamsS1 = results[0] || [];
                var streamsS2 = results[1] || [];
                return streamsS1.concat(streamsS2);
            });
        });
    }).catch(function(error) {
        console.error("[NetMirror] Global Error: " + error.message);
        return [];
    });
}

module.exports = { getStreams: getStreams };
