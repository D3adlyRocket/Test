var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var LOCAL_URL = "http://192.168.1.176:8080/cookie.txt";
var API_BASE = "https://febapi.nuvioapp.space/api";

function getStreams(tmdbId, type, s, e) {
    return fetch(LOCAL_URL)
        .then(function(res) { return res.text(); })
        .then(function(token) {
            var uiToken = token.trim();
            if (!uiToken) return [];

            var boxType = (type === 'tv') ? 2 : 1;
            // STEP 1: Using the 2026 "App Handshake" parameters
            var idUrl = API_BASE + "/febbox/id?id=" + tmdbId + "&type=" + boxType + "&app_id=com.tdo.showbox&app_key=moviebox";

            return fetch(idUrl, {
                headers: { 
                    'Cookie': 'ui=' + uiToken,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.febbox.com/',
                    'Origin': 'https://www.febbox.com'
                }
            });
        })
        .then(function(res) { return res.json(); })
        .then(function(idData) {
            var shareKey = idData.share_key || idData.id;
            if (!shareKey) return [];

            // STEP 2: Fetch files using the verified shareKey
            var listUrl = API_BASE + "/febbox/files/" + shareKey;
            return fetch(listUrl, {
                headers: { 
                    'Cookie': 'ui=' + uiToken,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                    'Referer': 'https://www.febbox.com/'
                }
            });
        })
        .then(function(res) { return res.json(); })
        .then(function(fileData) {
            if (!fileData || !fileData.list || fileData.list.length === 0) return [];

            return fileData.list.map(function(file) {
                return {
                    name: "ShowBox " + (file.quality || "HD"),
                    url: file.url,
                    quality: file.quality || "HD",
                    provider: "ShowBox-Repo-Logic"
                };
            });
        })
        .catch(function() { return []; });
}

global.getStreams = getStreams;
