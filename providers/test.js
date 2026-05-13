// providers/pinoyhub.js
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const BASE_URL = 'https://pinoymovieshub.win';
const TMDB_API_KEY = '6dc830f9624b43261325bed3bf7d0dfa';

// ------------------------------------------------------------------
// Default headers – update the cookie if it expires
// ------------------------------------------------------------------
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': BASE_URL,
  'Cookie': 'starstruck_7da72d90b632af60dd1158c068193d61=99f22538d0588cdd7ccfc783299f88a7'
};

// Headers used when playing the final video stream
const VIDEO_HEADERS = {
  'User-Agent': HEADERS['User-Agent'],
  'Referer': BASE_URL,
  'Accept': 'video/webm,video/ogg,video/*;q=0.9,*/*;q=0.5'
};

// ------------------------------------------------------------------
// Puppeteer browser instance (reused)
// ------------------------------------------------------------------
let browser = null;

/**
 * Extracts the first .m3u8 or .mp4 URL from a player page using headless Chrome.
 * Mimics the Python Selenium script exactly.
 */
async function extractMediaPuppeteer(pageUrl, timeoutMs = 15000) {
  try {
    if (!browser || !browser.isConnected()) {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-gpu', '--mute-audio']
      });
    }

    const page = await browser.newPage();

    // Prevent detection as headless (optional)
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    let mediaUrl = null;

    // Listen for network responses – capture any .m3u8 or .mp4
    page.on('response', (response) => {
      const url = response.url();
      if (/\.(m3u8|mp4)(\?|$)/i.test(url) && response.ok()) {
        mediaUrl = url;  // first match wins
      }
    });

    // Load the page and wait until network is mostly idle
    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: timeoutMs });

    // If no media request appeared, simulate video play and wait a bit
    if (!mediaUrl) {
      try {
        await page.evaluate(() => {
          const v = document.querySelector('video');
          if (v) v.play();
        });
      } catch (e) {}

      try {
        await page.waitForResponse(
          (res) => /\.(m3u8|mp4)(\?|$)/i.test(res.url()) && res.ok(),
          { timeout: 5000 }
        );
      } catch (e) {}
    }

    await page.close();
    return mediaUrl;  // null if nothing found
  } catch (err) {
    console.error(`[pinoyhub] Puppeteer extraction error for ${pageUrl}: ${err.message}`);
    return null;
  }
}

// ------------------------------------------------------------------
// Optional: static HTML extraction (fallback if Puppeteer fails)
// ------------------------------------------------------------------
async function extractDirectMediaUrl(pageUrl) {
  try {
    const res = await fetch(pageUrl, { headers: HEADERS, redirect: 'follow' });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Check <video> tag
    const videoSrc = $('video').attr('src');
    if (videoSrc && /\.(m3u8|mp4)/i.test(videoSrc)) return videoSrc;

    // Check <source> inside <video>
    const sourceSrc = $('video source[type*="video"]').attr('src');
    if (sourceSrc && /\.(m3u8|mp4)/i.test(sourceSrc)) return sourceSrc;

    // Look inside <script> tags
    const scripts = $('script').map((i, el) => $(el).html()).get();
    for (const script of scripts) {
      if (!script) continue;
      const match = script.match(/(["'])(https?:\/\/[^"']*\.(?:m3u8|mp4)[^"']*)\1/);
      if (match) return match[2];
    }

    return null;
  } catch (err) {
    return null;
  }
}

