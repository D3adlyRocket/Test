// =============================================================
// Provider Nuvio : Nakios (VF / VOSTFR / MULTI)
// Version : 5.0.0
// - Layout: Header (Bold) | Line 1 (Identity) | Line 2 (Specs)
// - Fixed: Restored original linear fetch flow to fix fetching
// =============================================================

var TMDB_KEY = 'f3d757824f08ea2cff45eb8f47ca3a1e';
var NAKIOS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var DOMAINS_URL = 'https://raw.githubusercontent.com/wooodyhood/nuvio-repo/main/domains.json';

function getTmdbData(tmdbId, type, season, episode) {
    var url = 'https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=en-US';
    return fetch(url).then(function(res) { return res.json(); }).then(function(data) {
        var meta = {
            name: data.title || data.name || "Nakios",
            year: (data.release_date || data.first_air_date || "").split('-')[0],
            duration: type === 'movie' ? (data.runtime ? data.runtime + ' min' : '') : (data.episode_run_time && data.episode_run_time[0] ? data.episode_run_time[0] + ' min' : ''),
            epName: null
        };
        if (type === 'tv' && season && episode) {
            return fetch('https://api.themoviedb.org/3/tv/' + tmdbId + '/season/' + season + '/episode/' + episode + '?api_key=' + TMDB_KEY)
                .then(function(r) { return r.json(); }).then(function(e) { meta.epName = e.name; return meta; })
                .catch(function() { return meta; });
        }
        return meta;
    }).catch(function() { return { name: "Nakios", year: "", duration: "", epName: null }; });
}

function getStreams(tmdbId, mediaType, season, episode) {
    var _endpoint = null;

    return fetch(DOMAINS_URL)
        .then(function(res) { return res.json(); })
        .then(function(data) {
            var tld = data.nakios || 'fit';
            _endpoint = {
                api: 'https://api.nakios.' + tld + '/api',
                referer: 'https://nakios.' + tld + '/',
                base: 'https://nakios.' + tld
            };
            
            // Reverted to linear chain - fetch meta first, then the provider
            return getTmdbData(tmdbId, mediaType, season, episode);
        })
        .then(function(meta) {
            var provUrl = mediaType === 'tv' 
                ? _endpoint.api + '/sources/tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1)
                : _endpoint.api + '/sources/movie/' + tmdbId;

            return fetch(provUrl, { headers: { 'User-Agent': NAKIOS_UA, 'Referer': _endpoint.referer } })
                .then(function(res) { return res.json(); })
                .then(function(provData) {
                    if (!provData || !provData.sources) return [];

                    return provData.sources.map(function(s) {
                        if (s.isEmbed) return null;

                        // Header: Nakios - 1080p
                        var header = 'Nakios - ' + (s.quality || 'HD');

                        // Line 1: Identity
                        var l1 = '🎬 ' + (mediaType === 'tv' ? 'S' + season + ' E' + episode + (meta.epName ? ' - ' + meta.epName : '') + ' | ' + meta.name : meta.name + (meta.year ? ' - ' + meta.year : ''));

                        // Line 2: Tech Specs
                        var lang = (s.lang || 'MULTI').toUpperCase();
                        var lIcon = (lang.indexOf('MULTI') !== -1) ? '🌍' : (lang.indexOf('VOST') !== -1 ? '🔡' : '🇫🇷');
                        var lLab = (lang.indexOf('MULTI') !== -1) ? 'MULTI' : (lang.indexOf('VOST') !== -1 ? 'VOSTFR' : 'VF');
                        
                        var specs = [
                            '📺 ' + (s.quality || 'HD'),
                            lIcon + ' ' + lLab
                        ];
                        if (s.size) specs.push('💾 ' + s.size);
                        specs.push('🎞️ ' + (s.url.indexOf('.m3u8') !== -1 ? 'M3U8' : 'MP4'));
                        if (meta.duration) specs.push('⏱️ ' + meta.duration);

                        return {
                            name: header,
                            title: l1 + '\n' + specs.join(' | '),
                            url: s.url,
                            quality: s.quality || 'HD',
                            format: s.url.indexOf('.m3u8') !== -1 ? 'm3u8' : 'mp4',
                            headers: {
                                'User-Agent': NAKIOS_UA,
                                'Referer': _endpoint.referer,
                                'Origin': _endpoint.base
                            }
                        };
                    }).filter(function(x) { return x !== null; });
                });
        })
        .catch(function() { return []; });
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { getStreams: getStreams }; }
else { global.getStreams = getStreams; }
