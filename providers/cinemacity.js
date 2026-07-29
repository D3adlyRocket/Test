/**
 * AnimeZey Scraper (Filmes & Séries)
 * Preserves the full original search and matching engine with formatted stream outputs.
 */

var PROVIDER_NAME = "AnimeZeY";
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_BASE = "https://api.themoviedb.org/3";
var MAX_RETRIES = 2;
var MAX_RESULTS_MOVIE = 5;
var MAX_RESULTS_EPISODE = 2;

var MOBILE_UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];

// ---------------------------------------------------------------------------
// Helper Utils
// ---------------------------------------------------------------------------

function removeAccents(text) {
  return (text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeForCompare(text) {
  if (!text) return '';
  var ascii = removeAccents(String(text)).toLowerCase();
  return ascii.replace(/[^a-z0-9]/g, '');
}

function parseQuality(text) {
  var n = String(text || '').toLowerCase();
  if (n.includes('2160p') || n.includes('4k') || n.includes('uhd')) return '2160p';
  if (n.includes('1080p') || n.includes('fullhd') || n.includes('full hd')) return '1080p';
  if (n.includes('720p')) return '720p';
  if (['dvdrip', 'sd', '480p', 'tvrip'].some(function (t) { return n.includes(t); })) return '480p';
  return '1080p';
}

function formatSize(sizeBytes) {
  try {
    var b = Number(sizeBytes);
    if (!b || isNaN(b)) return 'N/A';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(2) + ' KB';
    if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(2) + ' MB';
    return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  } catch (e) {
    return 'N/A';
  }
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

function decodeEntities(encodedString) {
  if (!encodedString) return '';
  var translate_re = /&(nbsp|amp|quot|lt|gt|#038);/g;
  var translate = { "nbsp": " ", "amp": "&", "quot": "\"", "lt": "<", "gt": ">", "#038": "&" };
  return encodedString.replace(translate_re, function(match, entity) { return translate[entity]; }).replace(/&#(\d+);/g, function(match, num) { return String.fromCharCode(num); });
}

// ---------------------------------------------------------------------------
// Search Pattern Generators & Match Rules
// ---------------------------------------------------------------------------

function getAnimeSearchPatterns(season, episode) {
  var seen = {};
  var patterns = [];
  function add(s, e) {
    var key = s + ':' + e;
    if (!seen[key]) { seen[key] = true; patterns.push([s, e]); }
  }
  add(season, episode);
  if (season === 1 && episode > 11) {
    [12, 13].forEach(function (offset) {
      if (episode > offset) add(2, episode - offset);
    });
  }
  return patterns;
}

function getAnimeSearchCodes(season, episode) {
  var patterns = getAnimeSearchPatterns(season, episode);
  var seen = {};
  var codes = [];
  function add(c) { if (!seen[c]) { seen[c] = true; codes.push(c); } }

  patterns.forEach(function (pair) {
    var s = pair[0], e = pair[1];
    add('S' + pad(s, 2) + 'E' + pad(e, 2));
    add(pad(s, 2) + 'x' + pad(e, 2));
    add(s + '.' + pad(e, 2));
    if (s === 1 && e !== 1) {
      add(pad(e, 2));
      add(pad(e, 3));
      add('ep' + pad(e, 2));
      add('e' + pad(e, 2));
    }
  });
  return codes;
}

var TITLE_END_RE = new RegExp(
  '^(?:' +
    's\\d{1,2}e\\d{1,2}' +
    '|\\[?\\d{3,4}p\\]?' +
    '|(?:19|20)\\d{2}' +
    '|ep?\\s*\\d+' +
    '|episode\\s*\\d+' +
    '|\\[(?:dual|dub|leg|sub|pt[\\-.]br|bluray|bdrip|webrip' +
      '|web[\\-.]dl|hdtv|x264|x265|hevc|aac|mkv|mp4|avi|wmv|mov)\\]' +
    '|(?:dual|dub|leg|sub|pt[\\-.]br|bluray|bdrip|webrip' +
      '|web[\\-.]dl|hdtv|x264|x265|hevc|aac|mkv|mp4|avi|wmv|mov)' +
    '|\\[\\d+' +
    '|\\s-\\s\\d+' +
  ')',
  'i'
);

var IGNORABLE_PREFIX_WORDS = { the: 1, a: 1, an: 1, o: 1, os: 1, as: 1, de: 1, do: 1, da: 1, dos: 1, das: 1, em: 1, no: 1, na: 1, nos: 1, nas: 1, um: 1, uma: 1 };

var NOISE_WORD_RE = new RegExp(
  '^(?:\\d{4}|[a-z0-9]+(?:p|k)|bluray|bdrip|webrip|web|hdtv' +
  '|x264|x265|hevc|aac|mkv|mp4|avi|wmv|mov|hdr|sdr|remux' +
  '|dual|dub|dublado|leg|legendado|sub|pt[\\-.]?br' +
  '|nf|netflix|hbo|max|hbomax|disney|disneyplus|amazon|prime' +
  '|paramount|peacock|hulu|apple|appletv|star|globoplay' +
  '|telecine|crunchyroll|funimation|youtube|vix|pluto' +
  '|copia|copy|sample|extras?)$',
  'i'
);

// ---------------------------------------------------------------------------
// Network Layer
// ---------------------------------------------------------------------------

async function fetchPlain(url, options) {
  return fetch(url, options || {});
}

async function fetchJson(url, sessionUA) {
  try {
    var res = await fetchPlain(url, { headers: { 'User-Agent': sessionUA } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function postToAnimezey(url, payload, sessionUA) {
  try {
    var res = await fetchPlain(url, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'accept-language': 'pt-BR,pt;q=0.9',
        'content-type': 'application/json',
        'Referer': url,
        'User-Agent': sessionUA,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function fetchTmdbDetails(tmdbId, mediaType, sessionUA) {
  var path = mediaType === 'movie' ? '/movie/' + tmdbId : '/tv/' + tmdbId;
  var url = TMDB_BASE + path + '?api_key=' + TMDB_API_KEY + '&language=pt-BR';
  return await fetchJson(url, sessionUA);
}

function computeAbsoluteEpisode(seasons, season, episode) {
  if (!Array.isArray(seasons)) return null;
  var abs = episode;
  for (var i = 0; i < seasons.length; i++) {
    var s = seasons[i];
    if (s.season_number > 0 && s.season_number < season) {
      abs += s.episode_count || 0;
    }
  }
  return abs;
}

// ---------------------------------------------------------------------------
// Stream Layout Engine
// ---------------------------------------------------------------------------

function makeStream(fileName, url, fileSize, sessionUA, mediaInfo) {
  var cleanName = decodeEntities(fileName || '').replace(/[\n\t]+/g, '').trim();
  var lowerContext = cleanName.toLowerCase();
  var lowerUrl = (url || "").toLowerCase();

  var fileSizeOnly = fileSize || "N/A";
  var numericalSizeWeight = 0;
  var sizeInGB = 0;

  var sizeMatch = fileSizeOnly.match(/(\d+(?:\.\d+)?\s*[MG]B)/i);
  if (sizeMatch) {
    var num = parseFloat(sizeMatch[1]);
    var unit = sizeMatch[1].toUpperCase();
    numericalSizeWeight = unit.includes("GB") ? num * 1024 : num;
    sizeInGB = unit.includes("GB") ? num : num / 1024;
  }

  var fileFormat = (url && lowerUrl.split('?')[0].endsWith(".mp4")) ? "MP4" : "MKV";
  var sourceTag = "WEB-DL";
  if (/\b(bluray|blu\-ray|bdrip)\b/i.test(lowerContext)) sourceTag = "BluRay";
  else if (/\b(hdrip|webrip)\b/i.test(lowerContext)) sourceTag = "WEBRip";

  var quality = parseQuality(cleanName);
  var is4K = quality === "2160p" || lowerContext.includes("4k");
  var codecTag = "H.264";
  if (/\b(hevc|x265|h265)\b/i.test(lowerContext) || lowerUrl.includes("hevc") || lowerUrl.includes("x265") || is4K) {
    codecTag = "HEVC";
  }

  var videoRangeBlock = "";
  var rangeTag = "";
  if (/\b(dolby\s*vision|dovi|dv)\b/i.test(lowerContext) || lowerUrl.includes("dovi")) {
    rangeTag = "Dolby Vision";
  } else if (/\bhdr10\b/i.test(lowerContext)) {
    rangeTag = "HDR10";
  } else if (/\bhdr\b/i.test(lowerContext)) {
    rangeTag = "HDR";
  } else if (/\b(10bit|10\-bit)\b/i.test(lowerContext)) {
    rangeTag = "10Bit";
  }

  if (rangeTag) videoRangeBlock = " | 🔆 " + rangeTag + " • ⚡ " + codecTag;
  else videoRangeBlock = " | ⚡ " + codecTag;

  var audioChannelTag = "DD5.1";
  if (is4K) {
    audioChannelTag = "DDP5.1 • 🔊 Atmos";
  } else if (sizeMatch && sizeInGB < 1.3) {
    audioChannelTag = "Stereo";
  } else if (codecTag === "HEVC") {
    audioChannelTag = "DD5.1";
  }

  var isDualAudio = /\b(dual|multi|dubbed|legendado|dublado)\b/i.test(lowerContext) || lowerUrl.includes("dual");
  var audioType = isDualAudio ? "Dual-Audio" : "Single Audio";
  var displayLanguages = isDualAudio ? "Portuguese 🇧🇷 • Japanese 🇯🇵" : "Portuguese 🇧🇷";

  var label = PROVIDER_NAME + " | " + quality + " | " + audioType;
  var yearMatch = cleanName.match(/\b(19|20)\d{2}\b/);
  var displayYear = yearMatch ? yearMatch[0] : "2026";

  var line1 = mediaInfo ? '🎦 ' + cleanName + ' - ' + mediaInfo : '🎦 ' + cleanName + ' - (' + displayYear + ')';
  var line2 = '💎 ' + quality + ' | 🗣️ ' + displayLanguages + ' | 💾 ' + fileSizeOnly;
  var line3 = '🎞️ ' + fileFormat + ' | 🎧 ' + audioChannelTag + videoRangeBlock;
  var line4 = '🔗 AnimeZeY Server | ☁️ ' + sourceTag;
  var formattedTitle = line1 + '\n' + line2 + '\n' + line3 + '\n' + line4;

  var baseResWeight = is4K ? 9000000 : (quality.includes("1080") ? 6000000 : 3000000);
  var structuralSortWeight = baseResWeight + numericalSizeWeight;

  return {
    name: label,
    title: formattedTitle,
    size: formattedTitle,  // <-- CORRECTED: Mapping multiline text to size field
    url: url || "",
    _sortWeight: structuralSortWeight,
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: {
        request: {
          "User-Agent": sessionUA,
          "Referer": "https://1.animezey23112022.workers.dev/"
        }
      }
    }
  };
}

// ---------------------------------------------------------------------------
// AnimeZey Scraper Engine Class
// ---------------------------------------------------------------------------

function AnimeZeyScraper(providerUrl, itemData, sessionUA) {
  this.providerUrl = providerUrl;
  this.sessionUA = sessionUA;
  this.tmdbId = itemData.tmdb_id;
  this.title = (itemData.title || '').trim();
  this.originalTitle = (itemData.original_title || '').trim();
  this.romajiTitle = (itemData.romaji_title || '').trim();
  this.mediaType = (itemData.media_type || '').toLowerCase();

  var y = parseInt(itemData.year, 10);
  this.year = Number.isFinite(y) ? y : null;

  if (this.mediaType === 'tvshow') {
    var s = parseInt(itemData.season, 10);
    var e = parseInt(itemData.episode, 10);
    this.season = Number.isFinite(s) ? s : 1;
    this.episode = Number.isFinite(e) ? e : 1;
    var rawAbs = itemData.absolute_episode;
    var abs = parseInt(rawAbs, 10);
    this.absEp = (rawAbs !== undefined && rawAbs !== null && Number.isFinite(abs)) ? abs : null;
  } else {
    this.season = null;
    this.episode = null;
    this.absEp = null;
  }

  this._setupDomains();
}

AnimeZeyScraper.prototype._setupDomains = function () {
  var netloc = '1.animezey23112022.workers.dev';
  try { netloc = new URL(this.providerUrl).host || netloc; } catch (e) {}
  this.baseDomain = netloc;
  this.downloadDomain = 'animezey16082023.animezey16082023.workers.dev';
};

AnimeZeyScraper.prototype._isAnime = function () {
  if (this.romajiTitle && this.romajiTitle !== this.originalTitle) return true;
  var cjk = /[\u3040-\u30ff\u4e00-\u9fff]/;
  return [this.romajiTitle, this.originalTitle, this.title].some(function (f) { return f && cjk.test(f); });
};

AnimeZeyScraper.prototype._isFlatSeries = function () {
  return !this._isAnime() && this.mediaType === 'tvshow' && this.season === 1;
};

AnimeZeyScraper.prototype.scrape = async function () {
  if (this.mediaType === 'movie') return await this._searchMovies();
  if (this.mediaType === 'tvshow') return await this._searchEpisodes();
  return [];
};

AnimeZeyScraper.prototype._searchEpisodes = async function () {
  var self = this;
  var seenIds = {};
  var episodes = [];
  var queries = this._generateEpisodeQueries().slice(0, 10);
  if (!queries.length) return [];

  var searchUrl = 'https://' + this.baseDomain + '/1:search';

  for (var i = 0; i < queries.length; i++) {
    if (episodes.length >= MAX_RESULTS_EPISODE) break;
    var result = await postToAnimezey(searchUrl, { q: queries[i], page_token: null, page_index: 0 }, self.sessionUA);
    var files = result && result.data && result.data.files ? result.data.files : [];
    for (var j = 0; j < files.length; j++) {
      if (episodes.length >= MAX_RESULTS_EPISODE) break;
      var item = files[j];
      if (seenIds[item.id]) continue;
      seenIds[item.id] = true;
      if (!self._isVideoFile(item)) continue;
      if (self._isCorrectEpisode(item.name || '')) {
        episodes.push(item);
      }
    }
  }

  return await self._processResults(episodes);
};

AnimeZeyScraper.prototype._generateEpisodeQueries = function () {
  var queries = [];
  var baseNames = this._getBaseNames().slice(0, 4);
  if (!baseNames.length) return [];

  var searchCodes = getAnimeSearchCodes(this.season, this.episode);
  var isAnime = this._isAnime();
  var self = this;

  function variants(name) {
    var clean = removeAccents(name.replace(/['".:]/g, ''));
    clean = clean.replace(/\s*-\s*/g, ' ').trim();
    var dots = clean.replace(/ /g, '.');
    var raw = name.replace(/['".:]/g, '');
    raw = raw.replace(/\s*-\s*/g, ' ').trim();
    var dotsRaw = raw.replace(/ /g, '.');
    return { clean: clean, dots: dots, raw: raw, dotsRaw: dotsRaw };
  }

  var sxey = 'S' + pad(this.season, 2) + 'E' + pad(this.episode, 2);
  baseNames.forEach(function (name) {
    var v = variants(name);
    queries.push(v.dotsRaw + '.' + sxey);
    queries.push(v.dots + '.' + sxey);
    queries.push(v.raw + ' ' + sxey);
    queries.push(v.clean + ' ' + sxey);
  });

  if (this._isFlatSeries()) {
    baseNames.forEach(function (name) {
      var v = variants(name);
      queries.push(v.clean + ' - ' + pad(self.episode, 3));
      queries.push(v.clean + ' - ' + pad(self.episode, 2));
      queries.push(v.dots + '.' + pad(self.episode, 3));
      queries.push(v.dots + '.' + pad(self.episode, 2));
      queries.push(v.clean + ' ' + pad(self.episode, 3));
    });
  }

  var useAbsolute = isAnime && this.absEp !== null && this.absEp !== this.episode;
  if (useAbsolute) {
    baseNames.forEach(function (name) {
      var v = variants(name);
      queries.push(v.clean + ' - ' + pad(self.absEp, 2));
      queries.push(v.clean + ' - ' + pad(self.absEp, 3));
      queries.push(v.dots + '.' + pad(self.absEp, 2));
      queries.push(v.dots + '.' + pad(self.absEp, 3));
    });
  }

  if (isAnime && this.season > 1 && this.absEp === null) {
    baseNames.forEach(function (name) {
      var v = variants(name);
      queries.push(v.clean + ' - ' + pad(self.episode, 3));
      queries.push(v.clean + ' - ' + pad(self.episode, 2));
      queries.push(v.dots + '.' + pad(self.episode, 3));
      queries.push(v.dots + '.' + pad(self.episode, 2));
    });
  }

  if (isAnime && this.season === 1) {
    baseNames.forEach(function (name) {
      var v = variants(name);
      queries.push(v.clean + ' - ' + pad(self.episode, 2));
      queries.push(v.clean + ' - ' + pad(self.episode, 3));
      queries.push(v.dots + ' - ' + pad(self.episode, 2));
      queries.push(v.dots + '-' + pad(self.episode, 2));
    });
  }

  baseNames.forEach(function (name) {
    var v = variants(name);
    var codes = (isAnime && self.season === 1)
      ? searchCodes.filter(function (c) { return /^\d+$/.test(c); })
      : searchCodes.slice(0, 4);
    codes.forEach(function (code) {
      queries.push(v.dots + '.' + code);
      if (code.toUpperCase().charAt(0) !== 'S') queries.push(v.clean + ' ' + code);
    });
  });

  if (this.year && this.year > 1900) {
    baseNames.slice(0, 2).forEach(function (name) {
      var v = variants(name);
      searchCodes.slice(0, 2).forEach(function (code) {
        queries.push(v.dots + '.' + self.year + '.' + code);
      });
      if (isAnime && self.season === 1) {
        queries.push(v.clean + ' ' + self.year + ' - ' + pad(self.episode, 2));
      }
    });
  }

  var seen = {};
  return queries.filter(function (q) {
    q = q.trim();
    if (!q || seen[q]) return false;
    seen[q] = true;
    return true;
  });
};

AnimeZeyScraper.prototype._isCorrectEpisode = function (filename) {
  var fnLower = filename.toLowerCase();
  var fnAsciiLower = removeAccents(fnLower);

  if (!this._matchesSeriesInFilename(fnLower)) return false;

  var sxeyPresent = /s\d{2}e\d{2}|\d+x\d{2}/.test(fnAsciiLower);
  var sxeyPatterns = ['s' + pad(this.season, 2) + 'e' + pad(this.episode, 2), this.season + 'x' + pad(this.episode, 2)];
  for (var i = 0; i < sxeyPatterns.length; i++) {
    if (fnAsciiLower.includes(sxeyPatterns[i])) return true;
  }
  if (sxeyPresent) return false;

  var codes = getAnimeSearchCodes(this.season, this.episode);
  for (var j = 0; j < codes.length; j++) {
    var re = new RegExp('(?<!\\d)' + escapeRegExp(codes[j].toLowerCase()) + '(?!\\d)');
    if (re.test(fnAsciiLower)) return true;
  }

  if (this._isAnime() && this.season > 1 && this.absEp === null) {
    var epPatterns = [
      ' - ' + pad(this.episode, 2), ' - ' + pad(this.episode, 3),
      '- ' + pad(this.episode, 2), '- ' + pad(this.episode, 3),
      ' ' + pad(this.episode, 3) + '.', ' ' + pad(this.episode, 3) + ' ',
      '[' + pad(this.episode, 3) + ']',
    ];
    if (epPatterns.some(function (p) { return fnAsciiLower.includes(p); })) return true;
  }

  if (this._isAnime() && this.absEp !== null) {
    var absPatterns = [
      ' - ' + pad(this.absEp, 2) + '(?!\\d)', ' - ' + pad(this.absEp, 3) + '(?!\\d)',
      '- ' + pad(this.absEp, 2) + '(?!\\d)', '- ' + pad(this.absEp, 3) + '(?!\\d)',
      ' ' + pad(this.absEp, 2) + ' ', ' ' + pad(this.absEp, 3) + ' ',
      ' ' + pad(this.absEp, 2) + '\\.', ' ' + pad(this.absEp, 3) + '\\.',
      '\\[' + pad(this.absEp, 2) + '\\]', '\\[' + pad(this.absEp, 3) + '\\]',
    ];
    if (absPatterns.some(function (p) { return new RegExp(p).test(fnAsciiLower); })) return true;
  }

  if (this._isFlatSeries()) {
    var flat = [
      ' - ' + pad(this.episode, 3) + '(?!\\d)', ' - ' + pad(this.episode, 2) + '(?!\\d)',
      '- ' + pad(this.episode, 3) + '(?!\\d)', '- ' + pad(this.episode, 2) + '(?!\\d)',
      '\\' + pad(this.episode, 3) + '\\]', '\\[' + pad(this.episode, 2) + '\\]',
      ' ' + pad(this.episode, 3) + '\\.', ' ' + pad(this.episode, 2) + '\\.',
      ' ' + pad(this.episode, 3) + ' ', ' ' + pad(this.episode, 2) + ' ',
    ];
    if (flat.some(function (p) { return new RegExp(p).test(fnAsciiLower); })) return true;
  }

  return false;
};

AnimeZeyScraper.prototype._normalizeFn = function (s) {
  var out = removeAccents((s || '').toLowerCase());
  out = out.replace(/[.\-_+,:]/g, ' ');
  out = out.replace(/[[\](){}]/g, ' ');
  return out.replace(/\s+/g, ' ').trim();
};

AnimeZeyScraper.prototype._titleMatch = function (title, filename) {
  var titleN = this._normalizeFn(title);
  var fnN = this._normalizeFn(filename);
  if (!titleN) return false;

  var hasSxey = /s\d{2}e\d{2}|\d+x\d{2}/.test(fnN);
  var pattern = new RegExp('(?<![a-z0-9])' + escapeRegExp(titleN) + '(?=[^a-z0-9]|$)', 'g');

  var m;
  while ((m = pattern.exec(fnN)) !== null) {
    var after = fnN.slice(m.index + titleN.length).trim();
    var afterOk = !after || TITLE_END_RE.test(after) || /^[\-\u2013\u2014]?\s*\d/.test(after);

    if (!afterOk && hasSxey) {
      var sxeyM = after.match(/s\d{2}e\d{2}|\d+x\d{2}/);
      if (sxeyM) {
        var between = after.slice(0, sxeyM.index);
        var betweenWords = between.split(/\s+/).filter(Boolean).filter(function (w) { return !NOISE_WORD_RE.test(w); });
        afterOk = betweenWords.length === 0;
      }
    }
    if (!afterOk) continue;

    var before = fnN.slice(0, m.index).trim();
    if (!before) return true;

    var contentWords = before.split(/\s+/).filter(Boolean).filter(function (w) {
      return !NOISE_WORD_RE.test(w) && !IGNORABLE_PREFIX_WORDS[w];
    });
    if (!contentWords.length) return true;
  }
  return false;
};

AnimeZeyScraper.prototype._matchesSeriesInFilename = function (filenameLower) {
  var baseNames = this._getBaseNames().slice(0, 8);
  var fnNorm = normalizeForCompare(removeAccents(filenameLower));
  var self = this;

  for (var i = 0; i < baseNames.length; i++) {
    var name = baseNames[i];
    var nameAscii = removeAccents(name);
    var nameNorm = normalizeForCompare(nameAscii);

    if (nameAscii.includes(':')) {
      var parts = nameAscii.split(':').map(function (p) { return p.trim(); });
      var allMatch = parts.every(function (p) {
        return p.length <= 2 || self._titleMatch(p, filenameLower) || self._titleMatch(normalizeForCompare(p), fnNorm);
      });
      if (allMatch) return true;
    } else if (self._titleMatch(nameAscii, filenameLower) || self._titleMatch(nameNorm, fnNorm)) {
      return true;
    }
  }
  return false;
};

AnimeZeyScraper.prototype._getBaseNames = function () {
  var names = [];
  var fields = this._isAnime()
    ? [this.romajiTitle, this.originalTitle, this.title]
    : [this.title, this.originalTitle, this.romajiTitle];

  fields.forEach(function (field) {
    if (!field) return;
    var clean = field.trim();
    if (names.indexOf(clean) === -1) names.push(clean);
    if (clean.includes(':')) {
      var short = clean.split(':')[0].trim();
      if (names.indexOf(short) === -1) names.push(short);
    }
  });
  if (!names.length) return [];

  var final = [];
  names.forEach(function (name) {
    final.push(name);
    if (name.includes("'")) final.push(name.replace(/'/g, ''));
    if (!name.includes(':')) {
      var lower = name.toLowerCase();
      var articles = ['the ', 'a ', 'an ', 'o ', 'os ', 'as '];
      for (var i = 0; i < articles.length; i++) {
        if (lower.startsWith(articles[i])) {
          var rest = name.slice(articles[i].length);
          if (final.indexOf(rest) === -1) final.push(rest);
          break;
        }
      }
    }
  });

  var seen = {};
  return final.filter(function (n) {
    if (!n || seen[n]) return false;
    seen[n] = true;
    return true;
  });
};

AnimeZeyScraper.prototype._searchMovies = async function () {
  var self = this;
  var seenIds = {};
  var movies = [];
  var queries = this._generateMovieQueries().slice(0, 8);
  var searchUrl = 'https://' + this.baseDomain + '/1:search';

  for (var i = 0; i < queries.length; i++) {
    if (movies.length >= MAX_RESULTS_MOVIE) break;
    var result = await postToAnimezey(searchUrl, { q: queries[i] }, self.sessionUA);
    var files = result && result.data && result.data.files ? result.data.files : [];
    for (var j = 0; j < files.length; j++) {
      if (movies.length >= MAX_RESULTS_MOVIE) break;
      var item = files[j];
      if (seenIds[item.id]) continue;
      seenIds[item.id] = true;
      if (self._isVideoFile(item) && self._isCorrectMovie(item.name || '')) {
        movies.push(item);
      }
    }
  }

  return await self._processResults(movies);
};

AnimeZeyScraper.prototype._generateMovieQueries = function () {
  var queries = [];
  var baseNames = this._getBaseNames().slice(0, 5);
  var self = this;

  baseNames.forEach(function (name) {
    var clean = removeAccents(name.replace(/['".:]/g, ''));
    clean = clean.replace(/\s*-\s*/g, ' ').trim();
    var dots = clean.replace(/ /g, '.');
    if (self.year) {
      queries.push(dots + '.' + self.year);
      queries.push(clean + ' ' + self.year);
    }
    queries.push(dots);
    queries.push(clean);
  });

  if (this.originalTitle) {
    var rawOrig = this.originalTitle.replace(/['".\-]/g, '').trim();
    if (this.year) queries.push(rawOrig + ' ' + this.year);
    queries.push(rawOrig);
  }

  var seen = {};
  return queries.filter(function (q) {
    if (!q || seen[q]) return false;
    seen[q] = true;
    return true;
  });
};

AnimeZeyScraper.prototype._isCorrectMovie = function (filename) {
  var baseNames = this._getBaseNames();
  var fnLower = filename.toLowerCase();
  var fnNorm = normalizeForCompare(removeAccents(fnLower));
  var self = this;

  for (var i = 0; i < baseNames.length; i++) {
    var name = baseNames[i];
    var nameAscii = removeAccents(name);
    var nameNorm = normalizeForCompare(nameAscii);
    var matched = self._titleMatch(nameAscii, fnLower) || self._titleMatch(nameNorm, fnNorm);
    if (matched) {
      return self.year ? fnLower.includes(String(self.year)) : true;
    }
  }
  return false;
};

AnimeZeyScraper.prototype._isVideoFile = function (item) {
  var name = (item.name || '').toLowerCase();
  var mime = item.mimeType || '';
  return mime.includes('video') || /\.(mp4|mkv|avi|mov|wmv|flv|webm)$/.test(name);
};

AnimeZeyScraper.prototype._processResults = async function (items) {
  var self = this;
  var streams = [];
  var seenLinks = {};

  var epInfo = (self.mediaType === 'tvshow') ? 'S' + pad(self.season, 2) + 'E' + pad(self.episode, 2) : '';

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var url = await self._extractPlayerUrl(item);
    if (!url || seenLinks[url]) continue;
    seenLinks[url] = true;

    var sizeFormatted = formatSize(item.size || 0);
    var streamObj = makeStream(item.name || 'AnimeZeY Stream', url, sizeFormatted, self.sessionUA, epInfo);
    streams.push(streamObj);
  }

  streams.sort(function (a, b) { return (b._sortWeight || 0) - (a._sortWeight || 0); });
  return streams;
};

AnimeZeyScraper.prototype._extractPlayerUrl = async function (item) {
  var linkPart = item.link || '';
  if (!linkPart) return null;

  if (linkPart.includes('/download.aspx')) {
    return this._buildDownloadLink(linkPart);
  }

  var viewUrl = 'https://' + this.baseDomain + linkPart;
  if (!viewUrl.includes('a=view')) {
    viewUrl += viewUrl.includes('?') ? '&a=view' : '?a=view';
  }

  try {
    var res = await fetchPlain(viewUrl, {
      headers: {
        'User-Agent': this.sessionUA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': 'https://' + this.baseDomain + '/',
      },
    });
    if (!res.ok) return this._buildDownloadLink(linkPart);
    var html = await res.text();
    var srcMatch = html.match(/<source[^>]+src=["']([^"']+)["']/i);
    if (srcMatch) return srcMatch[1];
  } catch (e) {}

  return this._buildDownloadLink(linkPart);
};

AnimeZeyScraper.prototype._buildDownloadLink = function (linkPart) {
  if (!linkPart || linkPart.charAt(0) !== '/') return null;
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

    return 'https://' + this.downloadDomain + pathPart + '?' + outParams.toString();
  } catch (e) {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    var sessionUA = MOBILE_UAS[Math.floor(Math.random() * MOBILE_UAS.length)];
    var isMovie = mediaType === 'movie';
    var isTv = mediaType === 'tv' || mediaType === 'series' || mediaType === 'tvshow';
    if (!isMovie && !isTv) return [];

    var details = await fetchTmdbDetails(tmdbId, isMovie ? 'movie' : 'tv', sessionUA);
    if (!details) return [];

    var title = isMovie ? details.title : details.name;
    var originalTitle = isMovie ? details.original_title : details.original_name;
    var dateStr = details.release_date || details.first_air_date || '';
    var year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : null;

    var itemData = {
      tmdb_id: tmdbId,
      title: title,
      original_title: originalTitle,
      romaji_title: '',
      media_type: isMovie ? 'movie' : 'tvshow',
      year: year,
      season: season,
      episode: episode,
      absolute_episode: (!isMovie && details.seasons) ? computeAbsoluteEpisode(details.seasons, season, episode) : null,
    };

    var scraper = new AnimeZeyScraper('https://1.animezey23112022.workers.dev', itemData, sessionUA);
    return await scraper.scrape();
  } catch (e) {
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
