/**
 * Videasy Scraper - HF Space Version
 * v2.7.1-worker-only-no-token
 */

const DECRYPT_API = 'https://enc-dec.app/api/dec-videasy';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://player.videasy.to',
  'Referer': 'https://player.videasy.to/'
};

const PLAYBACK_HEADERS = {
  'Referer': 'https://player.videasy.to/',
  'User-Agent': HEADERS['User-Agent']
};

const PROXY_BASE = 'https://prox-videasy-hf.python-hacking19.workers.dev/proxy';

const SERVERS = {
  Yoru:   { path: '/cdn/sources-with-title', legacyFormat: true },
  MbFlix: { path: '/mb-flix/sources-with-title' },
};

const TIMEOUT_HTTP_FETCH  = 20000;
const TIMEOUT_RESOLVE_URL = 15000;
const TIMEOUT_TMDB        = 12000;

const EXCLUDED_QUALITIES = ['360P', '240P', '144P'];

async function httpFetch(url, options = {}, timeoutMs = TIMEOUT_HTTP_FETCH) {
  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs)
    });

    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      headers: response.headers,
      text: async () => text,
      json: async () => {
        try {
          return JSON.parse(text);
        } catch (e) {
          return {};
        }
      }
    };
  } catch (err) {
    console.warn(`[VIDEASY] httpFetch failed for ${url}: ${err?.message || err}`);
    return {
      ok: false,
      status: 0,
      url,
      headers: new Headers(),
      text: async () => '',
      json: async () => ({})
    };
  }
}

function isHttpUrl(url) {
  return typeof url === 'string' && /^https?:///i.test(url);
}

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function looksLikeDirectMedia(url) {
  const clean = String(url || '').toLowerCase().split('?')[0].split('#')[0];
  return clean.endsWith('.m3u8') || clean.endsWith('.mp4') || clean.endsWith('.mpd');
}

function shouldResolveUrl(url) {
  if (!isHttpUrl(url)) return false;
  if (looksLikeDirectMedia(url)) return false;

  const lower = url.toLowerCase();
  return (
    lower.includes('/e/') ||
    lower.includes('/embed') ||
    lower.includes('playlist') ||
    lower.includes('source') ||
    lower.includes('play') ||
    lower.includes('stream') ||
    lower.includes('redirect')
  );
}

async function resolveFinalUrl(url, timeoutMs = TIMEOUT_RESOLVE_URL) {
  if (!shouldResolveUrl(url)) return url;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: PLAYBACK_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs)
    });
    return res.url || url;
  } catch (e) {
    return url;
  }
}

function getQualityRank(quality) {
  const value = String(quality || 'Auto').toUpperCase();
  if (value === '4K' || value === '2160P') return 7;
  if (value === '1440P') return 6;
  if (value === '1080P' || value === 'FHD') return 5;
  if (value === '720P' || value === 'HD') return 4;
  if (value === '576P') return 3;
  if (value === '480P' || value === 'SD') return 2;
  if (value === '360P') return 1;
  return 0;
}

function sanitizeTitle(title) {
  return String(title || '')
    .replace(/'/g, '')
    .replace(/"/g, '')
    .replace(/[^\w\s\-.,:&]/g, '') // ✅ DIPERBAIKI
    .replace(/\s+/g, ' ')
    .trim();
}

function encodeTitle(title) {
  return encodeURIComponent(encodeURIComponent(sanitizeTitle(title)));
}

function buildStreamObject(serverName, source, finalUrl) {
  const quality = source.quality || 'Auto';

  return {
    name: `VIDEASY | Xyr0nX [${serverName.toUpperCase()}]`,
    title: `Videasy | ${quality} | Server ${serverName}`,
    url: finalUrl,
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: {
        request: {
          Referer: PLAYBACK_HEADERS.Referer,
          'User-Agent': PLAYBACK_HEADERS['User-Agent']
        }
      },
      bingeGroup: `videasy-${serverName.toLowerCase()}-${String(quality).toLowerCase()}`
    }
  };
}

async function decryptSources(encryptedText, mediaId) {
  const decryptedResponse = await httpFetch(DECRYPT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encryptedText, id: mediaId })
  }, TIMEOUT_HTTP_FETCH);

  const rawText = await decryptedResponse.text();
  if (!rawText) return [];

  try {
    const decrypted = JSON.parse(rawText);
    const result = decrypted.result || decrypted;
    if (!result || !Array.isArray(result.sources)) return [];
    return result.sources;
  } catch (e) {
    return [];
  }
}

