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
  const clientUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  try {
    // Construct the query for an open-source stream resolver API
    // This bridge executes the JS ciphers server-side and outputs a pre-authorized direct link
    const targetQuery = mediaType === 'tv'
      ? `id=${encodeURIComponent(imdbId)}&s=${Number(seasonNum || 1)}&e=${Number(episodeNum || 1)}`
      : `id=${encodeURIComponent(imdbId)}`;

    const apiUrl = `https://vidsrc.me/vidsrc-api.json?${targetQuery}`;
    
    const apiRes = await safeFetch(apiUrl);
    const apiData = apiRes && apiRes.ok ? await apiRes.json() : null;

    if (apiData && apiData.url) {
      results.push({
        name: `${PROVIDER_ID} - Direct Link`,
        url: apiData.url, // Already contains the unmasked runtime stream tokens
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
    } else {
      // Direct universal open fallback link if the primary resolver API has heavy load
      const backupEmbed = mediaType === 'tv'
        ? `https://vidsrc.pm/embed/tv/${imdbId}/${Number(seasonNum || 1)}/${Number(episodeNum || 1)}`
        : `https://vidsrc.pm/embed/movie/${imdbId}`;

      results.push({
        name: `${PROVIDER_ID} - Alternate Mirror`,
        url: backupEmbed,
        quality: toQualityLabel(1080),
        headers: { 'Referer': 'https://vsembed.ru/', 'User-Agent': clientUA },
        provider: PROVIDER_ID
      });
    }

  } catch (err) {
    console.error("API link aggregation failed:", err);
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
