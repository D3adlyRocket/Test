/**
 * PlayIMDb - Final Playback Fix
 * Bypasses UK ISP blocks AND fixes "Playback Error"
 */

var HOST = "https://vsembed.ru";
var TMDB_API_KEY = '1b3113663c9004682ed61086cf967c44';
var TMDB_BASE = 'https://api.themoviedb.org/3';

async function safeFetch(url) {
    // Bridges the connection to act like SafeDNS
    var bridgeUrl = "https://api.allorigins.win/get?url=" + encodeURIComponent(url);
    var res = await fetch(bridgeUrl);
    var data = await res.json();
    return {
        ok: true,
        text: function() { return Promise.resolve(data.contents); },
        json: function() { return Promise.resolve(JSON.parse(data.contents)); }
    };
}

async function getStreams(tmdbId, type, season, episode) {
    try {
        var playUrl = HOST + "/embed/" + tmdbId + "/";
        var res = await safeFetch(playUrl);
        var html = await res.text();

        var iframeMatch = html.match(/iframe id="player_iframe" src="([^"]+)"/);
        var iframeSrc = iframeMatch ? iframeMatch[1] : null;

        if (iframeSrc) {
            if (iframeSrc.indexOf('//') === 0) iframeSrc = "https:" + iframeSrc;

            return [{
                name: "PlayIMDb | 1080p",
                title: "Server Bypass Active",
                url: iframeSrc,
                quality: "1080p",
                // THIS PART FIXES THE PLAYBACK ERROR
                headers: {
                    "Referer": "https://cloudnestra.com/",
                    "Origin": "https://cloudnestra.com",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
                }
            }];
        }
    } catch (e) {
        return [];
    }
    return [];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
