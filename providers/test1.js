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
 * Scans the provider configurations dynamically to isolate the live authorized token path
 */
async function resolveCloudnestraStreams(imdbId, mediaType, seasonNum, episodeNum) {
  const results = [];
  const clientUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  const headersCloud = {
    'Referer': 'https://cloudorchestranova.com/',
    'Origin': 'https://cloudorchestranova.com',
    'User-Agent': clientUserAgent
  };

  try {
    // 1. Fetch the initial layout wrapper
    const embedUrl = mediaType === 'tv'
      ? `https://vidsrc-embed.ru/embed/tv?imdb=${encodeURIComponent(imdbId)}&season=${Number(seasonNum || 1)}&episode=${Number(episodeNum || 1)}`
      : `https://vidsrc-embed.ru/embed/${encodeURIComponent(imdbId)}`;

    const embedRes = await safeFetch(embedUrl, { headers: { 'User-Agent': clientUserAgent } });
    const embedHtml = embedRes && embedRes.ok ? await embedRes.text() : '';
    const iframeSrc = (embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/) || [])[1];
    if (!iframeSrc) return [];

    // 2. Open the intermediate security frame
    const iframeRes = await safeFetch(`https:${iframeSrc}`, {
      headers: {
        'user-agent': clientUserAgent,
        'referer': 'https://vidsrc-embed.ru/'
      }
    });
    const iframeHtml = iframeRes && iframeRes.ok ? await iframeRes.text() : '';
    const prorcpSrc = (iframeHtml.match(/src:\s*["']([^"']+)["']/) || [])[1];
    if (!prorcpSrc) return [];

    // 3. Load the script layer hosting the execution setup variables
    const cloudRes = await safeFetch(`https://cloudorchestranova.com${prorcpSrc}`, { headers: { referer: 'https://cloudorchestranova.com/' } });
    const cloudHtml = cloudRes && cloudRes.ok ? await cloudRes.text() : '';

    // Match the exact dynamic encrypted token path block from your original working logs:
    // It captures /y5MMCbscf/pl/H4sIAAAAAAAA... style token paths embedded inside the code structures
    const streamPathRegex = /\/y5MMCbscf\/pl\/[a-zA-Z0-9_\-\+=]+/g;
    const pathMatches = cloudHtml.match(streamPathRegex) || [];
    
    if (pathMatches.length > 0) {
      // Build the authorized stream URL with the live dynamic token
      const liveTokenPath = pathMatches[0];
      const directStreamUrl = `https://horologyhollow.site${liveTokenPath}/master.m3u8`;

      results.push({
        name: `${PROVIDER_ID} - Live Auto Stream`,
        url: directStreamUrl, // Balanced clean string url for standard player compliance
        quality: toQualityLabel(1080),
        headers: headersCloud,
        behaviorHints: {
          notStream: false,
          proxyHeaders: {
            "referer": "https://cloudorchestranova.com/",
            "origin": "https://cloudorchestranova.com"
          }
        },
        provider: PROVIDER_ID
      });
    }
  } catch (err) {
    console.error("Failed executing dynamic stream extraction:", err);
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
