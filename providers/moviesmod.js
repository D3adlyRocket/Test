// --- UTILITY HELPERS ---

function getJson(url, options) {
  return fetch(url, options || {}).then(res => {
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  });
}

function getText(url, options) {
  return fetch(url, options || {}).then(res => {
    if (!res.ok) throw new Error('Request failed');
    return res.text();
  });
}

function getTmdbMeta(tmdbId, mediaType) {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`;
  return getJson(url);
}

function streamObject(name, title, url, quality, headers) {
  return { name, title, url, quality: quality || 'Auto', headers };
}

// --- PROVIDER RESOLVERS ---

function resolveVidEasy(tmdbId, mediaType, season, episode) {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  const dbUrl = `https://db.videasy.net/3/${type}/${tmdbId}?append_to_response=external_ids&api_key=ad301b7cc82ffe19273e55e4d4206885`;

  return getJson(dbUrl).then(meta => {
    const isTv = mediaType === 'tv';
    const title = encodeURIComponent((isTv ? meta.name : meta.title) || '');
    const year = new Date(isTv ? meta.first_air_date : meta.release_date).getFullYear() || '';
    const imdbId = meta.external_ids?.imdb_id || '';
    
    const api = `https://api.videasy.net/cdn/sources-with-title?title=${title}&mediaType=${mediaType}&year=${year}&episodeId=${episode || 1}&seasonId=${season || 1}&tmdbId=${tmdbId}&imdbId=${imdbId}`;
    
    return getText(api).then(enc => {
      return getJson('https://enc-dec.app/api/dec-videasy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: enc, id: String(tmdbId) })
      });
    });
  }).then(dec => {
    const sources = dec?.result?.sources || [];
    return sources.map(s => streamObject('VidEasy', 'VidEasy ' + s.quality, s.url, s.quality, { Referer: 'https://player.videasy.net' }));
  }).catch(() => []);
}

function resolveVidLink(tmdbId, mediaType, season, episode) {
  return getJson('https://enc-dec.app/api/enc-vidlink?text=' + tmdbId)
    .then(enc => {
      const url = mediaType === 'tv' 
        ? `https://vidlink.pro/api/b/tv/${enc.result}/${season || 1}/${episode || 1}?multiLang=0`
        : `https://vidlink.pro/api/b/movie/${enc.result}?multiLang=0`;
      return getJson(url);
    })
    .then(res => {
      const playlist = res?.stream?.playlist;
      console.log("[VidLink Test] URL:", playlist);
      return [streamObject('VidLink', 'VidLink Primary', playlist, 'Auto', { Referer: 'https://vidlink.pro' })];
    }).catch(() => []);
}

function resolveVidMody(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType).then(meta => {
    const imdbId = mediaType === 'tv' ? meta.external_ids?.imdb_id : meta.imdb_id;
    if (!imdbId) return [];

    const s = "s" + (season || 1);
    const e = "e" + (episode < 10 ? "0" + (episode || 1) : (episode || 1));
    const url = mediaType === "movie" ? `https://vidmody.com/vs/${imdbId}#.m3u8` : `https://vidmody.com/vs/${imdbId}/${s}/${e}#.m3u8`;

    return fetch(url.replace("#.m3u8", ""), { method: "GET" }).then(res => {
      if (res.status !== 200) return [];
      return res.text().then(content => {
        console.log("[VidMody Test] Manifest Start:", content.substring(0, 250));
        return [streamObject('VidMody', `${meta.title || meta.name} (VidMody)`, url, 'Auto', { Referer: 'https://vidmody.com/' })];
      });
    });
  }).catch(() => []);
}

function resolveVidSrc(tmdbId, mediaType, season, episode) {
  return getTmdbMeta(tmdbId, mediaType).then(meta => {
    const imdbId = mediaType === 'tv' ? meta.external_ids?.imdb_id : meta.imdb_id;
    const url = mediaType === 'tv' ? `https://vsrc.su/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}` : `https://vsrc.su/embed/${imdbId}`;
    
    return getText(url).then(html => {
      const frame = html.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
      return getText('https:' + frame, { headers: { referer: 'https://vsrc.su/' } });
    }).then(html => {
      const src = html.match(/src:\s*['"]([^'"]+)['"]/i)?.[1];
      return getText('https://cloudnestra.com' + src, { headers: { referer: 'https://cloudnestra.com/' } });
    }).then(html => {
      const div = html.match(/<div id="([^"]+)"[^>]*>([a-zA-Z0-9:/.,{}_=+ ]+)<\/div>/i);
      return getJson('https://enc-dec.app/api/dec-cloudnestra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: div[2], div_id: div[1] })
      });
    }).then(res => {
      return (res?.result || []).map((u, i) => streamObject('VidSrc', 'VidSrc Server ' + (i+1), u, 'Auto', { referer: 'https://cloudnestra.com/' }));
    });
  }).catch(() => []);
}

// --- EXPORT ---

async function getStreams(tmdbId, mediaType, season, episode) {
  const resolvers = [resolveVidEasy, resolveVidLink, resolveVidMody, resolveVidSrc];
  const results = await Promise.all(resolvers.map(r => r(tmdbId, mediaType, season, episode).catch(() => [])));
  return results.flat().filter(s => s && s.url).slice(0, 50);
}

module.exports = { getStreams };
