// Metadata config matched to your VixSrc setup
var TMDB_API_KEY = '68e094699525b18a70bab2f86b1fa706';

function normalizeCodecLabel(codec) {
  switch ((codec || '').trim().toLowerCase()) {
    case 'h264': case 'avc': case 'mpeg-4 avc': case 'mpeg4-avc': return 'H264';
    case 'h265': case 'hevc': case 'x265': return 'H265';
    case 'av1': return 'AV1';
    case 'vp9': return 'VP9';
    default: return (codec || '').trim().toUpperCase();
  }
}

function detectQuality(texts) {
  var sources = Array.isArray(texts) ? texts : [texts];
  for (var i = 0; i < sources.length; i++) {
    var t = String(sources[i] || '').toLowerCase();
    if (!t) continue;
    if (/\b2160p\b/.test(t) || /\b4k\b/.test(t) || /\buhd\b/.test(t)) return '2160p';
    if (/\b1080p\b/.test(t)) return '1080p';
    if (/\b720p\b/.test(t))  return '720p';
    if (/\b480p\b/.test(t))  return '480p';
    if (/\b360p\b/.test(t))  return '360p';
  }
  return '1080p'; 
}

function extractFilename(stream) {
  var textFields = [stream.filename, stream.file, stream.name, stream.label, stream.title];
  for (var i = 0; i < textFields.length; i++) {
    var v = (textFields[i] || '').trim();
    if (v && /\.(mkv|mp4|avi|m4v|mov)$/i.test(v)) return v;
  }

  if (stream.url) {
    try {
      var path = stream.url.split('?')[0].split('#')[0];
      var segments = path.split('/');
      var last = decodeURIComponent(segments[segments.length - 1] || '');
      if (last && /\.(mkv|mp4|avi|m4v|mov)$/i.test(last)) return last;
    } catch (e) {}
  }

  var parts = [];
  if ((stream.quality || '').trim())               parts.push(stream.quality.trim());
  var rel = (stream.release || stream.source || '').trim();
  if (rel)                                         parts.push(rel);
  if ((stream.encode || '').trim())                parts.push(stream.encode.trim());
  if ((stream.format || '').trim())                parts.push(stream.format.trim());
  if ((stream.codec  || '').trim())                parts.push(normalizeCodecLabel(stream.codec));
  if ((stream.label  || '').trim())                parts.push(stream.label.trim());
  var desc = parts.join('.');
  if (desc) return desc + '.mkv';

  return 'stream.mkv';
}

function extractDownloadFilename(download, src) {
  var title = (download.title || '').trim();
  if (/\.(mkv|mp4|avi|m4v|mov)$/i.test(title)) return title;
  if (title) {
    var clean = title.replace(/\s+/g, '.').replace(/\.{2,}/g, '.');
    if (!/\.(mkv|mp4)$/i.test(clean)) clean = clean + '.mkv';
    return clean;
  }
  var srcName = (src.name || '').trim().replace(/\s+\d+$/, '').trim();
  return (srcName || 'stream') + '.mkv';
}

function extractSourceName(stream) {
  var srcField = (stream.source || stream.release || '').trim();
  if (srcField) return srcField;

  if (stream.url) {
    try {
      var host = new URL(stream.url).hostname.replace(/^www\./, '');
      var seg = host.split('.')[0];
      return seg.charAt(0).toUpperCase() + seg.slice(1);
    } catch (e) {}
  }
  return 'Direct';
}

// Visual Multi-line Title Builder (Renders the 3 info lines)
function buildTitle(meta, res, lang, format, size, season, episode, filename) {
  var qIcon = (res.includes('4K') || res.includes('2160')) ? '🌟' : '💎';
  
  // Line 1: Show context title info OR actual file name if it fits nicely
  var line1 = '🎬 ';
  if (season && episode) {
    line1 += 'S' + season + ' E' + episode + ' | ' + meta.name;
    if (meta.episodeTitle) {
      line1 += ' | ' + meta.episodeTitle;
    }
  } else {
    line1 += (filename && filename !== 'stream.mkv') ? filename : meta.name + (meta.year ? ' (' + meta.year + ')' : '');
  }

  // Line 2: Quality, Audio Lang, and exact Size string
  var line2 = qIcon + ' ' + res + ' | 🌍 ' + lang + ' | 💾 ' + (size || 'Variable Size');
  
  // Line 3: Container format, runtime clock, and profile parameters
  var line3 = '🎞️ ' + format.toUpperCase() + ' | ⏱️ ' + meta.duration + ' | 📼 AVC • 🔊 AAC';

  return line1 + '\n' + line2 + '\n' + line3;
}

// Convert IMDb IDs to TMDB IDs if necessary
function getTmdbId(imdbId, type) {
  var normalizedType = String(type).toLowerCase();
  var findUrl = 'https://api.themoviedb.org/3/find/' + imdbId + '?api_key=' + TMDB_API_KEY + '&external_source=imdb_id';
  
  return fetch(findUrl)
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) {
      if (!data) return null;
      if (normalizedType === 'movie' && data.movie_results && data.movie_results.length > 0) {
        return data.movie_results[0].id.toString();
      } else if (normalizedType === 'tv' && data.tv_results && data.tv_results.length > 0) {
        return data.tv_results[0].id.toString();
      }
      return null;
    })
    .catch(function() {
      return null;
    });
}

