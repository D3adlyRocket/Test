// StreamFlix Provider for Nuvio
// Ported from StreamFlix API
const cheerio = require('cheerio-without-node-native');

// Constants
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const STREAMFLIX_API_BASE = "https://api.streamflix.app";
const CONFIG_URL = `${STREAMFLIX_API_BASE}/config/config-streamflixapp.json`;
const DATA_URL = `${STREAMFLIX_API_BASE}/data.json`;
const WEBSOCKET_URL = "wss://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/.ws?ns=chilflix-410be-default-rtdb&v=5";

// Global cache
let cache = {
  config: null,
  configTimestamp: 0,
  data: null,
  dataTimestamp: 0,
};
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// The stream links carry the release filename, which is where the only honest
// statement about resolution lives: `BrBa.S01E01.720p.BrRip.x264.400MB-Pahe.in.mkv`
// is a 720p file no matter which mirror serves it. Labelling every premium
// mirror 1080p and every standard one 720p by rule put 720p files into the
// caller's 1080p slot; when the filename says nothing, so do we.
function qualityFromLink(link) {
  const match = String(link || '').match(/\b(2160p|4k|1080p|720p|480p|360p)\b/i);
  if (!match) return null;
  return match[1].toLowerCase() === '4k' ? '2160p' : match[1].toLowerCase();
}

// Helper function for HTTP requests
function makeRequest(url, options = {}) {
  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive'
  };

  return fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  }).then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response;
  });
}

// Get config data with caching
function getConfig() {
  const now = Date.now();
  if (cache.config && now - cache.configTimestamp < CACHE_TTL) {
    return Promise.resolve(cache.config);
  }

  console.log('[StreamFlix] Fetching config data...');
  return makeRequest(CONFIG_URL)
    .then(response => response.json())
    .then(json => {
      cache.config = json;
      cache.configTimestamp = now;
      console.log('[StreamFlix] Config data cached successfully');
      return json;
    })
    .catch(error => {
      console.error('[StreamFlix] Failed to fetch config:', error.message);
      throw error;
    });
}

// Get data with caching
function getData() {
  const now = Date.now();
  if (cache.data && now - cache.dataTimestamp < CACHE_TTL) {
    return Promise.resolve(cache.data);
  }

  console.log('[StreamFlix] Fetching data...');
  return makeRequest(DATA_URL)
    .then(response => response.json())
    .then(json => {
      cache.data = json;
      cache.dataTimestamp = now;
      console.log('[StreamFlix] Data cached successfully');
      return json;
    })
    .catch(error => {
      console.error('[StreamFlix] Failed to fetch data:', error.message);
      throw error;
    });
}

// Search for content by title
function searchContent(title, year, mediaType) {
  console.log(`[StreamFlix] Searching for: "${title}" (${year})`);
  
  return getData()
    .then(data => {
      if (!data || !data.data) {
        throw new Error('Invalid data structure received');
      }

      const searchQuery = title.toLowerCase();
      const results = data.data.filter(item => {
        if (!item.moviename) return false;

        // Whole words, not substrings. `includes` matched "It" inside
        // "Bitter" and "Up" inside "Uptown", which is how a search could
        // select a different film entirely and still look like a hit.
        const itemWords = new Set(item.moviename.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
        const titleWords = searchQuery.split(/[^a-z0-9]+/).filter(Boolean);
        if (titleWords.length === 0) return false;

        // Check if all words from search query are present in the item title
        return titleWords.every(word => itemWords.has(word));
      });

      console.log(`[StreamFlix] Found ${results.length} search results`);
      return results;
    });
}

// Find best match from search results
function findBestMatch(targetTitle, results) {
  if (!results || results.length === 0) {
    return null;
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const result of results) {
    const score = calculateSimilarity(
      targetTitle.toLowerCase(),
      result.moviename.toLowerCase()
    );
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = result;
    }
  }

  console.log(`[StreamFlix] Best match: "${bestMatch?.moviename}" (score: ${bestScore.toFixed(2)})`);
  return bestMatch;
}

// Calculate string similarity
function calculateSimilarity(str1, str2) {
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  
  let matches = 0;
  for (const word of words1) {
    if (word.length > 2 && words2.some(w => w.includes(word) || word.includes(w))) {
      matches++;
    }
  }
  
  return matches / Math.max(words1.length, words2.length);
}

