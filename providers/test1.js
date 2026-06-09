const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const PROVIDER_ID = 'VidSrc';

async function safeFetch(url, options = {}) {
  // Graceful fallback if fetchv2 isn't available in the runtime environment
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

function inferQualityScore(text) {
  const value = String(text || '').toLowerCase();
  if (value.includes('2160') || value.includes('4k')) return 2160;
  if (value.includes('1440')) return 1440;
  if (value.includes('1080')) return 1080;
  if (value.includes('720')) return 720;
  if (value.includes('480')) return 480;
  if (value.includes('360')) return 360;
  return 0;
}

function toQualityLabel(score) {
  if (score >= 2160) return '2160p';
  if (score >= 1440) return '1440p';
  if (score >= 1080) return '1080p';
  return 'Auto';
}

/**
 * Local client-side decryption fallback to replace the dead 404 API endpoint
 */
function decryptCloudorchestranova(encryptedText, divId) {
  try {
    // Standard Base64 Decode
    let decoded = atob(encryptedText);
    
    // Attempt standard string reversal decryption
    let reversed = decoded.split('').reverse().join('');
    
    if (reversed.includes('http')) {
      try { return JSON.parse(reversed); } catch {}
      // Fallback extraction regex if string contains raw links rather than strict array notation
      const matches = reversed.match(/(https?:\/\/[^\s",\]}]+)/g);
      if (matches) return matches;
    }
    
    if (decoded.includes('http')) {
      try { return JSON.parse(decoded); } catch {}
      const matches = decoded.match(/(https?:\/\/[^\s",\]}]+)/g);
      if (matches) return matches;
    }
    
    return [];
  } catch (e) {
    console.error("Local decoding exception:", e);
    return [];
  }
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
  const headersCloud = {
    'Referer': 'https://cloudorchestranova.com/',
    'Origin': 'https://cloudorchestranova.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  const embedUrl = mediaType === 'tv'
    ? `https://vidsrc-embed.ru/embed/tv?imdb=${encodeURIComponent(imdbId)}&season=${Number(seasonNum || 1)}&episode=${Number(episodeNum || 1)}`
    : `https://vidsrc-embed.ru/embed/${encodeURIComponent(imdbId)}`;

  const embedRes = await safeFetch(embedUrl, { headers: { 'User-Agent': headersCloud['User-Agent'] } });
  const embedHtml = embedRes && embedRes.ok ? await embedRes.text() : '';
  const iframeSrc = (embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/) || [])[1];
  if (!iframeSrc) return [];

  const iframeRes = await safeFetch(`https:${iframeSrc}`, {
    headers: {
      'user-agent': headersCloud['User-Agent'],
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'referer': 'https://vidsrc-embed.ru/'
    }
  });
  const iframeHtml = iframeRes && iframeRes.ok ? await iframeRes.text() : '';
  const prorcpSrc = (iframeHtml.match(/src:\s*["']([^"']+)["']/) || [])[1];
  if (!prorcpSrc) return [];

  const cloudRes = await safeFetch(`https://cloudorchestranova.com${prorcpSrc}`, { headers: { referer: 'https://cloudorchestranova.com/' } });
  const cloudHtml = cloudRes && cloudRes.ok ? await cloudRes.text() : '';

  const hidden = cloudHtml.match(/<div id="([^"]+)"[^>]*style=["']display\s*:\s*none;?["'][^>]*>([a-zA-Z0-9:\/.,{}\-_=+ ]+)<\/div>/);
  const divId = hidden ? hidden[1] : null;
  const divText = hidden ? hidden[2] : null;
  
  if (!divId || !divText) return [];

  // Decrypt content locally using client utility methods
  const rawUrls = decryptCloudorchestranova(divText, divId);
  const urls = Array.isArray(rawUrls) ? rawUrls : [rawUrls];
  if (urls.length === 0) return [];

  const results = [];
  for (let idx = 0; idx < urls.length; idx++) {
    const streamUrl = urls[idx];
    if (!streamUrl) continue;

    const scoreFromUrl = inferQualityScore(streamUrl);
    const assumed = streamUrl.includes('.m3u8') ? 1080 : 0;
    const score = Math.max(scoreFromUrl, assumed);

    // Bypassing CORS blocks on media pipelines often requires specific URL string suffixes 
    // to instruct underlying platform HTTP clients to attach required headers.
    const appendedHeadersUrl = `${streamUrl}|Referer=https://cloudorchestranova.com/&Origin=https://cloudorchestranova.com`;

    results.push({
      name: `${PROVIDER_ID} - Server ${idx + 1}`,
      url: appendedHeadersUrl, // Standard format header injection string suffix
      quality: toQualityLabel(score),
      headers: headersCloud,
      behaviorHints: {
        notStream: false,
        proxyHeaders: {
          "referer": "https://cloudorchestranova.com/",
          "origin": "https://cloudorchestranova.com"
        }
      },
      provider: PROVIDER_ID,
      _score: score
    });
  }

  return results
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...rest }) => rest);
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
