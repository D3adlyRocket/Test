/**
 * SkTorrent Nuvio Provider
 */

const SKTORRENT_BASE = 'https://sktorrent.eu';
const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba1e9bbfb'; // Public TMDB read key

/**
 * Resolves TMDB ID to a search title
 */
function getTitleFromTMDB(tmdbId, mediaType) {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
  
  return fetch(url)
    .then(res => res.json())
    .then(data => data.title || data.name || data.original_title || data.original_name)
    .catch(() => null);
}

/**
 * Main Nuvio Entry Point
 */
function getStreams(tmdbId, mediaType, season, episode) {
  console.log(`[SkTorrent] Searching streams for TMDB ID: ${tmdbId} (${mediaType})`);

  return getTitleFromTMDB(tmdbId, mediaType)
    .then(title => {
      if (!title) {
        console.error('[SkTorrent] Failed to fetch title from TMDB');
        return [];
      }

      // Build search query (add season/episode if TV show)
      let searchQuery = title;
      if (mediaType === 'tv' && season && episode) {
        const s = String(season).padStart(2, '0');
        const e = String(episode).padStart(2, '0');
        searchQuery += ` S${s}E${e}`;
      }

      const searchUrl = `${SKTORRENT_BASE}/torrent/torrents.php?search=${encodeURIComponent(searchQuery)}`;

      return fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'cs-CZ,cs;q=0.9,sk;q=0.8,en;q=0.7'
        }
      })
      .then(response => response.text())
      .then(html => parseSkTorrentHTML(html, searchQuery))
      .catch(err => {
        console.error('[SkTorrent] Network or parsing error:', err.message);
        return [];
      });
    });
}

/**
 * Parses SkTorrent search results HTML
 */
function parseSkTorrentHTML(html, query) {
  const streams = [];

  // Match rows or links containing magnet/torrent details
  // SkTorrent links usually follow details.php?id=... or download.php?id=...
  const rowRegex = /<a[^>]+href=["'](details\.php\?id=\d+)["'][^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const detailPath = match[1];
    const torrentTitle = match[2].replace(/<[^>]+>/g, '').trim();

    if (torrentTitle) {
      // Determine stream quality label
      let quality = '720p';
      if (/1080p|FULLHD|BDrip/i.test(torrentTitle)) quality = '1080p';
      else if (/2160p|4K|UHD/i.test(torrentTitle)) quality = '4K';
      else if (/480p|DVD/i.test(torrentTitle)) quality = '480p';

      streams.push({
        name: 'SkTorrent',
        title: torrentTitle,
        url: `${SKTORRENT_BASE}/torrent/${detailPath}`,
        quality: quality
      });
    }
  }

  console.log(`[SkTorrent] Found ${streams.length} candidate streams`);
  return streams;
}

module.exports = { getStreams };
