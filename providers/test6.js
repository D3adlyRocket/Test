// ============================================================
// Provider Nuvio : VoirDrama (voirdrama.to)
// Version      : 2.0.0
// Moteur       : Promise chains UNIQUEMENT (Hermes / React Native)
//                AUCUN async/await, AUCUN require() Node.js
// Langues      : VF priorité, fallback VOSTFR
// Sources      : VIDM (vidmoly.biz) > Vidmoly > Mail.ru > autres
//
// Structure réelle du site (vérifiée sur HTML source) :
//   - Page drama    : /drama/{slug}/
//   - Page épisode  : /drama/{slug}/{slug}-{NN}-{lang}/
//     ex : /drama/hidden-love/hidden-love-01-vostfr/
//   - Sources embed : var thisChapterSources = {"LECTEUR X VIDM":"<iframe...>", ...}
//     → "VIDM" dans le label = vidmoly.biz (priorité maximale)
//   - Recherche     : GET /?s={query}&post_type=wp-manga
//   - Liste épisodes: <option data-redirect="{url}">{numéro}</option>
// ============================================================

var VD_FALLBACK  = 'to';
var VD_BASE      = 'https://voirdrama.' + VD_FALLBACK;
var VD_REF       = VD_BASE + '/';
var UA           = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var TMDB_KEY     = '2dca580c2a14b55200e784d157207b4d';

// Cache mémoire tmdbId → slug voirdrama
var _cache      = {};
var _cachedBase = null;

// ─── Détection domaine dynamique ─────────────────────────────

var MIRRORS = [
  'voirdrama.to',
  'voirdrama.tv',
  'voirdrama.org',
  'voirdrama.my'
];

function detectVoirDramaBase() {
  if (_cachedBase) return Promise.resolve(_cachedBase);

  // Teste chaque miroir en séquence, prend le premier qui répond
  return MIRRORS.reduce(function(chain, domain) {
    return chain.then(function(found) {
      if (found) return found;
      return fetch('https://' + domain + '/', {
        method: 'HEAD',
        headers: { 'User-Agent': UA },
        redirect: 'follow'
      })
      .then(function(r) {
        return (r.ok || r.status < 400) ? 'https://' + domain : null;
      })
      .catch(function() { return null; });
    });
  }, Promise.resolve(null))
  .then(function(base) {
    var result = base || ('https://voirdrama.' + VD_FALLBACK);
    console.log('[VoirDrama] Base retenue:', result);
    _cachedBase = result;
    return result;
  });
}

// ─── Helpers réseau ──────────────────────────────────────────

function getText(url, referer) {
  return fetch(url, {
    headers: {
      'User-Agent': UA,
      'Referer': referer || VD_REF,
      'Accept-Language': 'fr-FR,fr;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + url);
    return r.text();
  });
}

function getJson(url) {
  return fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' }
  }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}

// ─── Étape 1 : tmdbId → titres candidats ─────────────────────

function getTitlesFromTmdb(tmdbId, mediaType) {
  function extractTitles(d) {
    var seen = {}, titles = [];
    function add(t) {
      t = (t || '').trim();
      if (t && !seen[t]) { seen[t] = 1; titles.push(t); }
    }
    var frFull    = (d.name || d.title || '').trim();
    var frShort   = frFull.split(/\s*[:\-|]\s*/)[0].trim();
    var orig      = (d.original_name || d.original_title || '').trim();
    var origShort = orig.split(/\s*[:\-|]\s*/)[0].trim();
    add(frShort);
    add(frFull);
    add(origShort);
    add(orig);
    var arr = ((d.alternative_titles || {}).results || (d.alternative_titles || {}).titles || []);
    arr.forEach(function(a) {
      var t = (a.title || a.name || '').trim();
      add(t.split(/\s*[:\-|]\s*/)[0].trim());
      add(t);
    });
    return titles;
  }

  function fetchType(type) {
    var url = 'https://api.themoviedb.org/3/' + type + '/' + tmdbId
      + '?api_key=' + TMDB_KEY + '&language=fr-FR&append_to_response=alternative_titles';
    console.log('[VoirDrama] TMDB:', url);
    return getJson(url);
  }

  var primaryType = (mediaType === 'movie') ? 'movie' : 'tv';
  var fallbackType = (primaryType === 'movie') ? 'tv' : 'movie';

  return fetchType(primaryType)
    .catch(function(e) {
      console.warn('[VoirDrama] TMDB fail (' + primaryType + '):', e.message, '- Essai fallback', fallbackType);
      return fetchType(fallbackType);
    })
    .then(function(d) {
      var titles = extractTitles(d);
      console.log('[VoirDrama] Titres candidats:', titles.slice(0, 6));
      return titles;
    })
    .catch(function(e) {
      console.warn('[VoirDrama] TMDB fail total:', e.message);
      return [];
    });
}

