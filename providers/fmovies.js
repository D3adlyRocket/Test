/**
 * PlayIMDb - Public Tunnel Edition
 * No Super Proxy or Every Proxy required.
 * Bypasses UK ISP blocks by routing through a Cloud Bridge.
 */

function getStreams(tmdbId, type, season, episode) {
    return new Promise(function(resolve) {
        
        // This is a public bridge that fetches the content for us
        var bridge = "https://api.allorigins.win/get?url=";
        var targetSite = "https://vsembed.ru/embed/" + tmdbId + "/";
        
        // We wrap the URL to hide it from the ISP
        var finalUrl = bridge + encodeURIComponent(targetSite);

        console.log("[PlayIMDb] Fetching through Cloud Bridge...");

        fetch(finalUrl)
            .then(function(response) {
                if (!response.ok) throw new Error("Bridge blocked");
                return response.json(); // AllOrigins returns a JSON object
            })
            .then(function(data) {
                // The actual website HTML is inside 'data.contents'
                var html = data.contents;
                var streams = [];

                // Find the video player link
                var match = html.match(/iframe id="player_iframe" src="([^"]+)"/i);
                
                if (match) {
                    var videoUrl = match[1];
                    if (videoUrl.indexOf('//') === 0) videoUrl = "https:" + videoUrl;

                    streams.push({
                        name: "Cloud Server",
                        title: "Bypass Active (No Proxy)",
                        url: videoUrl,
                        quality: "HD",
                        headers: { "Referer": "https://vsembed.ru/" }
                    });
                }

                resolve(streams);
            })
            .catch(function(err) {
                console.error("[PlayIMDb] Error: " + err.message);
                resolve([]); // Stop the loading circle
            });
    });
}

// System exports for Nuvio
if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; }
global.getStreams = getStreams;
