'use strict';

// ... [Keep Cache and Config sections as they are] ...

function fetchFromWorker(tmdbId, mediaType, se, ep) {
  var url = WORKER_BASE + '/streams'
    + '?tmdb_id=' + encodeURIComponent(tmdbId)
    + '&type='    + encodeURIComponent(mediaType)
    + '&proxy='   + encodeURIComponent(WORKER_BASE);

  // Note: If the API supports a language param, we could add &lang=en here.
  // Currently, the API at moviebox.s4nch1tt seems to default to localized content.

  if (mediaType === 'tv') {
    url += '&se=' + (se  != null ? se  : 1);
    url += '&ep=' + (ep  != null ? ep  : 1);
  }

  return fetch(url, {
    headers  : { 'Accept': 'application/json', 'User-Agent': 'Nuvio/1.0' },
    redirect : 'follow',
  })
    .then(function (r) {
      if (!r.ok) throw new Error('Worker HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.streams)) return data.streams;
      return [];
    });
}

function buildStream(s, isTv, se, ep) {
  var streamUrl = s.proxy_url || s.url || '';
  if (!streamUrl) return null;

  var quality = 'Auto';
  if (s.resolution) {
    var m = String(s.resolution).match(/(\d+)/);
    quality = m ? m[1] + 'p' : String(s.resolution);
  }

  // ENHANCED LANGUAGE LOGIC
  var lang = 'Original/English'; 
  var nameStr = (s.name || '').toLowerCase();
  
  // Extract language from brackets if it exists
  var langMatch = (s.name || '').match(/\(([^)]+)\)/);
  if (langMatch) {
    lang = langMatch[1];
  } else if (nameStr.includes('hindi')) {
    lang = 'Hindi';
  } else if (nameStr.includes('eng') || nameStr.includes('dual')) {
    lang = 'English/Dual';
  }

  var streamName = '📺 MovieBox | ' + quality + ' | ' + lang;

  var titleBase = (s.title || '').split(' S0')[0].split(' S1')[0].trim();
  var epTag = '';
  if (isTv && se != null && ep != null) {
    epTag = ' · S' + String(se).padStart(2, '0') + 'E' + String(ep).padStart(2, '0');
  }

  var lines = [];
  lines.push((titleBase || 'MovieBox') + epTag);
  lines.push('📺 ' + quality + '  🔊 ' + lang + (s.codec ? '  🎞 ' + s.codec : ''));

  if (s.size_mb) lines.push('💾 ' + s.size_mb + ' MB');
  lines.push("by Sanchit · @S4NCHITT");

  return {
    name    : streamName,
    title   : lines.join('\n'),
    url     : streamUrl,
    quality : quality,
    behaviorHints: { bingeGroup: 'moviebox', notWebReady: false },
    subtitles: [],
  };
}

// ... [Keep getStreams and Export sections as they are] ...
