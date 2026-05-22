// Vidlink Scraper for Nuvio Local Scrapers
// React Native compatible version - Standalone (no external dependencies)
// ONLY UI formatting enhanced - Core logic untouched

// Constants
const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const ENC_DEC_API = "https://enc-dec.app/api";
const VIDLINK_API = "https://vidlink.pro/api/b";

// Required headers for Vidlink requests
const VIDLINK_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    "Connection": "keep-alive",
    "Referer": "https://vidlink.pro/",
    "Origin": "https://vidlink.pro"
};

// ======================
// UI HELPERS
// ======================

function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return "Variable Size";

    const units = ["B", "KB", "MB", "GB"];
    let i = 0;

    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024;
        i++;
    }

    return `${bytes.toFixed(2)} ${units[i]}`;
}

function calculateFallbackSize(quality, durationText) {
    const mins = parseInt(durationText) || 90;
    const norm = String(quality || "").toLowerCase();

    let bitrateKbps = 5200;

    if (norm.includes("4k") || norm.includes("2160")) bitrateKbps = 16000;
    else if (norm.includes("1440") || norm.includes("2k")) bitrateKbps = 9000;
    else if (norm.includes("1080")) bitrateKbps = 5200;
    else if (norm.includes("720")) bitrateKbps = 2500;
    else if (norm.includes("480")) bitrateKbps = 1200;

    const calculatedBytes = ((bitrateKbps * 1000) / 8) * (mins * 60);

    return formatBytes(calculatedBytes);
}

function buildTitle(meta, res, lang, format, size, season, episode) {

    const qIcon = res.includes("4K") || res.includes("2160")
        ? "🌟"
        : "💎";

    let line1 = "🎬 ";

    if (season && episode) {

        line1 += `S${season} E${episode} | ${meta.title}`;

        if (meta.episodeTitle) {
            line1 += ` | ${meta.episodeTitle}`;
        }

    } else {

        line1 += `${meta.title}${meta.year ? ` (${meta.year})` : ""}`;
    }

    const line2 = `${qIcon} ${res} | 🌍 ${lang} | 💾 ${size}`;
    const line3 = `🎞️ ${format} | ⏱️ ${meta.duration || "Unknown"} | 📼 AVC • 🔊 AAC`;

    return `${line1}\n${line2}\n${line3}`;
}

// ======================
// REQUEST HELPER
// ======================

function makeRequest(url, options = {}) {

    const defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        'Accept': 'application/json,*/*',
        'Accept-Language': 'en-US,en;q=0.5',
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

        console.error(`[Vidlink] Request failed for ${url}: ${error.message}`);
        throw error;
    });
}

// ======================
// M3U8 PARSING
// ======================

function parseM3U8(content, baseUrl) {

    const lines = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line);

    const streams = [];

    let currentStream = null;

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i];

        if (line.startsWith('#EXT-X-STREAM-INF:')) {

            currentStream = {
                bandwidth: null,
                resolution: null,
                url: null
            };

            const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);

            if (bandwidthMatch) {
                currentStream.bandwidth = parseInt(bandwidthMatch[1]);
            }

            const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);

            if (resolutionMatch) {
                currentStream.resolution = resolutionMatch[1];
            }

        } else if (currentStream && !line.startsWith('#')) {

            currentStream.url = resolveUrl(line, baseUrl);
            streams.push(currentStream);
            currentStream = null;
        }
    }

    return streams;
}

function resolveUrl(url, baseUrl) {

    if (url.startsWith('http')) {
        return url;
    }

    try {
        return new URL(url, baseUrl).toString();
    } catch (error) {
        console.error(`[Vidlink] Could not resolve URL: ${url}`);
        return url;
    }
}

function getQualityFromResolution(resolution) {

    if (!resolution) return 'Auto';

    const [width, height] = resolution.split('x').map(Number);

    if (height >= 2160) return '4K';
    if (height >= 1440) return '1440p';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height >= 360) return '360p';

    return '240p';
}

// ======================
// FETCH & PARSE PLAYLIST
// ======================

