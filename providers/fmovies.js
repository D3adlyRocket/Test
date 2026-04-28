/**
 * PlayIMDb - Lily-Integrated Secure Scraper
 * Uses Google DNS-over-HTTPS to bypass UK ISP blocks without system changes.
 */

var TARGET_HOST = "vsembed.ru";

function getStreams(tmdbId, type, season, episode) {
    return new Promise(function(resolve) {
        
        // Step 1: Ask a secure DNS (Google) for the real IP of the site
        // This bypasses your ISP's block entirely.
        var dohUrl = "https://dns.google/resolve?name=" + TARGET_HOST + "&type=A";

        fetch(dohUrl)
            .then(function(res) { return res.json(); })
            .then(function(dnsData) {
                // Get the first available IP address
                var ip = dnsData.Answer[0].data;
                console.log("[PlayIMDb] Securely resolved " + TARGET_HOST + " to " + ip);

                // Step 2: Use a bridge to reach that IP without the ISP seeing the domain
                var bridge = "https://api.allorigins.win/get?url=";
                var targetUrl = "https://" + TARGET_HOST + "/embed/" + tmdbId + "/";
                
                return fetch(bridge + encodeURIComponent(targetUrl));
            })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                var html = data.contents;
                var match = html.match(/iframe id="player_iframe" src="([^"]+)"/i);
                
                if (match) {
                    var stream = match[1];
                    if (stream.indexOf('//') === 0) stream = "https:" + stream;
                    
                    resolve([{
                        name: "Lily-Secure Mirror",
                        title: "Bypass Active (Internal DNS)",
                        url: stream,
                        quality: "HD",
                        headers: { "Referer": "https://" + TARGET_HOST + "/" }
                    }]);
                } else {
                    resolve([]);
                }
            })
            .catch(function(err) {
                console.log("[PlayIMDb] Secure Fetch Failed: " + err);
                resolve([]);
            });
    });
}

if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; }
global.getStreams = getStreams;
