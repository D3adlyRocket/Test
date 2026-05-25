// PencuriMovie SubMalay scraper for Nuvio
// Domain: https://ww105.pencurimoviesubmalay.guru/
// Promise-based, React Native compatible

const BASE_URL = 'https://ww105.pencurimoviesubmalay.guru';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,ms;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': BASE_URL + '/',
  'Origin': BASE_URL
};

const PLAYBACK_HEADERS = {
  'User-Agent': HEADERS['User-Agent'],
  'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'identity',
  'Referer': BASE_URL + '/',
  'Origin': BASE_URL
};

function makeRequest(url, options) {
  options = options || {};
  return fetch(url, {
    method: options.method || 'GET',
    headers: Object.assign({}, HEADERS, options.headers || {})
  }).then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText);
    return response;
  });
}

function getTMDBDetails(tmdbId, mediaType) {
  const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
  const url = TMDB_BASE_URL + '/' + endpoint + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;
  return makeRequest(url)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      const title = mediaType === 'tv' ? data.name : data.title;
      const date = mediaType === 'tv' ? data.first_air_date : data.release_date;
      const year = date ? parseInt(date.split('-')[0], 10) : null;
      return { title: title, year: year };
    });
}

function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/['".:,&!?()[\]’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildCandidateSlugs(title, year, mediaType, season, episode) {
  const base = slugify(title);
  const out = [];
  if (mediaType === 'tv' && season && episode) {
    out.push(base + '-season-' + season + '-episode-' + episode);
    out.push(base + '-s' + String(season).padStart(2, '0') + 'e' + String(episode).padStart(2, '0'));
    out.push(base + '-' + year + '-season-' + season + '-episode-' + episode);
  }
  if (year) out.push(base + '-' + year);
  out.push(base);
  return out.filter(Boolean);
}

function extractUrls(html, regex) {
  const out = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    const val = (m[1] || '').trim();
    if (val && out.indexOf(val) === -1) out.push(val);
  }
  return out;
}

function extractIframeUrls(html) {
  return extractUrls(html, /<iframe[^>]+src=["']([^"'#]+)["']/gi)
    .concat(extractUrls(html, /data-src=["']([^"'#]+)["']/gi))
    .filter(function (u, i, arr) {
      return arr.indexOf(u) === i;
    });
}

