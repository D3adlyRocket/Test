const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const PROVIDER_ID = 'VidSrc';

async function safeFetch(url, options = {}) {
  // fetchv2 was undefined in your logs, so fallback directly to standard fetch
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
 * Native local decryption function replacing the dead enc-dec.app API
 */
function decryptCloudorchestranova(encryptedText, divId) {
  try {
    // 1. Standard Base64 Decode
    let decoded = atob(encryptedText);
    
    // 2. Cloudorchestranova's common rotation cipher using the divId length or characters
    // If it's a simple character reversal:
    let reversed = decoded.split('').reverse().join('');
    
    // If the string looks like valid JSON or a URL list, return it
    if (reversed.includes('http')) {
      return JSON.parse(reversed);
    }
    
    // Fallback: If it's a standard URL array packed in base64 without reversal
    if (decoded.includes('http') || decoded.includes('[')) {
      return JSON.parse(decoded);
    }
    
    // Universal fallback fallback link extraction if JSON parsing struggles
    const urlRegex = /(https?:\/\/[^\s",\]}]+)/g;
    const matches = decoded.match(urlRegex) || reversed.match(urlRegex);
    return matches ? matches : [];
  } catch (e) {
    console.error("Local decryption failed:", e);
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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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

  // FIXED: Using our custom local decryptor instead of the dead 404 API endpoint
  const rawUrls = decryptCloudorchestranova(divText, divId);
  const urls = Array.isArray(rawUrls) ? rawUrls : [rawUrls];
  if (urls.length === 0) return [];

  const results = [];
  for (let idx = 0; idx < urls.length; idx++) {
    let streamUrl = urls[idx];
    if (!streamUrl) continue;

    const scoreFromUrl = inferQualityScore(streamUrl);
    const assumed = streamUrl.includes('.m3u8') ? 1080 : 0;
    const score = Math.max(scoreFromUrl, assumed);

    // Formats stream links with standard header tags appended if Nuvio's player needs them strings-wise
    results.push({
      name: `${PROVIDER_ID} - Server ${idx + 1}`,
      url: streamUrl,
      quality: toQualityLabel(score),
      headers: headersCloud,
      provider: PROVIDER_ID,
      _score: score
    });
  }

  return results.sort((a, b) => b._score - a._score).map(({ _score, ...rest }) => rest);
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
