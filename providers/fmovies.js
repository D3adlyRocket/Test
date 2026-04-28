/**
 * PlayIMDb - Nuvio Universal Bypass
 * Fixes "Connection Refused" by avoiding local IPs.
 */

var PROVIDER_URL = "https://vsembed.ru";

function getStreams(tmdbId, type, season, episode) {
    return new Promise(function(resolve) {
        
        // We use a high-availability 'Mirror Fetcher'. 
        // This acts as a middleman that Nuvio cannot block with a local firewall.
        var bridge = "https://api.codetabs.com/v1/proxy?quest=";
        var target = PROVIDER_URL + "/embed/" + tmdbId + "/";
        
        console.log("[Nuvio] Requesting via Cloud Bridge...");

        fetch(bridge + encodeURIComponent(target), {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })
        .then(function(res) { 
            return res.text(); 
        })
        .then(function(html) {
            var streams = [];
            
            // This regex specifically looks for the player link in the Russian source
            var iframeMatch = html.match(/iframe id="player_iframe" src="([^"]+)"/i);
            
            if (iframeMatch) {
                var finalUrl = iframeMatch[1];
                if (finalUrl.indexOf('//') === 0) finalUrl = "https:" + finalUrl;

                streams.push({
                    name: "Direct Stream (Cloud)",
                    title: "Bypass Active - " + tmdbId,
                    url: finalUrl,
                    quality: "HD",
                    headers: { "Referer": PROVIDER_URL }
                });
            }

            // Always resolve (even if empty) to stop the searching circle
            resolve(streams);
        })
        .catch(function(err) {
            console.error("[Nuvio] Bridge Error: " + err.message);
            resolve([]); 
        });
    });
}

// Ensure Nuvio sees the entry point
if (typeof module !== 'undefined') {
    module.exports = { getStreams: getStreams };
}
global.getStreams = getStreams;
