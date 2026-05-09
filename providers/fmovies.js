// =============================================================
// Provider Nuvio : Nakios (VF / VOSTFR / MULTI)
// Version : 4.7.0
// - FIX: Restored original fetching sequence
// - Layout: Header (Quality) | Line 1 (Name + Year) | Line 2 (Specs)
// - Feature: Added ⏱️ Duration & Episode Name
// =============================================================

var TMDB_KEY = 'f3d757824f08ea2cff45eb8f47ca3a1e';
var NAKIOS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var DOMAINS_URL = 'https://raw.githubusercontent.com/wooodyhood/nuvio-repo/main/domains.json';

var _cachedEndpoint = null;

// ─── 1. Metadata Helper ─────────────────────────────────────

function getMetadata(tmdbId, type, season, episode) {
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

// ─── 2. Formatting Logic ────────────────────────────────────

function buildNakiosTitle(s, meta, season, episode) {
    var quality = s.quality || 'HD';
    var rawLang = (s.lang || 'MULTI').toUpperCase();
    var lIcon = '🇫🇷', lLab = 'VF';
    if (rawLang.indexOf('MULTI') !== -1) { lIcon = '🌍'; lLab = 'MULTI'; }
    else if (rawLang.indexOf('VOST') !== -1) { lIcon = '🔡'; lLab = 'VOSTFR'; }

    var line1 = '🎬 ' + (season && episode ? 'S' + season + ' E' + episode + (meta.epName ? ' - ' + meta.epName : '') + ' | ' + meta.name : meta.name + (meta.year ? ' - ' + meta.year : ''));
    
    var specs = ['📺 ' + quality, lIcon + ' ' + lLab];
    if (s.size) specs.push('💾 ' + s.size);
    specs.push('🎞️ ' + (s.url.indexOf('.m3u8') !== -1 ? 'M3U8' : 'MP4'));
    if (meta.duration) specs.push('⏱️ ' + meta.duration);

    return line1 + '\n' + specs.join(' | ');
}

// ─── 3. Original Execution Flow ─────────────────────────────

function getStreams(tmdbId, mediaType, season, episode) {
    // A. Detect Domain
    return fetch(DOMAINS_URL).then(function(res) { return res.json(); }).then(function(domains) {
        var tld = domains.nakios || 'fit';
        var endpoint = {
            api: 'https://api.nakios.' + tld + '/api',
            referer: 'https://nakios.' + tld + '/',
            base: 'https://nakios.' + tld
        };

        // B. Fetch Meta and Sources simultaneously to prevent hanging
        return Promise.all([
            getMetadata(tmdbId, mediaType, season, episode),
            fetch(mediaType === 'tv' ? endpoint.api + '/sources/tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1) : endpoint.api + '/sources/movie/' + tmdbId, 
            { headers: { 'User-Agent': NAKIOS_UA, 'Referer': endpoint.referer } }).then(function(r) { return r.json(); })
        ]).then(function(results) {
            var meta = results[0];
            var data = results[1];

            if (!data || !data.sources) return [];

            return data.sources.map(function(s) {
                if (s.isEmbed) return null;
                return {
                    name: 'Nakios - ' + (s.quality || 'HD'),
                    title: buildNakiosTitle(s, meta, season, episode),
                    url: s.url,
                    quality: s.quality || 'HD',
                    format: s.url.indexOf('.m3u8') !== -1 ? 'm3u8' : 'mp4',
                    headers: {
                        'User-Agent': NAKIOS_UA,
                        'Referer': endpoint.referer,
                        'Origin': endpoint.base
                    }
                };
            }).filter(function(x) { return x !== null; });
        });
    }).catch(function() { return []; });
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { getStreams: getStreams }; }
else { global.getStreams = getStreams; }
