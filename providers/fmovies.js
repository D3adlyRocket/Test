var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var SB_BASE = 'https://febapi.nuvioapp.space/api/media';
var LOCAL_URL = "http://192.168.1.176:8080/cookie.txt";

function getStreams(tmdbId, type, s, e) {
    return fetch(LOCAL_URL)
        .then(function(res) { return res.text(); })
        .then(function(text) {
            var token = text.trim();
            if (!token) return [];

            // 2026 MANDATORY PARAMETERS
            // We use 'token' instead of 'cookie' and specify the USA5 region cluster
            var api = (type === 'tv') 
                ? SB_BASE + "/tv/" + tmdbId + "/oss=USA5/" + s + "/" + e + "?token=" + encodeURIComponent(token)
                : SB_BASE + "/movie/" + tmdbId + "/oss=USA5?token=" + encodeURIComponent(token);

            return fetch(api, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Android TV) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://www.febbox.com/',
                    'X-App-Id': '68b9a1e0', // This is the standard 2026 App ID for Febapi
                    'Origin': 'https://www.febbox.com'
                }
            });
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            // Check if API returned an error or empty versions
            if (!data || !data.success || !data.versions || data.versions.length === 0) {
                console.log("[ShowBox] API Success but no links. Likely Expired Token.");
                return [];
            }
            
            return data.versions.flatMap(function(v) {
                return (v.links || []).map(function(l) {
                    return {
                        name: "ShowBox " + (l.quality || "HD"),
                        url: l.url,
                        quality: l.quality || "HD",
                        provider: "private-local"
                    };
                });
            });
        })
        .catch(function(err) {
            console.log("[ShowBox] Fatal: " + err.message);
            return [];
        });
}

global.getStreams = getStreams;
