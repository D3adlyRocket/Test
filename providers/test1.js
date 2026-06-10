const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const PROVIDER_ID = 'VidSrc';

async function safeFetch(url, options = {}) {
  if (typeof fetchv2 === 'function') {
    const headers = options.headers || {};
    const method = options.method || 'GET';
    const body = options.body || null;
    try {
      return await fetchv2(url, headers, method, body, true, options.encoding || 'utf-8');
    } catch {}
  }
  return fetch(url, options);
}

function toQualityLabel(score) {
  if (score >= 2160) return '2160p';
  if (score >= 1440) return '1440p';
  if (score >= 1080) return '1080p';
  return 'Auto';
}

async function tmdbFetch(path) {
  return safeFetch(`${TMDB_BASE}${path}?api_key=${TMDB_API_KEY}`)
    .then(r => (r && r.ok ? r.json() : null))
    .catch(() => null);
}

async function getImdbId(tmdbId, mediaType) {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  if (type === 'movie') {
    const movie = await tmdbFetch(`/movie/${tmdbId}`);
    return movie && movie.imdb_id ? movie.imdb_id : null;
  }

  const tv = await tmdbFetch(`/tv/${tmdbId}`);
  if (!tv) return null;
  const ext = await tmdbFetch(`/tv/${tmdbId}/external_ids`);
  return ext && ext.imdb_id ? ext.imdb_id : null;
}

/**
 * Automates the exact URL assembly routing discovered via the framework diagnostics
 */
async function resolveCloudnestraStreams(imdbId, mediaType, seasonNum, episodeNum) {
  const results = [];
  const clientUA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36';
  
  const headersCloud = {
    'Referer': 'https://cloudorchestranova.com/',
    'Origin': 'https://cloudorchestranova.com',
    'User-Agent': clientUA
  };

  try {
    // 1. Hit the verified top-level window target domain discovered via Console
    const embedUrl = mediaType === 'tv'
      ? `https://vsembed.ru/embed/tv?imdb=${encodeURIComponent(imdbId)}&season=${Number(seasonNum || 1)}&episode=${Number(episodeNum || 1)}`
      : `https://vsembed.ru/embed/${encodeURIComponent(imdbId)}`;

    const embedRes = await safeFetch(embedUrl, { headers: { 'User-Agent': clientUA } });
    const embedHtml = embedRes && embedRes.ok ? await embedRes.text() : '';
    
    // 2. Locate the precise "player_iframe" SRC attribute discovered by your framework script
    const iframeSrcMatch = embedHtml.match(/<iframe[^>]+id=["']player_iframe["'][^>]+src=["']([^"']+)["']/i) || 
                           embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    
    let iframeSrc = iframeSrcMatch ? iframeSrcMatch[1] : null;
    if (!iframeSrc) return [];
    if (!iframeSrc.startsWith('http')) iframeSrc = `https:${iframeSrc}`;

    // 3. Extract the primary base64 security token parameter out of the layout path segment
    // Example target string path: /rcp/NGMxNzJkMWJkMjU...
    const urlParts = iframeSrc.split('/');
    const tokenParam = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
    if (!tokenParam || tokenParam.length < 30) return [];

    // 4. Force query execution against the target internal processing file observed in your initialization logs
    const processingUrl = `https://cloudorchestranova.com/prorcp/${tokenParam}`;
    const processingRes = await safeFetch(processingUrl, { 
      headers: { 
        'Referer': `https://cloudorchestranova.com/rcp/${tokenParam}`,
        'User-Agent': clientUA 
      } 
    });
    const processingHtml = processingRes && processingRes.ok ? await processingRes.text() : '';

    // 5. Scan the execution stream files array for the authorized folder string path segment
    const streamTokenRegex = /\/y5MMCbscf\/(pl|content)\/[a-zA-Z0-9_\-\+=]+/g;
    const matches = processingHtml.match(streamTokenRegex) || [];
    
    let directSegmentPath = matches[0];
    
    // Fallback assembly sequence mirroring your exact media player network snapshot address if code is string split
    if (!directSegmentPath) {
      directSegmentPath = `/y5MMCbscf/pl/${tokenParam}`;
    }
    
    if (!directSegmentPath.endsWith('master.m3u8') && !directSegmentPath.endsWith('index.m3u8')) {
      directSegmentPath = `${directSegmentPath}/master.m3u8`;
    }

    const clearDirectM3u8Url = `https://horologyhollow.site${directSegmentPath}`;

    results.push({
      name: `${PROVIDER_ID} - Direct Stream Link`,
      url: clearDirectM3u8Url, 
      quality: toQualityLabel(1080),
      headers: headersCloud,
      behaviorHints: {
        notStream: false,
        proxyHeaders: {
          "referer": "https://cloudorchestranova.com/",
          "origin": "https://cloudorchestranova.com",
          "User-Agent": clientUA
        }
      },
      provider: PROVIDER_ID
    });

  } catch (err) {
    console.error("Scraper internal runtime error:", err);
  }

  return results;
}

async function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  try {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const imdbId = await getImdbId(tmdbId, type);
    if (!imdbId) return [];
    return await resolveCloudnestraStreams(imdbId, type, seasonNum, episodeNum);
  } catch {
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
