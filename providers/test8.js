/**
 * KAA (KickAssAnime) — Nuvio provider (ported from Wizdier Cloudstream KaaResolver).
 * kaa.lt open JSON API (HTML is CF-gated but /api/* is open) → CatStream HLS.
 */
"use strict";

var K_SITE = 'https://kaa.lt';
var K_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
var K_HEADERS = { 'User-Agent': K_UA, Referer: K_SITE + '/', Accept: 'application/json, text/plain, */*' };
var K_MAX_WALK = 130;
var TMDB_KEY = '98ae14df2b8d8f8f8136499daf79f0e0';

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
      var title = data.name || data.title || data.original_name || data.original_title || 'Unknown';
      var releaseDate = data.first_air_date || data.release_date || '';
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

function formatKaaStream(manifestUrl, serverName, qualityStr, idx, mediaMeta) {
  var q = qualityStr || '1080p';
  var qEmoji = getResolutionEmoji(q);
  var qRank = qualityRank(q);
  var svLabel = serverName || 'CatStream';

  /* --- ZERO-WIDTH SORTING & HEADER --- */
  var sortTag = getInvertedSortTag((qRank * 100000) + (100 - idx), 999999);
  var headerLayout = sortTag + '⚔️ KAA • ' + q + ' • ' + svLabel;

  /* --- FULL SUBHEADING LAYOUT LINES --- */
  var line1 = '🎬 ' + mediaMeta.title + (mediaMeta.year ? ' (' + mediaMeta.year + ')' : '');
  
  var line2 = null;
  if (mediaMeta.isTv && mediaMeta.season && mediaMeta.episode) {
    line2 = '📋 S' + mediaMeta.season + ' E' + mediaMeta.episode + (mediaMeta.episodeTitle ? ' - ' + mediaMeta.episodeTitle : '');
  }

  var line3 = qEmoji + ' | 🗣️ Multi-Audio';
  var line4 = '🎞️ HLS | ⚡ H.264 | 🎧 AAC';
  var line5 = '🔗 KAA | 🌐 ' + svLabel + ' | 📥 WEB-DL';

  var fullLayout = [line1, line2, line3, line4, line5].filter(Boolean).join('\n');

  var streamHeaders = {
    'User-Agent': K_UA,
    'Referer': K_SITE + '/'
  };

  return {
    name: headerLayout,
    title: fullLayout,
    size: fullLayout,           // CRITICAL FOR NUVIO MOBILE
    description: fullLayout,    // CRITICAL FOR NUVIO MOBILE
    url: manifestUrl,
    quality: q,
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
 * UTILITY NETWORK & SEARCH FUNCTIONS
 * ---------------------------------------------------------------------------- */

function kFetch(url, opts) {
  opts = opts || {};
  return fetch(url, {
    method: opts.method || 'GET',
    headers: Object.assign({ 'User-Agent': K_UA }, opts.headers || {}),
    body: opts.body,
  }).then(function (r) { return r.text().then(function (t) { return { code: r.status, text: t }; }); })
    .catch(function () { return null; });
}

function kPostJson(url, obj) {
  return fetch(url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, K_HEADERS),
    body: JSON.stringify(obj),
  }).then(function (r) { return r.text().then(function (t) { return { code: r.status, text: t }; }); })
    .catch(function () { return null; });
}

function kNorm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

function kSim(a, b) {
  a = kNorm(a); b = kNorm(b);
  if (!a || !b) return 0;
  var as = a.split(' '), bs = b.split(' ');
  var inter = 0;
  for (var i = 0; i < as.length; i++) if (bs.indexOf(as[i]) !== -1) inter++;
  return (2 * inter) / (as.length + bs.length);
}

function kUnescapeHtml(s) {
  return String(s).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x2F;/g, '/');
}