// Fetch metadata automatically from TMDB
function getMetadata(id, type, season, episode, fallbackContext) {
  var localFallbackName = 'Unknown Title';
  var localFallbackDuration = type === 'tv' ? '45 min' : '90 min';
  var localFallbackEpisodeTitle = '';

  if (fallbackContext && typeof fallbackContext === 'object') {
    localFallbackName = fallbackContext.name || fallbackContext.title || localFallbackName;
    localFallbackEpisodeTitle = fallbackContext.episodeName || fallbackContext.episodeTitle || localFallbackEpisodeTitle;
    localFallbackDuration = fallbackContext.duration || localFallbackDuration;
  }

  var normalizedType = String(type).toLowerCase();
  var endpoint = normalizedType === 'movie' ? 'movie' : 'tv';
  var url = 'https://api.themoviedb.org/3/' + endpoint + '/' + id + '?api_key=' + TMDB_API_KEY;

  return fetch(url)
    .then(function(res) { return res.ok ? res.json() : Promise.reject(); })
    .then(function(data) {
      var duration = localFallbackDuration;
      var year = (data.release_date || data.first_air_date || '').split('-')[0];

      if (normalizedType === 'movie' && data.runtime) {
        duration = data.runtime + ' min';
        return { name: data.title || data.name || localFallbackName, year: year, duration: duration, episodeTitle: '' };
      } else if (normalizedType === 'tv') {
        var epUrl = 'https://api.themoviedb.org/3/tv/' + id + '/season/' + season + '/episode/' + episode + '?api_key=' + TMDB_API_KEY;
        return fetch(epUrl)
          .then(function(epRes) { return epRes.ok ? epRes.json() : null; })
          .then(function(epData) {
            var epTitle = localFallbackEpisodeTitle;
            if (epData) {
              if (epData.name) epTitle = epData.name;
              if (epData.runtime) duration = epData.runtime + ' min';
            } else if (data.episode_run_time && data.episode_run_time.length > 0) {
              duration = data.episode_run_time[0] + ' min';
            }
            return { name: data.name || data.title || localFallbackName, year: year, duration: duration, episodeTitle: epTitle };
          });
      }
      return { name: data.title || data.name || localFallbackName, year: year, duration: duration, episodeTitle: '' };
    })
    .catch(function() {
      return { name: localFallbackName, year: '', duration: localFallbackDuration, episodeTitle: localFallbackEpisodeTitle };
    });
}

function getStreams(id, mediaType, season, episode, providerContext) {
  console.log('[GoatAPI] getStreams → id=' + id + ' type=' + mediaType);

  var requestedType = String(mediaType).toLowerCase();
  var normalizedType = requestedType === 'series' ? 'tv' : requestedType;

  if (normalizedType !== 'movie') {
    return Promise.resolve([]);
  }

  var tmdbIdPromise = Promise.resolve(id.toString().replace('tmdb:', ''));
  if (id.toString().startsWith('tt')) {
    tmdbIdPromise = getTmdbId(id, normalizedType).then(function(convertedId) {
      return convertedId || id.toString();
    });
  }

  return tmdbIdPromise.then(function(resolvedTmdbId) {
    return getMetadata(resolvedTmdbId, normalizedType, season, episode, providerContext)
      .then(function(metadata) {
        var apiUrl = 'https://goatapi.imreallydagoatt.workers.dev/api/downloader/movie/' + resolvedTmdbId;

        return fetch(apiUrl)
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (!data || data.success !== true) {
              console.log('[GoatAPI] GoatAPI success=false');
              return [];
            }

            var streams = [];

            if (data.streams && data.streams.length > 0) {
              data.streams.forEach(function(stream) {
                if (!stream.url) return;

                var filename   = extractFilename(stream);
                var size       = (stream.size || '').trim() || 'Variable Size';
                var sourceName = extractSourceName(stream);
                var quality    = detectQuality([
                  stream.quality, stream.label, stream.title,
                  stream.release, stream.source, stream.encode,
                  stream.format,  stream.codec,  filename, stream.url
                ]);

                // The multi-line system runs completely within title string context
                var generatedTitle = buildTitle(
                  metadata,
                  quality,
                  'English',
                  'MKV',
                  size,
                  null,
                  null,
                  filename
                );

                streams.push({
                  name:    'GoatAPI | ' + quality + ' | ' + sourceName,
                  title:   generatedTitle,
                  quality: quality.toLowerCase(),
                  url:     stream.url,
                });
              });
            } else if (data.downloads) {
              data.downloads.forEach(function(download) {
                (download.sources || []).forEach(function(src) {
                  if (!src.url) return;

                  var filename   = extractDownloadFilename(download, src);
                  var size       = (download.size || '').trim() || 'Variable Size';
                  var host       = (src.name || '').trim().replace(/\s+\d+$/, '').trim() || 'Mirror';
                  var quality    = detectQuality([download.title, filename]);

                  var generatedTitle = buildTitle(
                    metadata,
                    quality,
                    'English',
                    'MKV',
                    size,
                    null,
                    null,
                    filename
                  );

                  streams.push({
                    name:    'GoatAPI | ' + quality + ' | ' + host,
                    title:   generatedTitle,
                    quality: quality.toLowerCase(),
                    url:     src.url,
                  });
                });
              });
            }

            console.log('[GoatAPI] Returning ' + streams.length + ' stream(s)');
            return streams;
          });
      });
  })
  .catch(function(err) {
    console.error('[GoatAPI] Error: ' + err.message);
    return [];
  });
}

module.exports = { getStreams };