function fetchAndParseM3U8(playlistUrl, mediaInfo) {

    return makeRequest(playlistUrl, {
        headers: VIDLINK_HEADERS
    })

    .then(response => response.text())

    .then(m3u8Content => {

        const parsedStreams = parseM3U8(m3u8Content, playlistUrl);

        if (parsedStreams.length === 0) {

            const fallbackTitle = buildTitle(
                mediaInfo,
                "Auto",
                "Original Audio",
                "M3U8",
                calculateFallbackSize("Auto", mediaInfo.duration),
                mediaInfo.season,
                mediaInfo.episode
            );

            return [{
                name: `🎦 Vidlink | Auto | Original Audio`,
                title: fallbackTitle,
                url: playlistUrl,
                quality: 'Auto',
                size: 'Unknown',
                headers: VIDLINK_HEADERS,
                provider: 'vidlink'
            }];
        }

        return parsedStreams.map(stream => {

            const quality = getQualityFromResolution(stream.resolution);

            const formattedTitle = buildTitle(
                mediaInfo,
                quality,
                "Original Audio",
                "M3U8",
                calculateFallbackSize(quality, mediaInfo.duration),
                mediaInfo.season,
                mediaInfo.episode
            );

            return {
                name: `🎦 Vidlink | ${quality} | Original Audio`,
                title: formattedTitle,
                url: stream.url,
                quality: quality,
                size: calculateFallbackSize(quality, mediaInfo.duration),
                headers: VIDLINK_HEADERS,
                provider: 'vidlink'
            };
        });
    })

    .catch(error => {

        console.error(`[Vidlink] M3U8 Error: ${error.message}`);

        return [];
    });
}

// ======================
// TMDB INFO
// ======================

function getTmdbInfo(tmdbId, mediaType, seasonNum = null, episodeNum = null) {

    const url =
        `https://api.themoviedb.org/3/${
            mediaType === 'tv' ? 'tv' : 'movie'
        }/${tmdbId}?api_key=${TMDB_API_KEY}`;

    return makeRequest(url)

    .then(response => response.json())

    .then(data => {

        const title =
            mediaType === 'tv'
                ? data.name
                : data.title;

        const year =
            mediaType === 'tv'
                ? data.first_air_date?.substring(0, 4)
                : data.release_date?.substring(0, 4);

        if (!title) {
            throw new Error('Could not extract title');
        }

        // TV EPISODE METADATA
        if (mediaType === 'tv' && seasonNum && episodeNum) {

            const epUrl =
                `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNum}/episode/${episodeNum}?api_key=${TMDB_API_KEY}`;

            return makeRequest(epUrl)

            .then(res => res.json())

            .then(epData => ({

                title,
                year,
                duration: epData.runtime
                    ? `${epData.runtime} min`
                    : "45 min",

                episodeTitle: epData.name || "",
                data
            }))

            .catch(() => ({

                title,
                year,
                duration: "45 min",
                episodeTitle: "",
                data
            }));
        }

        // MOVIES
        return {

            title,
            year,
            duration: data.runtime
                ? `${data.runtime} min`
                : "90 min",

            episodeTitle: "",
            data
        };
    });
}

// ======================
// ENCRYPT TMDB ID
// ======================

function encryptTmdbId(tmdbId) {

    return makeRequest(
        `${ENC_DEC_API}/enc-vidlink?text=${tmdbId}`
    )

    .then(response => response.json())

    .then(data => {

        if (data && data.result) {
            return data.result;
        }

        throw new Error('Invalid encryption response');
    });
}

// ======================
// QUALITY DETECTION
// ======================

function extractQuality(streamData) {

    if (!streamData) return 'Unknown';

    const qualityFields = [
        'quality',
        'resolution',
        'label',
        'name'
    ];

    for (const field of qualityFields) {

        if (streamData[field]) {

            const quality =
                streamData[field]
                    .toString()
                    .toLowerCase();

            if (quality.includes('2160') || quality.includes('4k')) return '4K';
            if (quality.includes('1440') || quality.includes('2k')) return '1440p';
            if (quality.includes('1080')) return '1080p';
            if (quality.includes('720')) return '720p';
            if (quality.includes('480')) return '480p';
            if (quality.includes('360')) return '360p';
            if (quality.includes('240')) return '240p';
        }
    }

    return 'Unknown';
}

// ======================
// PROCESS VIDLINK RESPONSE
// ======================

