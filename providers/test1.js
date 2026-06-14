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
 * Unpacks standard JavaScript obfuscated code configurations
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
 * Follows internal router links, handles page redirects, and extracts tokenized streams
 */
async function extractDirectStream(embedUrl) {
  try {
    // 1. Follow potential server-side redirects to find the destination player domain
    const response = await fetch(embedUrl, { 
      headers: HEADERS,
      redirect: 'follow' 
    });
    
    const finalUrl = response.url;
    const html = await response.text();

    // 2. Scan for complete tokenized m3u8 playlist queries
    const m3u8Regex = /(https?:\/\/[^"']+\.m3u8\?[^"']+)/i;
    let match = html.match(m3u8Regex);
    
    if (match && match[1]) {
      return { url: match[1].replace(/\\/g, ''), referer: finalUrl };
    }

    // 3. Fallback to parsing packed script data blocks
    const packedRegex = /(eval\(function\(p,a,c,k,e,.*\)\))/g;
    const packedBlocks = html.match(packedRegex);

    if (packedBlocks) {
      for (const block of packedBlocks) {
        const unpackedText = unpackJS(block);
        match = unpackedText.match(m3u8Regex);
        if (match && match[1]) {
          return { url: match[1].replace(/\\/g, ''), referer: finalUrl };
        }
        
        // If the stream block doesn't use a query parameter string fallback to a standard match
        const standardM3u8Regex = /(https?:\/\/[^"']+\.m3u8[^"']*)/i;
        const fallbackMatch = unpackedText.match(standardM3u8Regex);
        if (fallbackMatch && fallbackMatch[1]) {
          return { url: fallbackMatch[1].replace(/\\/g, ''), referer: finalUrl };
        }
      }
    }
  } catch (e) {
    console.error(`[Extractor Error] Failed parsing stream endpoint: ${embedUrl}`, e);
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

          // Extract loops across active internal tabs
          const serverLinks = [];
          $ep('#aa-options > div > iframe').each((_, el) => {
            let src = $ep(el).attr('data-src') || $ep(el).attr('src');
            if (src) {
              if (src.startsWith('//')) src = 'https:' + src;
              if (src.startsWith('/')) src = BASE_URL + src;
              serverLinks.push(src);
            }
          });

          for (const serverLink of serverLinks) {
            try {
              // Extract the functional streaming path along with its authorization referer header context
              const streamData = await extractDirectStream(serverLink);

              if (streamData && streamData.url) {
                streams.push({
                  name: "Toonstream",
                  url: streamData.url,
                  quality: extractQuality(streamData.url),
                  title: 'Toonstream',
                  subtitles: [],
                  behaviorHints: {
                    notWebReady: false,
                    proxyHeaders: {
                      request: Object.assign({}, HEADERS, { 
                        "Referer": streamData.referer,
                        "Origin": new URL(streamData.referer).origin
                      })
                    }
                  }
                });
              }
            } catch (e) { /* skip failed servers */ }
          }
        }
      }
    } else {
      // Movie - extract options directly
      const movieEmbedLinks = [];
      $page('#aa-options > div > iframe').each((_, el) => {
        let src = $page(el).attr('data-src') || $page(el).attr('src');
        if (src) {
          if (src.startsWith('//')) src = 'https:' + src;
          if (src.startsWith('/')) src = BASE_URL + src;
          movieEmbedLinks.push(src);
        }
      });

      for (const embedUrl of movieEmbedLinks) {
        const streamData = await extractDirectStream(embedUrl);
        if (streamData && streamData.url) {
          streams.push({
            name: "Toonstream",
            url: streamData.url,
            quality: extractQuality(streamData.url),
            title: 'Toonstream',
            subtitles: [],
            behaviorHints: {
              notWebReady: false,
              proxyHeaders: {
                request: Object.assign({}, HEADERS, { 
                  "Referer": streamData.referer,
                  "Origin": new URL(streamData.referer).origin
                })
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
