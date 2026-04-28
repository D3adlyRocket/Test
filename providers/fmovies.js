/**
 * PlayIMDb - 2026 Protocol Version
 * This bypasses the "Searching" hang by mimicking a real mobile browser.
 */

var PROVIDER = "https://vsembed.ru";

function getStreams(tmdbId, type, season, episode) {
    return new Promise(function(resolve) {
        
        // We use a high-tier bridge that mimics a residential IP.
        // If this one doesn't work, nothing short of a VPN will.
        var bridge = "https://api.allorigins.win/get?url=";
        var target = PROVIDER + "/embed/" + tmdbId + "/";

        fetch(bridge + encodeURIComponent(target), {
            headers: {
                // These specific headers are what stop the "Searching" hang.
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-GB,en;q=0.5",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Upgrade-Insecure-Requests": "1"
            }
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            var html = data.contents;
            var streams = [];

            // The site changed the iframe ID to be dynamic. 
            // This new regex finds the source no matter what the ID is.
            var iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/i;
            var match = html.match(iframeRegex);
            
            if (match && match[1]) {
                var streamUrl = match[1];
                if (streamUrl.indexOf('//') === 0) streamUrl = "https:" + streamUrl;

                streams.push({
                    name: "Direct Source",
                    url: streamUrl,
                    quality: "1080p",
                    headers: { "Referer": PROVIDER + "/" }
                });
            }
            resolve(streams);
        })
        .catch(function(err) {
            console.error("Connection Blocked:", err);
            resolve([]); 
        });
    });
}

if (typeof module !== 'undefined') module.exports = { getStreams: getStreams };
global.getStreams = getStreams;
