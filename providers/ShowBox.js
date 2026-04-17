/**
 * @name ShowBox-TV-Edition
 * @description Unique build for Android TV compatibility
 * @author Gemini
 * @version 2.0.0
 * @settings
 * [
 * {"name": "uiToken", "type": "text", "label": "TV UI Token"},
 * {"name": "ossGroup", "type": "text", "label": "TV OSS Group"}
 * ]
 */

// API CONFIG - Using 'var' for older TV compatibility
var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';
var SB_BASE = 'https://febapi.nuvioapp.space/api/media';

// SETTINGS HANDLER
function getTVSetting(key) {
    try {
        var s = (typeof global !== 'undefined' && global.SCRAPER_SETTINGS) ? global.SCRAPER_SETTINGS : {};
        return s[key] || "";
    } catch (e) {
        return "";
    }
}

// MAIN FUNCTION
function getStreams(tmdbId, type, s, e) {
    var token = getTVSetting('uiToken');
    var oss = getTVSetting('ossGroup');

    if (!token) {
        console.log("ShowBox-TV: No Token entered.");
        return Promise.resolve([]);
    }

    var tmdbUrl = 'https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv/' : 'movie/') + tmdbId + '?api_key=' + TMDB_KEY;

    return fetch(tmdbUrl).then(function(r) { return r.json(); }).then(function(m) {
        var name = (type === 'tv' ? m.name : m.title) || "Media";
        var year = (type === 'tv' ? m.first_air_date : m.release_date || "").split('-')[0];
        
        var api = (type === 'tv') 
            ? SB_BASE + '/tv/' + tmdbId + (oss ? '/oss=' + oss : '') + '/' + s + '/' + e + '?cookie=' + encodeURIComponent(token)
            : SB_BASE + '/movie/' + tmdbId + '?cookie=' + encodeURIComponent(token);

        return fetch(api, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' } })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!d || !d.versions) return [];
                var res = [];
                for (var i = 0; i < d.versions.length; i++) {
                    var v = d.versions[i];
                    if (v.links) {
                        for (var j = 0; j < v.links.length; j++) {
                            var l = v.links[j];
                            res.push({
                                name: "ShowBox " + (l.quality || "HD"),
                                title: name + (year ? " (" + year + ")" : ""),
                                url: l.url,
                                quality: l.quality || "HD",
                                provider: "showbox-tv"
                            });
                        }
                    }
                }
                return res;
            });
    }).catch(function() { return []; });
}

// GLOBAL EXPORTS
global.getStreams = getStreams;
if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; }
