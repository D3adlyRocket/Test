// ShowBox Scraper for Nuvio Local Scrapers
// React Native compatible version - Promise-based approach only

// TMDB API Configuration
const TMDB_API_KEY = '1c29a5198ee1854bd5eb45dbe8d17d92';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// ShowBox API Configuration
const SHOWBOX_API_BASE = 'https://febapi.nuvioapp.space/api/media';
const SHOWBOX_SERVER_REGION = 'USA5'; // Primary region
const SHOWBOX_FALLBACK_REGION = 'aws'; // Fallback if primary returns no streams

// Your Local Cookie URL
const LOCAL_COOKIE_URL = "http://192.168.1.176:8080/cookie.txt";

// Working headers for ShowBox API
const WORKING_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    'Accept': 'application/json',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Content-Type': 'application/json'
};

/**
 * MODIFIED: This is now an async function that checks your local server first.
 */
async function getUiToken() {
    // 1. Try to pick up private cookie from your local server
    try {
        console.log(`[ShowBox] Attempting fetch from: ${LOCAL_COOKIE_URL}`);
        const response = await fetch(LOCAL_COOKIE_URL);
        if (response.ok) {
            const serverCookie = await response.text();
            if (serverCookie && serverCookie.trim()) {
                console.log("[ShowBox] Successfully loaded cookie from local server");
                return serverCookie.trim();
            }
        }
    } catch (e) {
        console.log(`[ShowBox] Local server fetch failed: ${e.message}`);
    }

    // 2. Fallback to settings if local server is unreachable or file is empty
    try {
        if (typeof global !== 'undefined' && global.SCRAPER_SETTINGS && global.SCRAPER_SETTINGS.uiToken) {
            return String(global.SCRAPER_SETTINGS.uiToken);
        }
        if (typeof window !== 'undefined' && window.SCRAPER_SETTINGS && window.SCRAPER_SETTINGS.uiToken) {
            return String(window.SCRAPER_SETTINGS.uiToken);
        }
    } catch (e) {
        // ignore
    }
    return '';
}

function getOssGroup() {
    return SHOWBOX_SERVER_REGION;
}

// Utility Functions
function getQualityFromName(qualityStr) {
    if (!qualityStr) return 'Unknown';
    const quality = qualityStr.toUpperCase();
    if (quality === 'ORG' || quality === 'ORIGINAL') return 'Original';
    if (quality === '4K' || quality === '2160P') return '4K';
    if (quality === '1440P' || quality === '2K') return '1440p';
    if (quality === '1080P' || quality === 'FHD') return '1080p';
    if (quality === '720P' || quality === 'HD') return '720p';
    if (quality === '480P' || quality === 'SD') return '480p';
    if (quality === '360P') return '360p';
    if (quality === '240P') return '240p';
    const match = qualityStr.match(/(\d{3,4})[pP]?/);
    if (match) {
        const resolution = parseInt(match[1]);
        if (resolution >= 2160) return '4K';
        if (resolution >= 1440) return '1440p';
        if (resolution >= 1080) return '1080p';
        if (resolution >= 720) return '720p';
        if (resolution >= 480) return '480p';
        if (resolution >= 360) return '360p';
        return '240p';
    }
    return 'Unknown';
}

function formatFileSize(sizeStr) {
    if (!sizeStr) return 'Unknown';
    if (typeof sizeStr === 'string' && (sizeStr.includes('GB') || sizeStr.includes('MB') || sizeStr.includes('KB'))) {
        return sizeStr;
    }
    if (typeof sizeStr === 'number') {
        const gb = sizeStr / (1024 * 1024 * 1024);
        if (gb >= 1) return `${gb.toFixed(2)} GB`;
        const mb = sizeStr / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    }
    return sizeStr;
}

function extractCodecDetails(text) {
    if (!text || typeof text !== 'string') return [];
    const details = new Set();
    const lowerText = text.toLowerCase();
    if (lowerText.includes('dolby vision') || lowerText.includes('dovi') || lowerText.includes('.dv.')) details.add('DV');
    if (lowerText.includes('hdr10+') || lowerText.includes('hdr10plus')) details.add('HDR10+');
    else if (lowerText.includes('hdr')) details.add('HDR');
    if (lowerText.includes('sdr')) details.add('SDR');
    if (lowerText.includes('av1')) details.add('AV1');
    else if (lowerText.includes('h265') || lowerText.includes('x265') || lowerText.includes('hevc')) details.add('H.265');
    else if (lowerText.includes('h264') || lowerText.includes('x264') || lowerText.includes('avc')) details.add('H.264');
    if (lowerText.includes('atmos')) details.add('Atmos');
    if (lowerText.includes('truehd') || lowerText.includes('true-hd')) details.add('TrueHD');
    if (lowerText.includes('dts-hd ma') || lowerText.includes('dtshdma') || lowerText.includes('dts-hdhr')) details.add('DTS-HD MA');
    else if (lowerText.includes('dts-hd')) details.add('DTS-HD');
    else if (lowerText.includes('dts') && !lowerText.includes('dts-hd')) details.add('DTS');
    if (lowerText.includes('eac3') || lowerText.includes('e-ac-3') || lowerText.includes('dd+') || lowerText.includes('ddplus')) details.add('EAC3');
    else if (lowerText.includes('ac3') || (lowerText.includes('dd') && !lowerText.includes('dd+') && !lowerText.includes('ddp'))) details.add('AC3');
    if (lowerText.includes('aac')) details.add('AAC');
    if (lowerText.includes('opus')) details.add('Opus');
    if (lowerText.includes('mp3')) details.add('MP3');
    if (lowerText.includes('10bit') || lowerText.includes('10-bit')) details.add('10-bit');
    else if (lowerText.includes('8bit') || lowerText.includes('8-bit')) details.add('8-bit');
    return Array.from(details);
}

