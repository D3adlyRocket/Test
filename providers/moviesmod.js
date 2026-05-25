// Dutamovie21 Scraper for Nuvio Local Scrapers
// React Native compatible version - Promise-based approach only
// Scrapes https://simplycufflinks.com (Dutamovie21 / LK21 mirror)

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const BASE_URL = 'https://simplycufflinks.com';

const WORKING_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://simplycufflinks.com/',
  'Connection': 'keep-alive',
  'DNT': '1',
};

const PLAYBACK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'identity',
  'Referer': 'https://simplycufflinks.com/',
  'Connection': 'keep-alive',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(url, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || 'GET',
    headers: Object.assign({}, WORKING_HEADERS, options.headers || {}),
  }).then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText);
    return response;
  }).catch(function (error) {
    console.error('[Dutamovie21] Request failed for ' + url + ' — ' + error.message);
    throw error;
  });
}

function getTMDBDetails(tmdbId, mediaType) {
  var endpoint = mediaType === 'tv' ? 'tv' : 'movie';
  var url = TMDB_BASE_URL + '/' + endpoint + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;
  return makeRequest(url)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var title = mediaType === 'tv' ? data.name : data.title;
      var releaseDate = mediaType === 'tv' ? data.first_air_date : data.release_date;
      var year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null;
      return { title: title, year: year };
    });
}

// Build slug variants to try (site uses hyphenated slugs with year suffix)
function buildSlugs(title, year) {
  var base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  var slugs = [];
  if (year) slugs.push(base + '-' + year);
  slugs.push(base);
  return slugs;
}

// Extract quality from URL
function extractQuality(url) {
  if (!url) return 'Unknown';
  var m;
  m = url.match(/(\d{3,4})[pP]/);
  if (m) {
    var res = parseInt(m[1]);
    if (res >= 2160) return '4K';
    if (res >= 1440) return '1440p';
    if (res >= 1080) return '1080p';
    if (res >= 720) return '720p';
    if (res >= 480) return '480p';
    if (res >= 360) return '360p';
    return '240p';
  }
  if (/4k|2160/i.test(url)) return '4K';
  if (/1080|fhd/i.test(url)) return '1080p';
  if (/720|hd/i.test(url)) return '720p';
  if (/480|sd/i.test(url)) return '480p';
  return 'Unknown';
}

// ─── Page Fetch & Parse ─────────────────────────────────────────────────────

function fetchMoviePage(slug) {
  var url = BASE_URL + '/' + slug + '/';
  console.log('[Dutamovie21] Trying page: ' + url);
  return makeRequest(url)
    .then(function (r) { return r.text(); })
    .then(function (html) {
      return { html: html, pageUrl: url };
    })
    .catch(function () { return null; });
}

function fetchTVPage(slug, season, episode) {
  // DM21 TV pattern: /tv-show-slug/season-X/episode-Y/
  var url = BASE_URL + '/tv/' + slug + '/season-' + season + '/episode-' + episode + '/';
  console.log('[Dutamovie21] Trying TV page: ' + url);
  return makeRequest(url)
    .then(function (r) { return r.text(); })
    .then(function (html) { return { html: html, pageUrl: url }; })
    .catch(function () {
      // Fallback: /slug-sXXeYY/
      var epSlug = slug + '-s' + String(season).padStart(2, '0') + 'e' + String(episode).padStart(2, '0');
      var url2 = BASE_URL + '/' + epSlug + '/';
      console.log('[Dutamovie21] Fallback TV page: ' + url2);
      return makeRequest(url2)
        .then(function (r) { return r.text(); })
        .then(function (html) { return { html: html, pageUrl: url2 }; })
        .catch(function () { return null; });
    });
}

// Extract all iframe/embed src values from page HTML
function extractIframeSrcs(html) {
  var srcs = [];
  var iframeRegex = /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi;
  var match;
  while ((match = iframeRegex.exec(html)) !== null) {
    var src = match[1].trim();
    if (
      src &&
      !src.includes('googletagmanager') &&
      !src.includes('google-analytics') &&
      !src.includes('facebook') &&
      !src.includes('disqus') &&
      !src.includes('yandex') &&
      src.length > 10
    ) {
      srcs.push(src);
    }
  }
  // Also check data-src attributes (lazy-loaded iframes)
  var dataSrcRegex = /<iframe[^>]+data-src=["']([^"']+)["'][^>]*>/gi;
  while ((match = dataSrcRegex.exec(html)) !== null) {
    var src = match[1].trim();
    if (src && !srcs.includes(src)) srcs.push(src);
  }
  return srcs;
}

