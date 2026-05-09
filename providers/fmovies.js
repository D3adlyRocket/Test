// =============================================================
// Provider Nuvio : Nakios (VF / VOSTFR / MULTI)
// Version : 4.4.0
// - Fixed: Playback Error (Removed \n from title)
// - Fixed: Duration logic (Ensured TMDB sync)
// - Layout: 🎬 Title (Year) | 📺 Res | 🌍 Lang | 💾 Size | 🎞️ Fmt | ⏱️ Dur
// =============================================================

var TMDB_KEY = 'f3d757824f08ea2cff45eb8f47ca3a1e';
var NAKIOS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
var DOMAINS_URL = 'https://raw.githubusercontent.com/wooodyhood/nuvio-repo/main/domains.json';

// ─── TMDB Details Helper ────────────────────────────────────

function getTmdbDetails(tmdbId, type) {
  var url = 'https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&language=en-US';
  return fetch(url)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var name = data.title || data.name || "Nakios";
      var date = data.release_date || data.first_air_date || "";
      var year = date ? date.split('-')[0] : "";
      
      // Strict Duration Logic
      var duration = "";
      if (type === 'movie' && data.runtime) {
          duration = data.runtime + ' min';
      } else if (type === 'tv') {
          if (data.episode_run_time && data.episode_run_time.length > 0) {
              duration = data.episode_run_time[0] + ' min';
          } else if (data.last_episode_to_air && data.last_episode_to_air.runtime) {
              duration = data.last_episode_to_air.runtime + ' min';
          }
      }
      return { name: name, year: year, duration: duration };
    })
    .catch(function() { return { name: "Nakios", year: "", duration: "" }; });
}

// ─── UI Helper ───────────────────────────────────────────────

function normalizeSources(sources, endpoint, meta, season, episode, epName) {
  var results = [];
  for (var i = 0; i < sources.length; i++) {
    var s = sources[i];
    if (s.isEmbed) continue;

    var quality = s.quality || 'HD';
    var format = (s.url && s.url.indexOf('.m3u8') !== -1) ? 'M3U8' : 'MP4';
    
    var rawLang = (s.lang || 'MULTI').toUpperCase();
    var lIcon = '🇫🇷', lLab = 'VF';
    if (rawLang.indexOf('MULTI') !== -1) { lIcon = '🌍'; lLab = 'MULTI'; }
    else if (rawLang.indexOf('VOST') !== -1) { lIcon = '🔡'; lLab = 'VOSTFR'; }

    // --- Single Line Title (Safe for Playback) ---
    var titleParts = [];
    
    // Identity Section
    var identity = '🎬 ';
    if (season && episode) {
        identity += 'S' + season + ' E' + episode + (epName ? ' - ' + epName : '') + ' | ' + meta.name;
    } else {
        identity += meta.name + (meta.year ? ' (' + meta.year + ')' : '');
    }
    titleParts.push(identity);

    // Tech Specs Section
    titleParts.push('📺 ' + quality);
    titleParts.push(lIcon + ' ' + lLab);
    if (s.size) titleParts.push('💾 ' + s.size);
    titleParts.push('🎞️ ' + format);
    if (meta.duration) titleParts.push('⏱️ ' + meta.duration);

    results.push({
      name: 'Nakios - ' + quality, 
      title: titleParts.join(' | '), // Joined by pipes only
      url: s.url,
      quality: quality,
      format: format.toLowerCase(),
      headers: { 'User-Agent': NAKIOS_UA, 'Referer': endpoint.referer }
    });
  }
  return results;
}

// ─── Main Logic ──────────────────────────────────────────────

function getEpisodeName(tmdbId, season, episode) {
  if (!tmdbId || !season || !episode) return Promise.resolve(null);
  var url = 'https://api.themoviedb.org/3/tv/' + tmdbId + '/season/' + season + '/episode/' + episode + '?api_key=' + TMDB_KEY + '&language=en-US';
  return fetch(url).then(function(res) { return res.json(); }).then(function(data) { return data.name || null; }).catch(function() { return null; });
}

function detectEndpoint() {
  return fetch(DOMAINS_URL)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var tld = data.nakios || 'fit';
      return { referer: 'https://nakios.' + tld + '/', api: 'https://api.nakios.' + tld + '/api' };
    }).catch(function() { return { referer: 'https://nakios.fit/', api: 'https://api.nakios.fit/api' }; });
}

function getStreams(tmdbId, mediaType, season, episode) {
  return Promise.all([
    getTmdbDetails(tmdbId, mediaType),
    mediaType === 'tv' ? getEpisodeName(tmdbId, season, episode) : Promise.resolve(null),
    detectEndpoint()
  ]).then(function(results) {
    var meta = results[0];
    var epName = results[1];
    var endpoint = results[2];

    var url = mediaType === 'tv'
      ? endpoint.api + '/sources/tv/' + tmdbId + '/' + (season || 1) + '/' + (episode || 1)
      : endpoint.api + '/sources/movie/' + tmdbId;

    return fetch(url, { headers: { 'User-Agent': NAKIOS_UA, 'Referer': endpoint.referer } })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data || !data.sources) return [];
        return normalizeSources(data.sources, endpoint, meta, season, episode, epName);
      });
  }).catch(function() { return []; });
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { getStreams: getStreams }; } 
else { global.getStreams = getStreams; }
