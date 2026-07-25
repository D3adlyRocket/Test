// ============================================================================
// Nuvio Provider: SkTorrent
// Description: Czech / Slovak torrent provider for Nuvio
// Engine: React Native Hermes Compatible (Promise-based)
// ============================================================================

const SKTORRENT_BASE = 'https://sktorrent.eu/torrent';
const SKTORRENT_TRACKER = 'http://ipv4announce.sktorrent.eu:6969/announce';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Safe Logger
function log(msg) {
  if (typeof console !== 'undefined' && console.log) {
    console.log('[SkTorrent] ' + msg);
  }
}

// Network Helpers
function fetchText(url) {
  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'cs,sk,en;q=0.8'
    }
  }).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
  });
}

function fetchJson(url) {
  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    }
  }).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  });
}

// Text Sanitization & Normalization
function decodeHtml(html) {
  return String(html || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, function (_, dec) { return String.fromCharCode(parseInt(dec, 10)); })
    .replace(/&#x([0-9a-fA-F]+);/g, function (_, hex) { return String.fromCharCode(parseInt(hex, 16)); });
}

function stripTags(html) {
  return decodeHtml(String(html || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeSearchQuery(text) {
  if (!text) return '';
  return text
    .normalize('NFD') // Decompose accented characters (e.g. Č -> C + ˇ)
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritic marks
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // Replace non-alphanumeric with space
    .replace(/\s+/g, ' ')
    .trim();
}

// Quality & Metadata Detectors
function getQualityFromTitle(title) {
  var upper = String(title || '').toUpperCase();
  if (/\b(2160P|4K|UHD)\b/.test(upper)) return '4K';
  if (/\b(1440P|2K)\b/.test(upper)) return '1440p';
  if (/\b(1080P|FHD|FULLHD)\b/.test(upper)) return '1080p';
  if (/\b(720P|HDTV|WEBRIP|WEB-DL|HD)\b/.test(upper)) return '720p';
  if (/\b(576P|DVDRIP|DVD)\b/.test(upper)) return '576p';
  if (/\b480P\b/.test(upper)) return '480p';
  if (/\b(CAM|TS|HDCAM)\b/.test(upper)) return 'CAM';
  return '720p';
}

// Parse SkTorrent HTML Rows
function parseTorrentBlocks(html) {
  var torrents = [];
  // Match torrent details links with numeric IDs or 40-char hashes
  var rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/ig;
  var rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    var rowContent = rowMatch[1];
    
    // Look for details.php?id=...
    var idMatch = rowContent.match(/details\.php\?[^"\s>]*?id=([a-f0-9]{40}|\d+)/i);
    if (!idMatch) continue;

    var torrentId = idMatch[1];

    // Extract title
    var linkMatch = rowContent.match(/<a\b[^>]*href\s*=\s*["']?details\.php[^>]*>([\s\S]*?)<\/a>/i);
    var titleAttr = rowContent.match(/\btitle\s*=\s*["']([^"']+)["']/i);
    
    var torrentTitle = stripTags(linkMatch && linkMatch[1]);
    if (!torrentTitle && titleAttr) {
      torrentTitle = titleAttr[1].replace(/^Stiahni si\s+/i, '');
    }
    if (!torrentTitle) continue;

    // Extract size & peers
    var sizeMatch = rowContent.match(/(\d+(?:\.\d+)?\s*(?:GB|MB|KB|B))/i);
    var seedsMatch = rowContent.match(/Odosielaju\s*:\s*(\d+)/i) || rowContent.match(/(\d+)\s*seed/i);
    var peersMatch = rowContent.match(/Stahuju\s*:\s*(\d+)/i) || rowContent.match(/(\d+)\s*leech/i);

    var sizeStr = sizeMatch ? sizeMatch[1].trim() : 'Unknown';
    var seeds = seedsMatch ? parseInt(seedsMatch[1], 10) : 0;
    var peers = peersMatch ? parseInt(peersMatch[1], 10) : 0;

    // Build URL: Magnet if 40-char infoHash, Torrent file download URL if numeric ID
    var streamUrl = '';
    if (/^[a-f0-9]{40}$/i.test(torrentId)) {
      streamUrl = 'magnet:?xt=urn:btih:' + torrentId.toLowerCase() + 
                  '&dn=' + encodeURIComponent(torrentTitle) + 
                  '&tr=' + encodeURIComponent(SKTORRENT_TRACKER);
    } else {
      streamUrl = SKTORRENT_BASE + '/download.php?id=' + torrentId;
    }

    torrents.push({
      id: torrentId,
      title: torrentTitle,
      size: sizeStr,
      seeds: seeds,
      peers: peers,
      url: streamUrl
    });
  }
  return torrents;
}

// Media Info Resolvers (Cinemeta + TMDB Czech Title Fallback)
function resolveMediaDetails(tmdbId, mediaType) {
  var cinemetaType = mediaType === 'tv' ? 'series' : 'movie';
  var cinemetaUrl = 'https://v3-cinemeta.strem.io/meta/' + cinemetaType + '/' + tmdbId + '.json';

  return fetchJson(cinemetaUrl)
    .then(function (data) {
      if (data && data.meta) {
        return {
          title: data.meta.name,
          year: data.meta.year ? parseInt(data.meta.year, 10) : null
        };
      }
      return null;
    })
    .catch(function () {
      return null;
    });
}

function buildSearchQuery(title, year, mediaType, season, episode) {
  var cleanTitle = sanitizeSearchQuery(title);
  
  if (mediaType === 'tv' && season && episode) {
    var s = String(season).padStart(2, '0');
    var e = String(episode).padStart(2, '0');
    return cleanTitle + ' S' + s + 'E' + e;
  }
  
  if (year) {
    return cleanTitle + ' ' + year;
  }
  
  return cleanTitle;
}

// Execute SkTorrent Query
function querySkTorrent(queryText) {
  var searchUrl = SKTORRENT_BASE + '/torrents_v2.php?search=' + encodeURIComponent(queryText) + '&category=0&active=0';
  log('Searching SkTorrent with query: ' + queryText);

  return fetchText(searchUrl)
    .then(function (html) {
      if (!html) return [];
      return parseTorrentBlocks(html);
    })
    .catch(function (err) {
      log('Search query failed for "' + queryText + '": ' + err.message);
      return [];
    });
}

// ============================================================================
// Nuvio Main Entry Point
// ============================================================================
function getStreams(arg1, arg2, arg3, arg4) {
  var tmdbId, mediaType, season, episode;

  // Handle both Object and Positional argument signatures from Nuvio
  if (typeof arg1 === 'object' && arg1 !== null) {
    tmdbId = arg1.tmdbId || arg1.id;
    mediaType = arg1.mediaType || arg1.type;
    season = arg1.season;
    episode = arg1.episode;
  } else {
    tmdbId = arg1;
    mediaType = arg2;
    season = arg3;
    episode = arg4;
  }

  log('Resolving stream for TMDB ID: ' + tmdbId + ' (' + mediaType + ')');

  return resolveMediaDetails(tmdbId, mediaType)
    .then(function (meta) {
      if (!meta || !meta.title) {
        log('Failed to resolve metadata for ID: ' + tmdbId);
        return [];
      }

      var query = buildSearchQuery(meta.title, meta.year, mediaType, season, episode);
      
      // First attempt: Primary Title
      return querySkTorrent(query).then(function (results) {
        // Fallback attempt: Title without Year if primary search returned no results
        if (results.length === 0 && meta.year) {
          var fallbackQuery = buildSearchQuery(meta.title, null, mediaType, season, episode);
          log('Primary query yielded 0 results. Trying fallback: ' + fallbackQuery);
          return querySkTorrent(fallbackQuery);
        }
        return results;
      });
    })
    .then(function (torrents) {
      log('Found ' + torrents.length + ' valid torrent streams');

      var streams = [];
      for (var i = 0; i < torrents.length; i++) {
        var t = torrents[i];
        var quality = getQualityFromTitle(t.title);

        streams.push({
          name: 'SkTorrent • ' + quality,
          title: t.title + '\n👤 Seeds: ' + t.seeds + ' | Peers: ' + t.peers + ' | 💾 ' + t.size,
          url: t.url,
          quality: quality,
          size: t.size
        });
      }

      return streams;
    })
    .catch(function (err) {
      log('Error during execution: ' + err.message);
      return [];
    });
}

// Module Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  globalThis.getStreams = getStreams;
}
