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
  const headersCloud = {
    'Referer': 'https://cloudorchestranova.com/',
    'Origin': 'https://cloudorchestranova.com',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
  };

  try {
    // 1. Target the initial embedding layer
    const embedUrl = mediaType === 'tv'
      ? `https://vidsrc-embed.ru/embed/tv?imdb=${encodeURIComponent(imdbId)}&season=${Number(seasonNum || 1)}&episode=${Number(episodeNum || 1)}`
      : `https://vidsrc-embed.ru/embed/${encodeURIComponent(imdbId)}`;

    const embedRes = await safeFetch(embedUrl, { headers: { 'User-Agent': headersCloud['User-Agent'] } });
    const embedHtml = embedRes && embedRes.ok ? await embedRes.text() : '';
    const iframeSrc = (embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/) || [])[1];
    if (!iframeSrc) return [];

    // 2. Fetch the inner wrapper document 
    const iframeRes = await safeFetch(`https:${iframeSrc}`, {
      headers: {
        'user-agent': headersCloud['User-Agent'],
        'referer': 'https://vidsrc-embed.ru/'
      }
    });
    const iframeHtml = iframeRes && iframeRes.ok ? await iframeRes.text() : '';
    const prorcpSrc = (iframeHtml.match(/src:\s*["']([^"']+)["']/) || [])[1];
    if (!prorcpSrc) return [];

    // 3. Load the source code where the streaming player config token lives
    const cloudRes = await safeFetch(`https://cloudorchestranova.com${prorcpSrc}`, { headers: { referer: 'https://cloudorchestranova.com/' } });
    const cloudHtml = cloudRes && cloudRes.ok ? await cloudRes.text() : '';

    // Match the long cryptographic token path pattern found in your Network DevTools logs
    // Looking for strings matching /y5MMCbscf/pl/... or /y5MMCbscf/content/...
    const tokenRegex = /\/y5MMCbscf\/[a-zA-Z0-9_\-\/]+/g;
    const tokenMatches = cloudHtml.match(tokenRegex) || [];
    
    // Fallback link construction if an explicit string format is found inside the player setup variables
    let finalPath = tokenMatches[0] || "/y5MMCbscf/master.m3u8";
    
    // Ensure the stream ends cleanly with the playlist file descriptor
    if (!finalPath.endsWith('master.m3u8') && !finalPath.endsWith('index.m3u8')) {
      finalPath = `${finalPath}/master.m3u8`;
    }

    const cleanStreamUrl = `https://horologyhollow.site${finalPath}`;

    results.push({
      name: `${PROVIDER_ID} - Direct Stream`,
      url: cleanStreamUrl, // Clean URL string without the broken '|' character
      quality: toQualityLabel(1080),
      headers: headersCloud, // Send headers natively via the structured object parameters
      behaviorHints: {
        notStream: false,
        proxyHeaders: {
          "referer": "https://cloudorchestranova.com/",
          "origin": "https://cloudorchestranova.com",
          "User-Agent": headersCloud['User-Agent']
        }
      },
      provider: PROVIDER_ID
    });

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
