/**
 * NetMirror - Fixed Version (Rate-Limit Protection & Sequential Fetching)
 */

// Updated to a more standard, stable User-Agent
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

var cachedBaseUrl = null;
var cachedStreamBaseUrl = null;
var cachedS1Cookies = "";
var cachedS2Cookies = "";
var cacheTimestamp = 0;
var CACHE_DURATION = 7200 * 1000; // Increased to 2 hours to reduce init hits

// Helper: Sleep function to prevent "Too Many Requests"
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateSpoofedCookies() {
    var now = Math.floor(Date.now() / 1000);
    var mutateHex = function(hexStr) {
        var chars = hexStr.split('');
        for(var i = chars.length - 4; i < chars.length; i++) {
            chars[i] = Math.floor(Math.random() * 16).toString(16);
        }
        return chars.join('');
    };
    var userToken = mutateHex("70616185895ea8507acfe05437a9d4fc");
    var tHash = mutateHex("a478b84982c0b0920a91838c5df6c5f4") + "::" + now + "::ac";
    var tHashT = mutateHex("779fc597851aa6b05d46d86583ef647d") + "::" + mutateHex("5185938f776f1b181082230868049087") + "::" + now + "::ac::p";
    return "t_hash_t=" + encodeURIComponent(tHashT) + "; t_hash=" + encodeURIComponent(tHash) + "; user_token=" + userToken;
}

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
    var finalCookies = dynamicCookies ? dynamicCookies : generateSpoofedCookies();
    return {
        "User-Agent": USER_AGENT, 
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Referer": urlObj.origin + refererPath, 
        "Origin": urlObj.origin,
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": "ott=" + ottTag + "; " + finalCookies
    };
}

function safeFetchText(url, options) {
    return fetch(url, options || {}).then(function(res) {
        if (res.status === 429) throw new Error("Rate Limited");
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
    });
}

function safeFetchJson(url, options) {
    return fetch(url, options || {}).then(function(res) {
        if (res.status === 429) throw new Error("Rate Limited");
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
    });
}

function getBaseUrlsAndCookies() {
    if (cachedBaseUrl && cachedS1Cookies && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
        return Promise.resolve({ baseUrl: cachedBaseUrl, streamBaseUrl: cachedStreamBaseUrl, s1Cookies: cachedS1Cookies, s2Cookies: cachedS2Cookies });
    }
    
    return safeFetchText("https://netmirror.gg/2/en", { headers: { "User-Agent": USER_AGENT } })
    .then(function(html) {
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

        // Fix: Sequential fetching with delays to avoid "Abuse" detection
        return sleep(800).then(() => safeFetchText(baseUrl + "/home", { headers: { "User-Agent": USER_AGENT } }))
            .then(html1 => {
                var c1 = extractHiddenTokens(html1);
                return sleep(800).then(() => safeFetchText(streamBaseUrl + "/search", { headers: { "User-Agent": USER_AGENT } }))
                    .then(html2 => {
                        var c2 = extractHiddenTokens(html2);
                        cachedBaseUrl = baseUrl;
                        cachedStreamBaseUrl = streamBaseUrl;
                        cachedS1Cookies = c1;
                        cachedS2Cookies = c2;
                        cacheTimestamp = Date.now();
                        return { baseUrl, streamBaseUrl, s1Cookies: c1, s2Cookies: c2 };
                    });
            });
    }).catch(function(e) {
        return { baseUrl: "https://net22.cc", streamBaseUrl: "https://net52.cc", s1Cookies: "", s2Cookies: "" };
    });
}

function fetchServer1(title, baseUrl, streamBaseUrl, s1Cookies) {
    var timestamp = Math.floor(Date.now() / 1000);
    var searchUrl = baseUrl + "/search.php?s=" + encodeURIComponent(title) + "&t=" + timestamp;
    
    return sleep(500).then(() => safeFetchJson(searchUrl, { headers: getHeaders(searchUrl, '/home', 'nf', s1Cookies) }))
    .then(function(searchData) {
        if (!searchData.searchResult || searchData.searchResult.length === 0) return [];
        var movieId = searchData.searchResult[0].id;

        return sleep(500).then(() => safeFetchJson(baseUrl + "/play.php", {
            method: 'POST',
            headers: Object.assign(getHeaders(baseUrl + "/play.php", '/home', 'nf', s1Cookies), { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }),
            body: "id=" + movieId
        })).then(function(hashData) {
            if (!hashData.h) return [];
            var actualHash = hashData.h.indexOf("in=") === 0 ? hashData.h.substring(3) : hashData.h;
            var playlistUrl = streamBaseUrl + "/playlist.php?id=" + movieId + "&t=" + encodeURIComponent(title) + "&tm=" + timestamp + "&h=" + actualHash;
            
            return sleep(500).then(() => safeFetchJson(playlistUrl, { headers: getHeaders(playlistUrl, '/', 'nf', s1Cookies) }))
            .then(function(playlistData) {
                return playlistData.flatMap(item => (item.sources || []).map(source => ({
                    name: "NetMirror [S1]",
                    title: "Netflix - " + (source.label || 'HD'),
                    url: streamBaseUrl + source.file,
                    quality: source.label || "1080p",
                    headers: { "Referer": streamBaseUrl + "/", "User-Agent": USER_AGENT }
                })));
            });
        });
    }).catch(() => []);
}

function fetchServer2(title, streamBaseUrl, s2Cookies) {
    var timestamp = Math.floor(Date.now() / 1000);
    var searchUrl = streamBaseUrl + "/pv/search.php?s=" + encodeURIComponent(title);

    return sleep(1000).then(() => safeFetchJson(searchUrl, { headers: getHeaders(searchUrl, '/search', 'pv', s2Cookies) }))
    .then(function(searchData) {
        if (!searchData.searchResult || searchData.searchResult.length === 0) return [];
        var movieId = searchData.searchResult[0].id;
        var playlistUrl = streamBaseUrl + "/pv/playlist.php?id=" + movieId + "&tm=" + timestamp;

        return sleep(500).then(() => safeFetchJson(playlistUrl, { headers: getHeaders(playlistUrl, '/search', 'pv', s2Cookies) }))
        .then(function(playlistData) {
            return playlistData.flatMap(item => (item.sources || []).map(source => ({
                name: "NetMirror [S2]",
                title: "Prime - " + (source.label || 'HD'),
                url: streamBaseUrl + source.file,
                quality: source.label || "1080p",
                headers: { "Referer": streamBaseUrl + "/", "User-Agent": USER_AGENT }
            })));
        });
    }).catch(() => []);
}

function getStreams(tmdbId, mediaType) {
    if (mediaType !== 'movie') return Promise.resolve([]);
    var tmdbUrl = "https://api.themoviedb.org/3/movie/" + tmdbId + "?api_key=d131017ccc6e5462a81c9304d21476de&language=en-US";

    return safeFetchJson(tmdbUrl).then(function(mediaData) {
        if (!mediaData || !mediaData.title) return [];
        return getBaseUrlsAndCookies().then(function(config) {
            // Sequential server fetching to lower request density
            return fetchServer1(mediaData.title, config.baseUrl, config.streamBaseUrl, config.s1Cookies)
                .then(s1 => fetchServer2(mediaData.title, config.streamBaseUrl, config.s2Cookies)
                .then(s2 => s1.concat(s2)));
        });
    }).catch(() => []);
}

module.exports = { getStreams: getStreams };
