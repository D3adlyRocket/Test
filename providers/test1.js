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
 * Replicates the network resolution pipeline to extract the dynamic play tokens
 */
async function resolveCloudnestraStreams(imdbId, mediaType, seasonNum, episodeNum) {
  const results = [];
  const clientUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  try {
    // Step 1: Hit the entry point domain verified via DevTools Console
    const embedUrl = mediaType === 'tv'
      ? `https://vsembed.ru/embed/tv?imdb=${encodeURIComponent(imdbId)}&season=${Number(seasonNum || 1)}&episode=${Number(episodeNum || 1)}`
      : `https://vsembed.ru/embed/${encodeURIComponent(imdbId)}`;

    const embedRes = await safeFetch(embedUrl, { headers: { 'User-Agent': clientUA } });
    const embedHtml = embedRes && embedRes.ok ? await embedRes.text() : '';

    // Step 2: Extract the inner player_iframe route
    const iframeSrcMatch = embedHtml.match(/src=["']([^"']+\/rcp\/[^"']+)["']/i) || 
                           embedHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    
    let iframeSrc = iframeSrcMatch ? iframeSrcMatch[1] : null;
    if (!iframeSrc) return [];
    if (!iframeSrc.startsWith('http')) iframeSrc = `https:${iframeSrc}`;

    // Step 3: Isolate the NGMx... initialization directory segment
    const tokenParam = iframeSrc.split('/rcp/')[1] || iframeSrc.split('/').pop();
    if (!tokenParam || tokenParam.length < 20) return [];

    // Step 4: Force query execution against the target internal backend controller
    const processingUrl = `https://cloudorchestranova.com/prorcp/${tokenParam}`;
    const processingRes = await safeFetch(processingUrl, { 
      headers: { 
        'Referer': `https://cloudorchestranova.com/rcp/${tokenParam}`,
        'Origin': 'https://cloudorchestranova.com',
        'User-Agent': clientUA 
      } 
    });
    const processingHtml = processingRes && processingRes.ok ? await processingRes.text() : '';

    // Step 5: Extract the inflated stream token string (H4sIAAAAA...) from the layout script
    // This matches any character string assigned following the playlist layout markers
    const complexTokenMatch = processingHtml.match(/\/y5MMCbscf\/pl\/([a-zA-Z0-9_\-\+=.]+)/) || 
                              processingHtml.match(/["'](H4sIAAAAA[^"']+)["']/);

    let finalPlayToken = complexTokenMatch ? complexTokenMatch[1] : null;

    // Fallback if the string is clean inside text arrays
    if (!finalPlayToken) {
      const longStringRegex = /H4sIAAAAA[a-zA-Z0-9_\-\+=.]+/g;
      const foundStrings = processingHtml.match(longStringRegex) || [];
      if (foundStrings.length > 0) {
        finalPlayToken = foundStrings[0];
      }
    }

    if (!finalPlayToken) return [];

    // Step 6: Assemble the complete destination manifest URI
    const targetStreamUrl = `https://horologyhollow.site/y5MMCbscf/pl/${finalPlayToken}/master.m3u8`;

    results.push({
      name: `${PROVIDER_ID} - High Definition`,
      url: targetStreamUrl,
      quality: toQualityLabel(1080),
      headers: {
        'Referer': 'https://cloudorchestranova.com/',
        'Origin': 'https://cloudorchestranova.com',
        'User-Agent': clientUA
      },
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
    console.error("Extraction routing failed:", err);
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
