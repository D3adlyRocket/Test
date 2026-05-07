var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var API_BASE = "https://febapi.nuvioapp.space/api";
var LOCAL_URL = "http://192.168.1.176:8080/cookie.txt";

function getStreams(tmdbId, type, s, e) {
    // Step 1: Read the cookie from your local server
    return fetch(LOCAL_URL)
        .then(function(res) { return res.text(); })
        .then(function(token) {
            var uiToken = token.trim();
            if (!uiToken) return [];

            // Step 2: Get the FebBox Share Key (Mapping TMDB to ShowBox ID)
            // type 1 = movie, type 2 = tv
            var boxType = (type === 'tv') ? 2 : 1;
            var idUrl = API_BASE + "/febbox/id?id=" + tmdbId + "&type=" + boxType;

            return fetch(idUrl, {
                headers: { 
                    'Cookie': 'ui=' + uiToken, 
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Android TV)' 
                }
            })
            .then(function(res) { return res.json(); })
            .then(function(idData) {
                // The server might return 'share_key' or just 'id'
                var shareKey = idData.share_key || idData.id;
                if (!shareKey) return [];

                // Step 3: Fetch the actual file list using the shareKey
                var listUrl = API_BASE + "/febbox/files/" + shareKey;
                return fetch(listUrl, {
                    headers: { 
                        'Cookie': 'ui=' + uiToken,
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Android TV)'
                    }
                });
            })
            .then(function(res) { return res.json(); })
            .then(function(fileData) {
                // If this is empty, your token is likely expired or IP-locked
                if (!fileData || !fileData.list) return [];

                return fileData.list.map(function(file) {
                    return {
                        name: "ShowBox " + (file.quality || 'HD'),
                        url: file.url,
                        quality: file.quality || "HD",
                        size: file.size || "Unknown",
                        provider: "private-local-mapping"
                    };
                });
            });
        })
        .catch(function() {
            return [];
        });
}

global.getStreams = getStreams;
