// ============================================================================
// Nuvio Provider: SkTorrent
// Description: Czech / Slovak torrent provider for Nuvio
// Engine: Compatible with React Native Hermes (Promise-based)
// ============================================================================

const SKTORRENT_BASE = 'https://sktorrent.eu/torrent';
const SKTORRENT_TRACKER = 'http://ipv4announce.sktorrent.eu:6969/announce';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Safe Logger
function log(msg) {
  if (typeof console !== 'undefined' && console.log) {
    console.log('[SkTorrent Provider] ' + msg);
  }
}

// Network Helpers
function fetchText(url) {
  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
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

// Text Parsers & Sanitizers
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

function buildMagnet(infoHash, name) {
  var hash = String(infoHash || '').trim();
  if (!/^[a-f0-9]{40}$/i.test(hash)) return null;
  return 'magnet:?xt=urn:btih:' + hash + '&dn=' + encodeURIComponent(name || 'SkTorrent') + '&tr=' + encodeURIComponent(SKTORRENT_TRACKER);
}

function parseTorrentBlocks(html) {
  var torrents = [];
  var cellRegex = /<td\b[^>]*class\s*=\s*["']?lista["']?[^>]*>([\s\S]*?)(?=<td\b[^>]*class\s*=\s*["']?lista["']?|<\/tr>|<\/table>|$)/ig;
  var block;

  while ((block = cellRegex.exec(html)) !== null) {
    var content = block[1];
    var hashMatch = content.match(/details\.php\?[^"\s>]*?id=([a-f0-9]{40})/i);
    if (!hashMatch) continue;

    var linkMatch = content.match(/<a\b[^>]*href\s*=\s*["']?details\.php[^>]*>([\s\S]*?)<\/a>/i);
    var titleAttr = linkMatch && linkMatch[0].match(/\btitle\s*=\s*["']([^"']+)["']/i);
    
    var torrentTitle = stripTags(linkMatch && linkMatch[1]);
    if (!torrentTitle && titleAttr) {
      torrentTitle = titleAttr[1].replace(/^Stiahni si\s+/i, '');
    }
    if (!torrentTitle) continue;

    var sizeMatch = content.match(/Velkost\s+([^|<]+)/i);
    var seedsMatch = content.match(/Odosielaju\s*:\s*(\d+)/i);
    var peersMatch = content.match(/Stahuju\s*:\s*(\d+)/i);

    var sizeStr = sizeMatch ? decodeHtml(sizeMatch[1]).trim() : 'Unknown';

    torrents.push({
      infoHash: hashMatch[1].toLowerCase(),
      title: torrentTitle,
      size: sizeStr,
      seeds: seedsMatch ? parseInt(seedsMatch[1], 10) : 0,
      peers: peersMatch ? parseInt(peersMatch[1], 10) : 0
    });
  }
  return torrents;
}

// Media Info Resolvers
function resolveMediaDetails(tmdbId, mediaType) {
  var cinemetaType = mediaType === 'tv' ? 'series' : 'movie';
  var url = 'https://v3-cinemeta.strem.io/meta/' + cinemetaType + '/' + tmdbId + '.json';

  return fetchJson(url)
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

function buildQuery(title, year, mediaType, season, episode) {
  var cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  
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

// ============================================================================
// Nuvio Main Entry Point
// ============================================================================
function getStreams(tmdbId, mediaType, season, episode) {
  log('Searching streams for TMDB ID: ' + tmdbId + ' (' + mediaType + ')');

  return resolveMediaDetails(tmdbId, mediaType)
    .then(function (meta) {
      if (!meta || !meta.title) {
        log('Failed to resolve title for TMDB ID: ' + tmdbId);
        return [];
      }

      var searchQuery = buildQuery(meta.title, meta.year, mediaType, season, episode);
      var searchUrl = SKTORRENT_BASE + '/torrents_v2.php?search=' + encodeURIComponent(searchQuery);

      log('Querying SkTorrent: ' + searchQuery);
      return fetchText(searchUrl);
    })
    .then(function (html) {
      if (!html) return [];

      var torrents = parseTorrentBlocks(html);
      log('Found ' + torrents.length + ' raw torrent results');

      var streams = [];
      for (var i = 0; i < torrents.length; i++) {
        var t = torrents[i];
        var magnet = buildMagnet(t.infoHash, t.title);
        if (!magnet) continue;

        var quality = getQualityFromTitle(t.title);

        streams.push({
          name: 'SkTorrent • ' + quality,
          title: t.title + '\n👤 Seeders: ' + t.seeds + ' | Peer: ' + t.peers + ' | 💾 ' + t.size,
          url: magnet,
          quality: quality,
          size: t.size
        });
      }

      return streams;
    })
    .catch(function (err) {
      log('Error during stream extraction: ' + err.message);
      return [];
    });
}

// Nuvio Module Export Specification
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  globalThis.getStreams = getStreams;
}
