/**
 * Moonflix — Nuvio provider (ported from Wizdier Cloudstream MoonflixResolver).
 * TMDB-keyed: CH + HV backends (/movie/{id}, /tv/{id}/{s}/{e}) → {streams[]}.
 */
"use strict";

var M_SITE = 'https://moonflix.website';
var M_PLAYER = 'https://player.moonflix.website';
var M_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
var M_PLAYER_HEADERS = { 'User-Agent': M_UA, Referer: M_PLAYER + '/', Origin: M_PLAYER };
var M_APIS = [
  ['CH', 'https://confident-harmony-production-0578.up.railway.app'],
  ['HV', 'https://hvhyu-production.up.railway.app'],
];
var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';

/* ----------------------------------------------------------------------------
 * HELPER & FORMATTING FUNCTIONS
 * ---------------------------------------------------------------------------- */

function getInvertedSortTag(val, maxBaseline) {
  if (!maxBaseline) maxBaseline = 999999;
  var safeVal = Math.max(0, parseInt(val, 10) || 0);
  var inverted = Math.max(0, maxBaseline - safeVal);
  var binaryStr = inverted.toString(2);
  while (binaryStr.length < 20) { binaryStr = '0' + binaryStr; }
  return binaryStr.split('').map(function(bit) {
    return bit === '1' ? '\uFEFF' : '\u200B';
  }).join('');
}

function getResolutionEmoji(res) {
  var clean = String(res || '').toLowerCase();
  if (clean.includes("2160") || clean.includes("4k") || clean.includes("uhd")) return "🌟 4K";
  if (clean.includes("1080") || clean.includes("fhd")) return "🔥 1080p";
  if (clean.includes("720") || clean.includes("hd")) return "💎 720p";
  if (clean.includes("480") || clean.includes("sd")) return "📱 480p";
  return "📺 " + (res || "1080p");
}

function qualityRank(qualityStr) {
  if (/2160p|4k/i.test(qualityStr)) return 4;
  if (/1080p/i.test(qualityStr)) return 3;
  if (/720p/i.test(qualityStr)) return 2;
  if (/480p/i.test(qualityStr)) return 1;
  return 0;
}

function fetchTmdbMeta(tmdbId, mediaType, season, episode) {
  if (!tmdbId) return Promise.resolve({ title: 'Unknown', year: null, episodeTitle: '' });
  var isTv = mediaType === 'tv';
  var url = isTv
    ? 'https://api.themoviedb.org/3/tv/' + tmdbId + '?api_key=' + TMDB_KEY
    : 'https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + TMDB_KEY;

  return fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var title = data.title || data.name || 'Unknown';
      var releaseDate = data.release_date || data.first_air_date || '';
      var year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null;
      var meta = { title: title, year: year, episodeTitle: '' };

      if (isTv && season && episode) {
        var seasonUrl = 'https://api.themoviedb.org/3/tv/' + tmdbId + '/season/' + season + '?api_key=' + TMDB_KEY;
        return fetch(seasonUrl)
          .then(function(sr) { return sr.json(); })
          .then(function(sData) {
            if (sData && Array.isArray(sData.episodes)) {
              var epNum = parseInt(episode);
              for (var i = 0; i < sData.episodes.length; i++) {
                if (sData.episodes[i].episode_number === epNum) {
                  meta.episodeTitle = sData.episodes[i].name || '';
                  break;
                }
              }
            }
            return meta;
          })
          .catch(function() { return meta; });
      }
      return meta;
    })
    .catch(function() {
      return { title: 'Unknown', year: null, episodeTitle: '' };
    });
}

function formatMoonflixStream(c, apiLabel, idx, mediaMeta) {
  var q = c.q || '1080p';
  var qEmoji = getResolutionEmoji(q);
  var qRank = qualityRank(q);

  /* --- ZERO-WIDTH SORTING & HEADER --- */
  var sortTag = getInvertedSortTag((qRank * 100000) + (100 - idx), 999999);
  var headerLayout = sortTag + '🌙 Moonflix • ' + q + ' • Dual-Audio';

  /* --- FULL SUBHEADING LAYOUT LINES --- */
  var line1 = '🎬 ' + mediaMeta.title + (mediaMeta.year ? ' (' + mediaMeta.year + ')' : '');
  
  var line2 = null;
  if (mediaMeta.isTv && mediaMeta.season && mediaMeta.episode) {
    line2 = '📋 S' + mediaMeta.season + ' E' + mediaMeta.episode + (mediaMeta.episodeTitle ? ' - ' + mediaMeta.episodeTitle : '');
  }

  var line3 = qEmoji + ' | 🗣️ Dual-Audio';
  var line4 = '🎞️ HLS | ⚡ H.264 | 🎧 AAC';
  var line5 = '🔗 Moonflix | 🌐 ' + apiLabel + ' | 📥 WEB-DL';

  var fullLayout = [line1, line2, line3, line4, line5].filter(Boolean).join('\n');

  var streamHeaders = {
    'User-Agent': M_UA,
    'Referer': M_PLAYER + '/',
    'Origin': M_PLAYER
  };

  return {
    name: headerLayout,
    title: fullLayout,
    size: fullLayout,           // CRITICAL FOR NUVIO MOBILE
    description: fullLayout,    // CRITICAL FOR NUVIO MOBILE
    url: c.url,
    headers: streamHeaders,     // ROOT LEVEL HEADERS PREVENT REFERER BLOCK
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: {
        request: streamHeaders
      }
    }
  };
}

