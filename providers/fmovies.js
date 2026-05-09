/**
 * NetMirror - Pure Promise Version (Hermes Native, WAF Bypass, Dynamic Hashes)
 */

var USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Mobile/15E148 Safari/604.1";

var cachedBaseUrl = null;
var cachedStreamBaseUrl = null;
var cacheTimestamp = 0;
var CACHE_DURATION = 3600 * 1000;

// THE EXPLOIT: Automatically generates fresh tokens to bypass IP-locking
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

// Generates matching browser headers for WAF bypass
function getHeaders(targetUrl, refererPath, ottTag) {
    var urlObj = new URL(targetUrl);
    var dynamicCookies = generateSpoofedCookies();
    
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
        "Cookie": "ott=" + ottTag + "; " + dynamicCookies
    };
}

// Helper: Fetch Text
function safeFetchText(url, options) {
    return fetch(url, options || {}).then(function(res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
    });
}

// Helper: Fetch JSON
function safeFetchJson(url, options) {
    return fetch(url, options || {}).then(function(res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
    });
}

// Derives the dynamic net22 / net52 backend URLs
function getBaseUrls() {
    if (cachedBaseUrl && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return Promise.resolve({ baseUrl: cachedBaseUrl, streamBaseUrl: cachedStreamBaseUrl });
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
        
        cachedBaseUrl = baseUrl;
        cachedStreamBaseUrl = streamBaseUrl;
        cacheTimestamp = Date.now();
        
        return { baseUrl: baseUrl, streamBaseUrl: streamBaseUrl };
    }).catch(function(e) {
        console.error("[NetMirror] Init Error: " + e.message);
        return { baseUrl: "https://net22.cc", streamBaseUrl: "https://net52.cc" };
    });
}

function fetchServer1(title, baseUrl, streamBaseUrl) {
    var timestamp = Math.floor(Date.now() / 1000);
    var searchUrl = baseUrl + "/search.php?s=" + encodeURIComponent(title) + "&t=" + timestamp;
    var searchHeaders = getHeaders(searchUrl, '/home', 'nf');

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
            var playlistHeaders = getHeaders(playlistUrl, '/', 'nf');

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

function fetchServer2(title, streamBaseUrl) {
    var timestamp = Math.floor(Date.now() / 1000);
    var searchUrl = streamBaseUrl + "/pv/search.php?s=" + encodeURIComponent(title);
    var searchHeaders = getHeaders(searchUrl, '/search', 'pv');

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
    
    // Use TMDB API to convert ID to Movie Title
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

        return getBaseUrls().then(function(urls) {
            return Promise.all([
                fetchServer1(title, urls.baseUrl, urls.streamBaseUrl),
                fetchServer2(title, urls.streamBaseUrl)
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