// ─── Étape 2 : Recherche slug ─────────────────────────────────
// VoirDrama = WordPress Madara
// URL de recherche : /?s={query}&post_type=wp-manga
// Les résultats contiennent des liens /drama/{slug}/

function searchVoirDrama(query) {
  if (!query || query.length < 2) return Promise.resolve([]);

  var url = VD_BASE + '/?s=' + encodeURIComponent(query) + '&post_type=wp-manga';
  console.log('[VoirDrama] Recherche:', url);

  return getText(url, VD_REF)
    .then(function(html) {
      var results = [];
      var re = /href=["']https?:\/\/[^"'\/]+\/drama\/([a-z0-9_-]+)\/?["']/gi;
      var m;
      while ((m = re.exec(html)) !== null) {
        if (results.indexOf(m[1]) === -1) results.push(m[1]);
      }
      console.log('[VoirDrama] Slugs pour "' + query + '":', results);
      return results;
    })
    .catch(function(e) {
      console.warn('[VoirDrama] Search fail "' + query + '":', e.message);
      return [];
    });
}

// ─── Étape 2b : Score similarité ─────────────────────────────

function norm(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreMatch(title, slug) {
  var a = norm(title);
  var b = norm(slug.replace(/-/g, ' '));
  if (a === b) return 1;
  if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return 0.9;
  var wa = a.split(' '), wb = b.split(' ');
  var common = wa.filter(function(w) { return w.length > 2 && wb.indexOf(w) !== -1; });
  return common.length / Math.max(wa.length, wb.length, 1);
}

// ─── Étape 2c : Résolution slug ──────────────────────────────

function resolveSlug(tmdbId, titles) {
  if (_cache[tmdbId]) {
    console.log('[VoirDrama] Cache hit:', _cache[tmdbId]);
    return Promise.resolve(_cache[tmdbId]);
  }

  var best = null, bestScore = 0;

  return titles.reduce(function(chain, title) {
    return chain.then(function() {
      if (bestScore >= 1) return;
      return searchVoirDrama(title).then(function(slugs) {
        slugs.forEach(function(slug) {
          var s = scoreMatch(title, slug);
          if (s > bestScore) { bestScore = s; best = slug; }
        });
      });
    });
  }, Promise.resolve()).then(function() {
    if (best) {
      console.log('[VoirDrama] Slug résolu:', best, '(score', bestScore.toFixed(2) + ')');
      _cache[tmdbId] = best;
    } else {
      console.warn('[VoirDrama] Slug introuvable pour tmdbId=' + tmdbId);
    }
    return best;
  });
}

// ─── Étape 3 : Récupération page épisode ─────────────────────
//
// URL épisode réelle : /drama/{slug}/{slug}-{NN}-{lang}/
// ex : /drama/hidden-love/hidden-love-01-vostfr/
//
// Stratégie :
//   1. Fetch la page drama /drama/{slug}/
//   2. Extraire toutes les options data-redirect → liste des URLs d'épisodes
//   3. Trouver l'URL correspondant au numéro demandé (VF d'abord, VOSTFR sinon)
//
// Fallback : construction directe avec padding 2 chiffres

function padEp(n) {
  // VoirDrama utilise toujours le padding 2 chiffres (01, 02 ... 09, 10, 11...)
  // Sauf pour les épisodes > 99 qui restent non-paddés (100, 101...)
  if (n < 10) return '0' + n;
  return '' + n;
}

function fetchEpisodePage(slug, season, episode) {
  // VoirDrama ne gère pas les saisons via l'URL (pas de /saison-N/).
  // La gestion multi-saison est intégrée dans le slug de l'épisode lui-même.
  // On cherche dans la liste des épisodes de la page drama.
  var dramaUrl = VD_BASE + '/drama/' + slug + '/';

  return getText(dramaUrl, VD_REF)
    .then(function(html) {
      return parseEpisodeList(html, slug, season, episode);
    })
    .then(function(episodeUrl) {
      if (!episodeUrl) throw new Error('URL épisode introuvable dans la page drama');
      console.log('[VoirDrama] URL épisode:', episodeUrl);
      return getText(episodeUrl, VD_REF).then(function(html) {
        return { html: html, url: episodeUrl };
      });
    })
    .catch(function(err) {
      // Fallback : construction directe de l'URL
      console.warn('[VoirDrama] Fallback URL directe:', err.message);
      return buildDirectEpisodeUrl(slug, season, episode);
    });
}

function parseEpisodeList(html, slug, season, episode) {
  var langOrder = ['vf', 'vostfr'];
  var results   = {}; // {lang: {epNum: url}}

  // 1. Catch <a> tags (Standard for the main Drama page)
  var reA = /href=["'](https?:\/\/[^"']+\/drama\/[^"'\/]+\/([^"'\/]+))\/?["']/gi;
  // 2. Catch <option> tags (Standard inside the reader)
  var reOpt = /data-redirect=["'](https?:\/\/[^"']+\/drama\/[^"'\/]+\/([^"'\/]+))\/?["']/gi;

  function processMatch(m) {
    var fullUrl = m[1];
    var epSlug  = m[2].toLowerCase(); // ex: hidden-love-01-vostfr

    // Ensure the URL belongs to this exact drama (ignores recommended links)
    if (fullUrl.indexOf('/drama/' + slug + '/') === -1) return;

    // Safely extract the episode number and language directly from the URL slug
    var epMatch = epSlug.match(/-(\d+)-(vf|vostfr)/);
    if (!epMatch) return;

    var epNum = parseInt(epMatch[1], 10);
    var lang  = epMatch[2];

    if (!results[lang]) results[lang] = {};
    if (!results[lang][epNum]) results[lang][epNum] = fullUrl;
  }

  var m;
  while ((m = reA.exec(html)) !== null) processMatch(m);
  while ((m = reOpt.exec(html)) !== null) processMatch(m);

  console.log('[VoirDrama] Épisodes extraits -> VF:', Object.keys(results['vf'] || {}).length, 
              '| VOSTFR:', Object.keys(results['vostfr'] || {}).length);

  // Preference: VF first, then VOSTFR
  for (var i = 0; i < langOrder.length; i++) {
    var lang2 = langOrder[i];
    if (results[lang2] && results[lang2][episode]) {
      console.log('[VoirDrama] Épisode', episode, 'trouvé en', lang2.toUpperCase());
      return Promise.resolve(results[lang2][episode]);
    }
  }

  return Promise.resolve(null);
}

function buildDirectEpisodeUrl(slug, season, episode) {
  var ep = padEp(episode);
  var langs   = ['vf', 'vostfr'];
  var found   = null;

  return langs.reduce(function(chain, lang) {
    return chain.then(function() {
      if (found) return;
      var url = VD_BASE + '/drama/' + slug + '/' + slug + '-' + ep + '-' + lang + '/';
      return fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': UA, 'Referer': VD_REF }
      })
      .then(function(r) {
        // Only accept if OK AND it didn't redirect back to the drama index
        if (r.ok && r.url.indexOf(ep + '-' + lang) !== -1) {
          console.log('[VoirDrama] URL directe OK:', r.url);
          found = r.url;
        }
      })
      .catch(function() {});
    });
  }, Promise.resolve())
  .then(function() {
    if (!found) throw new Error('Aucune URL directe valide pour S' + season + 'E' + episode);
    return getText(found, VD_REF).then(function(html) {
      return { html: html, url: found };
    });
  });
}

// ─── Étape 4 : Extraction des sources depuis la page épisode ─
//
// Le site stocke toutes les sources dans :
//   var thisChapterSources = {"☰ LECTEUR 6 VIDM":"<iframe src=\"...\">","☰ LECTEUR 3 RU":"..."};
//
// Chaque valeur est du HTML d'iframe encodé en JSON string.
// La clé contient le nom du lecteur (ex: "VIDM", "RU", "FR"...).

function parseChapterSources(html) {
  // Extrait l'objet thisChapterSources
  var re = /var\s+thisChapterSources\s*=\s*(\{[\s\S]*?\})\s*;/;
  var m  = re.exec(html);
  if (!m) {
    console.warn('[VoirDrama] thisChapterSources non trouvé');
    return [];
  }

  var rawJson = m[1];
  // Décode les séquences unicode (\uXXXX) — le site encode ☰ en \u2630
  rawJson = rawJson.replace(/\\u([0-9a-fA-F]{4})/g, function(_, hex) {
    return String.fromCharCode(parseInt(hex, 16));
  });

  var sources;
  try {
    sources = JSON.parse(rawJson);
  } catch (e) {
    console.warn('[VoirDrama] JSON.parse thisChapterSources échoué:', e.message);
    // Fallback : extraction manuelle des src d'iframe
    sources = {};
    var fallbackRe = /"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    var fm;
    while ((fm = fallbackRe.exec(rawJson)) !== null) {
      sources[fm[1]] = fm[2].replace(/\\"/g, '"').replace(/\\\//g, '/');
    }
  }

  var result = [];
  Object.keys(sources).forEach(function(label) {
    var iframeHtml = sources[label] || '';
    // Extrait le src de l'iframe
    var srcM = /src=["']([^"']+)["']/.exec(iframeHtml);
    if (srcM && srcM[1].indexOf('http') === 0) {
      result.push({ label: label, url: srcM[1] });
      console.log('[VoirDrama] Source:', label, '→', srcM[1].substring(0, 70));
    }
  });

  // Trie : VIDM en premier (le reste est secondaire)
  result.sort(function(a, b) {
    var aIsVidm = a.label.toUpperCase().indexOf('VIDM') !== -1 ? 1 : 0;
    var bIsVidm = b.label.toUpperCase().indexOf('VIDM') !== -1 ? 1 : 0;
    return bIsVidm - aIsVidm;
  });

  return result;
}

// Détecte la langue depuis l'URL de l'épisode
function detectLangFromUrl(url) {
  var u = url.toLowerCase();
  if (/-vf\//.test(u) || /-vf$/.test(u)) return 'vf';
  return 'vostfr';
}

// ─── Étape 5 : Extracteurs embed ─────────────────────────────

// Désobfuscateur p,a,c,k,e,d
function unpackEval(code) {
  try {
    if (code.indexOf('p,a,c,k,e,d') === -1) return code;
    var re = /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)[\s\S]*?\}\s*\(([\s\S]*?)\)\s*\)/g;
    var m = re.exec(code);
    if (!m) return code;
    var args = m[1].match(/^'([\s\S]*?)',\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]*?)'\.split\('\|'\)/s);
    if (!args) return code;
    var payload = args[1].replace(/\\'/g, "'");
    var base = parseInt(args[2]), count = parseInt(args[3]);
    var words = args[4].split('|');
    var toBase = function(n) {
      return (n < base ? '' : toBase(Math.floor(n / base))) + ((n = n % base) > 35 ? String.fromCharCode(n + 29) : n.toString(36));
    };
    var dict = {};
    while (count--) dict[toBase(count)] = words[count] || toBase(count);
    return payload.replace(/\b\w+\b/g, function(w) { return dict[w] || w; });
  } catch (e) { return code; }
}

// ── Extracteur générique JW Player / vidmoly (vidmoly.biz = VIDM sur VoirDrama) ──
function extractVidmoly(embedUrl) {
  // Accepte tous les domaines vidmoly (to, me, biz, net, ru, is)
  var ref = 'https://' + embedUrl.replace(/^https?:\/\//, '').split('/')[0] + '/';

  return fetch(embedUrl, {
    headers: {
      'User-Agent': UA,
      'Referer': VD_REF,   // Referer = voirdrama (anti-hotlink)
      'Origin': VD_BASE
    }
  })
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  })
  .then(function(html) {
    // Suit une éventuelle redirection JS
    var redir = /window\.location\.(?:replace|href)\s*=\s*['"]([^'"]+)['"]/.exec(html);
    if (redir && redir[1] !== embedUrl) {
      return fetch(redir[1], {
        headers: { 'User-Agent': UA, 'Referer': ref }
      }).then(function(r2) { return r2.text(); });
    }
    return html;
  })
  .then(function(html) {
    if (html.indexOf('p,a,c,k,e,d') !== -1) html = unpackEval(html);

    // m3u8 (prioritaire — HD adaptatif)
    var m3 = /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i.exec(html)
          || /["'](https?:\/\/[^"']+\.m3u8[^"'"\s]*)["']/i.exec(html)
          || /<source[^>]+src=["']([^"']+\.m3u8[^"']*)["']/i.exec(html);
    if (m3) return { url: m3[1], fmt: 'm3u8', referer: ref };

    // mp4
    var m4 = /file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i.exec(html)
          || /["'](https?:\/\/[^"']+\.mp4[^"'"\s]*)["']/i.exec(html);
    if (m4) return { url: m4[1], fmt: 'mp4', referer: ref };

    return null;
  })
  .catch(function(e) {
    console.warn('[VoirDrama][Vidmoly] Erreur:', e.message);
    return null;
  });
}

// ── Mail.ru (LECTEUR X RU) ──
function extractMailRu(embedUrl) {
  // my.mail.ru retourne directement un player HTML avec les sources
  return fetch(embedUrl, {
    headers: {
      'User-Agent': UA,
      'Referer': VD_REF
    }
  })
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  })
  .then(function(html) {
    // Mail.ru encode les sources vidéo dans un attribut data-vars JSON
    var dataM = /data-vars=["']([^"']+)["']/.exec(html);
    if (dataM) {
      try {
        var decoded = decodeURIComponent(dataM[1]);
        var data = JSON.parse(decoded);
        var videos = (data && data.videos) || [];
        if (videos.length) {
          // Prend la meilleure qualité disponible
          var best = videos[videos.length - 1];
          return { url: best.url, fmt: best.url.indexOf('.m3u8') !== -1 ? 'm3u8' : 'mp4', referer: 'https://my.mail.ru/' };
        }
      } catch (e) { /* ignore */ }
    }

    // Fallback : patterns directs m3u8/mp4
    var m3 = /["'](https?:\/\/[^"']+\.m3u8[^"'"\s]*)["']/i.exec(html);
    if (m3) return { url: m3[1], fmt: 'm3u8', referer: 'https://my.mail.ru/' };

    var m4 = /["'](https?:\/\/[^"']+\.mp4[^"'"\s]*)["']/i.exec(html);
    if (m4) return { url: m4[1], fmt: 'mp4', referer: 'https://my.mail.ru/' };

    return null;
  })
  .catch(function(e) {
    console.warn('[VoirDrama][MailRu] Erreur:', e.message);
    return null;
  });
}

// ── Sibnet ──
function extractSibnet(shellUrl) {
  return fetch(shellUrl, {
    headers: { 'User-Agent': UA, 'Referer': 'https://video.sibnet.ru/' }
  })
  .then(function(r) { return r.text(); })
  .then(function(html) {
    var m = /src\s*:\s*['"](\/v\/[^'"]+\.mp4)['"]/.exec(html)
         || /file\s*:\s*["'](\/v\/[^'"]+\.mp4)["']/.exec(html)
         || /["']((?:https?:)?\/\/[^"'\s]+\.mp4[^"'\s]*)["']/.exec(html);
    if (!m) return null;
    var path = m[1];
    if (path.startsWith('//')) return { url: 'https:' + path, fmt: 'mp4', referer: 'https://video.sibnet.ru/' };
    if (path.startsWith('/'))  return { url: 'https://video.sibnet.ru' + path, fmt: 'mp4', referer: 'https://video.sibnet.ru/' };
    return { url: path, fmt: 'mp4', referer: 'https://video.sibnet.ru/' };
  })
  .catch(function() { return null; });
}

// ── Sendvid ──
function extractSendvid(embedUrl) {
  var url = embedUrl.indexOf('/embed/') !== -1
    ? embedUrl
    : embedUrl.replace(/sendvid\.com\/([a-z0-9]+)/i, 'sendvid.com/embed/$1');

  return fetch(url, {
    headers: { 'User-Agent': UA, 'Referer': 'https://sendvid.com/' }
  })
  .then(function(r) { return r.text(); })
  .then(function(html) {
    var patterns = [
      /video_source\s*:\s*["']([^"']+\.mp4[^"']*)["']/i,
      /["'](https?:\/\/videos\d*\.sendvid\.com\/[^"'>\s]+\.mp4[^"'>\s]*)["']/i,
      /<source[^>]+src=["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i,
      /file\s*:\s*["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i,
      /["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = patterns[i].exec(html);
      if (m) return { url: m[1], fmt: 'mp4', referer: 'https://sendvid.com/' };
    }
    return null;
  })
  .catch(function() { return null; });
}

// ── Dispatch : identifie la source et appelle le bon extracteur ──

function classifySource(url) {
  var u = (url || '').toLowerCase();
  if (/vidmoly\.(biz|to|me|net|ru|is)/.test(u)) return 'vidmoly';  // VIDM sur VoirDrama
  if (/my\.mail\.ru/.test(u))                    return 'mailru';
  if (/sibnet\.ru/.test(u))                      return 'sibnet';
  if (/sendvid\.com/.test(u))                    return 'sendvid';
  return 'unknown';
}

function extractUrl(embedUrl) {
  var type = classifySource(embedUrl);
  console.log('[VoirDrama] Extracteur:', type, '—', embedUrl.substring(0, 80));

  switch (type) {
    case 'vidmoly':  return extractVidmoly(embedUrl);
    case 'mailru':   return extractMailRu(embedUrl);
    case 'sibnet':   return extractSibnet(embedUrl);
    case 'sendvid':  return extractSendvid(embedUrl);
    default:
      return Promise.resolve(null);
  }
}

// ─── Étape 6 : Priorités et construction des streams ─────────

// VIDM (= vidmoly.biz) est la source prioritaire demandée par l'utilisateur
var PRIO = {
  vidmoly:  100,   // VIDM sur VoirDrama → priorité maximale
  mailru:    60,
  sibnet:    50,
  sendvid:   55,
  unknown:   20
};

var LABELS = {
  vidmoly: 'VIDM',
  mailru:  'Mail.ru',
  sibnet:  'Sibnet',
  sendvid: 'Sendvid'
};

function buildStreams(sources, lang, season, episode) {
  var flag = (lang === 'vf') ? '[VF]' : '[VOSTFR]';

  var promises = sources.map(function(source) {
    var type = classifySource(source.url);
    // Boost supplémentaire si le label contient "VIDM" (sécurité double)
    var labelBoost = source.label.toUpperCase().indexOf('VIDM') !== -1 ? 10 : 0;

    return extractUrl(source.url).then(function(res) {
      if (!res || !res.url) return null;
      return {
        name:    'VoirDrama',
        title:   flag + ' ' + (LABELS[type] || source.label) + ' | S' + season + 'E' + episode,
        url:     res.url,
        quality: res.fmt === 'm3u8' ? 'HD' : 'Auto',
        format:  res.fmt,
        headers: {
          'User-Agent': UA,
          'Referer': res.referer || VD_REF
        },
        _prio: (PRIO[type] || 20) + labelBoost
      };
    }).catch(function() { return null; });
  });

  return Promise.all(promises).then(function(results) {
    return results
      .filter(Boolean)
      .sort(function(a, b) { return b._prio - a._prio; })
      .map(function(r) { delete r._prio; return r; });
  });
}


// ─── Mode Film : Tous les épisodes ────────────────────────────

function fetchAllEpisodesStreams(slug) {
  var dramaUrl = VD_BASE + '/drama/' + slug + '/';

  return getText(dramaUrl, VD_REF)
    .then(function(html) {
      var results = {};
      var reA = /href=["'](https?:\/\/[^"']+\/drama\/[^"'\/]+\/([^"'\/]+))\/?["']/gi;
      var reOpt = /data-redirect=["'](https?:\/\/[^"']+\/drama\/[^"'\/]+\/([^"'\/]+))\/?["']/gi;

      function processMatch(m) {
        var fullUrl = m[1];
        var epSlug  = m[2].toLowerCase();

        if (fullUrl.indexOf('/drama/' + slug + '/') === -1) return;

        var epMatch = epSlug.match(/-(\d+)-(vf|vostfr)/);
        if (!epMatch) return;

        var epNum = parseInt(epMatch[1], 10);
        var lang  = epMatch[2];

        if (!results[lang]) results[lang] = {};
        if (!results[lang][epNum]) results[lang][epNum] = fullUrl;
      }

      var m;
      while ((m = reA.exec(html)) !== null) processMatch(m);
      while ((m = reOpt.exec(html)) !== null) processMatch(m);

      var episodesToFetch = [];
      var seenEps = {};

      if (results['vf']) {
        Object.keys(results['vf']).forEach(function(ep) {
          episodesToFetch.push({ epNum: ep, url: results['vf'][ep], lang: 'vf' });
          seenEps[ep] = true;
        });
      }
      if (results['vostfr']) {
        Object.keys(results['vostfr']).forEach(function(ep) {
          if (!seenEps[ep]) {
            episodesToFetch.push({ epNum: ep, url: results['vostfr'][ep], lang: 'vostfr' });
          }
        });
      }

      if (episodesToFetch.length === 0) {
          console.warn('[VoirDrama] Mode Film: Aucun épisode trouvé, fallback S1E1');
          return fetchEpisodePage(slug, 1, 1).then(function(page) {
            var sources = parseChapterSources(page.html);
            if (!sources.length) throw new Error('Aucune source dans thisChapterSources');
            var lang = detectLangFromUrl(page.url);
            return buildStreams(sources, lang, 1, 1);
          });
      }

      episodesToFetch.sort(function(a, b) {
        return parseInt(a.epNum, 10) - parseInt(b.epNum, 10);
      });

      console.log('[VoirDrama] Mode Film: Fetch de', episodesToFetch.length, 'épisodes');

      var promises = episodesToFetch.map(function(epData) {
        return getText(epData.url, VD_REF)
          .then(function(epHtml) {
            var sources = parseChapterSources(epHtml);
            return buildStreams(sources, epData.lang, 1, epData.epNum).then(function(streams) {
              streams.forEach(function(s) {
                 s.title = s.title.replace(/S1E(\d+)/, 'EP $1');
              });
              return streams;
            });
          })
          .catch(function() { return []; });
      });

      return Promise.all(promises).then(function(resArray) {
        var allStreams = [];
        resArray.forEach(function(streams) {
          allStreams = allStreams.concat(streams);
        });
        return allStreams;
      });
    });
}

// ─── Interface publique Nuvio ─────────────────────────────────

function getStreams(tmdbId, mediaType, season, episode) {
  var s = season  || 1;
  var e = episode || 1;

  console.log('[VoirDrama] getStreams tmdbId=' + tmdbId + ' type=' + mediaType + ' S' + s + 'E' + e);

  function pipeline() {
    return getTitlesFromTmdb(tmdbId, mediaType)
      .then(function(titles) {
        if (!titles.length) throw new Error('Aucun titre TMDB');
        return resolveSlug(tmdbId, titles);
      })
      .then(function(slug) {
        if (!slug) throw new Error('Slug introuvable');

        if (mediaType === 'movie') {
          return fetchAllEpisodesStreams(slug);
        } else {
          return fetchEpisodePage(slug, s, e)
            .then(function(page) {
              var sources = parseChapterSources(page.html);
              if (!sources.length) throw new Error('Aucune source dans thisChapterSources');
              var lang = detectLangFromUrl(page.url);
              console.log('[VoirDrama] Langue:', lang.toUpperCase(), '| Sources:', sources.length);
              return buildStreams(sources, lang, s, e);
            });
        }
      });
  }

  return detectVoirDramaBase()
    .then(function(base) {
      VD_BASE = base;
      VD_REF  = base + '/';
      return pipeline();
    })
    .catch(function(err) {
      console.error('[VoirDrama] Erreur pipeline:', err && err.message || err);
      return [];
    });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
