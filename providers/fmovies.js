/**
 * PlayIMDb - Nuvio Local Bypass
 * Requires: Simple HTTP Server running on phone
 */

// CHANGE THIS to your phone's IP from the app
var SERVER = "http://192.168.1.3:8080"; 

function getStreams(tmdbId, type, season, episode) {
    return new Promise(function(resolve) {
        console.log("[PlayIMDb] Search started for: " + tmdbId);

        // 1. Get the instructions from your phone
        fetch(SERVER + "/config.json")
            .then(function(res) { return res.json(); })
            .then(function(config) {
                
                // 2. Get the cookies from your phone
                return fetch(SERVER + "/cookie.txt")
                    .then(function(res) { return res.text(); })
                    .then(function(cookies) {
                        
                        // 3. Build the bridged URL to jump the UK block
                        var target = config.host + "/embed/" + tmdbId + "/";
                        var bridged = config.proxy + encodeURIComponent(target);

                        return fetch(bridged, {
                            method: 'GET',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (NVShield)',
                                'Cookie': cookies.trim()
                            }
                        });
                    });
            })
            .then(function(res) { return res.text(); })
            .then(function(html) {
                var streams = [];
                // Look for the video player iframe
                var match = html.match(/iframe id="player_iframe" src="([^"]+)"/i);
                
                if (match) {
                    var link = match[1];
                    if (link.indexOf('//') === 0) link = "https:" + link;

                    streams.push({
                        name: "Local Config Link",
                        title: "Bypass Active",
                        url: link,
                        quality: "HD",
                        headers: { "Referer": "https://vsembed.ru/" }
                    });
                }
                
                // Return found links (or empty array if none)
                resolve(streams);
            })
            .catch(function(err) {
                console.log("[PlayIMDb] Error: " + err);
                resolve([]); // Always resolve empty so Nuvio stops the loading circle
            });
    });
}

// Export for the Shield
if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; }
global.getStreams = getStreams;
