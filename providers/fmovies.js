// =============================================================
// Provider Nuvio : Nakios (VF / VOSTFR / MULTI)
// Version : 4.8.0
// - REVERTED: Original stable network logic (Fixes Fetch/Playback)
// - LAYOUT: Header (Nakios - Quality)
// - LINE 1: 🎬 Name - Year (or S/E - Ep Name | Name)
// - LINE 2: 📺 Res | 🌍 Lang | 💾 Size | 🎞️ Fmt | ⏱️ Dur
// =============================================================

var TMDB_KEY = 'f3d757824f08ea2cff45eb8f47ca3a1e';
var NAKIOS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var DOMAINS_URL = 'https://raw.githubusercontent.com/wooodyhood/nuvio-repo/main/domains.json';

// ─── Metadata Helper (Purely for text labels) ───────────────

function getTmdbText(tmdbId, type, season, episode) {
    var url = 'https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=en-US';
    return fetch(url).then(function(res) { return res.json(); }).then(function(data) {
        var meta = {
            name: data.title || data.name || "Nakios",
            year: (data.release_date || data.first_air_date || "").split('-')[0],
            duration: type === 'movie' ? (data.runtime ? data.runtime + ' min' : '') : (data.episode_run_time && data.episode_run_time[0] ? data.episode_run_time[0] + ' min' : ''),
            epName: null
        };
        if (type === 'tv' && season && episode) {
            return fetch('https://api.themoviedb.org/3/tv/' + tmdbId + '/season/' + season + '/episode/' + episode + '?api_key=' + TMDB_KEY + '&language=en-US')
                .then(function(r) { return r.json(); }).then(function(e) { meta.epName = e.name; return meta; })
                .catch(function() { return meta; });
        }
        return meta;
    }).catch(function() { return { name: "Nakios", year: "", duration: "", epName: null }; });
}

// ─── Main Execution (Original Last Working Flow) ─────────────

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
            
            // Now fetch metadata and sources
            return Promise.all([
                getTmdbText(tmdbId, mediaType, season, episode),
                fetch(mediaType === 'tv' ? _endpoint.api + '/sources/tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1) : _endpoint.api + '/sources/movie/' + tmdbId, {
                    headers: { 'User-Agent': NAKIOS_UA, 'Referer': _endpoint.referer }
                }).then(function(res) { return res.json(); })
            ]);
        })
        .then(function(results) {
            var meta = results[0];
            var data = results[1];
            if (!data || !data.sources) return [];

            return data.sources.map(function(s) {
                if (s.isEmbed) return null;

                // Build Line 1
                var line1 = '🎬 ';
                if (mediaType === 'tv' && season && episode) {
                    line1 += 'S' + season + ' E' + episode + (meta.epName ? ' - ' + meta.epName : '') + ' | ' + meta.name;
                } else {
                    line1 += meta.name + (meta.year ? ' - ' + meta.year : '');
                }

                // Build Line 2
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
                    name: 'Nakios - ' + (s.quality || 'HD'),
                    title: line1 + '\n' + specs.join(' | '),
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
        })
        .catch(function() { return []; });
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { getStreams: getStreams }; }
else { global.getStreams = getStreams; }