// WebSocket-based episode fetching (real implementation per series.py/api.js)
function getEpisodesFromWebSocket(movieKey, totalSeasons = 1) {
  return new Promise((resolve, reject) => {
    let WSImpl = null;
    try {
      WSImpl = typeof WebSocket !== 'undefined' ? WebSocket : require('ws');
    } catch (e) {
      WSImpl = null;
    }

    if (!WSImpl) {
      return reject(new Error('WebSocket implementation not available'));
    }

    const ws = new WSImpl(
      'wss://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/.ws?ns=chilflix-410be-default-rtdb&v=5'
    );

    const seasonsData = {};
    let currentSeason = 1;
    let completedSeasons = 0;
    let messageBuffer = '';
    let expectedResponses = 0;
    let responsesReceived = 0;

    const overallTimeout = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error('WebSocket timeout'));
    }, 30000);

    function sendSeasonRequest(season) {
      const payload = {
        t: 'd',
        d: { a: 'q', r: season, b: { p: `Data/${movieKey}/seasons/${season}/episodes`, h: '' } }
      };
      try {
        ws.send(JSON.stringify(payload));
      } catch (e) {
        // Ignore send errors; will be picked up by 'error' event
      }
    }

    ws.onopen = function () {
      sendSeasonRequest(currentSeason);
    };

    ws.onmessage = function (evt) {
      try {
        const message = (typeof evt.data === 'string') ? evt.data : evt.data.toString();

        // numeric count of expected messages sometimes sent
        if (/^\d+$/.test(message.trim())) {
          expectedResponses = parseInt(message.trim(), 10);
          responsesReceived = 0;
          return;
        }

        messageBuffer += message;

        try {
          const data = JSON.parse(messageBuffer);
          messageBuffer = '';

          if (data.t === 'c') {
            return; // handshake complete
          }

          if (data.t === 'd') {
            const d_data = data.d || {};
            const b_data = d_data.b || {};

            // completion for current season
            if (d_data.r === currentSeason && b_data.s === 'ok') {
              completedSeasons++;
              if (completedSeasons < totalSeasons) {
                currentSeason++;
                expectedResponses = 0;
                responsesReceived = 0;
                sendSeasonRequest(currentSeason);
              } else {
                clearTimeout(overallTimeout);
                try { ws.close(); } catch {}
                resolve(seasonsData);
              }
              return;
            }

            // episode data
            if (b_data.d) {
              const episodes = b_data.d;
              const seasonEpisodes = seasonsData[currentSeason] || {};
              for (const [epKey, epData] of Object.entries(episodes)) {
                if (epData && typeof epData === 'object') {
                  seasonEpisodes[parseInt(epKey, 10)] = {
                    key: epData.key,
                    link: epData.link,
                    name: epData.name,
                    overview: epData.overview,
                    runtime: epData.runtime,
                    still_path: epData.still_path,
                    vote_average: epData.vote_average
                  };
                  responsesReceived++;
                }
              }
              seasonsData[currentSeason] = seasonEpisodes;

              // If we know how many to expect and we reached/exceeded it, do nothing here.
              // The season completion is signaled by b.s === 'ok' above which we handle to advance.
            }
          }
        } catch (e) {
          // Incomplete JSON in buffer, wait for more
          if (messageBuffer.length > 100000) {
            messageBuffer = '';
          }
        }
      } catch (err) {
        // ignore parse errors; will continue buffering
      }
    };

    ws.onerror = function (err) {
      clearTimeout(overallTimeout);
      reject(new Error('WebSocket error'));
    };

    ws.onclose = function () {
      clearTimeout(overallTimeout);
    };
  });
}

