// VideoEasy Scraper - Final 2026 Optimization
const TMDB_API_KEY = '1c29a5198ee1854bd5eb45dbe8d17d92';
const DECRYPT_API = 'https://enc-dec.app/api/dec-videasy';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://player.videasy.to',
  'Referer': 'https://player.videasy.to/'
};

const SERVERS = {
  'Neon': { url: 'https://api.wingsdatabase.com/mb-flix/sources-with-title' },
  'Yoru': { url: 'https://api.wingsdatabase.com/cdn/sources-with-title', moviesOnly: true },
  'Tejo': { url: 'https://api.wingsdatabase.com/tejo/sources-with-title' },
  'Jett': { url: 'https://api.wingsdatabase.com/jett/sources-with-title' },
  'Cypher': { url: 'https://api.wingsdatabase.com/downloader2/sources-with-title' },
  'Breach': { url: 'https://api.wingsdatabase.com/m4uhd/sources-with-title' },
  'Omen': { url: 'https://api.wingsdatabase.com/lamovie/sources-with-title' },
  'Sage': { url: 'https://api.wingsdatabase.com/1movies/sources-with-title' },
  'Vyse': {url: 'https://api.wingsdatabase.com/hdmovie/sources-with-title' },
  'Raze': { url: 'https://api.wingsdatabase.com/superflix/sources-with-title' } // Raze often rotates URLs
};

function getStreams(tmdbId, mediaType, season, episode) {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

  return fetch(tmdbUrl)
    .then(res => res.json())
    .then(data => {
      const details = {
        id: tmdbId.toString(),
        title: data.title || data.name,
        year: (data.release_date || data.first_air_date || '').split('-')[0],
        imdbId: data.external_ids ? data.external_ids.imdb_id : '',
        type: type
      };

      const promises = Object.keys(SERVERS).map(name => {
        const config = SERVERS[name];
        if (details.type === 'tv' && config.moviesOnly) return Promise.resolve([]);

        // Build URL ensuring IMDB ID is included (crucial for Omen/Breach)
        let url = `${config.url}?title=${encodeURIComponent(details.title)}` +
                  `&mediaType=${details.type}&year=${details.year}` +
                  `&tmdbId=${details.id}&imdbId=${details.imdbId || ''}`;
        
        if (details.type === 'tv') url += `&seasonId=${season}&episodeId=${episode}`;

        return fetch(url, { headers: HEADERS })
          .then(res => res.text())
          .then(encryptedText => {
            if (!encryptedText || encryptedText.length < 20 || encryptedText.startsWith('<!')) return [];
            
            return fetch(DECRYPT_API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: encryptedText, id: details.id })
            })
            .then(dRes => dRes.json())
            .then(decrypted => {
              const resData = decrypted.result || decrypted;
              if (!resData || !resData.sources) return [];

              return resData.sources.map(s => ({
                name: `VIDEASY ${name}`,
                url: s.url,
                quality: s.quality || 'Auto',
                headers: {
                  'Referer': 'https://player.videasy.to/',
                  'Origin': 'https://player.videasy.to',
                  'User-Agent': HEADERS['User-Agent']
                },
                provider: 'videasy'
              }));
            });
          })
          .catch(() => []);
      });

      return Promise.all(promises).then(results => {
        const flat = results.flat();
        const seen = new Set();
        return flat.filter(item => seen.has(item.url) ? false : seen.add(item.url));
      });
    })
    .catch(() => []);
}

if (typeof module !== 'undefined') module.exports = { getStreams };
