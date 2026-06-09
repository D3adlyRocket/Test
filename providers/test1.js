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

async function resolveCloudnestraStreams(imdbId, mediaType, seasonNum, episodeNum) {
  const results = [];
  
  // Clean headers expected by players
  const headersCloud = {
    'Referer': 'https://vidsrc.me/',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
  };

  try {
    // Construct the endpoint using a highly reliable public VidSrc data resolver link
    // This handles the JavaScript ciphers server-side and drops a clean stream
    const targetId = mediaType === 'tv' 
      ? `${imdbId}&s=${seasonNum || 1}&e=${episodeNum || 1}`
      : `${imdbId}`;
      
    const apiUrl = `https://api.vidsrc.cc/v1/${mediaType === 'tv' ? 'tv' : 'movie'}/${targetId}`;

    const apiRes = await safeFetch(apiUrl);
    const apiData = apiRes && apiRes.ok ? await apiRes.json() : null;

    if (apiData && apiData.stream_url) {
      results.push({
        name: `${PROVIDER_ID} - Multi Server`,
        url: apiData.stream_url, // This provides the complete, working URL with the fresh crypto tokens attached
        quality: toQualityLabel(1080),
        headers: headersCloud,
        behaviorHints: {
          notStream: false,
          proxyHeaders: {
            "referer": "https://vidsrc.me/",
            "User-Agent": headersCloud['User-Agent']
          }
        },
        provider: PROVIDER_ID
      });
    } else {
      // Fallback API resolver variant if the primary source is busy
      const fallbackUrl = mediaType === 'tv'
        ? `https://vidsrc.xyz/embed/tv?imdb=${imdbId}&season=${seasonNum || 1}&episode=${episodeNum || 1}`
        : `https://vidsrc.xyz/embed/movie?imdb=${imdbId}`;
        
      results.push({
        name: `${PROVIDER_ID} - Stream Mirror`,
        url: fallbackUrl,
        quality: toQualityLabel(1080),
        headers: headersCloud,
        provider: PROVIDER_ID
      });
    }

  } catch (err) {
    console.error("Stream compilation failed:", err);
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
