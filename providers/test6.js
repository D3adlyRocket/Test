const PROVIDER_NAME = 'OlaMovies 4K';
const BASE_URL = 'https://v3.olamovies.mov';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TIMEOUT = 15000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

async function fetchWithTimeout(url, options = {}, timeout = TIMEOUT) {
  const fetchOptions = { ...options };
  if (!fetchOptions.headers) fetchOptions.headers = HEADERS;
  return Promise.race([
    fetch(url, fetchOptions),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Request Timeout')), timeout))
  ]);
}

async function fetchText(url, options = {}) {
  try {
    const res = await fetchWithTimeout(url, options);
    if (res && res.ok) return await res.text();
    return null;
  } catch (err) {
    return null;
  }
}

async function fetchJson(url, options = {}) {
  try {
    const res = await fetchWithTimeout(url, options);
    if (res && res.ok) return await res.json();
    return null;
  } catch (err) {
    return null;
  }
}

async function getTMDBInfo(tmdbId, type) {
  const mediaType = (type === 'tv' || type === 'series') ? 'tv' : 'movie';
  let title = '';
  let year = '';
  try {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const data = await fetchJson(url);
    if (data) {
      title = data.title || data.name || '';
      const dateStr = data.release_date || data.first_air_date || '';
      year = dateStr.split('-')[0];
    }
  } catch (err) {}
  return { title, year, type: mediaType };
}

async function searchArticles(query, year, isTv, season) {
  const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const html = await fetchText(searchUrl);
  if (!html) return [];

  const articles = [];
  const linkRegex = /<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    let titleText = match[2].replace(/<[^>]+>/g, '').replace(/&#8211;/g, '-').replace(/&#038;/g, '&').trim();

    if (url.includes('/category/') || url.includes('/page/')) continue;

    if (!isTv && year && !titleText.includes(year)) {
      if (!titleText.toLowerCase().includes(query.toLowerCase())) continue;
    }

    if (isTv && season) {
      const seasonRegex = new RegExp(`(?:Season\\s*0*${season}|S0*${season}\\b)`, 'i');
      if (!seasonRegex.test(titleText) && !titleText.toLowerCase().includes('complete')) {
        continue;
      }
    }

    articles.push({ url, title: titleText });
  }

  return articles;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '--')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;/g, "'");
}

function extract4KStreams(articleHtml, articleUrl, tmdbInfo) {
  const streams = [];
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const seenUrls = new Set();

  while ((match = linkRegex.exec(articleHtml)) !== null) {
    const url = match[1].trim();
    const rawText = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, '').trim());

    if (!url.startsWith('http://') && !url.startsWith('https://')) continue;
    if (url.includes('olamovies.mov') || url.includes('google.com') || url.includes('telegram.me') || url.includes('t.me')) continue;

    // STRICT 4K FILTERING: Ensure the link is 4K / 2160p
    const is2160p = /2160p|\b4k\b/i.test(rawText);
    const isLowerQuality = /1080p|720p|480p/i.test(rawText);

    if (!is2160p || (isLowerQuality && !rawText.toLowerCase().includes('2160p'))) {
      continue;
    }

    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    const sizeMatch = rawText.match(/\[?(\d+(?:\.\d+)?\s*(?:GB|MB))\]?/i);
    const sizeStr = sizeMatch ? sizeMatch[1].toUpperCase() : 'N/A';

    const tags = [];
    if (/hdr10\+/i.test(rawText)) tags.push('⚡ HDR10+');
    else if (/hdr10/i.test(rawText)) tags.push('⚡ HDR10');
    else if (/hdr/i.test(rawText)) tags.push('⚡ HDR');

    if (/dv|dolby\s*vision/i.test(rawText)) tags.push('🕵️‍♀️ DV');
    if (/remux/i.test(rawText)) tags.push('💎 REMUX');
    if (/bluray/i.test(rawText)) tags.push('📀 BluRay');
    if (/web-dl|webrip/i.test(rawText)) tags.push('🌐 WEB-DL');
    if (/x265|hevc/i.test(rawText)) tags.push('🎥 HEVC x265');
    if (/10bit/i.test(rawText)) tags.push('🔆 10Bit');
    if (/atmos/i.test(rawText)) tags.push('🔊 Atmos');

    const tagStr = tags.length > 0 ? tags.join(' • ') : '🌟 4K UHD';

    streams.push({
      name: `${PROVIDER_NAME} | 2160P (4K)`,
      title: `🎬 ${tmdbInfo.title || 'Movie'} (${tmdbInfo.year || ''})\n🌟 2160P 4K UHD | 💾 ${sizeStr}\n${tagStr} |\n🔗 ${rawText}`,
      url: url,
      quality: '4K',
      size: sizeStr,
      behaviorHints: {
        notWebReady: true,
        proxyHeaders: {
          request: {
            Referer: articleUrl
          }
        }
      }
    });
  }

  return streams;
}

