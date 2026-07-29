/**
 * AnimeZey Scraper (Filmes & Séries)
 */

var PROVIDER_NAME = "AnimeZeY";
var BASE_DOMAIN = "1.animezey23112022.workers.dev";
var DOWNLOAD_DOMAIN = "animezey16082023.animezey16082023.workers.dev";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_BASE = "https://api.themoviedb.org/3";
var REQUEST_TIMEOUT = 12000;

var MOBILE_UAS = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];

function getHeaders(sessionUA) {
  return {
    "User-Agent": sessionUA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
  };
}

async function fetchJson(url, opts) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function fetchText(url, sessionUA) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    const res = await fetch(url, { 
      headers: { "User-Agent": sessionUA, "Accept": "text/html,application/xhtml+xml" },
      signal: controller.signal 
    });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}

function parseQuality(text) {
  var t = String(text || '').toLowerCase();
  if (t.includes('2160') || t.includes('4k') || t.includes('uhd')) return '2160p';
  if (t.includes('1080') || t.includes('fullhd')) return '1080p';
  if (t.includes('720')) return '720p';
  if (t.includes('480') || t.includes('sd')) return '480p';
  return '1080p';
}

function formatSize(sizeBytes) {
  try {
    var b = Number(sizeBytes);
    if (!b || isNaN(b)) return 'N/A';
    if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(2) + 'MB';
    return (b / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
  } catch (e) {
    return 'N/A';
  }
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

function removeAccents(text) {
  return (text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

async function getTMDBInfo(tmdbId, mediaType, sessionUA) {
  var isTv = (mediaType === 'tv' || mediaType === 'series' || mediaType === 'tvshow');
  var url = TMDB_BASE + (isTv ? '/tv/' : '/movie/') + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=pt-BR';
  var data = await fetchJson(url, { headers: getHeaders(sessionUA) });
  if (!data) return null;

  return {
    title: isTv ? data.name : data.title,
    originalTitle: isTv ? data.original_name : data.original_title,
    year: isTv ? (data.first_air_date || '').substring(0, 4) : (data.release_date || '').substring(0, 4),
    isTv: isTv,
    seasons: data.seasons || []
  };
}

async function postToAnimezey(searchUrl, payload, sessionUA) {
  return await fetchJson(searchUrl, {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'content-type': 'application/json',
      'User-Agent': sessionUA
    },
    body: JSON.stringify(payload)
  });
}

function buildDownloadUrl(linkPart) {
  if (!linkPart) return null;
  if (linkPart.includes('/download.aspx')) {
    return linkPart.startsWith('http') ? linkPart : 'https://' + DOWNLOAD_DOMAIN + linkPart;
  }
  try {
    var splitIdx = linkPart.indexOf('?');
    var pathPart = splitIdx === -1 ? linkPart : linkPart.slice(0, splitIdx);
    var queryString = splitIdx === -1 ? '' : linkPart.slice(splitIdx + 1);
    var params = new URLSearchParams(queryString);
    var fileId = params.get('file');
    if (!fileId) return null;

    var outParams = new URLSearchParams({ file: fileId });
    ['expiry', 'mac'].forEach(function (key) {
      var val = params.get(key);
      if (val) outParams.set(key, val);
    });

    return 'https://' + DOWNLOAD_DOMAIN + pathPart + '?' + outParams.toString();
  } catch (e) {
    return null;
  }
}

async function resolveDirectLink(item, sessionUA) {
  var linkPart = item.link || '';
  if (!linkPart) return null;

  if (linkPart.includes('/download.aspx')) {
    return buildDownloadUrl(linkPart);
  }

  var viewUrl = 'https://' + BASE_DOMAIN + linkPart;
  if (!viewUrl.includes('a=view')) viewUrl += viewUrl.includes('?') ? '&a=view' : '?a=view';

  var html = await fetchText(viewUrl, sessionUA);
  if (html) {
    var srcMatch = html.match(/<source[^>]+src=["']([^"']+)["']/i);
    if (srcMatch) return srcMatch[1];
  }

  return buildDownloadUrl(linkPart);
}

function makeStream(fileName, rawUrl, quality, fileSize, sessionUA, mediaInfo) {
  var cleanName = fileName.trim();
  var lowerContext = cleanName.toLowerCase();
  
  var fileFormat = lowerContext.endsWith('.mp4') ? 'MP4' : 'MKV';
  var sourceTag = "WEB-DL";
  if (/\b(bluray|bdrip)\b/i.test(lowerContext)) sourceTag = "BluRay";
  else if (/\b(webrip|hdrip)\b/i.test(lowerContext)) sourceTag = "WEBRip";

  var is4K = quality.includes("2160") || lowerContext.includes("4k");
  var codecTag = "H.264";
  if (/\b(hevc|x265|h265)\b/i.test(lowerContext) || is4K) codecTag = "HEVC";

  var rangeTag = "";
  if (/\b(dolby\s*vision|dovi|dv)\b/i.test(lowerContext)) rangeTag = "Dolby Vision";
  else if (/\bhdr10\b/i.test(lowerContext)) rangeTag = "HDR10";
  else if (/\bhdr\b/i.test(lowerContext)) rangeTag = "HDR";

  var videoRangeBlock = rangeTag ? " | 🔆 " + rangeTag + " • ⚡ " + codecTag : " | ⚡ " + codecTag;
  var audioChannelTag = is4K ? "DDP5.1 • 🔊 Atmos" : "DD5.1";

  var isDualAudio = /\b(dual|multi|dubbed|legendado|dublado)\b/i.test(lowerContext);
  var audioType = isDualAudio ? "Dual / Subbed" : "Single Audio";
  var displayLanguages = isDualAudio ? "Portuguese 🇧🇷 • Japanese 🇯🇵" : "Portuguese 🇧🇷";

  var displayQuality = quality || "1080p";
  var label = PROVIDER_NAME + " | " + displayQuality + " | " + audioType;

  var yearMatch = cleanName.match(/\b(19|20)\d{2}\b/);
  var displayYear = yearMatch ? yearMatch[0] : "2026";

  var line1 = mediaInfo ? '🎦 ' + cleanName + ' - ' + mediaInfo : '🎦 ' + cleanName;
  var line2 = '💎 ' + displayQuality + ' | 🗣️ ' + displayLanguages + ' | 💾 ' + fileSize;
  var line3 = '🎞️ ' + fileFormat + ' | 🎧 ' + audioChannelTag + videoRangeBlock;
  var line4 = '🔗 AnimeZeY Cloud | ☁️ ' + sourceTag;

  var formattedTitle = line1 + '\n' + line2 + '\n' + line3 + '\n' + line4;

  var num = parseFloat(fileSize) || 0;
  var numericalSizeWeight = fileSize.includes("GB") ? num * 1024 : num;
  var baseResWeight = is4K ? 9000000 : (displayQuality.includes("1080") ? 6000000 : 3000000);

  return {
    name: label,
    title: formattedTitle,
    size: fileSize,
    url: rawUrl,
    _sortWeight: baseResWeight + numericalSizeWeight,
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: {
        request: {
          "User-Agent": sessionUA,
          "Referer": "https://" + BASE_DOMAIN + "/"
        }
      }
    }
  };
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    var sessionUA = MOBILE_UAS[Math.floor(Math.random() * MOBILE_UAS.length)];
    var isTv = (mediaType === 'tv' || mediaType === 'series' || mediaType === 'tvshow');

    var tmdbInfo = await getTMDBInfo(tmdbId, mediaType, sessionUA);
    if (!tmdbInfo || !tmdbInfo.title) return [];

    var searchUrl = "https://" + BASE_DOMAIN + "/1:search";
    var query = tmdbInfo.title;

    if (isTv) {
      var s = parseInt(season, 10) || 1;
      var e = parseInt(episode, 10) || 1;
      query += " S" + pad(s, 2) + "E" + pad(e, 2);
    } else if (tmdbInfo.year) {
      query += " " + tmdbInfo.year;
    }

    var searchRes = await postToAnimezey(searchUrl, { q: query }, sessionUA);
    var files = (searchRes && searchRes.data && searchRes.data.files) ? searchRes.data.files : [];

    if (!files.length && tmdbInfo.originalTitle) {
      var altQuery = tmdbInfo.originalTitle + (isTv ? " E" + pad(episode || 1, 2) : "");
      var altRes = await postToAnimezey(searchUrl, { q: altQuery }, sessionUA);
      files = (altRes && altRes.data && altRes.data.files) ? altRes.data.files : [];
    }

    if (!files.length) return [];

    var epLabel = isTv ? 'S' + pad(season || 1, 2) + 'E' + pad(episode || 1, 2) : '';
    var streams = [];

    for (var i = 0; i < Math.min(files.length, 5); i++) {
      var file = files[i];
      var name = file.name || '';
      
      if (!/\.(mp4|mkv|avi|mov)$/i.test(name) && !(file.mimeType || '').includes('video')) continue;

      var directUrl = await resolveDirectLink(file, sessionUA);
      if (!directUrl) continue;

      var quality = parseQuality(name);
      var fileSize = formatSize(file.size || 0);

      var streamObj = makeStream(name, directUrl, quality, fileSize, sessionUA, epLabel);
      streams.push(streamObj);
    }

    streams.sort(function(a, b) { return (b._sortWeight || 0) - (a._sortWeight || 0); });
    return streams;

  } catch (e) {
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
