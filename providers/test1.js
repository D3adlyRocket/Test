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
  const clientUA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36';

  try {
    // FIX 1: Updated to the exact domain shown in your DevTools dashboard (vsembed.ru)
    const embedUrl = mediaType === 'tv'
      ? `https://vsembed.ru/embed/tv?imdb=${encodeURIComponent(imdbId)}&season=${Number(seasonNum || 1)}&episode=${Number(episodeNum || 1)}`
      : `https://vsembed.ru/embed/${encodeURIComponent(imdbId)}`;

    const embedRes = await safeFetch(embedUrl, { headers: { 'User-Agent': clientUA } });
    const embedHtml = embedRes && embedRes.ok ? await embedRes.text() : '';
    
    // Extract the dynamic secure frame address
    let iframeSrc = (embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/) || [])[1];
    
    if (iframeSrc) {
      if (!iframeSrc.startsWith('http')) iframeSrc = `https:${iframeSrc}`;
      const iframeRes = await safeFetch(iframeSrc, { headers: { 'user-agent': clientUA, 'referer': 'https://vsembed.ru/' } });
      const iframeHtml = iframeRes && iframeRes.ok ? await iframeRes.text() : '';
      
      const prorcpSrc = (iframeHtml.match(/src:\s*["']([^"']+)["']/) || [])[1];
      if (prorcpSrc) {
        const cloudRes = await safeFetch(`https://cloudorchestranova.com${prorcpSrc}`, { headers: { 'referer': 'https://cloudorchestranova.com/', 'user-agent': clientUA } });
        const cloudHtml = cloudRes && cloudRes.ok ? await cloudRes.text() : '';
        const streamMatches = cloudHtml.match(/\/y5MMCbscf\/[a-zA-Z0-9_\-\/]+/g) || [];
        
        if (streamMatches.length > 0) {
          results.push({
            name: `${PROVIDER_ID} - Native Stream`,
            url: `https://horologyhollow.site${streamMatches[0]}/master.m3u8`,
            quality: toQualityLabel(1080),
            headers: { 'Referer': 'https://cloudorchestranova.com/', 'User-Agent': clientUA },
            provider: PROVIDER_ID
          });
        }
      }
    }

    // FIX 2: Solid API failover bypass if their client-side encryption blocks the scraper
    if (results.length === 0) {
      const resolverUrl = `https://vidsrc.stream/api/source/${imdbId}`;
      const apiRes = await safeFetch(resolverUrl);
      const apiData = apiRes && apiRes.ok ? await apiRes.json() : null;

      if (apiData && apiData.url) {
        results.push({
          name: `${PROVIDER_ID} - Auto Stream`,
          url: apiData.url, // Completely clean stream link with active session tokens embedded
          quality: toQualityLabel(1080),
          headers: { 'Referer': 'https://vsembed.ru/', 'User-Agent': clientUA },
          provider: PROVIDER_ID
        });
      }
    }

  } catch (err) {
    console.error("Stream acquisition failed:", err);
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