// Extract direct video sources from page HTML (some DM21 pages embed sources directly)
function extractDirectSources(html) {
  var sources = [];
  // Match <source src="..." type="video/...">
  var srcRegex = /<source[^>]+src=["']([^"']+)["'][^>]*>/gi;
  var match;
  while ((match = srcRegex.exec(html)) !== null) {
    var url = match[1].trim();
    if (url && (url.endsWith('.mp4') || url.endsWith('.m3u8') || url.includes('.mp4') || url.includes('.m3u8'))) {
      sources.push(url);
    }
  }
  // Match jwplayer / player config file: "file":"..."
  var fileRegex = /"file"\s*:\s*["']([^"']+(?:\.mp4|\.m3u8)[^"']*)["']/gi;
  while ((match = fileRegex.exec(html)) !== null) {
    var url = match[1].trim();
    if (url && !sources.includes(url)) sources.push(url);
  }
  // Match sources array: sources:[{file:"..."}]
  var sourcesArrRegex = /sources\s*:\s*\[([^\]]+)\]/gi;
  while ((match = sourcesArrRegex.exec(html)) !== null) {
    var block = match[1];
    var fileMatches = block.match(/["']?(https?:\/\/[^"',\s]+)["']?/g);
    if (fileMatches) {
      fileMatches.forEach(function (f) {
        var clean = f.replace(/['"]/g, '').trim();
        if (clean && !sources.includes(clean)) sources.push(clean);
      });
    }
  }
  return sources;
}

// Resolve an embed/iframe URL to get the final stream URL
function resolveEmbed(embedUrl, pageUrl) {
  console.log('[Dutamovie21] Resolving embed: ' + embedUrl.substring(0, 80));
  return fetch(embedUrl, {
    method: 'GET',
    headers: Object.assign({}, WORKING_HEADERS, {
      'Referer': pageUrl,
      'Origin': BASE_URL,
    }),
  })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(function (embedHtml) {
      var directSrcs = extractDirectSources(embedHtml);
      var nestedIframes = extractIframeSrcs(embedHtml);
      return { directSrcs: directSrcs, nestedIframes: nestedIframes };
    })
    .catch(function (e) {
      console.warn('[Dutamovie21] Embed resolve failed: ' + e.message);
      return { directSrcs: [], nestedIframes: [] };
    });
}

// ─── Stream Builder ──────────────────────────────────────────────────────────

function buildStream(url, mediaTitle, embedSource) {
  var quality = extractQuality(url);
  var isHLS = url.includes('.m3u8');
  return {
    name: 'Dutamovie21' + (embedSource ? ' — ' + embedSource : ''),
    title: mediaTitle,
    url: url,
    quality: quality,
    size: 'Unknown',
    headers: PLAYBACK_HEADERS,
    provider: 'dutamovie21',
    behaviorHints: isHLS ? { notWebReady: false } : undefined,
  };
}

// ─── Search Fallback ─────────────────────────────────────────────────────────

function searchSite(title, year) {
  var query = encodeURIComponent(title);
  var url = BASE_URL + '/?s=' + query + '&post_type[]=post&post_type[]=tv';
  console.log('[Dutamovie21] Searching: ' + url);
  return makeRequest(url)
    .then(function (r) { return r.text(); })
    .then(function (html) {
      // Extract all article/post links from search results
      var links = [];
      var linkRegex = /href=["'](https:\/\/simplycufflinks\.com\/[a-z0-9-]+\/?)["']/gi;
      var match;
      var seen = {};
      while ((match = linkRegex.exec(html)) !== null) {
        var href = match[1];
        if (
          !seen[href] &&
          !href.includes('/category/') &&
          !href.includes('/tag/') &&
          !href.includes('/page/') &&
          !href.includes('/movie/') &&
          !href.includes('/tv/') &&
          !href.includes('/wp-content/') &&
          href !== BASE_URL + '/'
        ) {
          seen[href] = true;
          links.push(href);
        }
      }
      // Filter by year in URL if possible
      if (year) {
        var yearLinks = links.filter(function (l) { return l.includes(String(year)); });
        if (yearLinks.length > 0) return yearLinks.slice(0, 3);
      }
      return links.slice(0, 3);
    })
    .catch(function () { return []; });
}

// ─── Main Orchestrator ───────────────────────────────────────────────────────

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  mediaType = mediaType || 'movie';
  console.log('[Dutamovie21] getStreams — TMDB:' + tmdbId + ' type:' + mediaType +
    (mediaType === 'tv' ? ' S' + seasonNum + 'E' + episodeNum : ''));

  return getTMDBDetails(tmdbId, mediaType)
    .then(function (mediaInfo) {
      console.log('[Dutamovie21] Title: ' + mediaInfo.title + ' (' + mediaInfo.year + ')');
      var slugs = buildSlugs(mediaInfo.title, mediaInfo.year);
      var mediaTitle = mediaInfo.title;
      if (mediaInfo.year) mediaTitle += ' (' + mediaInfo.year + ')';
      if (mediaType === 'tv' && seasonNum && episodeNum) {
        mediaTitle += ' S' + String(seasonNum).padStart(2, '0') + 'E' + String(episodeNum).padStart(2, '0');
      }

      // Try each slug to find the page
      var pageFetcher;
      if (mediaType === 'tv') {
        pageFetcher = slugs.reduce(function (chain, slug) {
          return chain.then(function (result) {
            if (result) return result;
            return fetchTVPage(slug, seasonNum, episodeNum);
          });
        }, Promise.resolve(null));
      } else {
        pageFetcher = slugs.reduce(function (chain, slug) {
          return chain.then(function (result) {
            if (result) return result;
            return fetchMoviePage(slug);
          });
        }, Promise.resolve(null));
      }

      return pageFetcher.then(function (pageResult) {
        // Fallback: use search
        var searchPromise;
        if (!pageResult) {
          console.log('[Dutamovie21] Slug attempts failed, falling back to search...');
          searchPromise = searchSite(mediaInfo.title, mediaInfo.year)
            .then(function (searchLinks) {
              if (searchLinks.length === 0) return null;
              return fetch(searchLinks[0], { headers: WORKING_HEADERS })
                .then(function (r) { return r.ok ? r.text() : null; })
                .then(function (html) {
                  return html ? { html: html, pageUrl: searchLinks[0] } : null;
                })
                .catch(function () { return null; });
            });
        } else {
          searchPromise = Promise.resolve(pageResult);
        }

        return searchPromise.then(function (finalPage) {
          if (!finalPage || !finalPage.html) {
            console.log('[Dutamovie21] No page found for ' + mediaInfo.title);
            return [];
          }

          var html = finalPage.html;
          var pageUrl = finalPage.pageUrl;

          // 1. Extract direct video sources from the page
          var directSources = extractDirectSources(html);

          // 2. Extract iframe embeds
          var iframeSrcs = extractIframeSrcs(html);
          console.log('[Dutamovie21] Found ' + directSources.length + ' direct sources, ' + iframeSrcs.length + ' iframes');

          // Build streams from direct sources immediately
          var directStreams = directSources.map(function (src) {
            return buildStream(src, mediaTitle, 'Direct');
          });

          // Resolve each iframe for additional streams
          var embedPromises = iframeSrcs.slice(0, 5).map(function (embedUrl) {
            // Ensure absolute URL
            if (embedUrl.startsWith('//')) embedUrl = 'https:' + embedUrl;
            return resolveEmbed(embedUrl, pageUrl).then(function (resolved) {
              var streams = [];
              resolved.directSrcs.forEach(function (src) {
                streams.push(buildStream(src, mediaTitle, getDomain(embedUrl)));
              });
              // One level of nested iframes
              var nestedPromises = resolved.nestedIframes.slice(0, 2).map(function (nested) {
                if (nested.startsWith('//')) nested = 'https:' + nested;
                return resolveEmbed(nested, embedUrl).then(function (r2) {
                  return r2.directSrcs.map(function (s) {
                    return buildStream(s, mediaTitle, getDomain(nested));
                  });
                }).catch(function () { return []; });
              });
              return Promise.all(nestedPromises).then(function (nestedResults) {
                nestedResults.forEach(function (ns) { streams = streams.concat(ns); });
                return streams;
              });
            }).catch(function () { return []; });
          });

          return Promise.all(embedPromises).then(function (embedResults) {
            var allStreams = directStreams.slice();
            embedResults.forEach(function (es) { allStreams = allStreams.concat(es); });

            // Deduplicate by URL
            var seen = {};
            allStreams = allStreams.filter(function (s) {
              if (!s || !s.url || seen[s.url]) return false;
              seen[s.url] = true;
              return true;
            });

            // Sort by quality
            var order = { '4K': 6, '1440p': 5, '1080p': 4, '720p': 3, '480p': 2, '360p': 1, '240p': 0, 'Unknown': -1 };
            allStreams.sort(function (a, b) {
              return (order[b.quality] || -1) - (order[a.quality] || -1);
            });

            console.log('[Dutamovie21] Total streams: ' + allStreams.length);
            return allStreams;
          });
        });
      });
    })
    .catch(function (err) {
      console.error('[Dutamovie21] Fatal error: ' + err.message);
      return [];
    });
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch (e) {
    return 'embed';
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined') {
  module.exports = getStreams;
} else {
  global.Dutamovie21ScraperModule = getStreams;
}
