/**
 * PlayIMDb - Nuvio "Secure Tunnel" Edition
 * This bypasses "Connection Refused" by using a secure HTTPS bridge.
 */

function getStreams(tmdbId, type, season, episode) {
    return new Promise(function(resolve) {
        
        // We use a high-speed HTTPS proxy that Android won't block.
        // This acts as the middleman between your phone and the blocked .ru site.
        var bridge = "https://api.allorigins.win/get?url=";
        var target = "https://vsembed.ru/embed/" + tmdbId + "/";
        
        // Final secure URL
        var secureUrl = bridge + encodeURIComponent(target);

        console.log("[PlayIMDb] Requesting via Secure Bridge...");

        fetch(secureUrl)
            .then(function(res) {
                if (!res.ok) throw new Error("Bridge connection failed");
                return res.json(); 
            })
            .then(function(data) {
                // AllOrigins gives us the HTML inside a 'contents' key
                var html = data.contents;
                
                // Look for the video player
                var iframeMatch = html.match(/iframe id="player_iframe" src="([^"]+)"/i);
                
                if (iframeMatch) {
                    var streamUrl = iframeMatch[1];
                    if (streamUrl.indexOf('//') === 0) streamUrl = "https:" + streamUrl;

                    resolve([{
                        name: "Secure Mirror",
                        title: "PlayIMDb | 1080p Bypass",
                        url: streamUrl,
                        quality: "1080p",
                        headers: { 
                            "Referer": "https://vsembed.ru/",
                            "User-Agent": "Mozilla/5.0 (NVShield)"
                        }
                    }]);
                } else {
                    console.log("[PlayIMDb] No iframe found in HTML.");
                    resolve([]);
                }
            })
            .catch(function(err) {
                console.error("[PlayIMDb] Fetch failed: " + err.message);
                // Return empty so the app stops the loading circle
                resolve([]);
            });
    });
}

// System Export for Nuvio
if (typeof module !== 'undefined') {
    module.exports = { getStreams: getStreams };
}
global.getStreams = getStreams;
