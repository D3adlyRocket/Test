const cheerio = require('cheerio-without-node-native');
// toonstream.js
// Provider: Toonstream (https://toonstream.vip)

const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

async function getBaseUrl() {
  try {
    const domains = await (await fetch(DOMAINS_URL)).json();
    return domains.toonstream || "https://toonstream.vip";
  } catch (e) {
    return "https://toonstream.vip";
  }
}

function extractQuality(str) {
  const u = (str || '').toLowerCase();
  if (u.includes('2160p') || u.includes('4k')) return '4K';
  if (u.includes('1080p')) return '1080p';
  if (u.includes('720p')) return '720p';
  if (u.includes('480p')) return '480p';
  return 'Unknown';
}

/**
 * Decodes standard Dean Edwards P.A.C.K.E.R. obfuscated strings
 */
function unpackJS(packed) {
  try {
    const payload = packed.match(/^eval\(function\(p,a,c,k,e,d\)\{.*return\s+p\}.*\}\('(.*)',\s*(\d+),\s*(\d+),\s*'(.*)'\.split\('\|'\)\)\)$/);
    if (!payload) return packed;

    let [_, p, a, c, k] = payload;
    a = parseInt(a, 10);
    c = parseInt(c, 10);
    k = k.split('|');

    const e = (c) => (c < a ? '' : e(parseInt(c / a, 10))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36));

    while (c--) {
      if (k[c]) {
        p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]);
      }
    }
    return p;
  } catch (err) {
    return packed;
  }
}

/**
 * Pulls direct streams by checking plain HTML or evaluating packed JS datablocks
 */
async function extractDirectStream(embedUrl) {
  try {
    const response = await fetch(embedUrl, { headers: HEADERS });
    const html = await response.text();

    // 1. Try matching a straightforward, unencrypted m3u8 line first
    const m3u8Regex = /(https?:\/\/[^"']+\.m3u8[^"']*)/i;
    let match = html.match(m3u8Regex);
    if (match && match[1]) {
      return match[1].replace(/\\/g, '');
    }

    // 2. If missing, extract packed JS blocks and unpack them locally
    const packedRegex = /(eval\(function\(p,a,c,k,e,.*\)\))/g;
    const packedBlocks = html.match(packedRegex);

    if (packedBlocks) {
      for (const block of packedBlocks) {
        const unpackedText = unpackJS(block);
        match = unpackedText.match(m3u8Regex);
        if (match && match[1]) {
          return match[1].replace(/\\/g, '');
        }
      }
    }
  } catch (e) {
    console.error(`[Extractor] Error parsing target embed source: ${embedUrl}`, e);
  }
  return null;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const BASE_URL = await getBaseUrl();

    // 1. Get title from TMDB
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const mediaInfo = await (await fetch(tmdbUrl)).json();
    const title = mediaInfo.title || mediaInfo.name;
    if (!title) return [];

    // 2. Search Toonstream
    let searchHref = null;
    for (let i = 1; i <= 3; i++) {
      const searchUrl = `${BASE_URL}/page/${i}/?s=${encodeURIComponent(title)}`;
      const searchHtml = await (await fetch(searchUrl, { headers: HEADERS})).text();
      const $ = cheerio.load(searchHtml);
      const first = $('#movies-a > ul > li article > a').first().attr('href');
      if (first) {
        searchHref = first;
        break;
      }
    }

    if (!searchHref) return [];
    if (!searchHref.startsWith('http')) searchHref = BASE_URL + searchHref;

    // 3. Load the content page
    const pageHtml = await (await fetch(searchHref, { headers: HEADERS})).text();
    const $page = cheerio.load(pageHtml);

    const isSeries = searchHref.includes('series') || mediaType === 'tv';
    const streams = [];

    if (isSeries && season != null && episode != null) {
      // Get season/episode via AJAX
      const seasonElements = [];
      $page('div.aa-drp.choose-season > ul > li > a').each((_, el) => {
        const dataPost = $page(el).attr('data-post');
        const dataSeason = $page(el).attr('data-season');
        if (dataPost && dataSeason) {
          seasonElements.push({ dataPost, dataSeason });
        }
      });

      // Find the matching season
      const targetSeasonNum = String(season);
      let targetSeason = seasonElements.find(s => s.dataSeason === targetSeasonNum)
        || seasonElements[parseInt(season) - 1];

      if (targetSeason) {
        const ajaxResponse = await (await fetch(`${BASE_URL}/wp-admin/admin-ajax.php`, {
          method: 'POST',
          headers: {
            ...HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: `action=action_select_season&season=${targetSeason.dataSeason}&post=${targetSeason.dataPost}`})).text();

        const $season = cheerio.load(ajaxResponse);

        // Get all episode links
        const episodeLinks = [];
        $season('article').each((_, ep) => {
          const epHref = $season(ep).find('article > a').attr('href') || '';
          const epName = $season(ep).find('article > header.entry-header > h2').text();
          episodeLinks.push({ href: epHref, name: epName });
        });

        // Find target episode
        const targetEp = episodeLinks[parseInt(episode) - 1] || episodeLinks.find(e =>
          e.name.includes(`Episode ${episode}`) || e.name.includes(`Ep ${episode}`)
        );

        if (targetEp && targetEp.href) {
          const epPageHtml = await (await fetch(targetEp.href, { headers: HEADERS})).text();
          const $ep = cheerio.load(epPageHtml);

          // Extract iframes from servers
          const serverLinks = [];
          $ep('#aa-options > div > iframe').each((_, el) => {
            const src = $ep(el).attr('data-src');
            if (src) serverLinks.push(src);
          });

          for (const serverLink of serverLinks.slice(0, 3)) {
            try {
              const serverHtml = await (await fetch(serverLink, { headers: HEADERS})).text();
              const $server = cheerio.load(serverHtml);
              const trueLink = $server('iframe').attr('src') || '';
              
              if (trueLink) {
                const streamUrl = await extractDirectStream(trueLink);

                if (streamUrl) {
                  streams.push({
                    name: "Toonstream",
                    url: streamUrl,
                    quality: extractQuality(streamUrl),
                    title: 'Toonstream',
                    subtitles: [],
                    behaviorHints: {
                      notWebReady: false,
                      proxyHeaders: {
                        request: Object.assign({}, HEADERS, { "Referer": trueLink })
                      }
                    }
                  });
                }
              }
            } catch (e) { /* skip failed servers */ }
          }
        }
      }
    } else {
      // Movie - extract iframes directly
      const movieEmbedLinks = [];
      $page('#aa-options > div > iframe').each((_, el) => {
        const src = $page(el).attr('data-src');
        if (src) movieEmbedLinks.push(src);
      });

      for (const embedUrl of movieEmbedLinks) {
        const streamUrl = await extractDirectStream(embedUrl);
        if (streamUrl) {
          streams.push({
            name: "Toonstream",
            url: streamUrl,
            quality: extractQuality(streamUrl),
            title: 'Toonstream',
            subtitles: [],
            behaviorHints: {
              notWebReady: false,
              proxyHeaders: {
                request: Object.assign({}, HEADERS, { "Referer": embedUrl })
              }
            }
          });
        }
      }
    }

    return streams;

  } catch (e) {
    console.error('[Toonstream]', e);
    return [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
}
