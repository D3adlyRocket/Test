var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var SB_BASE = 'https://febapi.nuvioapp.space/api/media';
var LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie.txt";

function getStreams(tmdbId, type, s, e) {
    // 1. First, get the cookie
    return fetch(LOCAL_COOKIE_URL)
        .then(function(res) { return res.text(); })
        .then(function(text) {
            var token = text.trim();
            if (!token) return [];

            // 2. Build the API URL (Using the 2026 'token=' parameter)
            var api = (type === 'tv') 
                ? SB_BASE + "/tv/" + tmdbId + "/oss=USA5/" + s + "/" + e + "?token=" + encodeURIComponent(token)
                : SB_BASE + "/movie/" + tmdbId + "/oss=USA5?token=" + encodeURIComponent(token);

            // 3. Fetch the links
            return fetch(api, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Android TV)',
                    'Accept': 'application/json'
                }
            });
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            // 4. If ID search (like Hoppers) returns nothing, we MUST return [] 
            // so Nuvio doesn't hang.
            if (!data || !data.versions || data.versions.length === 0) {
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
        .catch(function() {
            return []; // Fail silently to prevent app crash
        });
}

global.getStreams = getStreams;
