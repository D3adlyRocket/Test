// --- UTILS ---

function getJson(url, options) {
  return fetch(url, options || {}).then(function (response) {
    if (!response || !response.ok) throw new Error('Request failed: ' + url);
    return response.json();
  });
}

function getText(url, options) {
  return fetch(url, options || {}).then(function (response) {
    if (!response || !response.ok) throw new Error('Request failed: ' + url);
    return response.text();
  });
}

function normalizeQuality(label) {
  var text = (label || '').toString();
  var match = text.match(/(2160p|1440p|1080p|720p|480p|360p|4K)/i);
  return match ? match[1].toUpperCase() : 'Auto';
}

function streamObject(provider, title, url, quality, headers) {
  if (!url || typeof url !== 'string') return null;
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

async function resolveVidFast(tmdbId, mediaType, seasonNum, episodeNum) {
    const VIDFAST_BASE = 'https://vidfast.pro';
    const ENCRYPT_API = 'https://enc-dec.app/api/enc-vidfast';
    const DECRYPT_API = 'https://enc-dec.app/api/dec-vidfast';
    const ALLOWED_SERVERS = ['Alpha', 'Cobra', 'Kirito', 'Max', 'Meliodas', 'Oscar', 'vEdge', 'vFast', 'vRapid', 'Bollywood'];

    try {
        const pageUrl = mediaType === 'tv'
            ? `${VIDFAST_BASE}/tv/${tmdbId}/${seasonNum || 1}/${episodeNum || 1}`
            : `${VIDFAST_BASE}/movie/${tmdbId}`;

        const headers = {
            'Accept': '*/*',
            'Origin': 'https://vidfast.pro',
            'Referer': pageUrl,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest'
        };

        const pageResponse = await fetch(pageUrl, { headers });
        if (!pageResponse.ok) return [];
        const pageText = await pageResponse.text();

        let rawData = null;
        const nextDataMatch = pageText.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
        if (nextDataMatch) {
            try {
                const jsonData = JSON.parse(nextDataMatch[1]);
                const propsStr = JSON.stringify(jsonData);
                const dataMatch = propsStr.match(/"en":"([^"]+)"/);
                if (dataMatch) rawData = dataMatch[1];
            } catch (e) {}
        }
        
        if (!rawData) {
            const patterns = [/"en":"([^"]+)"/, /'en':'([^']+)'/, /data\s*=\s*"([^"]+)"/];
            for (const pattern of patterns) {
                const match = pageText.match(pattern);
                if (match) { rawData = match[1]; break; }
            }
        }

        if (!rawData) return [];

        const apiData = await getJson(`${ENCRYPT_API}?text=${encodeURIComponent(rawData)}&version=1`);
        if (!apiData.result) return [];

        const apiServers = apiData.result.servers;
        const streamBase = apiData.result.stream;
        if (apiData.result.token) headers['X-CSRF-Token'] = apiData.result.token;

        const serversResponse = await fetch(apiServers, { method: 'POST', headers });
        const serversEncrypted = await serversResponse.text();
        
        const decryptData = await getJson(DECRYPT_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: serversEncrypted, version: '1' })
        });

        let serverList = decryptData.result || [];
        // Filter specifically for your allowed list + Bollywood
        serverList = serverList.filter(s => ALLOWED_SERVERS.includes(s.name));

        const streams = [];
        for (const serverObj of serverList) {
            try {
                const streamResponse = await fetch(`${streamBase}/${serverObj.data}`, { method: 'POST', headers });
                if (!streamResponse.ok) continue;

                const streamEncrypted = await streamResponse.text();
                const streamDecryptData = await getJson(DECRYPT_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: streamEncrypted, version: '1' })
                });

                const data = streamDecryptData.result;
                if (data && data.url) {
                    streams.push(streamObject(
                        'VidFast',
                        `VidFast ${serverObj.name}`,
                        data.url,
                        normalizeQuality(data.quality || data.label),
                        { 'Referer': 'https://vidfast.pro/', 'User-Agent': headers['User-Agent'] }
                    ));
                }
            } catch (e) { continue; }
        }
        return streams;
    } catch (error) {
        return [];
    }
}

// ... (Rest of your resolvers: resolveVidEasy, resolveVidLink, resolveVidmody, resolveVidSrc) ...

function resolveVidEasy(tmdbId, mediaType, season, episode) {
  var typePath = mediaType === 'tv' ? 'tv' : 'movie';
  var dbUrl = 'https://db.videasy.net/3/' + typePath + '/' + tmdbId + '?append_to_response=external_ids&language=en&api_key=ad301b7cc82ffe19273e55e4d4206885';
  return getJson(dbUrl).then(function (meta) {
      var isTv = mediaType === 'tv';
      var title = encodeURIComponent((isTv ? meta.name : meta.title) || '');
      var dateText = isTv ? meta.first_air_date : meta.release_date;
      var year = dateText ? new Date(dateText).getFullYear() : '';
      var imdbId = (meta.external_ids && meta.external_ids.imdb_id) || '';
      var fullUrl = 'https://api.videasy.net/cdn/sources-with-title?title=' + title + '&mediaType=' + (isTv ? 'tv' : 'movie') + '&year=' + year + '&episodeId=' + (isTv ? (episode || 1) : 1) + '&seasonId=' + (isTv ? (season || 1) : 1) + '&tmdbId=' + meta.id + '&imdbId=' + imdbId;
      return getText(fullUrl).then(function (encryptedText) {
        return getJson('https://enc-dec.app/api/dec-videasy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: encryptedText, id: String(tmdbId) })
        });
      });
    }).then(function (decryptedData) {
      var sources = (decryptedData && decryptedData.result && decryptedData.result.sources) || [];
      return sources.map(function (s) {
          return streamObject('VidEasy', 'VidEasy ' + (s.quality || 'Auto'), s.url, normalizeQuality(s.quality), { Origin: 'https://player.videasy.net' });
      }).filter(Boolean);
    }).catch(function () { return []; });
}

function resolveVidLink(tmdbId, mediaType, season, episode) {
  return getJson('https://enc-dec.app/api/enc-vidlink?text=' + encodeURIComponent(String(tmdbId)))
    .then(function (enc) {
      var url = mediaType === 'tv' ? `https://vidlink.pro/api/b/tv/${enc.result}/${season || 1}/${episode || 1}` : `https://vidlink.pro/api/b/movie/${enc.result}`;
      return getJson(url).then(function (p) {
        var s = streamObject('VidLink', 'VidLink Primary', p.stream.playlist, 'Auto', { Referer: 'https://vidlink.pro' });
        return s ? [s] : [];
      });
    }).catch(() => []);
}

function resolveVidmody(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType).then(function (meta) {
      var imdbId = (mediaType === 'tv' ? (meta.external_ids && meta.external_ids.imdb_id) : meta.imdb_id);
      if (!imdbId) return [];
      var targetUrl = mediaType === "movie" ?
