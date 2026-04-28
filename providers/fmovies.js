/**
 * Nuvio Local Scraper: PlayIMDb
 * Version: 2.0.0 (2026 Bypass)
 * Setup: Requires 'Simple HTTP Server' app running on phone
 */

// --- CONFIGURATION ---
var PHONE_SERVER = "http://192.168.1.3:8080"; 
var FALLBACK_HOST = "https://vsembed.ru";

/**
 * Main function Nuvio calls to find streams.
 * Note: Must return a Promise. Async/Await is NOT supported here.
 */
function getStreams(tmdbId, mediaType, season, episode) {
    console.log("[PlayIMDb] Starting search for: " + tmdbId);

    return new Promise(function(resolve, reject) {
        
        // 1. Fetch Configuration from your Phone's Simple HTTP Server
        fetch(PHONE_SERVER + "/config.json")
            .then(function(res) { 
                if (!res.ok) throw new Error("Local Config Server Unreachable");
                return res.json(); 
            })
            .then(function(config) {
                // 2. Fetch Cookie Data from your Phone
                return fetch(PHONE_SERVER + "/cookie.txt")
                    .then(function(res) { return res.text(); })
                    .then(function(cookieData) {
                        
                        var targetUrl = (config.host || FALLBACK_HOST) + "/embed/" + tmdbId + "/";
                        var bridgedUrl = config.proxy + encodeURIComponent(targetUrl);

                        console.log("[PlayIMDb] Requesting via Bridge: " + bridgedUrl);

                        // 3. Request the actual video site
                        return fetch(bridgedUrl, {
                            method: 'GET',
                            headers: {
                                "User-Agent": config.userAgent || "Mozilla/5.0",
                                "Cookie": cookieData.trim()
                            }
                        });
                    });
            })
            .then(function(res) { return res.text(); })
            .then(function(html) {
                // 4. Extract the stream URL
                var streams = [];
                var iframeMatch = html.match(/iframe id="player_iframe" src="([^"]+)"/i);
                
                if (iframeMatch) {
                    var finalUrl = iframeMatch[1];
                    if (finalUrl.startsWith('//')) finalUrl = "https:" + finalUrl;

                    streams.push({
                        name: "Bypass Link",
                        title: "Server 1 (Local Config Active)",
                        url: finalUrl,
                        quality: "HD",
                        headers: { "Referer": "https://vsembed.ru/" }
                    });
                }

                console.log("[PlayIMDb] Found " + streams.length + " streams.");
                resolve(streams);
            })
            .catch(function(err) {
                console.error("[PlayIMDb] Critical Error: " + err.message);
                // Return empty array so the app doesn't crash
                resolve([]); 
            });
    });
}

// --- NUVIO SYSTEM EXPORTS ---
// This part ensures the Nuvio Hermes engine sees the code correctly
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
