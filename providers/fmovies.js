var LOCAL_URL = "http://192.168.1.122:8080/cookie.txt";
var API_BASE = "https://febapi.nuvioapp.space/api";

function getStreams(tmdbId, type, s, e) {
    // 1. Return a hardcoded test link immediately. 
    // If you don't see this in Nuvio, the app isn't reading your file at all.
    var results = [{
        name: "DEBUG: Scraper Loaded",
        url: "http://test.com",
        quality: "720p",
        provider: "internal"
    }];

    // 2. Start the fetch chain
    return fetch(LOCAL_URL)
        .then(function(res) { return res.text(); })
        .then(function(token) {
            var uiToken = token.trim();
            if (!uiToken) return results;

            var boxType = (type === 'tv') ? 2 : 1;
            var idUrl = API_BASE + "/febbox/id?id=" + tmdbId + "&type=" + boxType + "&app_id=com.tdo.showbox&app_key=moviebox";

            return fetch(idUrl, {
                headers: { 
                    'Cookie': 'ui=' + uiToken,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
        })
        .then(function(res) { return res.json(); })
        .then(function(idData) {
            var shareKey = idData.share_key || idData.id;
            if (!shareKey) return results;

            var listUrl = API_BASE + "/febbox/files/" + shareKey;
            return fetch(listUrl, {
                headers: { 
                    'Cookie': 'ui=' + (idData.ui || ''), 
                    'User-Agent': 'Mozilla/5.0'
                }
            });
        })
        .then(function(res) { return res.json(); })
        .then(function(fileData) {
            if (fileData && fileData.list) {
                fileData.list.forEach(function(file) {
                    results.push({
                        name: "ShowBox " + (file.quality || 'HD'),
                        url: file.url,
                        quality: file.quality || "HD",
                        provider: "ShowBox-2026"
                    });
                });
            }
            return results;
        })
        .catch(function(err) {
            // Log the error to the results so you can see it on your screen
            results.push({ name: "ERROR: " + err.message, url: "", quality: "SD" });
            return results;
        });
}

global.getStreams = getStreams;
