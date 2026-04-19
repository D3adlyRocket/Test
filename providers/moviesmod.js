'use strict';
const cheerio = require('cheerio-without-node-native');

const BASE_URL = 'https://hindmovie.ltd';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const HM_WORKER = 'https://hindmoviez.s4nch1tt.workers.dev';

async function getStreams(tmdbId, type, season, episode) {
  try {
    // 1. Fetch TMDB info via specific endpoint to avoid TV search lag
    const tmdbRes = await fetch(`https://api.themoviedb.org/3/${type === 'movie' ? 'movie' : 'tv'}/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const details = await tmdbRes.json();
    const query = details.title || details.name;

    // 2. Search using simple fetch (Avoids fancy headers that crash some TV WebViews)
    const searchRes = await fetch(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
    const searchHtml = await searchRes.text();
    const $ = cheerio.load(searchHtml);
    const pageUrl = $('article h2.entry-title a').first().attr('href');
    if (!pageUrl) return [];

    // 3. Extract Links
    const pageRes = await fetch(pageUrl);
    const pageHtml = await pageRes.text();
    const $p = cheerio.load(pageHtml);
    const streams = [];

    // HindMoviez specifically uses H3 for quality labels
    const headings = $p('.entry-content h3').toArray();
    for (const h of headings) {
      const label = $p(h).text();
      const mvlink = $p(h).nextUntil('h3').find('a[href*="mvlink.site"]').attr('href');
      
      if (mvlink) {
        // Resolve target (Limited to first match for speed on TV)
        const mvRes = await fetch(mvlink);
        const mvHtml = await mvRes.text();
        const $mv = cheerio.load(mvHtml);
        
        let target = type === 'movie' 
          ? $mv('a:contains("Get Links")').attr('href') 
          : $mv(`a:contains("Episode ${episode}")`).attr('href');

        if (target) {
          // Cloudflare Worker handles the rest
          streams.push({
            name: "🎬 HindMoviez TV",
            title: `📺 ${label.split(']').pop().trim()}\nDirect Stream via Proxy`,
            url: `${HM_WORKER}/hm/proxy?url=${encodeURIComponent(target)}`,
            behaviorHints: {
              notWebReady: false,
              proxyHeaders: { "Referer": "https://hcloud.to/" }
            }
          });
        }
      }
    }
    return streams;
  } catch (e) {
    return [];
  }
}

module.exports = { getStreams };
