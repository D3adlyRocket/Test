'use strict';

/**
 * HindMoviez — Android TV Optimized Version
 * Author › Sanchit (Refactored for Android TV Compatibility)
 */

const BASE_URL     = 'https://hindmovie.ltd';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const PLUGIN_TAG   = '[HindMoviez]';
const HM_WORKER    = 'https://hindmoviez.s4nch1tt.workers.dev';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// --- Helpers ---

function hmProxyUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  return HM_WORKER + '/hm/proxy?url=' + encodeURIComponent(rawUrl);
}

function fetchText(url) {
  return fetch(url, { headers: DEFAULT_HEADERS, redirect: 'follow' })
    .then(res => res.text())
    .catch(err => { console.log(PLUGIN_TAG + ' Error: ' + err.message); return null; });
}

function fetchJson(url) {
  return fetch(url).then(res => res.json()).catch(() => null);
}

// --- Regex Based Parsers (No Cheerio) ---

function parseArticles(html) {
  const results = [];
  const re = /<h2 class="entry-title"><a href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    results.push({ link: match[1], title: match[2].trim() });
  }
  return results;
}

function parseHeadingInfo(text) {
  const qualityMatch = text.match(/\b(4K|2160p|1080p|720p|480p)\b/i);
  const sizeMatch = text.match(/\[([0-9.]+\s*(?:MB|GB))\]/i);
  const is10bit = /\b10bit\b/i.test(text);
  
  const langs = [];
  ['Hindi', 'English', 'Tamil', 'Telugu', 'Multi'].forEach(l => {
    if (new RegExp(l, 'i').test(text)) langs.push(l);
  });

  return {
    quality: qualityMatch ? qualityMatch[1].toLowerCase() : '720p',
    size: sizeMatch ? sizeMatch[1] : '',
    languages: langs.join(' + '),
    is10bit: is10bit
  };
}

/**
 * Matches H3 headings and the subsequent mvlink button
 */
function parseDownloadButtons(html) {
  const buttons = [];
  // Split by H3 to associate metadata with the link following it
  const sections = html.split(/<h3[^>]*>/i);
  
  sections.forEach(section => {
    const headingText = section.split('</h3>')[0];
    const linkMatch = section.match(/href="(https:\/\/mvlink\.site\/[^"]+)"/i);
    
    if (linkMatch) {
      buttons.push({
        link: linkMatch[1],
        info: parseHeadingInfo(headingText)
      });
    }
  });
  return buttons;
}

function parseServerLinks(html) {
  const servers = {};
  const re = /<a[^>]*href="([^"]+)"[^>]*>(Server\s+\d+)<\/a>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    servers[match[2]] = match[1];
  }
  return servers;
}

// --- Logic ---

async function resolveChain(mvlinkUrl) {
  const mvHtml = await fetchText(mvlinkUrl);
  if (!mvHtml) return {};

  // Find hshare.ink
  const hshareMatch = mvHtml.match(/href="(https:\/\/hshare\.ink\/[^"]+)"/i);
  if (!hshareMatch) return {};

  const hshareHtml = await fetchText(hshareMatch[1]);
  if (!hshareHtml) return {};

  // Find hcloud "HPage"
  const hcloudMatch = hshareHtml.match(/href="([^"]+)"[^>]*>HPage<\/a>/i);
  if (!hcloudMatch) return {};

  const hcloudHtml = await fetchText(hcloudMatch[1]);
  return parseServerLinks(hcloudHtml || '');
}

async function getStreams(tmdbId, type, season, episode) {
  const isSeries = type === 'series' || type === 'tv';
  const tmdbUrl = `https://api.themoviedb.org/3/${isSeries ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
  
  const details = await fetchJson(tmdbUrl);
  if (!details) return [];

  const title = isSeries ? details.name : details.title;
  const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
  const searchHtml = await fetchText(searchUrl);
  const articles = parseArticles(searchHtml || '');

  if (!articles.length) return [];
  const pageHtml = await fetchText(articles[0].link);
  const buttons = parseDownloadButtons(pageHtml || '');

  const streams = [];

  for (const btn of buttons) {
    // If series, we'd need to filter by episode in the mvlink page 
    // This example resolves the first valid server found for brevity
    const servers = await resolveChain(btn.link);
    
    for (const [srvName, srvUrl] of Object.entries(servers)) {
      const info = btn.info;
      streams.push({
        name: `🎬 HindMoviez | ${srvName}`,
        title: `📺 ${info.quality} ${info.is10bit ? '10bit' : ''}\n🔊 ${info.languages}\n💾 ${info.size}\n@S4NCHITT`,
        url: hmProxyUrl(srvUrl),
        quality: info.quality,
        behaviorHints: { notWebReady: false }
      });
    }
  }

  return streams;
}

// Export for Nuvio
if (typeof module !== 'undefined') { module.exports = { getStreams }; } 
else { global.getStreams = getStreams; }