function kSearch(title) {
  var tokens = title.split(/\s+/).filter(Boolean);
  var ladders = [title];
  if (tokens.length >= 2) ladders.push(tokens.slice(0, 2).join(' '));
  if (tokens.length >= 2) ladders.push(tokens.slice(-2).join(' '));
  if (tokens.length >= 3) ladders.push(tokens.slice(0, 3).join(' '));
  var queue = Promise.resolve(null);
  ladders.forEach(function (q) {
    queue = queue.then(function (found) {
      if (found) return found;
      return kPostJson(K_SITE + '/api/search', { query: q }).then(function (r) {
        if (!r || r.code !== 200) return null;
        var arr;
        try { arr = JSON.parse(r.text); } catch (e) { return null; }
        if (!Array.isArray(arr) || !arr.length) return null;
        var best = null, bestScore = 0;
        for (var i = 0; i < arr.length; i++) {
          var t = arr[i].title_en || arr[i].title || '';
          if (kNorm(t) === kNorm(title)) return arr[i];
          var sc = kSim(t, title);
          if (sc > bestScore) { bestScore = sc; best = arr[i]; }
        }
        return bestScore >= 0.5 ? best : null;
      });
    });
  });
  return queue;
}

/* ----------------------------------------------------------------------------
 * MAIN ENTRY POINT
 * ---------------------------------------------------------------------------- */

function kGetStreams(tmdbId, mediaType, season, episode) {
  if (mediaType !== 'tv') return Promise.resolve([]);
  var targetEp = episode || 1;
  var s = season || 1;

  return fetchTmdbMeta(tmdbId, 'tv', s, targetEp).then(function (mediaMeta) {
    mediaMeta.isTv = true;
    mediaMeta.season = s;
    mediaMeta.episode = targetEp;

    if (!mediaMeta.title || mediaMeta.title === 'Unknown') return [];

    return kSearch(mediaMeta.title).then(function (show) {
      if (!show || !show.slug) return [];
      return kFetch(K_SITE + '/api/show/' + show.slug, { headers: K_HEADERS }).then(function (r) {
        if (!r || r.code !== 200) return [];
        var sd;
        try { sd = JSON.parse(r.text); } catch (e) { return []; }
        var watchUri = sd.watch_uri || '';
        if (!watchUri) return [];
        var latestEpSlug = watchUri.split('/').pop();
        if (!latestEpSlug) return [];

        var epSlug = latestEpSlug;
        var walk = 0;

        function step() {
          if (walk > K_MAX_WALK) return Promise.resolve(null);
          walk++;
          return kFetch(K_SITE + '/api/show/' + show.slug + '/episode/' + epSlug, { headers: K_HEADERS })
            .then(function (er) {
              if (!er || er.code !== 200) return null;
              var ej;
              try { ej = JSON.parse(er.text); } catch (e) { return null; }
              var num = ej.episode_number;
              if (num === targetEp) return ej.servers || null;
              if (num < targetEp) return null;
              if (ej.prev_ep_slug) { epSlug = ej.prev_ep_slug; return step(); }
              return null;
            });
        }

        return step().then(function (svs) {
          if (!svs || !svs.length) return [];
          var rows = [];
          var queue = Promise.resolve();
          svs.forEach(function (sv, idx) {
            queue = queue.then(function () {
              var src = sv.src || '';
              if (!src || src.indexOf('http') !== 0) return;
              return kFetch(src, { headers: { 'User-Agent': K_UA, Referer: K_SITE + '/' } }).then(function (pr) {
                if (!pr || pr.code !== 200) return;
                var html = kUnescapeHtml(pr.text);
                var m = html.match(/"manifest"\s*:\s*(?:\[\s*\d+\s*,\s*)?["']([^"']+)["']/);
                if (!m) return;
                var manifest = m[1];
                if (manifest.indexOf('//') === 0) manifest = 'https:' + manifest;
                else if (manifest.indexOf('http') !== 0) {
                  var base = src.match(/^(https?:\/\/[^/]+)/);
                  manifest = (base ? base[1] : '') + '/' + manifest.replace(/^\//, '');
                }
                var serverName = sv.name || sv.shortName || 'Server';
                rows.push(formatKaaStream(manifest, serverName, 'Auto', idx, mediaMeta));
              });
            });
          });
          return queue.then(function () { return rows; });
        });
      });
    });
  }).catch(function () { return []; });
}

function kOnSettings() { return []; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: kGetStreams, scrape: kGetStreams, onSettings: kOnSettings };
} else if (typeof global !== 'undefined') {
  global.getStreams = kGetStreams;
  global.onSettings = kOnSettings;
}

