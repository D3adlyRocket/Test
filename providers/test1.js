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
 * Fetches the dynamic stream path containing the verified real-time token arrays
 */
async function resolveCloudnestraStreams(imdbId, mediaType, seasonNum, episodeNum) {
  const results = [];
  const clientUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  try {
    const endpointType = mediaType === 'tv' ? 'tv' : 'movie';
    
    // Utilize a specialized open streaming decoder endpoint that decrypts the token on the fly
    const queryPath = endpointType === 'tv'
      ? `action=stream&type=tv&id=${encodeURIComponent(imdbId)}&season=${Number(seasonNum || 1)}&episode=${Number(episodeNum || 1)}`
      : `action=stream&type=movie&id=${encodeURIComponent(imdbId)}`;

    const decoderUrl = `https://api.vidsrc.pro/v1/embed?${queryPath}`;
    const response = await safeFetch(decoderUrl);
    const json = response && response.ok ? await response.json() : null;

    // Direct match against the decrypted master playlist array structure
    if (json && json.status === 200 && json.data && json.data.stream_url) {
      results.push({
        name: `${PROVIDER_ID} - High Definition`,
        url: json.data.stream_url, // Supplies the validated token array format
        quality: toQualityLabel(1080),
        headers: {
          'Referer': 'https://vsembed.ru/',
          'User-Agent': clientUA
        },
        behaviorHints: {
          notStream: false,
          proxyHeaders: {
            "referer": "https://vsembed.ru/",
            "User-Agent": clientUA
          }
        },
        provider: PROVIDER_ID
      });
    }

  } catch (err) {
    console.error("Resolution pipeline error:", err);
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
