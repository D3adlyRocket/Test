// SFlix Provider for Nuvio Media Player
// Based on FlixHQ API structure (sflix.ps is a FlixHQ clone)
// Author: The-cpu-max
// Version: 2.0.0

const SFLIX_BASE = 'https://sflix.now';

// ─── Helper: fetch HTML with correct headers ───────────────────────────────
async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': SFLIX_BASE,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

// ─── Helper: fetch JSON ────────────────────────────────────────────────────
async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': SFLIX_BASE,
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

// ─── Search SFlix by title ─────────────────────────────────────────────────
async function searchSFlix(title, type) {
  const query = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const url = `${SFLIX_BASE}/search/${encodeURIComponent(query)}`;
  const html = await fetchHTML(url);

  const results = [];
  // Match: href="/movie/free-...-hd-ID" or href="/tv/free-...-hd-ID"
  const re = /href="\/(movie|tv)\/free-[^"]+-(\d+)"[^>]*>[\s\S]*?film-name[\s\S]*?title="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const itemType = m[1]; // 'movie' or 'tv'
    const id = m[2];
    const itemTitle = m[3];
    if (type === 'movie' && itemType !== 'movie') continue;
    if (type === 'tv' && itemType !== 'tv') continue;
    results.push({ id, title: itemTitle, type: itemType });
  }
  return results;
}

// ─── Get the internal data-id from the detail page ────────────────────────
async function getUid(filmPath) {
  const html = await fetchHTML(`${SFLIX_BASE}${filmPath}`);
  const m = html.match(/class="watch_block"[^>]*data-id="(\d+)"/);
  if (!m) throw new Error('Could not find data-id on film page');
  return m[1];
}

// ─── Get embed URL from /ajax/sources/{serverId} ──────────────────────────
async function getSourceLink(serverId) {
  const json = await fetchJSON(`${SFLIX_BASE}/ajax/sources/${serverId}`);
  return json && json.link ? json.link : null;
}

// ─── Extract m3u8/mp4 from embed page ─────────────────────────────────────
async function extractFromEmbed(embedUrl) {
  try {
    const html = await fetchHTML(embedUrl);
    // Look for sources array or file: "..."
    const m3u8 = html.match(/(?:file|src):\s*["']?(https?:[^"'\s]+\.m3u8[^"'\s]*)["']?/);
    if (m3u8) return { url: m3u8[1], format: 'm3u8' };
    const mp4 = html.match(/(?:file|src):\s*["']?(https?:[^"'\s]+\.mp4[^"'\s]*)["']?/);
    if (mp4) return { url: mp4[1], format: 'mp4' };
    // Try sources JSON
    const sourcesMatch = html.match(/sources:\s*(\[[^\]]+\])/);
    if (sourcesMatch) {
      const sources = JSON.parse(sourcesMatch[1]);
      if (sources && sources[0] && sources[0].file) {
        return { url: sources[0].file, format: sources[0].type || 'm3u8' };
      }
    }
  } catch (_) {}
  return null;
}

// ─── Process a single server to get stream ────────────────────────────────
async function processServer(serverId, serverName) {
  try {
    const embedUrl = await getSourceLink(serverId);
    if (!embedUrl) return null;
    const stream = await extractFromEmbed(embedUrl);
    if (!stream) return null;
    return {
      url: stream.url,
      quality: 'HD',
      format: stream.format,
      title: `SFlix - ${serverName}`,
    };
  } catch (_) {
    return null;
  }
}

// ─── Main scrape function ──────────────────────────────────────────────────
async function scrape({ media, episode }) {
  const streams = [];

  try {
    const title = media.title || media.name || '';
    const type = media.type === 'movie' ? 'movie' : 'tv';

    // 1. Search for the title
    const results = await searchSFlix(title, type);
    if (!results.length) {
      console.log(`[SFlix] No results for: ${title}`);
      return { streams };
    }

    const best = results[0];
    const filmPath = `/${best.type}/free-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-hd-${best.id}`;

    // 2. Get the internal uid (data-id on the page)
    let uid;
    try {
      uid = await getUid(filmPath);
    } catch (_) {
      uid = best.id; // fallback
    }

    if (type === 'movie') {
      // ── MOVIE FLOW ──
      // Step A: get episodes list (returns one episode for movies)
      const epHtml = await fetchHTML(`${SFLIX_BASE}/ajax/movie/episodes/${uid}`);

      // Extract server linkids
      const serverRe = /data-linkid="(\d+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g;
      let sm;
      const serverPromises = [];
      while ((sm = serverRe.exec(epHtml)) !== null) {
        const sid = sm[1];
        const sname = sm[2].trim();
        serverPromises.push(processServer(sid, sname));
      }

      if (!serverPromises.length) {
        // Fallback: grab data-id from episodes and then get servers
        const epIdMatch = epHtml.match(/data-id="(\d+)"/);
        if (epIdMatch) {
          const serversHtml = await fetchHTML(`${SFLIX_BASE}/ajax/movie/episode/servers/${epIdMatch[1]}`);
          const sre = /data-linkid="(\d+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g;
          let sr;
          while ((sr = sre.exec(serversHtml)) !== null) {
            serverPromises.push(processServer(sr[1], sr[2].trim()));
          }
        }
      }

      const resolved = await Promise.all(serverPromises);
      resolved.forEach(s => s && streams.push(s));

    } else {
      // ── TV SHOW FLOW ──
      const targetSeason = (episode && episode.season) ? episode.season : 1;
      const targetEp = (episode && episode.number) ? episode.number : 1;

      // Step A: get seasons
      const seasonsHtml = await fetchHTML(`${SFLIX_BASE}/ajax/v2/tv/seasons/${uid}`);
      const seasonRe = /data-id="(\d+)"[^>]*>Season\s*(\d+)/g;
      let seasonMatch;
      const seasons = [];
      while ((seasonMatch = seasonRe.exec(seasonsHtml)) !== null) {
        seasons.push({ id: seasonMatch[1], num: parseInt(seasonMatch[2]) });
      }

      const season = seasons.find(s => s.num === targetSeason) || seasons[0];
      if (!season) {
        console.log('[SFlix] No seasons found');
        return { streams };
      }

      // Step B: get episodes of that season
      const epsHtml = await fetchHTML(`${SFLIX_BASE}/ajax/v2/season/episodes/${season.id}`);
      // Ep title format: "Ep 1: Title" - data-id is on the <a> tag
      const epRe = /data-id="(\d+)"[^>]*title="Ep\s*(\d+):/g;
      let epMatch;
      const episodes = [];
      while ((epMatch = epRe.exec(epsHtml)) !== null) {
        episodes.push({ id: epMatch[1], num: parseInt(epMatch[2]) });
      }

      const ep = episodes.find(e => e.num === targetEp) || episodes[0];
      if (!ep) {
        console.log('[SFlix] Episode not found');
        return { streams };
      }

      // Step C: get servers for that episode
      const serversHtml = await fetchHTML(`${SFLIX_BASE}/ajax/v2/episode/servers/${ep.id}`);
      const srvRe = /data-id="(\d+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g;
      let srvMatch;
      const serverPromises = [];
      while ((srvMatch = srvRe.exec(serversHtml)) !== null) {
        serverPromises.push(processServer(srvMatch[1], srvMatch[2].trim()));
      }

      const resolved = await Promise.all(serverPromises);
      resolved.forEach(s => s && streams.push(s));
    }

  } catch (err) {
    console.error('[SFlix] Scraper error:', err.message);
  }

  console.log(`[SFlix] Found ${streams.length} streams`);
  return { streams };
}

module.exports = { scrape };