function extractMediaUrls(html) {
  const found = [];
  [
    /<source[^>]+src=["']([^"']+)["']/gi,
    /["']file["']\s*:\s*["']([^"']+)["']/gi,
    /["']src["']\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
    /(https?:\/\/[^"'\\\s<>]+(?:\.m3u8|\.mp4)[^"'\\\s<>]*)/gi
  ].forEach(function (rx) {
    let m;
    while ((m = rx.exec(html)) !== null) {
      const u = (m[1] || '').trim();
      if (u && found.indexOf(u) === -1) found.push(u);
    }
  });
  return found;
}

function normalizeUrl(url) {
  if (!url) return '';
  if (url.indexOf('//') === 0) return 'https:' + url;
  return url;
}

function getQualityFromUrl(url) {
  if (!url) return 'Unknown';
  const m = url.match(/(\d{3,4})p/i);
  if (m) {
    const q = parseInt(m[1], 10);
    if (q >= 2160) return '4K';
    if (q >= 1440) return '1440p';
    if (q >= 1080) return '1080p';
    if (q >= 720) return '720p';
    if (q >= 480) return '480p';
    if (q >= 360) return '360p';
    return '240p';
  }
  if (/4k|2160/i.test(url)) return '4K';
  if (/1080|fhd/i.test(url)) return '1080p';
  if (/720|hd/i.test(url)) return '720p';
  if (/480|sd/i.test(url)) return '480p';
  return 'Unknown';
}

function searchSite(title) {
  const url = BASE_URL + '/?s=' + encodeURIComponent(title);
  return makeRequest(url)
    .then(function (r) { return r.text(); })
    .then(function (html) {
      const links = extractUrls(html, /href=["'](https:\/\/ww105\.pencurimoviesubmalay\.guru\/[^"'?#]+\/)["']/gi)
        .filter(function (u) {
          return (
            u.indexOf('/group_movie/') === -1 &&
            u.indexOf('/search/') === -1 &&
            u.indexOf('/comments/') === -1 &&
            u.indexOf('/wp-content/') === -1 &&
            u !== BASE_URL + '/'
          );
        });
      return links;
    })
    .catch(function () { return []; });
}

function tryCandidatePages(candidates) {
  let p = Promise.resolve(null);
  candidates.forEach(function (url) {
    p = p.then(function (result) {
      if (result) return result;
      return makeRequest(url)
        .then(function (r) { return r.text(); })
        .then(function (html) {
          if (/404|page not found|not found/i.test(html)) return null;
          return { url: url, html: html };
        })
        .catch(function () { return null; });
    });
  });
  return p;
}

function resolveIframe(url, referer) {
  url = normalizeUrl(url);
  return fetch(url, {
    method: 'GET',
    headers: Object.assign({}, HEADERS, {
      Referer: referer || (BASE_URL + '/')
    })
  })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(function (html) {
      return {
        media: extractMediaUrls(html),
        nested: extractIframeUrls(html)
      };
    })
    .catch(function () {
      return { media: [], nested: [] };
    });
}

function buildStream(url, title, label) {
  return {
    name: 'PencuriMovie' + (label ? ' - ' + label : ''),
    title: title,
    url: url,
    quality: getQualityFromUrl(url),
    size: 'Unknown',
    headers: PLAYBACK_HEADERS,
    provider: 'pencurimoviesubmalay'
  };
}

function flatten(arr) {
  return [].concat.apply([], arr);
}

function dedupeStreams(streams) {
  const seen = {};
  return streams.filter(function (s) {
    if (!s || !s.url || seen[s.url]) return false;
    seen[s.url] = true;
    return true;
  });
}

function sortStreams(streams) {
  const order = { '4K': 6, '1440p': 5, '1080p': 4, '720p': 3, '480p': 2, '360p': 1, '240p': 0, 'Unknown': -1 };
  return streams.sort(function (a, b) {
    return (order[b.quality] || -1) - (order[a.quality] || -1);
  });
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return getTMDBDetails(tmdbId, mediaType)
    .then(function (info) {
      const candidates = buildCandidateSlugs(info.title, info.year, mediaType, seasonNum, episodeNum)
        .map(function (slug) { return BASE_URL + '/' + slug + '/'; });

      return tryCandidatePages(candidates)
        .then(function (page) {
          if (page) return page;
          return searchSite(info.title).then(function (links) {
            return tryCandidatePages(links.slice(0, 5));
          });
        })
        .then(function (page) {
          if (!page || !page.html) return [];

          let streams = [];
          const mediaTitle =
            mediaType === 'tv' && seasonNum && episodeNum
              ? info.title + ' S' + String(seasonNum).padStart(2, '0') + 'E' + String(episodeNum).padStart(2, '0')
              : (info.year ? info.title + ' (' + info.year + ')' : info.title);

          const directMedia = extractMediaUrls(page.html).map(function (u) {
            return buildStream(normalizeUrl(u), mediaTitle, 'Direct');
          });

          streams = streams.concat(directMedia);

          const iframes = extractIframeUrls(page.html).slice(0, 6);

          return Promise.all(
            iframes.map(function (iframeUrl) {
              return resolveIframe(iframeUrl, page.url).then(function (res1) {
                const level1 = res1.media.map(function (u) {
                  return buildStream(normalizeUrl(u), mediaTitle, 'Embed');
                });

                return Promise.all(
                  res1.nested.slice(0, 3).map(function (nestedUrl) {
                    return resolveIframe(nestedUrl, normalizeUrl(iframeUrl)).then(function (res2) {
                      return res2.media.map(function (u) {
                        return buildStream(normalizeUrl(u), mediaTitle, 'Nested');
                      });
                    });
                  })
                ).then(function (nestedStreams) {
                  return level1.concat(flatten(nestedStreams));
                });
              });
            })
          ).then(function (embedStreams) {
            streams = streams.concat(flatten(embedStreams));
            streams = dedupeStreams(streams);
            streams = sortStreams(streams);
            return streams;
          });
        });
    })
    .catch(function (err) {
      console.error('PencuriMovie scraper error:', err.message);
      return [];
    });
}

if (typeof module !== 'undefined') {
  module.exports = getStreams;
} else {
  global.PencuriMovieSubMalayScraperModule = getStreams;
}