// Main function that Nuvio will call
function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
  console.log(`[StreamFlix] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);
  
  if (seasonNum !== null) {
    console.log(`[StreamFlix] Season: ${seasonNum}, Episode: ${episodeNum}`);
  }

  // Get TMDB info first
  const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
  
  return makeRequest(tmdbUrl)
    .then(response => response.json())
    .then(tmdbData => {
      const title = mediaType === 'tv' ? tmdbData.name : tmdbData.title;
      const year = mediaType === 'tv' 
        ? tmdbData.first_air_date?.substring(0, 4) 
        : tmdbData.release_date?.substring(0, 4);

      if (!title) {
        throw new Error('Could not extract title from TMDB response');
      }

      console.log(`[StreamFlix] TMDB Info: "${title}" (${year})`);

      // Search for content
      return searchContent(title, year, mediaType)
        .then(searchResults => {
          if (searchResults.length === 0) {
            console.log('[StreamFlix] No search results found');
            return [];
          }

          const selectedResult = findBestMatch(title, searchResults);
          if (!selectedResult) {
            console.log('[StreamFlix] No suitable match found');
            return [];
          }

          // Get config for stream URLs
          return getConfig()
            .then(config => {
              if (mediaType === 'movie') {
                // Process movie streams
                return processMovieStreams(selectedResult, config);
              } else {
                // Process TV show streams
                return processTVStreams(selectedResult, config, seasonNum, episodeNum);
              }
            });
        });
    })
    .catch(error => {
      console.error(`[StreamFlix] Error in getStreams: ${error.message}`);
      return [];
    });
}

// Process movie streams
function processMovieStreams(movieData, config) {
  console.log(`[StreamFlix] Processing movie streams for: ${movieData.moviename}`);
  
  const streams = [];
  
  // Premium streams (higher quality)
  if (config.premium && movieData.movielink) {
    config.premium.forEach((baseUrl, index) => {
      const streamUrl = `${baseUrl}${movieData.movielink}`;
      streams.push({
        name: "StreamFlix",
        title: `${movieData.moviename} - Premium Quality`,
        url: streamUrl,
        quality: qualityFromLink(movieData.movielink),
        size: movieData.movieduration || "Unknown",
        type: 'direct',
        headers: {
          'Referer': 'https://api.streamflix.app',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
    });
  }
  
  // Regular movie streams
  if (config.movies && movieData.movielink) {
    config.movies.forEach((baseUrl, index) => {
      const streamUrl = `${baseUrl}${movieData.movielink}`;
      streams.push({
        name: "StreamFlix",
        title: `${movieData.moviename} - Standard Quality`,
        url: streamUrl,
        quality: qualityFromLink(movieData.movielink),
        size: movieData.movieduration || "Unknown",
        type: 'direct',
        headers: {
          'Referer': 'https://api.streamflix.app',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
    });
  }

  console.log(`[StreamFlix] Generated ${streams.length} movie streams`);
  return streams;
}

// Process TV show streams
function processTVStreams(tvData, config, seasonNum, episodeNum) {
  console.log(`[StreamFlix] Processing TV streams for: ${tvData.moviename}`);
  
  // Extract total seasons from duration field
  const seasonMatch = tvData.movieduration?.match(/(\d+)\s+Season/);
  const totalSeasons = seasonMatch ? parseInt(seasonMatch[1]) : 1;
  
  return getEpisodesFromWebSocket(tvData.moviekey, totalSeasons)
    .then(seasonsData => {
      const streams = [];
      
      // If specific episode requested
      if (seasonNum !== null && episodeNum !== null) {
        const seasonData = seasonsData[seasonNum];
        if (seasonData) {
          const episodeData = seasonData[episodeNum - 1];
          if (episodeData && config.premium) {
            config.premium.forEach(baseUrl => {
              const streamUrl = `${baseUrl}${episodeData.link}`;
              streams.push({
                name: "StreamFlix",
                title: `${tvData.moviename} S${seasonNum}E${episodeNum} - ${episodeData.name}`,
                url: streamUrl,
                quality: qualityFromLink(episodeData.link),
                size: episodeData.runtime ? `${episodeData.runtime}min` : "Unknown",
                type: 'direct',
                headers: {
                  'Referer': 'https://api.streamflix.app',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              });
            });
          }
        }
      } else {
        // Return all episodes for all seasons
        for (const [season, episodes] of Object.entries(seasonsData)) {
          for (const [epIndex, episodeData] of Object.entries(episodes)) {
            if (config.premium && episodeData.link) {
              const epNum = parseInt(epIndex) + 1;
              config.premium.forEach(baseUrl => {
                const streamUrl = `${baseUrl}${episodeData.link}`;
                streams.push({
                  name: "StreamFlix",
                  title: `${tvData.moviename} S${season}E${epNum} - ${episodeData.name}`,
                  url: streamUrl,
                  quality: qualityFromLink(episodeData.link),
                  size: episodeData.runtime ? `${episodeData.runtime}min` : "Unknown",
                  type: 'direct',
                  headers: {
                    'Referer': 'https://api.streamflix.app',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                  }
                });
              });
            }
          }
        }
      }
      
      // Fallback if no episodes found
      if (streams.length === 0 && config.premium && seasonNum !== null && episodeNum !== null) {
        const fallbackUrl = `${config.premium[0]}tv/${tvData.moviekey}/s${seasonNum}/episode${episodeNum}.mkv`;
        streams.push({
          name: "StreamFlix",
          title: `${tvData.moviename} S${seasonNum}E${episodeNum} (Fallback)`,
          url: fallbackUrl,
          quality: null,
          size: "Unknown",
          type: 'direct',
          headers: {
            'Referer': 'https://api.streamflix.app',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
      }

      console.log(`[StreamFlix] Generated ${streams.length} TV streams`);
      return streams;
    })
    .catch(error => {
      console.error('[StreamFlix] WebSocket failed, using fallback:', error.message);
      
      // Generate fallback stream
      if (config.premium && seasonNum !== null && episodeNum !== null) {
        const fallbackUrl = `${config.premium[0]}tv/${tvData.moviekey}/s${seasonNum}/episode${episodeNum}.mkv`;
        return [{
          name: "StreamFlix",
          title: `${tvData.moviename} S${seasonNum}E${episodeNum} (Fallback)`,
          url: fallbackUrl,
          quality: null,
          size: "Unknown",
          type: 'direct',
          headers: {
            'Referer': 'https://api.streamflix.app',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }];
      }
      
      return [];
    });
}

// Export for React Native
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