async function fetchServerSources(serverName, config, details, season, episode) {
  const startTime = Date.now();
  const encodedTitle = encodeTitle(details.title);

  console.log(`[VIDEASY] Server ${serverName}: query title="${sanitizeTitle(details.title)}"`);

  if (!PROXY_BASE) {
    console.warn('[VIDEASY] PROXY_BASE kosong, skip proxy');
    return [];
  }

  const proxiedUrl = new URL(`${PROXY_BASE}${config.path}`);
  proxiedUrl.searchParams.set('title', encodedTitle);
  proxiedUrl.searchParams.set('mediaType', details.type);
  proxiedUrl.searchParams.set('year', details.year || '');
  proxiedUrl.searchParams.set('tmdbId', details.id || '');
  proxiedUrl.searchParams.set('imdbId', details.imdbId || '');

  if (details.type === 'tv') {
    proxiedUrl.searchParams.set('seasonId', season);
    proxiedUrl.searchParams.set('episodeId', episode);
  }

  const encryptedResponse = await httpFetch(proxiedUrl.toString(), {
    headers: { ...HEADERS }
  }, TIMEOUT_HTTP_FETCH);

  const encryptedText = await encryptedResponse.text();

  if (!encryptedResponse.ok || !encryptedText || encryptedText.length < 20 || encryptedText.startsWith('<!')) {
    console.warn(`[VIDEASY] Server ${serverName}: respons tidak valid (status ${encryptedResponse.status})`);
    return [];
  }

  const sources = await decryptSources(encryptedText, details.id);
  if (!sources.length) {
    console.warn(`[VIDEASY] Server ${serverName}: decrypt menghasilkan 0 source`);
    return [];
  }

  const resolvedStreams = await Promise.all(
    sources.map(async (source) => {
      if (!source || !isHttpUrl(source.url)) return null;

      const candidateUrl = normalizeUrl(source.url);
      const finalUrl = normalizeUrl(await resolveFinalUrl(candidateUrl, TIMEOUT_RESOLVE_URL));
      if (!isHttpUrl(finalUrl)) return null;

      return buildStreamObject(serverName, source, finalUrl);
    })
  );

  const valid = resolvedStreams.filter(Boolean);
  const elapsed = Date.now() - startTime;
  console.log(`[VIDEASY] Server ${serverName}: ${valid.length} stream ditemukan (${elapsed}ms)`);

  return valid;
}

function dedupeStreams(streams) {
  const seen = new Set();

  return streams.filter((item) => {
    if (!item || !isHttpUrl(item.url)) return false;

    const quality = item.title?.match(/Videasys|s([^|]+)s|/)?.[1] || 'Auto';
    if (EXCLUDED_QUALITIES.includes(quality.toUpperCase())) {
      console.log(`[VIDEASY] Skip stream kualitas ${quality} (filtered)`);
      return false;
    }

    const cleanUrl = item.url.split('?')[0].split('#')[0].replace(/\/+$/, '');
    const key = `${cleanUrl}|${quality}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortStreams(streams) {
  return streams.sort((a, b) => {
    const qa = a.title?.match(/Videasys|s([^|]+)s|/)?.[1] || 'Auto';
    const qb = b.title?.match(/Videasys|s([^|]+)s|/)?.[1] || 'Auto';
    return getQualityRank(qb) - getQualityRank(qa);
  });
}

async function resolveDetailsFromVideasyDb(imdbIdReq, isTv) {
  const findUrl = `https://db.videasy.to/3/find/${imdbIdReq}?external_source=imdb_id&language=en`;

  const findResponse = await httpFetch(findUrl, {
    headers: {
      'Origin': 'https://player.videasy.to',
      'Referer': 'https://player.videasy.to/'
    }
  }, TIMEOUT_TMDB);

  if (!findResponse.ok) return null;

  const data = await findResponse.json();

  const mediaData = isTv
    ? (data?.tv_results?.[0] || data?.tv_episode_results?.[0])
    : data?.movie_results?.[0];

  if (!mediaData) return null;

  return {
    id: String(mediaData.id),
    title: mediaData.title || mediaData.name || '',
    year: (mediaData.release_date || mediaData.first_air_date || mediaData.air_date || '').split('-')[0],
    imdbId: imdbIdReq,
    type: isTv ? 'tv' : 'movie'
  };
}

async function getStreams(providedId, mediaType, season, episode) {
  if (!providedId) return [];

  const isTv = mediaType === 'tv' || mediaType === 'series';
  if (isTv && (season == null || episode == null)) return [];

  const imdbIdReq = String(providedId).startsWith('tt')
    ? String(providedId)
    : `tt${providedId}`;

  try {
    let details = await resolveDetailsFromVideasyDb(imdbIdReq, isTv);

    if (!details) {
      details = {
        id: '',
        title: '',
        year: '',
        imdbId: imdbIdReq,
        type: isTv ? 'tv' : 'movie'
      };
    }

    const results = await Promise.all(
      Object.entries(SERVERS).map(([serverName, config]) =>
        fetchServerSources(serverName, config, details, season, episode)
          .catch(() => [])
      )
    );

    const allStreams = results.flat();
    if (!allStreams.length) return [];

    return sortStreams(dedupeStreams(allStreams));
  } catch (err) {
    console.error('[VIDEASY] Fatal Error:', err?.message || err);
    return [];
  }
}

module.exports = { getStreams };
