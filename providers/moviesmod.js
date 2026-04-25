// Vixsrc Scraper for Nuvio Local Scrapers
// React Native compatible version - Standalone (no external dependencies)
// Converted to Promise-based syntax for sandbox compatibility
// Based on: https://github.com/rabygbox/Nuvio_Repo (working reference)

// Constants
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const BASE_URL = 'https://vixsrc.to';

// Helper function to make HTTP requests with default headers
function makeRequest(url, options = {}) {
    const defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json,*/*',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        ...options.headers
    };

    return fetch(url, {
        method: options.method || 'GET',
        headers: defaultHeaders,
        ...options
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
    })
    .catch(error => {
        console.error(`[Vixsrc] Request failed for ${url}: ${error.message}`);
        throw error;
    });
}

// Helper function to get TMDB info
function getTmdbInfo(tmdbId, mediaType) {
    const url = `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    return makeRequest(url)
    .then(response => response.json())
    .then(data => {
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = mediaType === 'tv' ? data.first_air_date?.substring(0, 4) : data.release_date?.substring(0, 4);

        if (!title) {
            throw new Error('Could not extract title from TMDB response');
        }

        console.log(`[Vixsrc] TMDB Info: "${title}" (${year})`);
        return { title, year, data };
    });
}

// Helper function to extract stream URL from Vixsrc page
function extractStreamFromPage(contentType, contentId, seasonNum, episodeNum) {
    let vixsrcUrl;
    let subtitleApiUrl;

    if (contentType === 'movie') {
        vixsrcUrl = `${BASE_URL}/movie/${contentId}`;
        subtitleApiUrl = `https://sub.wyzie.ru/search?id=${contentId}`;
    } else {
        vixsrcUrl = `${BASE_URL}/tv/${contentId}/${seasonNum}/${episodeNum}`;
        subtitleApiUrl = `https://sub.wyzie.ru/search?id=${contentId}&season=${seasonNum}&episode=${episodeNum}`;
    }

    console.log(`[Vixsrc] Fetching: ${vixsrcUrl}`);

    return makeRequest(vixsrcUrl, {
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': BASE_URL + '/'
        }
    })
    .then(response => response.text())
    .then(html => {
        console.log(`[Vixsrc] HTML length: ${html.length} characters`);

        let masterPlaylistUrl = null;

        // Method 1: Look for window.masterPlaylist (primary method)
        if (html.includes('window.masterPlaylist') || html.includes('masterPlaylist')) {
            console.log('[Vixsrc] Found masterPlaylist in HTML');

            const urlMatch = html.match(/url:\s*['"](https?:\/\/[^'"]+)['"]/)
                || html.match(/url:\s*['"]((?:\/[^'"]+)+)['"]/)
                || html.match(/url:\s*['"](([^'"]+\.m3u8[^'"]*))['"]/i);
            const tokenMatch = html.match(/['"]?token['"]?\s*:\s*['"](\S+?)['"]/);
            const expiresMatch = html.match(/['"]?expires['"]?\s*:\s*['"](\S+?)['"]/);

            if (urlMatch && tokenMatch && expiresMatch) {
                const basePlaylistUrl = urlMatch[1];
                const token = tokenMatch[1];
                const expires = expiresMatch[1];

                console.log(`[Vixsrc] Base URL: ${basePlaylistUrl}`);
                console.log(`[Vixsrc] Token: ${token.substring(0, 20)}...`);
                console.log(`[Vixsrc] Expires: ${expires}`);

                if (basePlaylistUrl.includes('?')) {
                    masterPlaylistUrl = `${basePlaylistUrl}&token=${token}&expires=${expires}&h=1&lang=it`;
                } else {
                    masterPlaylistUrl = `${basePlaylistUrl}?token=${token}&expires=${expires}&h=1&lang=it`;
                }

                console.log(`[Vixsrc] Master playlist URL: ${masterPlaylistUrl}`);
            }
        }

        // Method 2: Direct .m3u8 URL in page
        if (!masterPlaylistUrl) {
            const m3u8Match = html.match(/(https?:\/\/[^'"\s]+\.m3u8[^'"\s]*)/);
            if (m3u8Match) {
                masterPlaylistUrl = m3u8Match[1];
                console.log('[Vixsrc] Found direct .m3u8 URL:', masterPlaylistUrl);
            }
        }

        // Method 3: Scan script tags
        if (!masterPlaylistUrl) {
            const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
            if (scriptMatches) {
                for (const script of scriptMatches) {
                    const streamMatch = script.match(/['"]?(https?:\/\/[^'"\s]+(?:\.m3u8|playlist)[^'"\s]*)/);
                    if (streamMatch) {
                        masterPlaylistUrl = streamMatch[1];
                        console.log('[Vixsrc] Found stream in script tag:', masterPlaylistUrl);
                        break;
                    }
                }
            }
        }

        if (!masterPlaylistUrl) {
            console.log('[Vixsrc] No master playlist URL found in page');
            return null;
        }

        return { masterPlaylistUrl, subtitleApiUrl };
    });
}

// Helper function to get Italian/English subtitles
function getSubtitles(subtitleApiUrl) {
    return makeRequest(subtitleApiUrl)
    .then(response => response.json())
    .then(subtitleData => {
        if (!Array.isArray(subtitleData) || subtitleData.length === 0) return '';

        // Prefer Italian subtitles, fallback to English
        const findByLang = (lang) => subtitleData.find(t =>
            t.display && t.display.toLowerCase().includes(lang) &&
            ['ASCII', 'UTF-8'].includes(t.encoding)
        ) || subtitleData.find(t =>
            t.display && t.display.toLowerCase().includes(lang)
        );

        const subtitleTrack = findByLang('italian') || findByLang('english');
        const subtitles = subtitleTrack ? subtitleTrack.url : '';
        console.log(subtitles ? `[Vixsrc] Found subtitles: ${subtitles}` : '[Vixsrc] No subtitles found');
        return subtitles;
    })
    .catch(error => {
        console.log('[Vixsrc] Subtitle fetch failed:', error.message);
        return '';
    });
}

// Main function - NuvioMobile cmp-rewrite compatible
function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    const type = mediaType === 'series' ? 'tv' : (mediaType || 'movie');

    // Strip prefixes if any
    let id = String(tmdbId || '');
    if (id.startsWith('tmdb:')) id = id.replace('tmdb:', '');

    console.log(`[Vixsrc] getStreams called: id=${id}, type=${type}, s=${seasonNum}, e=${episodeNum}`);

    return getTmdbInfo(id, type)
    .then(() => extractStreamFromPage(type, id, seasonNum, episodeNum))
    .then(streamData => {
        if (!streamData) {
            console.log('[Vixsrc] No stream data found');
            return [];
        }

        const { masterPlaylistUrl, subtitleApiUrl } = streamData;

        return getSubtitles(subtitleApiUrl)
        .then(subtitles => {
            const stream = {
                name: '📡 VixSrc',
                title: type === 'movie' ? '🎬 Film ITA' : `📺 S${seasonNum}E${episodeNum} ITA`,
                url: masterPlaylistUrl,
                quality: 'Auto',
                type: 'direct',
                headers: {
                    'Referer': BASE_URL + '/',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            };

            if (subtitles) stream.subtitles = subtitles;

            console.log('[Vixsrc] Returning stream:', masterPlaylistUrl);
            return [stream];
        });
    })
    .catch(error => {
        console.error(`[Vixsrc] Fatal error: ${error.message}`);
        return [];
    });
}

// Export for NuvioMobile / React Native sandbox
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else if (typeof global !== 'undefined') {
    global.VixsrcScraperModule = { getStreams };
}
