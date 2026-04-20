const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const PROVIDER_ID = 'alas-vidsrc';

async function safeFetch(url, options = {}) {
  // Use fetchv2 if available (usually in specific extension environments)
  if (typeof fetchv2 === 'function') {
    const headers = options.headers || {};
    const method = options.method || 'GET';
    const body = options.body || null;
    try {
      return await fetchv2(url, headers, method, body, true, options.encoding || 'utf-8');
    } catch (e) {
      console.error("fetchv2 error:", e);
    }
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
  if (score >= 720) return '720p';
  if (score >= 480) return '480p';
  return 'Auto';
}

function maxResolutionFromM3u8Text(text) {
  const input = String(text || '');
  let maxY = 0;
  const re = /RESOLUTION=\s*\d+\s*x\s*(\d+)/gi;
  let m;
  while ((m = re.exec(input)) !== null) {
    const y = Number(m[1]);
    if (Number.isFinite(y) && y > maxY) maxY = y;
  }
  return maxY;
}

async function detectPlaylistMaxQuality(url, headers) {
  try {
    const res = await safeFetch(url, { headers: headers || {} });
    const text = res && res.ok ? await res.text() : '';
    return maxResolutionFromM3u8Text(text);
  } catch {
    return 0;
  }
}

async function resolveCloudnestraStreams(imdbId, mediaType, seasonNum, episodeNum) {
  const commonHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

  // Updated URL pattern for vsrc.su
  const embedUrl = mediaType === 'tv'
    ? `https://vsrc.su/embed/tv/${imdbId}/${seasonNum}-${episodeNum}`
    : `https://vsrc.su/embed/movie/${imdbId}`;

  const embedRes = await safeFetch(embedUrl, { headers: commonHeaders });
  const embedHtml = embedRes && embedRes.ok ? await embedRes.text() : '';
  
  // Extract iframe more reliably
  const iframeMatch = embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  let iframeSrc = iframeMatch ? iframeMatch[1] : null;
  if (!iframeSrc) return [];
  if (iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc;

  const iframeRes = await safeFetch(iframeSrc, {
    headers: { ...commonHeaders, referer: 'https://vsrc.su/' }
  });
  const iframeHtml = iframeRes && iframeRes.ok ? await iframeRes.text() : '';
  
  // Look for the source script tag
  const prorcpMatch = iframeHtml.match(/src:\s*["']([^"']+)["']/);
  const prorcpSrc = prorcpMatch ? prorcpMatch[1] : null;
  if (!prorcpSrc) return [];

  const cloudUrl = `https://cloudnestra.com${prorcpSrc}`;
  const cloudRes = await safeFetch(cloudUrl, { 
    headers: { ...commonHeaders, referer: 'https://cloudnestra.com/' } 
  });
  const cloudHtml = cloudRes && cloudRes.ok ? await cloudRes.text() : '';

  // Extract hidden div data
  const hidden = cloudHtml.match(/<div id="([^"]+)"[^>]*style=["']display\s*:\s*none;?["'][^>]*>([a-zA-Z0-9:\/.,{}\-_=+ ]+)<\/div>/);
  if (!hidden) return [];

  const decRes = await safeFetch('https://enc-dec.app/api/dec-cloudnestra', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: hidden[2], div_id: hidden[1] })
  });
  
  const decJson = decRes && decRes.ok ? await decRes.json() : null;
  const urls = decJson && Array.isArray(decJson.result) ? decJson.result : [];
  
  const results = [];
  for (let idx = 0; idx < urls.length; idx++) {
    const streamUrl = urls[idx];
    if (!streamUrl) continue;

    const maxFromPlaylist = await detectPlaylistMaxQuality(streamUrl, { Referer: 'https://cloudnestra.com/' });
    const scoreFromUrl = inferQualityScore(streamUrl);
    const score = maxFromPlaylist > 0 ? maxFromPlaylist : scoreFromUrl;

    results.push({
      name: `${PROVIDER_ID} - Server ${idx + 1}`,
      url: streamUrl,
      quality: toQualityLabel(score),
      headers: { Referer: 'https://cloudnestra.com/', Origin: 'https://cloudnestra.com' },
      provider: PROVIDER_ID,
      _score: score
    });
  }

  return results.sort((a, b) => b._score - a._score).map(({ _score, ...rest }) => rest);
}

// Support functions (tmdb, getImdbId, etc.)
async function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  try {
    const movie = await safeFetch(`${TMDB_BASE}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`).then(r => r.json());
    const ext = await safeFetch(`${TMDB_BASE}/${mediaType}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`).then(r => r.json());
    const imdbId = ext.imdb_id || movie.imdb_id;
    if (!imdbId) return [];
    return await resolveCloudnestraStreams(imdbId, mediaType, seasonNum, episodeNum);
  } catch {
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
