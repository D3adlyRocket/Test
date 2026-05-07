var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var LOCAL_URL = "http://192.168.1.176:8080/cookie.txt";

// The new direct API endpoints from the 2026 GitHub repositories
var API_BASE = "https://febapi.nuvioapp.space/api";
var APP_ID = "com.tdo.showbox";
var APP_KEY = "moviebox";

function getStreams(tmdbId, type, s, e) {
    return fetch(LOCAL_URL)
        .then(function(res) { return res.text(); })
        .then(function(token) {
            var uiToken = token.trim();
            if (!uiToken) return [];

            // STEP 1: Get Internal ShareKey (Mapping)
            var boxType = (type === 'tv') ? 2 : 1;
            var idUrl = API_BASE + "/febbox/id?id=" + tmdbId + "&type=" + boxType + "&app_id=" + APP_ID + "&app_key=" + APP_KEY;

            return fetch(idUrl, {
                headers: { 
                    'Cookie': 'ui=' + uiToken,
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Android TV)',
                    'Platform': 'android'
                }
            })
            .then(function(res) { return res.json(); })
            .then(function(idData) {
                var shareKey = idData.share_key || idData.id;
                if (!shareKey) return [];

                // STEP 2: Get File List
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
                if (!fileData || !fileData.list || fileData.list.length === 0) return [];

                // STEP 3: Map the files to the format Nuvio expects
                // Most 2026 repositories now provide the stream URL directly in the file list
                return fileData.list.map(function(file) {
                    return {
                        name: "ShowBox " + (file.quality || "HD"),
                        url: file.url,
                        quality: file.quality || "HD",
                        size: file.size || "Unknown",
                        provider: "ShowBox-Core-2026"
                    };
                });
            });
        })
        .catch(function() {
            return [];
        });
}

global.getStreams = getStreams;
