'use strict';

/**
 * Android TV Optimized Version
 * Removes Node.js native dependencies and uses TV-safe parsing.
 */

const cheerio = require('cheerio-without-node-native');

const BASE_URL     = 'https://hindmovie.ltd';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const HM_WORKER    = 'https://hindmoviez.s4nch1tt.workers.dev';

// Standard TV Headers
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; BRAVIA 4K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
};

// ─────────────────────────────────────────────────────────────────────────────
// TV-Safe Logic
// ─────────────────────────────────────────────────────────────────────────────

async function getStreams(tmdbId, type, season, episode) {
  try {
    // 1. Get Title from TMDB (Using standard fetch, no node-fetch)
    const tmdbResponse = await fetch(`https://api.themoviedb.org/3/${type === 'movie' ? 'movie' : 'tv'}/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const details = await tmdbResponse.json();
    if (!details) return [];

    const query = details.title || details.name;
    
    // 2. Search HindMoviez
    const searchRes = await fetch(`${BASE_URL}/?s=${encodeURIComponent(query)}`, { headers: HEADERS });
    const searchHtml = await searchRes.text();
    
    // Using Cheerio only for high-level selection to avoid memory leaks on TV
    const $ = cheerio.load(searchHtml);
    const pageUrl = $('article h2.entry-title a').first().attr('href');
    if (!pageUrl) return [];

    // 3. Parse Movie/Series Page
    const pageRes = await fetch(pageUrl, { headers: HEADERS });
    const pageHtml = await pageRes.text();
    const $p = cheerio.load(pageHtml);
    
    const streams = [];
    const linkGroups = [];

    // Map headings to mvlink buttons
    $p('h3').each((i, el) => {
      const headingText = $p(el).text();
      const nextLink = $p(el).nextUntil('h3').find('a[href*="mvlink.site"]').attr('href');
      if (nextLink) {
        linkGroups.push({ url: nextLink, label: headingText });
      }
    });

    // 4. Resolve Links (One by one to avoid TV CPU overload)
    for (const group of linkGroups.slice(0, 4)) {
      const mvRes = await fetch(group.url, { headers: HEADERS });
      const mvHtml = await mvRes.text();
      const $mv = cheerio.load(mvHtml);
      
      let target = null;
      if (type === 'movie') {
        // Fallback for "Get Links" text or direct hshare links
        target = $mv('a:contains("Get Links")').attr('href') || $mv('a[href*="hshare"]').attr('href');
      } else {
        // Specific Episode matching
        const epNum = String(episode).padStart(2, '0');
        $mv('a').each((i, a) => {
          if ($mv(a).text().includes('Episode ' + epNum)) {
            target = $mv(a).attr('href');
          }
        });
      }

      if (target) {
        // Final Formatting for Nuvio TV UI
        streams.push({
          name: "🎬 HindMoviez",
          title: `📺 ${group.label.split(']').pop().trim()}\nDirect via Proxy`,
          url: `${HM_WORKER}/hm/proxy?url=${encodeURIComponent(target)}`,
          behaviorHints: {
            notWebReady: false,
            proxyHeaders: {
              "Referer": "https://hcloud.to/",
              "User-Agent": HEADERS['User-Agent']
            }
          }
        });
      }
    }

    return streams;

  } catch (error) {
    // Return empty array instead of crashing the TV app
    console.log("TV App Error: ", error.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export (Strictly Browser/TV Compatible)
// ─────────────────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  // This is the important part for TV WebViews
  self.getStreams = getStreams;
}
