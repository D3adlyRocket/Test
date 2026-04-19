'use strict';

const cheerio = require('cheerio-without-node-native');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL     = 'https://hindmovie.ltd';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const PLUGIN_TAG   = '[HindMoviez-TV]';

// Cloudflare Worker proxy (Essential for Android TV range/seek support)
const HM_WORKER = 'https://hindmoviez.s4nch1tt.workers.dev';

function hmProxyUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  return HM_WORKER + '/hm/proxy?url=' + encodeURIComponent(rawUrl);
}

// Android TV needs very specific headers to avoid being flagged as a "bot" or "unsupported player"
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Referer': BASE_URL + '/',
  'Origin': BASE_URL
};

// ─────────────────────────────────────────────────────────────────────────────
// Robust Fetcher (Handles TV Timeout/CORS)
// ─────────────────────────────────────────────────────────────────────────────

async function smartFetch(url) {
  try {
    const res = await fetch(url, {
      headers: DEFAULT_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(12000) // TV's can be slow, 12s timeout
    });
    const text = await res.text();
    return { html: text, finalUrl: res.url };
  } catch (e) {
    console.log(`${PLUGIN_TAG} Fetch Error: ${e.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Logic
// ─────────────────────────────────────────────────────────────────────────────

async function getStreams(tmdbId, type, season, episode) {
  // 1. Get Title from TMDB
  const tmdbRes = await fetch(`https://api.themoviedb.org/3/${type === 'movie' ? 'movie' : 'tv'}/${tmdbId}?api_key=${TMDB_API_KEY}`);
  const details = await tmdbRes.json();
  if (!details) return [];

  const query = details.title || details.name;
  console.log(`${PLUGIN_TAG} Searching TV: ${query}`);

  // 2. Search HindMoviez
  const searchResult = await smartFetch(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
  if (!searchResult) return [];

  const $ = cheerio.load(searchResult.html);
  const pageUrl = $('article h2.entry-title a').first().attr('href');
  if (!pageUrl) return [];

  // 3. Parse Download Page
  const page = await smartFetch(pageUrl);
  if (!page) return [];
  const $p = cheerio.load(page.html);
  
  const streams = [];
  const links = [];

  // Match H3 headings to their buttons
  $p('.entry-content h3').each((i, el) => {
    const title = $p(el).text();
    const btn = $p(el).nextUntil('h3').find('a[href*="mvlink.site"]').attr('href');
    if (btn) links.push({ url: btn, meta: title });
  });

  // 4. Resolve Chains (Parallel)
  await Promise.all(links.map(async (item) => {
    const mv = await smartFetch(item.url);
    if (!mv) return;

    const $mv = cheerio.load(mv.html);
    let targetUrl = null;

    // Series handling
    if (type !== 'movie') {
      const epMatch = new RegExp(`Episode\\s*0?${episode}\\b`, 'i');
      $mv('a').each((i, a) => {
        if (epMatch.test($mv(a).text())) targetUrl = $mv(a).attr('href');
      });
    } else {
      targetUrl = $mv('a:contains("Get Links")').attr('href') || $mv('a[href*="hshare"]').attr('href');
    }

    if (!targetUrl) return;

    // Resolve final Cloud-Server link
    const hshare = await smartFetch(targetUrl);
    if (!hshare) return;
    const hcloudUrl = hshare.html.match(/https?:\/\/hcloud\.[^\s"']+/);
    
    if (hcloudUrl) {
      const finalPage = await smartFetch(hcloudUrl[0]);
      if (!finalPage) return;
      const $f = cheerio.load(finalPage.html);

      $f('a[id^="download-btn"]').each((i, srv) => {
        const directUrl = $f(srv).attr('href');
        streams.push({
          name: `🎬 HindMoviez | Server ${i+1}`,
          title: `📺 ${item.meta.split(' ').slice(-3).join(' ')}\nDirect Stream (TV Optimized)`,
          url: hmProxyUrl(directUrl),
          behaviorHints: {
            notWebReady: false,
            proxyHeaders: {
              "User-Agent": DEFAULT_HEADERS["User-Agent"],
              "Referer": "https://hcloud.to/"
            }
          }
        });
      });
    }
  }));

  return streams;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
