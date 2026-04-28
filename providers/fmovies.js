/**
 * PlayIMDb - Nuvio Promise Edition (No-VPN / UK Bypass)
 * Uses Google Mirroring + Promise-based Fetch for Maximum Compatibility.
 */

var HOST = "https://vsembed.ru";
var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

function getStreams(tmdbId, type, season, episode) {
    return new Promise(function(resolve, reject) {
        
        // 1. Construct the Google Tunnel URL
        var targetUrl = HOST + "/embed/" + tmdbId + "/";
        var googleTunnel = "https://translate.google.com/translate?sl=en&tl=en&u=" + encodeURIComponent(targetUrl);

        var headers = {
            "User-Agent": "Mozilla/5.0 (Linux; Android 11; NVShield) AppleWebKit/537.36"
        };

        // 2. Nuvio Fetch (using fetchv2 if available, or standard fetch)
        var fetchMethod = (typeof fetchv2 === 'function') ? fetchv2 : fetch;

        fetchMethod(googleTunnel, headers, 'GET', null, true)
            .then(function(res) {
                return res.text();
            })
            .then(function(html) {
                // Check if we got content back from the tunnel
                if (!html || html.length < 100) {
                    resolve([]);
                    return;
                }

                // Simple extraction of the player iframe
                var iframeMatch = html.match(/iframe id="player_iframe" src="([^"]+)"/i);
                if (iframeMatch) {
                    var streamUrl = iframeMatch[1];
                    // Return a basic stream object to Nuvio
                    resolve([{
                        name: "Google Mirror | HD",
                        title: "PlayIMDb Stream (Bypass Active)",
                        url: streamUrl,
                        quality: "HD",
                        headers: { "Referer": "https://cloudnestra.com/" }
                    }]);
                } else {
                    resolve([]);
                }
            })
            .catch(function(err) {
                console.error("Nuvio Scraper Error:", err);
                resolve([]);
            });
    });
}

// --- NUVIO EXPORT PATTERN ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    // Safety net for sandboxed environments
    global.getStreams = getStreams;
}
