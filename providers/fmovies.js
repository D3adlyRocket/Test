// --- UTILS ---

function getJson(url, options) {
  return fetch(url, options || {}).then(function (response) {
    if (!response || !response.ok) {
      throw new Error('Request failed: ' + url);
    }
    return response.json();
  });
}

function getText(url, options) {
  return fetch(url, options || {}).then(function (response) {
    if (!response || !response.ok) {
      throw new Error('Request failed: ' + url);
    }
    return response.text();
  });
}

function normalizeQuality(label) {
  var text = (label || '').toString();
  var match = text.match(/(2160p|1440p|1080p|720p|480p|360p|4K)/i);
  return match ? match[1].toUpperCase() : 'Auto';
}

function streamObject(provider, title, url, quality, headers) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  return {
    name: provider,
    title: title || provider,
    url: url,
    quality: quality || 'Auto',
    headers: headers || undefined
  };
}

function dedupeStreams(streams) {
  var seen = {};
  return (streams || []).filter(function (stream) {
    if (!stream || !stream.url) return false;
    if (seen[stream.url]) return false;
    seen[stream.url] = true;
    return true;
  });
}

function getTmdbMeta(tmdbId, mediaType) {
  var typePath = mediaType === 'tv' ? 'tv' : 'movie';
  var url = 'https://api.themoviedb.org/3/' + typePath + '/' + tmdbId + '?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885';
  return getJson(url);
}

// --- RESOLVERS ---

async function resolveVidFast(tmdbId, mediaType, season, episode) {
  try {
    const VIDFAST_BASE = 'https://vidfast.pro';
    const pageUrl = mediaType === 'tv'
      ? `${VIDFAST_BASE}/tv/${tmdbId}/${season || 1}/${episode || 1}`
      : `${VIDFAST_BASE}/movie/${tmdbId}`;

    const headers = {
      'Origin': VIDFAST_BASE,
      'Referer': pageUrl,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'X-Requested-With': 'XMLHttpRequest'
    };

    const html = await getText(pageUrl, { headers });
    let rawData = null;

    // Look for the encrypted string in __NEXT_DATA__
    const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (nextMatch) {
      const jsonData = JSON.parse(nextMatch[1]);
      // VidFast hides it in pageProps.en or pageProps.data
      rawData = jsonData.props?.pageProps?.en || jsonData.props?.pageProps?.data;
    }

    if (!rawData) {
      const regexMatch = html.match(/"en":"([^"]+)"/) || html.match(/data\s*=\s*"([^"]+)"/);
      if (regexMatch) rawData = regexMatch[1];
    }

    if (!rawData) return [];

    // Get API info from enc-dec
    const apiConfig = await getJson(`https://enc-dec.app/api/enc-vidfast?text=${encodeURIComponent(rawData)}&version=1`);
    if (!apiConfig || !apiConfig.result) return [];

    const res = apiConfig.result;
    if (res.token) headers['X-CSRF-Token'] = res.token;

    // Fetch Servers
    const encServers = await getText(res.servers, { method: 'POST', headers });
    const decServers = await getJson('https://enc-dec.app/api/dec-vidfast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: encServers, version: '1' })
    });

    const serverList = decServers.result || [];
    const streamPromises = serverList.map(async (srv) => {
      try {
        const encStr = await getText(`${res.stream}/${srv.data}`, { method: 'POST', headers });
        const decStr = await getJson('https://enc-dec.app/api/dec-vidfast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: encStr, version: '1' })
        });

        if (decStr.result?.url) {
          return streamObject(
            'VidFast',
            `VidFast ${srv.name || 'Server'}`,
            decStr.result.url,
            normalizeQuality(decStr.result.quality || decStr.result.label),
            { 'Referer': VIDFAST_BASE + '/', 'Origin': VIDFAST_BASE }
          );
        }
      } catch (e) { return null; }
    });

    const streams = await Promise.all(streamPromises);
    return streams.filter(Boolean);
  } catch (err) {
    return [];
  }
}

function resolveVidEasy(tmdbId, mediaType, season, episode) {
  var typePath = mediaType === 'tv' ? 'tv' : 'movie';
  var dbUrl = 'https://db.videasy.net/3/' + typePath + '/' + tmdbId + '?append_to_response=external_ids&language=en&api_key=ad301b7cc82ffe19273e55e4d4206885';

  return getJson(dbUrl)
    .then(function (meta) {
      var isTv = mediaType === 'tv';
      var title = encodeURIComponent((isTv ? meta.name : meta.title) || '');
      var dateText = isTv ? meta.first_air_date : meta.release_date;
      var year = dateText ? new Date(dateText).getFullYear() : '';
      var imdbId = (meta.external_ids && meta.external_ids.imdb_id) || '';
      var fullUrl = 'https://api.videasy.net/cdn/sources-with-title?title=' + title + '&mediaType=' + (isTv ? 'tv' : 'movie') + '&year=' + year + '&episodeId=' + (isTv ? (episode || 1) : 1) + '&seasonId=' + (isTv ? (season || 1) : 1) + '&tmdbId=' + meta.id + '&imdbId=' + imdbId;
      return getText(fullUrl).then(function (encryptedText) {
        var body = JSON.stringify({ text: encryptedText, id: String(tmdbId) });
        return getJson('https://enc-dec.app/api/dec-videasy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: body
        });
      });
    })
    .then(function (decryptedData) {
      var result = (decryptedData && decryptedData.result) || {};
      var sources = Array.isArray(result.sources) ? result.sources : [];
      return sources
        .filter(function (source) {
          return source && source.url && !(source.quality || '').toUpperCase().includes('HDR');
        })
        .map(function (source) {
          return streamObject(
            'VidEasy',
            'VidEasy ' + (source.quality || 'Auto'),
            source.url,
            normalizeQuality(source.quality),
            { Origin: 'https://player.videasy.net', Referer: 'https://player.videasy.net/' }
          );
        })
        .filter(Boolean);
    })
    .catch(function () { return []; });
}

