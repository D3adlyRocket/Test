'use strict';

const cheerio = require('cheerio-without-node-native');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL     = 'https://hindmovie.ltd';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const PLUGIN_TAG   = '[HindMoviez-TV]';
const HM_WORKER    = 'https://hindmoviez.s4nch1tt.workers.dev';

// Standard TV headers to bypass bot protection
const TV_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; BRAVIA 4K VH2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive'
};

// ─────────────────────────────────────────────────────────────────────────────
// DNS-Safe Smart Fetch
// ─────────────────────────────────────────────────────────────────────────────

async function smartFetch(url, customHeaders = {}) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10s strict timeout for TV

    const response = await fetch(url, {
      headers: { ...TV_HEADERS, ...customHeaders },
      redirect: 'follow',
      signal: controller.signal
    });
    
    clearTimeout(id);
    const text = await response.text();
    return { html: text, finalUrl: response.url };
  } catch (err) {
    console.log(`${PLUGIN_TAG} Fetch Failure [${url.slice(0, 30)}...]: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scraper Logic
// ─────────────────────────────────────────────────────────────────────────────

async function getStreams(tmdbId, type, season, episode) {
  // Get content details
  const tmdbUrl = `https://api.themoviedb.org/3/${type === 'movie' ? 'movie' : 'tv'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
  const tmdbRes = await smartFetch(tmdbUrl);
  if (!tmdbRes) return [];
  const details = JSON.parse(tmdbRes.html);

  const query = details.title || details.name;
  console.log(`${PLUGIN_TAG} Target: ${query}`);

  // Search HindMoviez
  const search = await smartFetch(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
  if (!search) return [];

  const $ = cheerio.load(search.html);
  const pageUrl = $('article h2.entry-title a').first().attr('href');
  if (!pageUrl) return [];

  // Parse Main Page
  const mainPage = await smartFetch(pageUrl);
  if (!mainPage) return [];
  const $mp = cheerio.load(mainPage.html);
  
  const streams = [];
  const candidates = [];

  // Identify all mvlink buttons
  $mp('a[href*="mvlink.site"]').each((i, el) => {
    const link = $mp(el).attr('href');
    const context = $mp(el).closest('div, p').prevAll('h3').first().text() || 'Standard Quality';
    candidates.push({ link, context });
  });

  // Limit concurrency for TV CPUs (max 3 at a time)
  for (const item of candidates.slice(0, 5)) { 
    const mvPage = await smartFetch(item.link);
    if (!mvPage) continue;

    const $mv = cheerio.load(mvPage.html);
    let target = null;

    if (type === 'movie') {
      target = $mv('a:contains("Get Links")').attr('href') || $mv('a[href*="hshare"]').attr('href');
    } else {
      const epRegex = new RegExp(`Episode\\s*0?${episode}\\b`, 'i');
      $mv('a').each((i, a) => {
        if (epRegex.test($mv(a).text())) target = $mv(a).attr('href');
      });
    }

    if (!target) continue;

    // Direct HCloud resolving
    const hshare = await smartFetch(target);
    if (!hshare) continue;
    
    const hcloudMatch = hshare.html.match(/https?:\/\/hcloud\.[^\s"']+/);
    if (hcloudMatch) {
      const hcloud = await smartFetch(hcloudMatch[0]);
      if (!hcloud) continue;
      const $hc = cheerio.load(hcloud.html);

      $hc('a[id^="download-btn"]').each((i, srv) => {
        const streamUrl = $hc(srv).attr('href');
        if (!streamUrl) return;

        streams.push({
          name: `🎬 HindMoviez | S${i + 1}`,
          title: `📺 ${item.context.split('|')[0].trim()}\n🔗 Direct Stream via Cloudflare`,
          url: `${HM_WORKER}/hm/proxy?url=${encodeURIComponent(streamUrl)}`,
          behaviorHints: {
            notWebReady: false,
            proxyHeaders: {
              "Referer": "https://hcloud.to/",
              "Origin": "https://hcloud.to",
              "User-Agent": TV_HEADERS['User-Agent']
            }
          }
        });
      });
    }
  }

  return streams;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
