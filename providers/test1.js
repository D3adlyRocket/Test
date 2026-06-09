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
 * Uses the exact network routing signature observed in the DevTools request chain logs
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
    // 1. Load primary outer player layout framework
    const embedUrl = mediaType === 'tv'
      ? `https://vidsrc-embed.ru/embed/tv?imdb=${encodeURIComponent(imdbId)}&season=${Number(seasonNum || 1)}&episode=${Number(episodeNum || 1)}`
      : `https://vidsrc-embed.ru/embed/${encodeURIComponent(imdbId)}`;

    const embedRes = await safeFetch(embedUrl, { headers: { 'User-Agent': clientUA } });
    const embedHtml = embedRes && embedRes.ok ? await embedRes.text() : '';
    const iframeSrc = (embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/) || [])[1];
    if (!iframeSrc) return [];

    // 2. Extract the prorcp request token wrapper parameter
    const iframeRes = await safeFetch(`https:${iframeSrc}`, {
      headers: { 'user-agent': clientUA, 'referer': 'https://vidsrc-embed.ru/' }
    });
    const iframeHtml = iframeRes && iframeRes.ok ? await iframeRes.text() : '';
    
    // Capture the entire matching prorcp path variable (the long NGMx... string from your log)
    const prorcpSrc = (iframeHtml.match(/src:\s*["']([^"']+)["']/) || [])[1];
    if (!prorcpSrc) return [];

    // 3. Request the direct endpoint containing the active player instance
    const finalDataUrl = `https://cloudorchestranova.com${prorcpSrc}`;
    const cloudRes = await safeFetch(finalDataUrl, { headers: { 'referer': 'https://cloudorchestranova.com/', 'user-agent': clientUA } });
    const cloudHtml = cloudRes && cloudRes.ok ? await cloudRes.text() : '';

    // Extract the live /y5MMCbscf/ sequence from the runtime layout
    const liveTokenRegex = /\/y5MMCbscf\/(pl|content)\/[a-zA-Z0-9_\-\+=]+/g;
    const matches = cloudHtml.match(liveTokenRegex) || [];
    
    // Use the parsed dynamic address path or construct a direct target signature
    let mediaPath = matches[0];
    if (!mediaPath) {
      // If hidden in packed module code, fallback to verifying the active directory pattern
      const stringId = prorcpSrc.split('/').pop();
      mediaPath = `/y5MMCbscf/pl/${stringId}`;
    }

    if (!mediaPath.endsWith('master.m3u8') && !mediaPath.endsWith('index.m3u8')) {
      mediaPath = `${mediaPath}/master.m3u8`;
    }

    const clearStreamUrl = `https://horologyhollow.site${mediaPath}`;

    results.push({
      name: `${PROVIDER_ID} - Direct TV Stream`,
      url: clearStreamUrl, 
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
    console.error("Network extraction execution failed:", err);
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