function resolveVidLink(tmdbId, mediaType, season, episode) {
  return getJson('https://enc-dec.app/api/enc-vidlink?text=' + encodeURIComponent(String(tmdbId)))
    .then(function (encrypted) {
      var encodedTmdb = encrypted && encrypted.result;
      if (!encodedTmdb) return [];
      var url = mediaType === 'tv'
        ? 'https://vidlink.pro/api/b/tv/' + encodedTmdb + '/' + (season || 1) + '/' + (episode || 1) + '?multiLang=0'
        : 'https://vidlink.pro/api/b/movie/' + encodedTmdb + '?multiLang=0';
      return getJson(url).then(function (payload) {
        var playlist = payload && payload.stream && payload.stream.playlist;
        var stream = streamObject('VidLink', 'VidLink Primary', playlist, 'Auto', { Referer: 'https://vidlink.pro' });
        return stream ? [stream] : [];
      });
    })
    .catch(function () { return []; });
}

function resolveVidmody(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType)
    .then(function (meta) {
      var imdbId = (mediaType === 'tv' ? (meta.external_ids && meta.external_ids.imdb_id) : meta.imdb_id);
      if (!imdbId) return [];
      var targetUrl = "";
      var displayTitle = (mediaType === 'tv' ? meta.name : meta.title) || "Vidmody";
      if (mediaType === "movie") {
        targetUrl = "https://vidmody.com/vs/" + imdbId + "#.m3u8";
      } else {
        var sStr = "s" + (season || 1);
        var eNum = episode || 1;
        var eStr = "e" + (eNum < 10 ? "0" + eNum : eNum);
        targetUrl = "https://vidmody.com/vs/" + imdbId + "/" + sStr + "/" + eStr + "#.m3u8";
        displayTitle += " - " + sStr.toUpperCase() + eStr.toUpperCase();
      }
      return fetch(targetUrl.replace("#.m3u8", ""), { method: "HEAD" })
        .then(function (res) {
          if (res.status === 200) {
            return [streamObject(
              "Vidmody",
              displayTitle + " (Vidmody)",
              targetUrl,
              "Auto",
              { "Referer": "https://vidmody.com/", "User-Agent": "Mozilla/5.0" }
            )];
          }
          return [];
        });
    })
    .catch(function () { return []; });
}

function resolveVidSrc(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType)
    .then(function (meta) {
      var imdbId = mediaType === 'tv' ? (meta.external_ids && meta.external_ids.imdb_id) : meta.imdb_id;
      if (!imdbId) return [];
      var embedUrl = mediaType === 'tv'
        ? 'https://vsrc.su/embed/tv?imdb=' + imdbId + '&season=' + (season || 1) + '&episode=' + (episode || 1)
        : 'https://vsrc.su/embed/' + imdbId;
      return getText(embedUrl)
        .then(function (embedHtml) {
          var iframeMatch = embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
          var iframeSrc = iframeMatch ? iframeMatch[1] : '';
          if (!iframeSrc) return [];
          return getText('https:' + iframeSrc, { headers: { referer: 'https://vsrc.su/' } })
            .then(function (iframeHtml) {
              var srcMatch = iframeHtml.match(/src:\s*['"]([^'"]+)['"]/i);
              var prorcpSrc = srcMatch ? srcMatch[1] : '';
              if (!prorcpSrc) return [];
              return getText('https://cloudnestra.com' + prorcpSrc, { headers: { referer: 'https://cloudnestra.com/' } })
                .then(function (cloudHtml) {
                  var divMatch = cloudHtml.match(/<div id="([^"]+)"[^>]*style=["']display\s*:\s*none;?["'][^>]*>([a-zA-Z0-9:\/.,{}\-_=+ ]+)<\/div>/i);
                  var divId = divMatch ? divMatch[1] : '';
                  var divText = divMatch ? divMatch[2] : '';
                  if (!divId || !divText) return [];
                  return getJson('https://enc-dec.app/api/dec-cloudnestra', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: divText, div_id: divId })
                  }).then(function (decrypted) {
                    var urls = (decrypted && decrypted.result) || [];
                    if (!Array.isArray(urls)) return [];
                    return urls.map(function (url, index) {
                      return streamObject('VidSrc', 'VidSrc Server ' + (index + 1), url, 'Auto', {
                        referer: 'https://cloudnestra.com/',
                        origin: 'https://cloudnestra.com'
                      });
                    }).filter(Boolean);
                  });
                });
            });
        });
    })
    .catch(function () { return []; });
}

// --- MAIN ---

async function getStreams(tmdbId, mediaType, season, episode) {
  const resolvers = [
    resolveVidFast,
    resolveVidEasy,
    resolveVidLink,
    resolveVidmody,
    resolveVidSrc
  ];

  const results = await Promise.all(
    resolvers.map(resolver => Promise.resolve(resolver(tmdbId, mediaType, season, episode)).catch(() => []))
  );

  let merged = [];
  results.forEach(group => {
    if (Array.isArray(group)) merged = merged.concat(group);
  });

  return dedupeStreams(merged).slice(0, 50);
}

module.exports = { getStreams };
