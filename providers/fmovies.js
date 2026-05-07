var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var SB_BASE = 'https://febapi.nuvioapp.space/api/media';
var LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie.txt";

function getStreams(tmdbId, type, s, e) {
    // We return a single Promise that the Nuvio engine will wait for
    return fetch(LOCAL_COOKIE_URL)
        .then(function(tokenResp) {
            return tokenResp.text();
        })
        .then(function(rawToken) {
            var token = rawToken.trim();
            if (!token) return [];

            // Build the ShowBox API URL with the required region
            var region = "USA5";
            var api = (type === 'tv') 
                ? SB_BASE + "/tv/" + tmdbId + "/oss=" + region + "/" + s + "/" + e + "?token=" + encodeURIComponent(token)
                : SB_BASE + "/movie/" + tmdbId + "/oss=" + region + "?token=" + encodeURIComponent(token);

            // Fetch the links from ShowBox
            return fetch(api, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Android TV)',
                    'Accept': 'application/json',
                    'Referer': 'https://www.febbox.com/'
                }
            });
        })
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if (!data || !data.versions || data.versions.length === 0) {
                return [];
            }
            
            // Map the links to the format Nuvio expects
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
            // If anything fails (Wi-Fi, Cookie, API), return empty array
            return [];
        });
}

// Ensure the function is attached to the global scope
global.getStreams = getStreams;
