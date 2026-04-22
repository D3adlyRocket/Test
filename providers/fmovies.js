var cheerio = require('cheerio-without-node-native');

var BASE_URL = 'https://filmpalast.to';
var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
var TMDB_BASE_URL = 'https://api.themoviedb.org/3';

var DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE_URL
};

// ==========================================
// 1. HELPER UTILS (Your Provided Logic)
// ==========================================
function b64decode(str) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var result = "";
    var i = 0;
    var s = str.replace(/[^A-Za-z0-9+/]/g, "");
    while (i < s.length) {
        var a = chars.indexOf(s[i++]);
        var b = chars.indexOf(s[i++]);
        var c = i < s.length ? chars.indexOf(s[i++]) : -1;
        var d = i < s.length ? chars.indexOf(s[i++]) : -1;
        var cb = c === -1 ? 0 : c;
        var db = d === -1 ? 0 : d;
        var n = a << 18 | b << 12 | cb << 6 | db;
        result += String.fromCharCode(n >> 16 & 255);
        if (c !== -1) result += String.fromCharCode(n >> 8 & 255);
        if (d !== -1) result += String.fromCharCode(n & 255);
    }
    return result;
}

function resolveRelativeUrl(href, base) {
    if (href.indexOf("http") === 0) return href;
    var m = base.match(/^(https?:\/\/[^/]+)/);
    var origin = m ? m[1] : "";
    if (href.charAt(0) === "/") return origin + href;
    var basePath = base.substring(0, base.lastIndexOf("/") + 1);
    return basePath + href;
}

// ==========================================
// 2. VOE DECODER (Your Provided Logic)
// ==========================================
function voeDecode(ct, luts) {
    try {
        var rawLuts = luts.replace(/^\[|\]$/g, "").split("','").map(function(s) {
            return s.replace(/^'+|'+$/g, "");
        });
        var escapedLuts = rawLuts.map(function(i) {
            return i.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        });
        var txt = "";
        for (var ci = 0; ci < ct.length; ci++) {
            var x = ct.charCodeAt(ci);
            if (x > 64 && x < 91) x = (x - 52) % 26 + 65;
            else if (x > 96 && x < 123) x = (x - 84) % 26 + 97;
            txt += String.fromCharCode(x);
        }
        for (var pi = 0; pi < escapedLuts.length; pi++) txt = txt.replace(new RegExp(escapedLuts[pi], "g"), "_");
        txt = txt.split("_").join("");
        var decoded1 = b64decode(txt);
        if (!decoded1) return null;
        var step4 = "";
        for (var si = 0; si < decoded1.length; si++) step4 += String.fromCharCode((decoded1.charCodeAt(si) - 3 + 256) % 256);
        var revBase64 = step4.split("").reverse().join("");
        var finalStr = b64decode(revBase64);
        if (!finalStr) return null;
        return JSON.parse(finalStr);
    } catch (e) {
        return null;
    }
}

// ==========================================
// 3. EXTRACTORS
// ==========================================