async function getStreams(tmdbId, type = 'movie', season = null, episode = null) {
  const streams = [];
  try {
    const isTv = (type === 'tv' || type === 'series');
    const tmdbInfo = await getTMDBInfo(tmdbId, type);
    if (!tmdbInfo.title) return streams;

    console.log(`[${PROVIDER_NAME}] Searching for: ${tmdbInfo.title} (${tmdbInfo.year})`);
    const articles = await searchArticles(tmdbInfo.title, tmdbInfo.year, isTv, season);

    for (const article of articles) {
      const articleHtml = await fetchText(article.url);
      if (!articleHtml) continue;

      const extracted = extract4KStreams(articleHtml, article.url, tmdbInfo);
      streams.push(...extracted);
    }
  } catch (err) {
    console.error(`[${PROVIDER_NAME}] Error fetching streams:`, err);
  }
  return streams;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}

// --- 4K ONLY WRAPPER WITH UNIVERSAL ID/TITLE BRIDGE (STRICTLY NO 1080P/720P/480P) ---
if (typeof getStreams === 'function') {
  const __origGetStreams = getStreams;
  getStreams = async function(...args) {
    try {
      let runArgs = [...args];
      // Safely unpack ID if passed as object from Nuvio sandbox
      if (runArgs.length > 0 && runArgs[0] && typeof runArgs[0] === 'object') {
        const obj = runArgs[0];
        runArgs[0] = obj.id || obj.imdb_id || obj.tmdb_id || obj.title || obj.query || runArgs[0];
        if (obj.type && !runArgs[1]) runArgs[1] = obj.type;
        if (obj.season && !runArgs[2]) runArgs[2] = obj.season;
        if (obj.episode && !runArgs[3]) runArgs[3] = obj.episode;
      }
      
      // For providers requiring specific TMDB/IMDB IDs when given a title or compound ID
      if (args.length > 0 && typeof runArgs[0] === 'string') {
        try {
          let rawId = runArgs[0].trim();
          let season = runArgs[2];
          let episode = runArgs[3];
          if (rawId.includes(':')) {
            const parts = rawId.split(':');
            rawId = parts[0];
            if (parts[1] && season == null) season = parseInt(parts[1], 10);
            if (parts[2] && episode == null) episode = parseInt(parts[2], 10);
          }
          const type = runArgs[1] || 'movie';
          const mediaType = (type === 'tv' || type === 'series') ? 'tv' : 'movie';
          
          // If OlaMovies or Cineby are given an IMDB ID (tt...), resolve to TMDB integer ID
          if (('olamovies' === 'olamovies' || 'olamovies' === 'cineby') && rawId.startsWith('tt')) {
            const res = await fetch('https://api.themoviedb.org/3/find/' + rawId + '?api_key=1865f43a0549ca50d341dd9ab8b29f49&external_source=imdb_id');
            const json = await res.json();
            if (json && json.movie_results && json.movie_results.length > 0 && mediaType === 'movie') {
              runArgs[0] = json.movie_results[0].id.toString();
            } else if (json && json.tv_results && json.tv_results.length > 0 && mediaType === 'tv') {
              runArgs[0] = json.tv_results[0].id.toString();
              if (season != null) runArgs[2] = season;
              if (episode != null) runArgs[3] = episode;
            }
          }
          // If given a plain text string title instead of an ID, resolve via TMDB search
          else if (!rawId.startsWith('tt') && !/^\d+$/.test(rawId)) {
            const res = await fetch('https://api.themoviedb.org/3/search/' + mediaType + '?api_key=1865f43a0549ca50d341dd9ab8b29f49&query=' + encodeURIComponent(rawId));
            const json = await res.json();
            if (json && json.results && json.results.length > 0) {
              const matchedId = json.results[0].id.toString();
              if ('olamovies' === 'olamovies' || 'olamovies' === 'cineby') {
                runArgs[0] = matchedId;
              }
            }
          }
        } catch (err) {}
      }
      
      const results = await __origGetStreams(...runArgs);
      if (!Array.isArray(results)) return [];
      
      return results.filter(s => {
        if (!s || !s.url) return false;
        const q = (s.quality || s.resolution || '').toString().toUpperCase();
        const str = ((s.name || '') + ' ' + (s.title || '') + ' ' + (s.qualityTag || '')).toUpperCase();
        
        // Strictly eliminate 1080p, 720p, 480p, SD, or lower resolutions
        if (q === '1080P' || q === '720P' || q === '480P' || q === '1080' || q === '720' || q === '480' || /\b(1080P|720P|480P|360P|240P|1080|720|480|FHD)\b/.test(str)) {
          return false;
        }
        
        // Keep ONLY 4K (2160p) streams
        const is2160 = q === '4K' || q === '2160P' || q === '2160' || q === 'UHD' || str.includes('2160P') || /\b(4K|2160|UHD|REMUX)\b/.test(str);
        return is2160;
      });
    } catch (e) {
      return [];
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { getStreams };
  if (typeof global !== 'undefined') global.getStreams = getStreams;
}