/* ----------------------------------------------------------------------------
 * NETWORK PROBING & FETCHING
 * ---------------------------------------------------------------------------- */

function mFetch(url, opts) {
  opts = opts || {};
  return fetch(url, {
    method: opts.method || 'GET',
    headers: Object.assign({ 'User-Agent': M_UA }, opts.headers || {}),
    body: opts.body,
  }).then(function (r) {
    return r.text().then(function (t) { return { code: r.status, text: t }; });
  }).catch(function () { return null; });
}

function mProbe(url, h) {
  return mFetch(url, { headers: Object.assign({ Range: 'bytes=0-16384' }, h || {}) }).then(function (r) {
    if (!r) return false;
    if (r.code !== 200 && r.code !== 206) return false;
    var t = r.text;
    return t.indexOf('#EXTM3U') === 0 || t.indexOf('{') !== 0; // playlist or mp4 range
  }).catch(function () { return false; });
}

function mParseStreams(json, label) {
  var out = [];
  var streams = json && Array.isArray(json.streams) ? json.streams : [];
  for (var i = 0; i < streams.length; i++) {
    var s = streams[i] || {};
    var url = s.url ? String(s.url) : '';
    if (!url || url.indexOf('http') !== 0) continue;
    var q = s.quality || 'Auto';
    out.push({ url: url, q: q, extra: s });
  }
  return out;
}

/* ----------------------------------------------------------------------------
 * MAIN ENTRY POINT
 * ---------------------------------------------------------------------------- */

function mGetStreams(tmdbId, mediaType, season, episode) {
  if (!tmdbId) return Promise.resolve([]);
  var isTv = mediaType === 'tv';
  var s = season || 1, e = episode || 1;
  var path = isTv ? ('tv/' + tmdbId + '/' + s + '/' + e) : ('movie/' + tmdbId);

  return fetchTmdbMeta(tmdbId, mediaType, s, e).then(function(mediaMeta) {
    mediaMeta.isTv = isTv;
    mediaMeta.season = s;
    mediaMeta.episode = e;

    var queue = Promise.resolve([]);
    M_APIS.forEach(function (api) {
      queue = queue.then(function (acc) {
        if (acc.length) return acc;
        return mFetch(api[1] + '/' + path, { headers: M_PLAYER_HEADERS }).then(function (r) {
          if (!r || r.code !== 200) return acc;
          var json;
          try { json = JSON.parse(r.text); } catch (err) { return acc; }
          var cands = mParseStreams(json, api[0]);
          var rows = [];
          var pending = Promise.resolve();
          cands.forEach(function (c, idx) {
            pending = pending.then(function () {
              return mProbe(c.url, M_PLAYER_HEADERS).then(function (ok) {
                if (!ok) return;
                rows.push(formatMoonflixStream(c, api[0], idx, mediaMeta));
              });
            });
          });
          return pending.then(function () { return acc.concat(rows); });
        });
      });
    });

    // TV-only SE backend as a third lane
    if (isTv) {
      queue = queue.then(function (acc) {
        if (acc.length) return acc;
        return mFetch('https://series-production-5c1c.up.railway.app/tv/' + tmdbId + '/' + s + '/' + e,
          { headers: M_PLAYER_HEADERS }).then(function (r) {
          if (!r || r.code !== 200) return acc;
          var json;
          try { json = JSON.parse(r.text); } catch (err) { return acc; }
          var sources = json.sources || [];
          var rows = [];
          var pending = Promise.resolve();
          for (var i = 0; i < sources.length; i++) {
            (function (src, idx) {
              pending = pending.then(function () {
                var url = (src.proxy_url || src.url || '');
                if (!url || url.indexOf('http') !== 0) return;
                return mProbe(url, M_PLAYER_HEADERS).then(function (ok) {
                  if (!ok) return;
                  var cand = { url: url, q: src.quality || 'Auto' };
                  rows.push(formatMoonflixStream(cand, 'SE', idx, mediaMeta));
                });
              });
            })(sources[i], i);
          }
          return pending.then(function () { return acc.concat(rows); });
        });
      });
    }
    return queue;
  });
}

function mOnSettings() { return []; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: mGetStreams, scrape: mGetStreams, onSettings: mOnSettings };
} else if (typeof global !== 'undefined') {
  global.getStreams = mGetStreams;
  global.onSettings = mOnSettings;
}
