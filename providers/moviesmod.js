'use strict';

const cheerio = require('cheerio-without-node-native');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL     = 'https://hindmovie.ltd';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const PLUGIN_TAG   = '[HindMoviez-TV]';

// Cloudflare Worker for Android TV Compatibility (Fixes Seek/Range issues)
const HM_WORKER = 'https://hindmoviez.s4nch1tt.workers.dev';

function hmProxyUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  // Android TV players often require absolute URLs and specific encoding
  return HM_WORKER + '/hm/proxy?url=' + encodeURIComponent(rawUrl);
}

// Android TV players often work best when mimicking a standard desktop browser
// to avoid "Mobile-Only" low-bitrate streams or blocks.
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Connection': 'keep-alive'
};

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fetchText(url, extraHeaders) {
  return fetch(url, {
    headers: Object.assign({}, DEFAULT_HEADERS, extraHeaders || {}),
    redirect: 'follow',
    // Added timeout for TV networks which can be unstable
    signal: AbortSignal.timeout(15000) 
  })
    .then(function (res) { return res.text(); })
    .catch(function (err) {
      console.log(PLUGIN_TAG + ' Fetch failed: ' + err.message);
      return null;
    });
}

function fetchTextWithFinalUrl(url, extraHeaders) {
  return fetch(url, {
    headers: Object.assign({}, DEFAULT_HEADERS, extraHeaders || {}),
    redirect: 'follow',
    signal: AbortSignal.timeout(15000)
  })
    .then(function (res) {
      return res.text().then(function (text) {
        return { html: text, finalUrl: res.url };
      });
    })
    .catch(function (err) {
      console.log(PLUGIN_TAG + ' Redirect failed: ' + err.message);
      return { html: null, finalUrl: url };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Parsers
// ─────────────────────────────────────────────────────────────────────────────

function getTmdbDetails(tmdbId, type) {
  var isSeries = (type === 'series' || type === 'tv');
  var endpoint = isSeries ? 'tv' : 'movie';
  var url = 'https://api.themoviedb.org/3/' + endpoint + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

  return fetch(url)
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (isSeries) {
        return {
          title : data.name,
          year  : data.first_air_date ? parseInt(data.first_air_date.split('-')[0]) : 0,
        };
      }
      return {
        title : data.title,
        year  : data.release_date ? parseInt(data.release_date.split('-')[0]) : 0,
      };
    })
    .catch(function () { return null; });
}

function parseHeadingInfo(heading) {
  var text = heading || '';
  var qualityMatch = text.match(/\b(4K|2160[pP]|1080[pP]|720[pP]|480[pP])\b/i);
  var quality = qualityMatch ? qualityMatch[1].toUpperCase().replace('P', 'p') : null;
  if (quality === '4K') quality = '2160p';

  var is10bit = /\b10\s*[Bb]it\b/.test(text);
  var sizeMatch = text.match(/\[([0-9.]+\s*(?:MB|GB|TB|KB))\]/i);
  
  var languages = [];
  ['Hindi', 'English', 'Tamil', 'Telugu'].forEach(function(l) {
    if (new RegExp(l, 'i').test(text)) languages.push(l);
  });

  return { quality: quality, is10bit: is10bit, size: sizeMatch ? sizeMatch[1] : null, languages: languages };
}

// ─────────────────────────────────────────────────────────────────────────────
// Logic & Scraping
// ─────────────────────────────────────────────────────────────────────────────

function resolveServerChain(mvlinkUrl) {
  return fetchTextWithFinalUrl(mvlinkUrl).then(function (result) {
    if (!result.html) return {};
    
    // Look for hshare.ink
    var hshareMatch = result.html.match(/https?:\/\/hshare\.ink\/[^\s"']+/);
    var hshareUrl = hshareMatch ? hshareMatch[0] : null;
    if (!hshareUrl && result.finalUrl.includes('hshare.ink')) hshareUrl = result.finalUrl;

    if (!hshareUrl) return {};

    return fetchText(hshareUrl).then(function (hshareHtml) {
      if (!hshareHtml) return {};
      var hcloudMatch = hshareHtml.match(/https?:\/\/hcloud\.[^\s"']+/);
      if (!hcloudMatch) return {};

      return fetchText(hcloudMatch[0]).then(function (hcloudHtml) {
        if (!hcloudHtml) return {};
        var $ = cheerio.load(hcloudHtml);
        var servers = {};
        $('a[id^="download-btn"]').each(function(i, el) {
          servers['Server ' + (i+1)] = $(el).attr('href');
        });
        return servers;
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getStreams Implementation
// ─────────────────────────────────────────────────────────────────────────────

function getStreams(tmdbId, type, season, episode) {
  return getTmdbDetails(tmdbId, type).then(function (details) {
    if (!details) return [];

    var searchUrl = BASE_URL + '/?s=' + encodeURIComponent(details.title);
    return fetchText(searchUrl).then(function (html) {
      if (!html) return [];
      
      var $ = cheerio.load(html);
      var firstResult = $('article h2.entry-title a').first().attr('href');
      if (!firstResult) return [];

      return fetchText(firstResult).then(function (pageHtml) {
        if (!pageHtml) return [];
        var $ = cheerio.load(pageHtml);
        var linksToProcess = [];

        $('.entry-content h3').each(function () {
          var h3Text = $(this).text();
          var mvlink = $(this).nextUntil('h3').find('a[href*="mvlink.site"]').first().attr('href');
          
          if (mvlink) {
            linksToProcess.push({ url: mvlink, info: parseHeadingInfo(h3Text) });
          }
        });

        return Promise.all(linksToProcess.map(function (item) {
          return fetchText(item.url).then(function (mvHtml) {
            if (!mvHtml) return [];
            var $mv = cheerio.load(mvHtml);
            var results = [];
            
            $mv('a').each(function () {
              var btnText = $(this).text();
              var btnHref = $(this).attr('href');
              
              if (type === 'movie' && /Get Links/i.test(btnText)) {
                results.push({ link: btnHref, info: item.info });
              } else if (type === 'series' || type === 'tv') {
                var epPattern = new RegExp('Episode\\s*0?' + episode + '\\b', 'i');
                if (epPattern.test(btnText)) {
                  results.push({ link: btnHref, info: item.info });
                }
              }
            });
            return results;
          });
        })).then(function (nested) {
          var flat = [].concat.apply([], nested);
          
          return Promise.all(flat.map(function (target) {
            return resolveServerChain(target.link).then(function (servers) {
              return { servers: servers, info: target.info };
            });
          })).then(function (finalResults) {
            var streams = [];
            finalResults.forEach(function (res) {
              Object.keys(res.servers).forEach(function (srv) {
                var streamUrl = res.servers[srv];
                var info = res.info;
                
                streams.push({
                  name: '🎬 HindMoviez | ' + srv,
                  title: (info.quality ? '📺 ' + info.quality : '') + 
                         (info.size ? ' 💾 ' + info.size : '') + 
                         '\n🔊 ' + info.languages.join(' + ') + 
                         '\n[TV Optimized Path]',
                  url: hmProxyUrl(streamUrl),
                  quality: info.quality || undefined,
                  // Behavior hints are CRITICAL for Android TV
                  behaviorHints: {
                    notWebReady: false, 
                    proxyHeaders: {
                      "User-Agent": DEFAULT_HEADERS["User-Agent"],
                      "Referer": "https://hcloud.to/"
                    },
                    // Helps with Android TV autoplay next episode
                    bingeGroup: "hindmoviez-" + tmdbId
                  }
                });
              });
            });
            return streams;
          });
        });
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