function buildApiUrl(mediaType, tmdbId, seasonNum, episodeNum, region, cookie) {
    if (mediaType === 'tv' && seasonNum && episodeNum) {
        return `${SHOWBOX_API_BASE}/tv/${tmdbId}/oss=${region}/${seasonNum}/${episodeNum}?cookie=${encodeURIComponent(cookie)}`;
    } else {
        return `${SHOWBOX_API_BASE}/movie/${tmdbId}/oss=${region}?cookie=${encodeURIComponent(cookie)}`;
    }
}

function fetchStreams(apiUrl, mediaInfo, mediaType, seasonNum, episodeNum) {
    console.log(`[ShowBox] Requesting: ${apiUrl}`);
    return makeRequest(apiUrl)
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            return processShowBoxResponse(data, mediaInfo, mediaType, seasonNum, episodeNum);
        });
}

function makeRequest(url, options = {}) {
    return fetch(url, {
        method: options.method || 'GET',
        headers: { ...WORKING_HEADERS, ...options.headers },
        ...options
    }).then(function(response) {
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response;
    });
}

function getTMDBDetails(tmdbId, mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    return makeRequest(url)
        .then(res => res.json())
        .then(data => {
            const title = mediaType === 'tv' ? data.name : data.title;
            const releaseDate = mediaType === 'tv' ? data.first_air_date : data.release_date;
            return { title: title, year: releaseDate ? parseInt(releaseDate.split('-')[0]) : null };
        })
        .catch(() => ({ title: `TMDB ID ${tmdbId}`, year: null }));
}

function processShowBoxResponse(data, mediaInfo, mediaType, seasonNum, episodeNum) {
    const streams = [];
    try {
        if (!data || !data.success || !data.versions) return streams;
        let baseTitle = mediaInfo.title || 'Unknown Title';
        if (mediaType === 'tv' && seasonNum && episodeNum) {
            baseTitle = `${mediaInfo.title} S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`;
        }
        data.versions.forEach(function(version, versionIndex) {
            const versionName = version.name || `Version ${versionIndex + 1}`;
            const codecs = extractCodecDetails(versionName);
            const codecLine = codecs.length > 0 ? codecs.join(' • ') : null;

            if (version.links) {
                version.links.forEach(function(link) {
                    if (!link.url) return;
                    const normalizedQuality = getQualityFromName(link.quality || 'Unknown');
                    let streamName = `ShowBox${data.versions.length > 1 ? ' V' + (versionIndex + 1) : ''} - ${normalizedQuality}`;
                    const fullTitle = codecLine ? `${baseTitle} ${normalizedQuality}\n${codecLine}` : `${baseTitle} ${normalizedQuality}`;

                    streams.push({
                        name: streamName,
                        title: fullTitle,
                        url: link.url,
                        quality: normalizedQuality,
                        size: formatFileSize(link.size || version.size),
                        provider: 'showbox'
                    });
                });
            }
        });
    } catch (e) { console.error(`[ShowBox] Error processing: ${e.message}`); }
    return streams;
}

/**
 * MODIFIED: Now an async function to allow the token fetch to complete.
 */
async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        // Await the token from your server
        const cookie = await getUiToken();
        if (!cookie) {
            console.error('[ShowBox] No cookie found');
            return [];
        }

        const ossGroup = getOssGroup();
        const mediaInfo = await getTMDBDetails(tmdbId, mediaType);

        const primaryUrl  = buildApiUrl(mediaType, tmdbId, seasonNum, episodeNum, ossGroup, cookie);
        const fallbackUrl = buildApiUrl(mediaType, tmdbId, seasonNum, episodeNum, SHOWBOX_FALLBACK_REGION, cookie);

        let streams = await fetchStreams(primaryUrl, mediaInfo, mediaType, seasonNum, episodeNum);
        
        if (streams.length === 0) {
            console.log(`[ShowBox] Trying fallback region...`);
            streams = await fetchStreams(fallbackUrl, mediaInfo, mediaType, seasonNum, episodeNum);
        }

        streams.sort(function(a, b) {
            const qualityOrder = { 'Original': 6, '4K': 5, '1440p': 4, '1080p': 3, '720p': 2, '480p': 1, '360p': 0, '240p': -1, 'Unknown': -2 };
            return (qualityOrder[b.quality] || -2) - (qualityOrder[a.quality] || -2);
        });

        return streams;
    } catch (error) {
        console.error(`[ShowBox] Error in getStreams: ${error.message}`);
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.ShowBoxScraperModule = { getStreams };
}
