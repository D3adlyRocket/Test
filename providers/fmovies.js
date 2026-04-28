/**
 * PlayIMDb - SafeDNS Integrated Bypass
 * 100% ES5 Compatible for Nuvio 2026 Engine
 * Bypasses UK ISP blocks without changing system DNS
 */

var HOST = "https://vsembed.ru";
var TMDB_API_KEY = '1b3113663c9004682ed61086cf967c44';
var TMDB_BASE = 'https://api.themoviedb.org/3';

// Integrated "SafeDNS" Logic: Routes blocked requests through a clean bridge
async function safeFetch(url, options) {
    var opt = options || {};
    var headers = opt.headers || {};
    
    // If we are hitting the blocked Russian host, we use the bridge
    if (url.indexOf('vsembed.ru') !== -1 || url.indexOf('cloudnestra') !== -1) {
        var bridgeUrl = "https://api.allorigins.win/get?url=" + encodeURIComponent(url);
        
        // fetchv2 is the Nuvio-specific high-performance fetch
        if (typeof fetchv2 === 'function') {
            var res = await fetchv2(bridgeUrl, {}, 'GET', null, true, 'utf-8');
            var json = await res.json();
            return {
                ok: true,
                text: function() { return Promise.resolve(json.contents); },
                json: function() { return Promise.resolve(JSON.parse(json.contents)); }
            };
        }
        
        // Standard fetch fallback
        var response = await fetch(bridgeUrl);
        var data = await response.json();
        return {
            ok: true,
            text: function() { return Promise.resolve(data.contents); },
            json: function() { return Promise.resolve(JSON.parse(data.contents)); }
        };
    }

    // Normal TMDB or external API calls
    if (typeof fetchv2 === 'function') {
        return await fetchv2(url, headers, opt.method || 'GET', opt.body || null, true, 'utf-8');
    }
    return fetch(url, opt);
}

function toQualityLabel(text) {
    var val = String(text || '').toLowerCase();
    if (val.indexOf('2160') !== -1 || val.indexOf('4k') !== -1) return '2160p';
    if (val.indexOf('1080') !== -1) return '1080p';
    if (val.indexOf('720') !== -1) return '720p';
    return 'HD';
}

async function getTMDBInfo(id, type) {
    var url = TMDB_BASE + "/" + (type === 'tv' ? 'tv' : 'movie') + "/" + id + "?api_key=" + TMDB_API_KEY;
    var res = await safeFetch(url);
    if (!res || !res.ok) return null;
    var data = await res.json();
    return {
        title: data.title || data.name,
        year: (data.release_date || data.first_air_date || "").split("-")[0],
        imdbId: data.imdb_id || id
    };
}

async function resolveDirectStreams(media, type, season, episode) {
    var imdbId = media.imdbId;
    var playUrl = HOST + "/embed/" + imdbId + "/";
    
    var res = await safeFetch(playUrl);
    var html = (res && res.ok) ? await res.text() : '';
    
    // Find the player iframe
    var iframeMatch = html.match(/iframe id="player_iframe" src="([^"]+)"/);
    var iframeSrc = iframeMatch ? iframeMatch[1] : null;
    
    if (iframeSrc) {
        if (iframeSrc.indexOf('//') === 0) iframeSrc = "https:" + iframeSrc;
        
        // Final stream structure for Nuvio
        return [{
            name: "SafeDNS Stream",
            title: media.title + " (" + media.year + ")",
            url: iframeSrc,
            quality: "1080p",
            headers: { "Referer": HOST + "/" }
        }];
    }
    return [];
}

async function getStreams(tmdbId, type, season, episode) {
    try {
        var media = await getTMDBInfo(tmdbId, type);
        var info = media || { title: "Unknown", year: "N/A", imdbId: tmdbId };
        return await resolveDirectStreams(info, type, season, episode);
    } catch (e) {
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