function processVidlinkResponse(data, mediaInfo) {

    const streams = [];

    try {

        if (data.stream && data.stream.qualities) {

            Object.entries(data.stream.qualities)

            .forEach(([qualityKey, qualityData]) => {

                if (qualityData.url) {

                    const quality =
                        extractQuality({
                            quality: qualityKey
                        });

                    const formattedTitle = buildTitle(
                        mediaInfo,
                        quality,
                        "Original Audio",
                        "M3U8",
                        calculateFallbackSize(
                            quality,
                            mediaInfo.duration
                        ),
                        mediaInfo.season,
                        mediaInfo.episode
                    );

                    streams.push({

                        name:
                            `🎦 Vidlink | ${quality} | Original Audio`,

                        title: formattedTitle,

                        url: qualityData.url,

                        quality: quality,

                        size: calculateFallbackSize(
                            quality,
                            mediaInfo.duration
                        ),

                        headers: VIDLINK_HEADERS,

                        provider: 'vidlink'
                    });
                }
            });

            if (data.stream.playlist) {

                streams.push({

                    _isPlaylist: true,

                    url: data.stream.playlist,

                    mediaInfo
                });
            }
        }

        else if (
            data.stream &&
            data.stream.playlist &&
            !data.stream.qualities
        ) {

            streams.push({

                _isPlaylist: true,

                url: data.stream.playlist,

                mediaInfo
            });
        }

    } catch (error) {

        console.error(
            `[Vidlink] Response Processing Error: ${error.message}`
        );
    }

    return streams;
}

// ======================
// MAIN GET STREAMS
// ======================

function getStreams(
    tmdbId,
    mediaType = 'movie',
    seasonNum = null,
    episodeNum = null
) {

    console.log(
        `[Vidlink] Fetching streams for TMDB ID: ${tmdbId}`
    );

    return getTmdbInfo(
        tmdbId,
        mediaType,
        seasonNum,
        episodeNum
    )

    .then(tmdbInfo => {

        const {
            title,
            year,
            duration,
            episodeTitle
        } = tmdbInfo;

        return encryptTmdbId(tmdbId)

        .then(encryptedId => {

            let vidlinkUrl;

            if (
                mediaType === 'tv' &&
                seasonNum &&
                episodeNum
            ) {

                vidlinkUrl =
                    `${VIDLINK_API}/tv/${encryptedId}/${seasonNum}/${episodeNum}`;

            } else {

                vidlinkUrl =
                    `${VIDLINK_API}/movie/${encryptedId}`;
            }

            return makeRequest(vidlinkUrl, {
                headers: VIDLINK_HEADERS
            })

            .then(response => response.json())

            .then(data => {

                const mediaInfo = {

                    title,
                    year,
                    duration,
                    episodeTitle,

                    mediaType,

                    season: seasonNum,
                    episode: episodeNum
                };

                const streams =
                    processVidlinkResponse(
                        data,
                        mediaInfo
                    );

                if (streams.length === 0) {
                    return [];
                }

                const playlistStreams =
                    streams.filter(s => s._isPlaylist);

                const directStreams =
                    streams.filter(s => !s._isPlaylist);

                if (playlistStreams.length > 0) {

                    const playlistPromises =
                        playlistStreams.map(ps =>
                            fetchAndParseM3U8(
                                ps.url,
                                ps.mediaInfo
                            )
                        );

                    return Promise.all(playlistPromises)

                    .then(parsedArrays => {

                        const allStreams =
                            directStreams.concat(...parsedArrays);

                        const qualityOrder = {
                            '4K': 5,
                            '1440p': 4,
                            '1080p': 3,
                            '720p': 2,
                            '480p': 1,
                            '360p': 0,
                            '240p': -1,
                            'Auto': -2,
                            'Unknown': -3
                        };

                        allStreams.sort((a, b) =>
                            (qualityOrder[b.quality] || -3) -
                            (qualityOrder[a.quality] || -3)
                        );

                        return allStreams;
                    });
                }

                return directStreams;
            });
        });
    })

    .catch(error => {

        console.error(
            `[Vidlink] Error in getStreams: ${error.message}`
        );

        return [];
    });
}

// ======================
// EXPORT
// ======================

if (typeof module !== 'undefined' && module.exports) {

    module.exports = {
        getStreams
    };

} else {

    global.VidlinkScraperModule = {
        getStreams
    };
}