async function extractVoe(embedUrl) {
    try {
        // Step 1: Handle the Landing Page Redirect
        var res = await fetch(embedUrl, { headers: { "Referer": embedUrl } });
        var data = await res.text();

        // Redirect check (per your debug logs)
        var redirectMatch = data.match(/window\.location\.href\s*=\s*['"](https:\/\/[^'"]+)['"]/i);
        if (redirectMatch && redirectMatch[1].indexOf('voe.sx') === -1) {
            console.log("[VOE] Redirecting to bypass landing page...");
            res = await fetch(redirectMatch[1], { headers: { "Referer": embedUrl } });
            data = await res.text();
        }

        // Step 2: Use your resolveVoe logic on the final page data
        var rMain = data.match(/json">\s*\[?\s*['"]([^'"]+)['"]\s*\]?\s*<\/script>\s*<script[^>]*src=['"]([^'"]+)['"]/i);
        if (rMain) {
            var encodedArray = rMain[1];
            var loaderUrl = resolveRelativeUrl(rMain[2], embedUrl);
            var jsRes = await fetch(loaderUrl, { headers: { "Referer": embedUrl } });
            var jsData = await jsRes.text();
            
            var replMatch = jsData.match(/(\[(?:'[^']{1,10}'[\s,]*){4,12}\])/i) || jsData.match(/(\[(?:"[^"]{1,10}"[,\s]*){4,12}\])/i);
            if (replMatch) {
                var decoded = voeDecode(encodedArray, replMatch[1]);
                if (decoded && (decoded.source || decoded.direct_access_url)) {
                    return decoded.source || decoded.direct_access_url;
                }
            }
        }

        // Fallback
        var re = /(?:mp4|hls|file)['"\s]*:\s*['"]([^'"]+)['"]/gi;
        var m;
        while ((m = re.exec(data)) !== null) {
            var url = m[1];
            if (url && url.indexOf("aHR0") === 0) return b64decode(url);
            if (url && url.indexOf("http") === 0) return url;
        }
    } catch (err) {
        console.log("[VOE] Error: " + err.message);
    }
    return null;
}

async function extractVidara(urlStr) {
    try {
        var filecodeMatch = urlStr.match(/\/(?:e|v|f)\/([a-zA-Z0-9]+)/);
        if (!filecodeMatch) return null;
        var apiBase = urlStr.split('/')[0] + '//' + urlStr.split('/')[2];
        var pageRes = await fetch(urlStr, { headers: DEFAULT_HEADERS });
        var pageHtml = await pageRes.text();
        var tokenMatch = pageHtml.match(/key:\s*['"]([^'"]+)['"]/i);
        
        var response = await fetch(apiBase + '/api/stream', {
            method: 'POST',
            headers: Object.assign({}, DEFAULT_HEADERS, { 'Content-Type': 'application/json', 'Referer': urlStr, 'X-Requested-With': 'XMLHttpRequest' }),
            body: JSON.stringify({ filecode: filecodeMatch[1], device: 'web', key: tokenMatch ? tokenMatch[1] : null })
        });
        var data = await response.json();
        return data && (data.streaming_url || data.url) ? (data.streaming_url || data.url) : null;
    } catch (e) { return null; }
}

// ==========================================
// 4. MAIN SCRAPER
// ==========================================
async function getStreams(tmdbId, mediaType) {
    var results = [];
    try {
        var tmdbUrl = TMDB_BASE_URL + '/' + (mediaType === 'series' ? 'tv' : 'movie') + '/' + tmdbId + '/external_ids?api_key=' + TMDB_API_KEY;
        var idData = await fetch(tmdbUrl).then(r => r.json());
        if (!idData.imdb_id) return [];

        var searchRes = await fetch(BASE_URL + '/autocomplete.php', {
            method: 'POST',
            headers: { 'User-Agent': DEFAULT_HEADERS['User-Agent'], 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'term=' + encodeURIComponent(idData.imdb_id)
        });
        
        var movieList = await searchRes.json();
        if (!movieList || movieList.length === 0) return [];
        
        var targetTitle = movieList.find(t => t.toLowerCase().indexOf('english') === -1) || movieList[0];
        var searchPageUrl = BASE_URL + '/search/title/' + encodeURIComponent(targetTitle);
        var searchHtml = await fetch(searchPageUrl, { headers: DEFAULT_HEADERS }).then(r => r.text());
        var $search = cheerio.load(searchHtml);
        
        var streamAnchor = $search('a[href*="/stream/"]').first();
        var streamPageUrl = streamAnchor.length > 0 ? BASE_URL + streamAnchor.attr('href').replace('/filmpalast.to', '') : (searchHtml.indexOf('currentStreamLinks') !== -1 ? searchPageUrl : null);

        if (!streamPageUrl) return [];

        var streamPageHtml = await fetch(streamPageUrl, { headers: DEFAULT_HEADERS }).then(r => r.text());
        var $stream = cheerio.load(streamPageHtml);
        var anchors = $stream('.currentStreamLinks a, .hosterSite span a, .streamList a').toArray();

        for (var i = 0; i < anchors.length; i++) {
            var aHref = $stream(anchors[i]).attr('href');
            if (!aHref || aHref.indexOf('javascript') !== -1) continue;
            var fullUrl = aHref.indexOf('//') === 0 ? 'https:' + aHref : (aHref.indexOf('http') === 0 ? aHref : 'https://' + aHref);
            
            if (fullUrl.indexOf('voe.sx') !== -1) {
                var direct = await extractVoe(fullUrl);
                if (direct) results.push({ url: direct, meta: { title: "VOE \xB7 1080p", countryCodes: ['de'] } });
            } else if (fullUrl.indexOf('vidara.') !== -1 || fullUrl.indexOf('vidfast.') !== -1) {
                var direct = await extractVidara(fullUrl);
                if (direct) results.push({ url: direct, meta: { title: "Vidara \xB7 1080p", countryCodes: ['de'] } });
            }
        }
    } catch (e) { console.log("[Filmpalast] Fatal Error: " + e.message); }
    return results;
}

module.exports = { getStreams };
