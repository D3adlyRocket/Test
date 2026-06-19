const cheerio = require('cheerio-without-node-native');

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
const BASE_URL = 'https://animedekho.app';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

// atob Polyfill (RN JS engines don't always have it)
const atob = (input) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = String(input).replace(/=+$/, '');
  if (str.length % 4 === 1) throw new Error("'atob' failed: bad encoding");
  let output = '';
  for (
    let bc = 0, bs, buffer, i = 0;
    (buffer = str.charAt(i++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
};

// Levenshtein distance for fuzzy title matching
const levenshtein = {
  get: function (s, t) {
    if (s === t) return 0;
    var n = s.length, m = t.length;
    if (n === 0) return m;
    if (m === 0) return n;
    var d = [];
    for (var i = 0; i <= n; i++) { d[i] = []; d[i][0] = i; }
    for (var j = 0; j <= m; j++) d[0][j] = j;
    for (var i = 1; i <= n; i++) {
      for (var j = 1; j <= m; j++) {
        var cost = (s.charAt(i - 1) === t.charAt(j - 1)) ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      }
    }
    return d[n][m];
  }
};

function fetchText(url, options) {
  options = options || {};
  return fetch(url, {
    headers: Object.assign({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': BASE_URL + '/'
    }, options.headers || {})
  })
    .then(function (res) { return res.text(); })
    .catch(function (err) {
      console.log('[AnimeDekho] Request failed for ' + url + ': ' + err.message);
      return null;
    });
}

// -----------------------------------------------------------------------------
// TMDB lookup
// -----------------------------------------------------------------------------
function getTmdbDetails(tmdbId, type) {
  var isSeries = type === 'series' || type === 'tv';
  var url = 'https://api.themoviedb.org/3/' + (isSeries ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;
  return fetch(url)
    .then(function (res) { return res.json(); })
    .then(function (data) {
      return isSeries
        ? { title: data.name, year: data.first_air_date ? parseInt(data.first_air_date.split('-')[0]) : 0 }
        : { title: data.title, year: data.release_date ? parseInt(data.release_date.split('-')[0]) : 0 };
    })
    .catch(function (err) {
      console.log('[AnimeDekho] TMDB request failed: ' + err.message);
      return null;
    });
}

// -----------------------------------------------------------------------------
// Search -> series/movie page
// -----------------------------------------------------------------------------
function searchTitle(name) {
  var searchUrl = BASE_URL + '/?s=' + encodeURIComponent(name);
  return fetchText(searchUrl).then(function (html) {
    if (!html) return [];
    var $ = cheerio.load(html);
    var results = [];

    // Result cards on AnimeDekho's search/listing pages.
    // The theme renders post cards with an <a> wrapping the poster + title.
    $('article, .movies-list .ml-item, .result-item, .post').each(function (_i, el) {
      var link = $(el).find('a').first().attr('href');
      var title = $(el).find('h2, h3, .ml-item-title, .title').first().text().trim();
      if (link && title) {
        results.push({ url: link, title: title });
      }
    });

    return results;
  });
}

function findSeriesPage(name, year) {
  return searchTitle(name).then(function (results) {
    if (!results.length) return null;

    var best = null;
    var bestDist = Infinity;
    results.forEach(function (r) {
      var cleanTitle = r.title.replace(/\(.*?\)/g, '').replace(/Hindi Dubbed/i, '').trim();
      var dist = levenshtein.get(cleanTitle.toLowerCase(), name.toLowerCase());
      if (dist < bestDist) {
        bestDist = dist;
        best = r;
      }
    });

    if (best && bestDist < 6) {
      return best.url.indexOf('http') === 0 ? best.url : BASE_URL + best.url;
    }
    return null;
  });
}

// -----------------------------------------------------------------------------
// Resolve episode page URL from a series page
// AnimeDekho episode URLs look like: BASE_URL/epi/{slug}-{season}x{episode}/
// -----------------------------------------------------------------------------
function findEpisodeUrl(seriesPageUrl, season, episode) {
  return fetchText(seriesPageUrl).then(function (html) {
    if (!html) return null;
    var $ = cheerio.load(html);
    var target = null;

    $('a').each(function (_i, el) {
      var href = $(el).attr('href') || '';
      var match = href.match(/\/epi\/(.+?)-(\d+)x(\d+)\/?$/);
      if (match) {
        var s = parseInt(match[2]);
        var e = parseInt(match[3]);
        if (s === parseInt(season) && e === parseInt(episode)) {
          target = href;
        }
      }
    });

    return target;
  });
}

function findMoviePageUrl(seriesPageUrl) {
  // Movies on AnimeDekho live directly under /movies-hindi/{slug}/ and usually
  // expose their download/stream block on the same page (no /epi/ split page).
  return Promise.resolve(seriesPageUrl);
}

// -----------------------------------------------------------------------------
// Extract playable/downloadable links from an episode or movie page
//
// NOTE: AnimeDekho gates real links behind a client-side "Skip Ad" step
// (GPLinks / Cuty.io shorteners). The selectors below target the most common
// patterns used by this WordPress theme family (iframe embeds + direct
// download buttons revealed in the page's <script> blocks). If the site
// changes its ad-gate implementation, only this function should need updates.
// -----------------------------------------------------------------------------
function extractStreamsFromPage(pageUrl) {
  return fetchText(pageUrl).then(function (html) {
    if (!html) return [];
    var $ = cheerio.load(html);
    var streams = [];

    // 1) Direct iframe embeds present in the page markup
    $('iframe').each(function (_i, el) {
      var src = $(el).attr('src') || $(el).attr('data-src');
      if (src && src.indexOf('youtube') === -1 && src.indexOf('vimeo') === -1) {
        streams.push({
          name: 'AnimeDekho - Embed',
          title: 'Embedded Player',
          url: src.indexOf('http') === 0 ? src : 'https:' + src,
          behaviorHints: { bingeGroup: 'animedekho-embed' }
        });
      }
    });

    // 2) Download buttons (server/quality links), commonly anchors with
    //    classes like .dl-item, .btn-download, or text containing quality tags
    $('a').each(function (_i, el) {
      var href = $(el).attr('href');
      var text = $(el).text().trim();
      if (!href) return;
      var qualityMatch = text.match(/(\d{3,4}p)/i);
      var looksLikeHost = /hubcloud|hubdrive|gdflix|gdtot|filepress|drive|fsl|pixeldrain/i.test(href);
      if (looksLikeHost) {
        streams.push({
          name: 'AnimeDekho - Download' + (qualityMatch ? ' ' + qualityMatch[1] : ''),
          title: text || 'Download Link',
          url: href,
          quality: qualityMatch ? qualityMatch[1] : undefined,
          behaviorHints: { bingeGroup: 'animedekho-download' }
        });
      }
    });

    // 3) Fallback: scan inline <script> blocks for a base64/obfuscated blob
    //    similar to the 4khdhub redirect pattern, in case the real link is
    //    injected via JS rather than present as a plain <a href>.
    var scriptBlobMatch = html.match(/atob\(['"]([A-Za-z0-9+/=]{20,})['"]\)/);
    if (scriptBlobMatch) {
      try {
        var decoded = atob(scriptBlobMatch[1]);
        if (decoded.indexOf('http') === 0) {
          streams.push({
            name: 'AnimeDekho - Decoded',
            title: 'Decoded Link',
            url: decoded,
            behaviorHints: { bingeGroup: 'animedekho-decoded' }
          });
        }
      } catch (e) {
        console.log('[AnimeDekho] Decode attempt failed: ' + e.message);
      }
    }

    return streams;
  });
}

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------
function getStreams(tmdbId, type, season, episode) {
  return getTmdbDetails(tmdbId, type).then(function (tmdbDetails) {
    if (!tmdbDetails) return [];

    var title = tmdbDetails.title;
    var year = tmdbDetails.year;
    var isSeries = type === 'series' || type === 'tv';

    console.log('[AnimeDekho] Search: ' + title + ' (' + year + ')');

    return findSeriesPage(title, year).then(function (pageUrl) {
      if (!pageUrl) {
        console.log('[AnimeDekho] Title page not found');
        return [];
      }
      console.log('[AnimeDekho] Found page: ' + pageUrl);

      var resolveTarget = isSeries && season && episode
        ? findEpisodeUrl(pageUrl, season, episode)
        : findMoviePageUrl(pageUrl);

      return resolveTarget.then(function (targetUrl) {
        if (!targetUrl) {
          console.log('[AnimeDekho] Episode/movie page not found');
          return [];
        }
        var fullTargetUrl = targetUrl.indexOf('http') === 0 ? targetUrl : BASE_URL + targetUrl;
        console.log('[AnimeDekho] Extracting from: ' + fullTargetUrl);
        return extractStreamsFromPage(fullTargetUrl);
      });
    });
  }).catch(function (err) {
    console.log('[AnimeDekho] getStreams error: ' + err.message);
    return [];
  });
}

// Export for React Native / Nuvio compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