// ------------------------------------------------------------------
// General fetch helpers
// ------------------------------------------------------------------
async function fetchHTML(url) {
  try {
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    console.error(`[pinoyhub] fetch error ${url}:`, err.message);
    return null;
  }
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// Follow internal /links/... redirect to the final external URL
// ------------------------------------------------------------------
async function resolveInternalLink(linkUrl) {
  console.log(`[pinoyhub] Following internal link: ${linkUrl}`);
  try {
    const res = await fetch(linkUrl, { headers: HEADERS, redirect: 'follow' });
    const finalUrl = res.url;
    if (finalUrl !== linkUrl && !finalUrl.includes('pinoymovieshub.win')) {
      console.log(`[pinoyhub] Redirected to: ${finalUrl}`);
      return finalUrl;
    }
  } catch (err) {}
  return null;
}

// ------------------------------------------------------------------
// Extract download links from the page
// ------------------------------------------------------------------
function extractDownloadLinks(html) {
  const $ = cheerio.load(html);
  const table = $('#download .links_table table');
  if (!table.length) {
    console.log('[pinoyhub] Download table not found');
    return [];
  }

  const links = [];
  table.find('tbody tr').each((i, row) => {
    const cols = $(row).find('td');
    if (cols.length < 4) return;
    const a = $(cols[0]).find('a');
    if (!a.length) return;
    let url = a.attr('href');
    if (url && !url.startsWith('http')) url = BASE_URL + url;
    const quality = $(cols[1]).find('strong.quality').text().trim() || 'Unknown';
    const language = $(cols[2]).text().trim();
    links.push({ url, quality, language });
  });
  return links;
}

// ------------------------------------------------------------------
// TMDB helpers
// ------------------------------------------------------------------
async function fetchTitleFromTMDB(tmdbId, mediaType) {
  const endpoint = mediaType === 'tv'
    ? `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`
    : `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
  const data = await fetchJSON(endpoint);
  if (!data) return null;
  return mediaType === 'tv' ? (data.name || data.original_name) : (data.title || data.original_title);
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ------------------------------------------------------------------
// Main function – the addon calls this
// ------------------------------------------------------------------
async function getStreams(tmdbId, mediaType, season, episode) {
  console.log(`[pinoyhub] === START for ${mediaType} TMDB ID:${tmdbId} S${season}E${episode} ===`);

  try {
    const tmdbTitle = await fetchTitleFromTMDB(tmdbId, mediaType);
    if (!tmdbTitle) {
      console.log('[pinoyhub] TMDB title not found');
      return [];
    }
    console.log(`[pinoyhub] TMDB title: "${tmdbTitle}"`);

    let pageUrl, displayTitle;
    if (mediaType === 'movie') {
      const movieSlug = slugify(tmdbTitle);
      pageUrl = `${BASE_URL}/movies/${movieSlug}/`;
      displayTitle = tmdbTitle;
    } else {
      const seriesSlug = slugify(tmdbTitle);
      pageUrl = `${BASE_URL}/episodes/${seriesSlug}-${season}x${episode}/`;
      displayTitle = `${tmdbTitle} S${season}E${episode}`;
    }

    const html = await fetchHTML(pageUrl);
    if (!html) return [];

    const links = extractDownloadLinks(html);
    if (links.length === 0) return [];

    const streams = [];
    for (const link of links) {
      // Skip subtitle-only rows
      if (/subtitle/i.test(link.quality) || /subtitle/i.test(link.language)) {
        console.log(`[pinoyhub] Skipping subtitle row: ${link.quality} / ${link.language}`);
        continue;
      }

      console.log(`[pinoyhub] Processing ${link.quality} / ${link.language}: ${link.url}`);
      const externalUrl = await resolveInternalLink(link.url);
      if (!externalUrl) continue;

      // ---- New extraction logic ----
      let finalUrl = await extractMediaPuppeteer(externalUrl);   // 1. Try Puppeteer
      if (!finalUrl) {
        finalUrl = await extractDirectMediaUrl(externalUrl);     // 2. Fallback to static HTML
      }
      if (!finalUrl) {
        finalUrl = externalUrl;                                  // 3. Keep player page URL
      }

      streams.push({
        name: `PinoyHub - ${link.quality}`,
        title: `${displayTitle} [${link.language}]`,
        url: finalUrl,
        quality: link.quality,
        headers: finalUrl !== externalUrl
          ? { ...VIDEO_HEADERS, Referer: externalUrl }
          : VIDEO_HEADERS,
        provider: 'pinoyhub'
      });
    }

    console.log(`[pinoyhub] Returning ${streams.length} stream(s)`);
    return streams;

  } catch (err) {
    console.error('[pinoyhub] error:', err.message);
    return [];
  }
}

// Cleanup function (call it when your addon shuts down to close the browser)
async function close() {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('[pinoyhub] Puppeteer browser closed');
  }
}

module.exports = { getStreams, close };
