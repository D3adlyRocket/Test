/**
 * AnimeZey scraper — FILMES + SÉRIES, Nuvio.
 * 100% Promise-based (.then/.catch), sem async/await, sem setTimeout/
 * AbortController (sandbox confirmado sem essas APIs).
 */

const DEBUG = true;
const log = function () {
  if (DEBUG) console.log.apply(console, ['[animezey]'].concat(Array.prototype.slice.call(arguments)));
};

const MAX_RETRIES = 2;
const MAX_RESULTS_MOVIE = 5;
const MAX_RESULTS_EPISODE = 2;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TMDB_API_KEY = '70533e9a93ad18166cb20a576dc62607';
const TMDB_BASE = 'https://api.themoviedb.org/3';

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function removeAccents(text) {
  return (text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeForCompare(text) {
  if (!text) return '';
  const ascii = removeAccents(String(text)).toLowerCase();
  return ascii.replace(/[^a-z0-9]/g, '');
}

function guessQualityFromName(name) {
  // Número (1080, 720...), não string — confirmado no fshd.js real.
  if (!name) return 480;
  const n = name.toLowerCase();
  if (n.includes('2160p') || n.includes('4k') || n.includes('uhd')) return 2160;
  if (n.includes('1080p') || n.includes('fullhd') || n.includes('full hd')) return 1080;
  if (n.includes('720p')) return 720;
  if (['hdtv', 'webdl', 'web-dl', 'webrip', 'hdrip', 'bluray', 'bdrip'].some(function (t) { return n.includes(t); })) return 720;
  if (['dvdrip', 'sd', '480p', 'tvrip'].some(function (t) { return n.includes(t); })) return 480;
  return 720;
}

function formatSize(sizeBytes) {
  try {
    const b = Number(sizeBytes);
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

function getAnimeSearchPatterns(season, episode) {
  const seen = {};
  const patterns = [];
  function add(s, e) {
    const key = s + ':' + e;
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
  const patterns = getAnimeSearchPatterns(season, episode);
  const seen = {};
  const codes = [];
  function add(c) { if (!seen[c]) { seen[c] = true; codes.push(c); } }

  patterns.forEach(function (pair) {
    const s = pair[0], e = pair[1];
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

const TITLE_END_RE = new RegExp(
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

const IGNORABLE_PREFIX_WORDS = { the: 1, a: 1, an: 1, o: 1, os: 1, as: 1, de: 1, do: 1, da: 1, dos: 1, das: 1, em: 1, no: 1, na: 1, nos: 1, nas: 1, um: 1, uma: 1 };

const NOISE_WORD_RE = new RegExp(
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
// HTTP
// ---------------------------------------------------------------------------

function fetchPlain(url, options) {
  // Sem setTimeout/AbortController disponíveis no sandbox — fetch puro.
  return fetch(url, options || {});
}

function withRetry(fn, maxRetries, attempt) {
  maxRetries = maxRetries || MAX_RETRIES;
  attempt = attempt || 0;
  return fn().catch(function (e) {
    const isRetryable = e.name === 'AbortError' || e.name === 'TypeError';
    if (attempt >= maxRetries - 1 || !isRetryable) throw e;
    return withRetry(fn, maxRetries, attempt + 1);
  });
}

function postToAnimezey(url, payload) {
  return withRetry(function () {
    return fetchPlain(url, {
      method: 'POST',
      headers: {
        accept: '*/*',
        'accept-language': 'pt-BR,pt;q=0.9',
        'content-type': 'application/json',
        Referer: url,
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }).catch(function (e) {
    log('Erro POST ' + url + ':', e.message);
    return null;
  });
}

function fetchTmdbDetails(tmdbId, mediaType) {
  const path = mediaType === 'movie' ? '/movie/' + tmdbId : '/tv/' + tmdbId;
  const url = TMDB_BASE + path + '?api_key=' + TMDB_API_KEY + '&language=pt-BR';
  return fetchPlain(url).then(function (res) {
    if (!res.ok) throw new Error('TMDB HTTP ' + res.status);
    return res.json();
  });
}

function computeAbsoluteEpisode(seasons, season, episode) {
  if (!Array.isArray(seasons)) return null;
  let abs = episode;
  for (let i = 0; i < seasons.length; i++) {
    const s = seasons[i];
    if (s.season_number > 0 && s.season_number < season) {
      abs += s.episode_count || 0;
    }
  }
  return abs;
}

// ---------------------------------------------------------------------------
// Scraper
// ---------------------------------------------------------------------------

function AnimeZeyScraper(providerUrl, itemData) {
  this.providerUrl = providerUrl;
  this.tmdbId = itemData.tmdb_id;
  this.title = (itemData.title || '').trim();
  this.originalTitle = (itemData.original_title || '').trim();
  this.romajiTitle = (itemData.romaji_title || '').trim();
  this.mediaType = (itemData.media_type || '').toLowerCase();

  const y = parseInt(itemData.year, 10);
  this.year = Number.isFinite(y) ? y : null;

  if (this.mediaType === 'tvshow') {
    const s = parseInt(itemData.season, 10);
    const e = parseInt(itemData.episode, 10);
    this.season = Number.isFinite(s) ? s : 1;
    this.episode = Number.isFinite(e) ? e : 1;
    const rawAbs = itemData.absolute_episode;
    const abs = parseInt(rawAbs, 10);
    this.absEp = (rawAbs !== undefined && rawAbs !== null && Number.isFinite(abs)) ? abs : null;
  } else {
    this.season = null;
    this.episode = null;
    this.absEp = null;
  }

  this._setupDomains();
  log('🎯 Busca: title="' + this.title + '" media=' + this.mediaType +
      (this.mediaType === 'tvshow' ? (' S' + this.season + 'E' + this.episode + ' abs=' + this.absEp) : ''));
}

AnimeZeyScraper.prototype._setupDomains = function () {
  let netloc = '1.animezey23112022.workers.dev';
  try { netloc = new URL(this.providerUrl).host || netloc; } catch (e) {}
  this.baseDomain = netloc;
  this.downloadDomain = 'animezey16082023.animezey16082023.workers.dev';
};

AnimeZeyScraper.prototype._isAnime = function () {
  if (this.romajiTitle && this.romajiTitle !== this.originalTitle) return true;
  const cjk = /[\u3040-\u30ff\u4e00-\u9fff]/;
  return [this.romajiTitle, this.originalTitle, this.title].some(function (f) { return f && cjk.test(f); });
};

AnimeZeyScraper.prototype._isFlatSeries = function () {
  return !this._isAnime() && this.mediaType === 'tvshow' && this.season === 1;
};

AnimeZeyScraper.prototype.scrape = function () {
  const self = this;
  let p;
  if (this.mediaType === 'movie') p = this._searchMovies();
  else if (this.mediaType === 'tvshow') p = this._searchEpisodes();
  else p = Promise.resolve([]);

  return p.catch(function (e) {
    log('❌ Erro no scrape:', e.message);
    return [];
  });
};

// -------------------- Episódios --------------------

AnimeZeyScraper.prototype._searchEpisodes = function () {
  const self = this;
  const seenIds = {};
  const episodes = [];
  const queries = this._generateEpisodeQueries().slice(0, 10);
  log('[_searchEpisodes] ' + queries.length + ' queries: ' + JSON.stringify(queries));
  if (!queries.length) return Promise.resolve([]);

  const searchUrl = 'https://' + this.baseDomain + '/1:search';

  function processQuery(query) {
    if (episodes.length >= MAX_RESULTS_EPISODE) return Promise.resolve();
    return postToAnimezey(searchUrl, { q: query, page_token: null, page_index: 0 }).then(function (result) {
      const files = result && result.data && result.data.files ? result.data.files : [];
      log('[_searchEpisodes] query="' + query + '" -> ' + files.length + ' arquivo(s)');
      for (let i = 0; i < files.length; i++) {
        if (episodes.length >= MAX_RESULTS_EPISODE) break;
        const item = files[i];
        if (seenIds[item.id]) continue;
        seenIds[item.id] = true;
        if (!self._isVideoFile(item)) continue;
        if (self._isCorrectEpisode(item.name || '')) {
          episodes.push(item);
        }
      }
    });
  }

  return queries.reduce(function (p, q) {
    return p.then(function () { return processQuery(q); });
  }, Promise.resolve()).then(function () {
    log('[_searchEpisodes] episódios casados: ' + episodes.length);
    return episodes.length ? self._processResults(episodes) : [];
  });
};

AnimeZeyScraper.prototype._generateEpisodeQueries = function () {
  const queries = [];
  const baseNames = this._getBaseNames().slice(0, 4);
  if (!baseNames.length) return [];

  const searchCodes = getAnimeSearchCodes(this.season, this.episode);
  const isAnime = this._isAnime();
  const self = this;

  function variants(name) {
    let clean = removeAccents(name.replace(/['".:]/g, ''));
    clean = clean.replace(/\s*-\s*/g, ' ').trim();
    const dots = clean.replace(/ /g, '.');
    let raw = name.replace(/['".:]/g, '');
    raw = raw.replace(/\s*-\s*/g, ' ').trim();
    const dotsRaw = raw.replace(/ /g, '.');
    return { clean: clean, dots: dots, raw: raw, dotsRaw: dotsRaw };
  }

  const sxey = 'S' + pad(this.season, 2) + 'E' + pad(this.episode, 2);
  baseNames.forEach(function (name) {
    const v = variants(name);
    queries.push(v.dotsRaw + '.' + sxey);
    queries.push(v.dots + '.' + sxey);
    queries.push(v.raw + ' ' + sxey);
    queries.push(v.clean + ' ' + sxey);
  });

  if (this._isFlatSeries()) {
    baseNames.forEach(function (name) {
      const v = variants(name);
      queries.push(v.clean + ' - ' + pad(self.episode, 3));
      queries.push(v.clean + ' - ' + pad(self.episode, 2));
      queries.push(v.dots + '.' + pad(self.episode, 3));
      queries.push(v.dots + '.' + pad(self.episode, 2));
      queries.push(v.clean + ' ' + pad(self.episode, 3));
    });
  }

  const useAbsolute = isAnime && this.absEp !== null && this.absEp !== this.episode;
  if (useAbsolute) {
    baseNames.forEach(function (name) {
      const v = variants(name);
      queries.push(v.clean + ' - ' + pad(self.absEp, 2));
      queries.push(v.clean + ' - ' + pad(self.absEp, 3));
      queries.push(v.dots + '.' + pad(self.absEp, 2));
      queries.push(v.dots + '.' + pad(self.absEp, 3));
    });
  }

  if (isAnime && this.season > 1 && this.absEp === null) {
    baseNames.forEach(function (name) {
      const v = variants(name);
      queries.push(v.clean + ' - ' + pad(self.episode, 3));
      queries.push(v.clean + ' - ' + pad(self.episode, 2));
      queries.push(v.dots + '.' + pad(self.episode, 3));
      queries.push(v.dots + '.' + pad(self.episode, 2));
    });
  }

  if (isAnime && this.season === 1) {
    baseNames.forEach(function (name) {
      const v = variants(name);
      queries.push(v.clean + ' - ' + pad(self.episode, 2));
      queries.push(v.clean + ' - ' + pad(self.episode, 3));
      queries.push(v.dots + ' - ' + pad(self.episode, 2));
      queries.push(v.dots + '-' + pad(self.episode, 2));
    });
  }

  baseNames.forEach(function (name) {
    const v = variants(name);
    const codes = (isAnime && self.season === 1)
      ? searchCodes.filter(function (c) { return /^\d+$/.test(c); })
      : searchCodes.slice(0, 4);
    codes.forEach(function (code) {
      queries.push(v.dots + '.' + code);
      if (code.toUpperCase().charAt(0) !== 'S') queries.push(v.clean + ' ' + code);
    });
  });

  if (this.year && this.year > 1900) {
    baseNames.slice(0, 2).forEach(function (name) {
      const v = variants(name);
      searchCodes.slice(0, 2).forEach(function (code) {
        queries.push(v.dots + '.' + self.year + '.' + code);
      });
      if (isAnime && self.season === 1) {
        queries.push(v.clean + ' ' + self.year + ' - ' + pad(self.episode, 2));
      }
    });
  }

  const seen = {};
  return queries.filter(function (q) {
    q = q.trim();
    if (!q || seen[q]) return false;
    seen[q] = true;
    return true;
  });
};

AnimeZeyScraper.prototype._isCorrectEpisode = function (filename) {
  const fnLower = filename.toLowerCase();
  const fnAsciiLower = removeAccents(fnLower);

  if (!this._matchesSeriesInFilename(fnLower)) return false;

  const sxeyPresent = /s\d{2}e\d{2}|\d+x\d{2}/.test(fnAsciiLower);
  const sxeyPatterns = ['s' + pad(this.season, 2) + 'e' + pad(this.episode, 2), this.season + 'x' + pad(this.episode, 2)];
  for (let i = 0; i < sxeyPatterns.length; i++) {
    if (fnAsciiLower.includes(sxeyPatterns[i])) return true;
  }
  if (sxeyPresent) return false;

  const codes = getAnimeSearchCodes(this.season, this.episode);
  for (let i = 0; i < codes.length; i++) {
    const re = new RegExp('(?<!\\d)' + escapeRegExp(codes[i].toLowerCase()) + '(?!\\d)');
    if (re.test(fnAsciiLower)) return true;
  }

  if (this._isAnime() && this.season > 1 && this.absEp === null) {
    const epPatterns = [
      ' - ' + pad(this.episode, 2), ' - ' + pad(this.episode, 3),
      '- ' + pad(this.episode, 2), '- ' + pad(this.episode, 3),
      ' ' + pad(this.episode, 3) + '.', ' ' + pad(this.episode, 3) + ' ',
      '[' + pad(this.episode, 3) + ']',
    ];
    if (epPatterns.some(function (p) { return fnAsciiLower.includes(p); })) return true;
  }

  if (this._isAnime() && this.absEp !== null) {
    const absPatterns = [
      ' - ' + pad(this.absEp, 2) + '(?!\\d)', ' - ' + pad(this.absEp, 3) + '(?!\\d)',
      '- ' + pad(this.absEp, 2) + '(?!\\d)', '- ' + pad(this.absEp, 3) + '(?!\\d)',
      ' ' + pad(this.absEp, 2) + ' ', ' ' + pad(this.absEp, 3) + ' ',
      ' ' + pad(this.absEp, 2) + '\\.', ' ' + pad(this.absEp, 3) + '\\.',
      '\\[' + pad(this.absEp, 2) + '\\]', '\\[' + pad(this.absEp, 3) + '\\]',
    ];
    if (absPatterns.some(function (p) { return new RegExp(p).test(fnAsciiLower); })) return true;
  }

  if (this._isFlatSeries()) {
    const flat = [
      ' - ' + pad(this.episode, 3) + '(?!\\d)', ' - ' + pad(this.episode, 2) + '(?!\\d)',
      '- ' + pad(this.episode, 3) + '(?!\\d)', '- ' + pad(this.episode, 2) + '(?!\\d)',
      '\\[' + pad(this.episode, 3) + '\\]', '\\[' + pad(this.episode, 2) + '\\]',
      ' ' + pad(this.episode, 3) + '\\.', ' ' + pad(this.episode, 2) + '\\.',
      ' ' + pad(this.episode, 3) + ' ', ' ' + pad(this.episode, 2) + ' ',
    ];
    if (flat.some(function (p) { return new RegExp(p).test(fnAsciiLower); })) return true;
  }

  return false;
};

// -------------------- Match de título (comum a filme/série) --------------------

AnimeZeyScraper.prototype._normalizeFn = function (s) {
  let out = removeAccents((s || '').toLowerCase());
  out = out.replace(/[.\-_+,:]/g, ' ');
  out = out.replace(/[[\](){}]/g, ' ');
  return out.replace(/\s+/g, ' ').trim();
};

AnimeZeyScraper.prototype._titleMatch = function (title, filename) {
  const titleN = this._normalizeFn(title);
  const fnN = this._normalizeFn(filename);
  if (!titleN) return false;

  const hasSxey = /s\d{2}e\d{2}|\d+x\d{2}/.test(fnN);
  const pattern = new RegExp('(?<![a-z0-9])' + escapeRegExp(titleN) + '(?=[^a-z0-9]|$)', 'g');

  let m;
  while ((m = pattern.exec(fnN)) !== null) {
    const after = fnN.slice(m.index + titleN.length).trim();
    let afterOk = !after || TITLE_END_RE.test(after) || /^[\-\u2013\u2014]?\s*\d/.test(after);

    if (!afterOk && hasSxey) {
      const sxeyM = after.match(/s\d{2}e\d{2}|\d+x\d{2}/);
      if (sxeyM) {
        const between = after.slice(0, sxeyM.index);
        const betweenWords = between.split(/\s+/).filter(Boolean).filter(function (w) { return !NOISE_WORD_RE.test(w); });
        afterOk = betweenWords.length === 0;
      }
    }
    if (!afterOk) continue;

    const before = fnN.slice(0, m.index).trim();
    if (!before) return true;

    const contentWords = before.split(/\s+/).filter(Boolean).filter(function (w) {
      return !NOISE_WORD_RE.test(w) && !IGNORABLE_PREFIX_WORDS[w];
    });
    if (!contentWords.length) return true;
  }
  return false;
};

AnimeZeyScraper.prototype._matchesSeriesInFilename = function (filenameLower) {
  const baseNames = this._getBaseNames().slice(0, 8);
  const fnNorm = normalizeForCompare(removeAccents(filenameLower));
  const self = this;

  for (let i = 0; i < baseNames.length; i++) {
    const name = baseNames[i];
    const nameAscii = removeAccents(name);
    const nameNorm = normalizeForCompare(nameAscii);

    if (nameAscii.includes(':')) {
      const parts = nameAscii.split(':').map(function (p) { return p.trim(); });
      const allMatch = parts.every(function (p) {
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
  const names = [];
  const fields = this._isAnime()
    ? [this.romajiTitle, this.originalTitle, this.title]
    : [this.title, this.originalTitle, this.romajiTitle];

  fields.forEach(function (field) {
    if (!field) return;
    const clean = field.trim();
    if (names.indexOf(clean) === -1) names.push(clean);
    if (clean.includes(':')) {
      const short = clean.split(':')[0].trim();
      if (names.indexOf(short) === -1) names.push(short);
    }
  });
  if (!names.length) return [];

  const final = [];
  names.forEach(function (name) {
    final.push(name);
    if (name.includes("'")) final.push(name.replace(/'/g, ''));
    if (!name.includes(':')) {
      const lower = name.toLowerCase();
      const articles = ['the ', 'a ', 'an ', 'o ', 'os ', 'as '];
      for (let i = 0; i < articles.length; i++) {
        if (lower.startsWith(articles[i])) {
          const rest = name.slice(articles[i].length);
          if (final.indexOf(rest) === -1) final.push(rest);
          break;
        }
      }
    }
  });

  const seen = {};
  return final.filter(function (n) {
    if (!n || seen[n]) return false;
    seen[n] = true;
    return true;
  });
};

// -------------------- Filmes --------------------

AnimeZeyScraper.prototype._searchMovies = function () {
  const self = this;
  const seenIds = {};
  const movies = [];
  const queries = this._generateMovieQueries().slice(0, 8);
  log('[_searchMovies] ' + queries.length + ' queries: ' + JSON.stringify(queries));
  const searchUrl = 'https://' + this.baseDomain + '/1:search';

  function processQuery(query) {
    if (movies.length >= MAX_RESULTS_MOVIE) return Promise.resolve();
    return postToAnimezey(searchUrl, { q: query }).then(function (result) {
      const files = result && result.data && result.data.files ? result.data.files : [];
      log('[_searchMovies] query="' + query + '" -> ' + files.length + ' arquivo(s)');
      for (let i = 0; i < files.length; i++) {
        if (movies.length >= MAX_RESULTS_MOVIE) break;
        const item = files[i];
        if (seenIds[item.id]) continue;
        seenIds[item.id] = true;
        if (self._isVideoFile(item) && self._isCorrectMovie(item.name || '')) {
          movies.push(item);
        }
      }
    });
  }

  return queries.reduce(function (p, q) {
    return p.then(function () { return processQuery(q); });
  }, Promise.resolve()).then(function () {
    log('[_searchMovies] filmes casados: ' + movies.length);
    return movies.length ? self._processResults(movies) : [];
  });
};

AnimeZeyScraper.prototype._generateMovieQueries = function () {
  const queries = [];
  const baseNames = this._getBaseNames().slice(0, 5);
  const self = this;

  baseNames.forEach(function (name) {
    let clean = removeAccents(name.replace(/['".:]/g, ''));
    clean = clean.replace(/\s*-\s*/g, ' ').trim();
    const dots = clean.replace(/ /g, '.');
    if (self.year) {
      queries.push(dots + '.' + self.year);
      queries.push(clean + ' ' + self.year);
    }
    queries.push(dots);
    queries.push(clean);
  });

  if (this.originalTitle) {
    const rawOrig = this.originalTitle.replace(/['".\-]/g, '').trim();
    if (this.year) queries.push(rawOrig + ' ' + this.year);
    queries.push(rawOrig);
  }

  const seen = {};
  return queries.filter(function (q) {
    if (!q || seen[q]) return false;
    seen[q] = true;
    return true;
  });
};

AnimeZeyScraper.prototype._isCorrectMovie = function (filename) {
  const baseNames = this._getBaseNames();
  const fnLower = filename.toLowerCase();
  const fnNorm = normalizeForCompare(removeAccents(fnLower));
  const self = this;

  for (let i = 0; i < baseNames.length; i++) {
    const name = baseNames[i];
    const nameAscii = removeAccents(name);
    const nameNorm = normalizeForCompare(nameAscii);
    const matched = self._titleMatch(nameAscii, fnLower) || self._titleMatch(nameNorm, fnNorm);
    if (matched) {
      return self.year ? fnLower.includes(String(self.year)) : true;
    }
  }
  return false;
};

// -------------------- Comum: resultado, download, extração --------------------

AnimeZeyScraper.prototype._isVideoFile = function (item) {
  const name = (item.name || '').toLowerCase();
  const mime = item.mimeType || '';
  return mime.includes('video') || /\.(mp4|mkv|avi|mov|wmv|flv|webm)$/.test(name);
};

AnimeZeyScraper.prototype._processResults = function (items) {
  const self = this;
  const results = [];
  const seenLinks = {};

  function processItem(item) {
    return self._extractPlayerUrl(item).then(function (url) {
      if (!url || seenLinks[url]) return;
      seenLinks[url] = true;
      results.push(self._createResultItem(item, url));
    });
  }

  return items.reduce(function (p, item) {
    return p.then(function () { return processItem(item); });
  }, Promise.resolve()).then(function () {
    results.sort(function (a, b) { return b.quality - a.quality; });
    return results;
  });
};

AnimeZeyScraper.prototype._extractPlayerUrl = function (item) {
  const self = this;
  const linkPart = item.link || '';
  if (!linkPart) return Promise.resolve(null);

  if (linkPart.includes('/download.aspx')) {
    return Promise.resolve(this._buildDownloadLink(linkPart));
  }

  let viewUrl = 'https://' + this.baseDomain + linkPart;
  if (!viewUrl.includes('a=view')) {
    viewUrl += viewUrl.includes('?') ? '&a=view' : '?a=view';
  }

  return fetchPlain(viewUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      Referer: 'https://' + this.baseDomain + '/',
    },
  }).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
  }).then(function (html) {
    const srcMatch = html.match(/<source[^>]+src=["']([^"']+)["']/i);
    if (srcMatch) return srcMatch[1];
    return self._buildDownloadLink(linkPart);
  }).catch(function (e) {
    log('❌ Erro ao extrair URL do player:', e.message);
    return self._buildDownloadLink(item.link);
  });
};

AnimeZeyScraper.prototype._buildDownloadLink = function (linkPart) {
  if (!linkPart || linkPart.charAt(0) !== '/') return null;
  try {
    const splitIdx = linkPart.indexOf('?');
    const pathPart = splitIdx === -1 ? linkPart : linkPart.slice(0, splitIdx);
    const queryString = splitIdx === -1 ? '' : linkPart.slice(splitIdx + 1);
    const params = new URLSearchParams(queryString);
    const fileId = params.get('file');
    if (!fileId) return null;

    const outParams = new URLSearchParams({ file: fileId });
    ['expiry', 'mac'].forEach(function (key) {
      const val = params.get(key);
      if (val) outParams.set(key, val);
    });

    return 'https://' + this.downloadDomain + pathPart + '?' + outParams.toString();
  } catch (e) {
    log('⚠️ Erro construindo link fallback:', e.message);
    return null;
  }
};

AnimeZeyScraper.prototype._createResultItem = function (fileData, downloadUrl) {
  const fileName = fileData.name || '';
  const quality = guessQualityFromName(fileName);
  const fnLower = fileName.toLowerCase();

  let language;
  let languageLabel;
  if (['dual', 'multi'].some(function (x) { return fnLower.includes(x); })) {
    language = 'DUAL'; languageLabel = 'Português e Inglês';
  } else if (['dublado', 'dub ', 'pt-br'].some(function (x) { return fnLower.includes(x); })) {
    language = 'PT-BR'; languageLabel = 'Português';
  } else if (['legendado', 'leg', 'sub', 'eng'].some(function (x) { return fnLower.includes(x); })) {
    language = 'LEG'; languageLabel = 'Português (Legendado)';
  } else {
    language = 'PT-BR'; languageLabel = 'Português';
  }

  const qualityLabel = quality >= 2160 ? '4K' : quality + 'p';
  const displayTitle = this.mediaType === 'tvshow'
    ? this.title + ' S' + pad(this.season, 2) + 'E' + pad(this.episode, 2)
    : this.title;

  const bingeGroup = this.mediaType === 'tvshow'
    ? 'animezey-tv-' + this.tmdbId
    : 'animezey-movie-' + this.tmdbId;

  return {
    // Estilo FrostStream: 'name' é o rótulo curto (provedor + qualidade),
    // 'title' é o detalhe multi-linha exibido na lista (título, fonte, idioma).
    name: 'AnimeZey ' + qualityLabel,
    title: '🎬 ' + displayTitle + '\n📦 AnimeZey\n🌎 ' + languageLabel,
    url: downloadUrl,
    quality: quality,
    group: language,
    provider: 'AnimeZey',
    headers: { 'User-Agent': USER_AGENT, Referer: 'https://' + this.baseDomain + '/' },
    behaviorHints: {
      notWebReady: true,
      bingeGroup: bingeGroup,
    },
    size: formatSize(fileData.size || 0),
  };
};

// ---------------------------------------------------------------------------
// Entry point — assinatura padrão Nuvio
// ---------------------------------------------------------------------------

function getStreams(tmdbId, mediaType, season, episode, providerUrl) {
  function debugError(e) {
    const msg = (e && e.message) ? e.message : String(e);
    log('[getStreams] ❌ Erro:', msg);
    return [{
      name: 'AnimeZey [ERRO]',
      title: 'DEBUG: ' + msg,
      url: 'https://example.com/erro-debug',
      quality: 0,
      group: 'DEBUG',
      provider: 'AnimeZey',
      headers: {},
    }];
  }

  try {
    providerUrl = providerUrl || 'https://1.animezey23112022.workers.dev';
    log('[getStreams] tmdbId=' + tmdbId + ' mediaType=' + mediaType + ' season=' + season + ' episode=' + episode);

    const isMovie = mediaType === 'movie';
    const isTv = mediaType === 'tv' || mediaType === 'series' || mediaType === 'tvshow';
    if (!isMovie && !isTv) {
      log('[getStreams] mediaType não suportado: ' + mediaType);
      return Promise.resolve([]);
    }

    return fetchTmdbDetails(tmdbId, isMovie ? 'movie' : 'tv').then(function (details) {
      const title = isMovie ? details.title : details.name;
      const originalTitle = isMovie ? details.original_title : details.original_name;
      const dateStr = details.release_date || details.first_air_date || '';
      const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : null;

      log('[getStreams] TMDB OK: title="' + title + '" original="' + originalTitle + '" year=' + year);

      const itemData = {
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

      const scraper = new AnimeZeyScraper(providerUrl, itemData);
      return scraper.scrape().then(function (results) {
        log('[getStreams] scrape() retornou ' + results.length + ' resultado(s)');
        return results;
      });
    }).catch(debugError);
  } catch (e) {
    return Promise.resolve(debugError(e));
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams: getStreams };
} else {
  global.getStreams = getStreams;
}
