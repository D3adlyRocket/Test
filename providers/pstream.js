// SFlix Provider for Nuvio
// Version: 2.2.0

const SFLIX_BASE = 'https://sflix.to';

// Helper for HTTP requests
async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': SFLIX_BASE
    },
  });
  return await res.text();
}

async function fetchJSON(url) {
  const res = await fetch(url);
  return await res.json();
}

/**
 * Nuvio Entry Point
 * @param {string} tmdbId - The TMDB ID of the media
 * @param {string} type - 'movie' or 'tv'
 * @param {number} season - Season number (for TV)
 * @param {number} episode - Episode number (for TV)
 * @param {string} title - The media title (passed by Nuvio)
 */
async function getStreams(tmdbId, type, season, episode, title) {
  const streams = [];
  
  try {
    // 1. Search for the title provided by Nuvio
    const searchTitle = title || "";
    const searchUrl = `${SFLIX_BASE}/search/${searchTitle.toLowerCase().replace(/ /g, '-')}`;
    const html = await fetchHTML(searchUrl);

    // Regex to find the site's internal ID
    const re = /href="\/watch-(movie|tv)\/[^"]+-(\d+)"/g;
    const match = re.exec(html);
    if (!match) return [];
    
    const sflixId = match[2];
    let serverListHtml = '';

    // 2. Navigate to the correct episode/movie servers
    if (type === 'movie') {
      serverListHtml = await fetchHTML(`${SFLIX_BASE}/ajax/movie/episodes/${sflixId}`);
    } else {
      // TV Show logic: Get seasons -> Get episodes -> Get servers
      const seasonsHtml = await fetchHTML(`${SFLIX_BASE}/ajax/v2/tv/seasons/${sflixId}`);
      const sId = (new RegExp(`data-id="(\\d+)"[^>]*>Season\\s*${season || 1}`, 'i').exec(seasonsHtml))?.[1];
      
      if (sId) {
        const epsHtml = await fetchHTML(`${SFLIX_BASE}/ajax/v2/season/episodes/${sId}`);
        const eId = (new RegExp(`data-id="(\\d+)"[^>]*title="[^"]*Ep\\s*${episode || 1}:`, 'i').exec(epsHtml))?.[1];
        if (eId) {
          serverListHtml = await fetchHTML(`${SFLIX_BASE}/ajax/v2/episode/servers/${eId}`);
        }
      }
    }

    // 3. Extract links from servers
    const serverRe = /data-id="(\d+)"[^>]*title="([^"]+)"/g;
    let s;
    while ((s = serverRe.exec(serverListHtml)) !== null) {
      const serverId = s[1];
      const serverName = s[2];
      
      const data = await fetchJSON(`${SFLIX_BASE}/ajax/sources/${serverId}`);
      if (data && data.link) {
        // Nuvio expects objects with 'url' and 'title'
        streams.push({
          url: data.link, 
          title: `SFlix: ${serverName}`,
          quality: 'HD',
          isM3U8: data.link.includes('.m3u8')
        });
      }
    }
  } catch (err) {
    console.error("SFlix Error: ", err);
  }

  return streams;
}

// Ensure the module exports getStreams for Nuvio to see it
module.exports = { getStreams };
