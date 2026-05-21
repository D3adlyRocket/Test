// Vidlink Scraper for Nuvio
// Fully Fixed Version

const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const ENC_DEC_API = "https://enc-dec.app/api";
const VIDLINK_API = "https://vidlink.pro/api/b";

const VIDLINK_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://vidlink.pro/",
    "Origin": "https://vidlink.pro"
};

// ======================
// HELPERS
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

function calculateCalculatedFallbackSize(quality, durationText) {

    const mins = parseInt(durationText) || 90;

    const norm = String(quality || "").toLowerCase();

    let bitrateKbps = 5200;

    if (norm.includes("4k") || norm.includes("2160")) {
        bitrateKbps = 16000;
    } else if (norm.includes("1440")) {
        bitrateKbps = 9000;
    } else if (norm.includes("1080")) {
        bitrateKbps = 5200;
    } else if (norm.includes("720")) {
        bitrateKbps = 2500;
    } else if (norm.includes("480")) {
        bitrateKbps = 1200;
    }

    const calculatedBytes =
        ((bitrateKbps * 1000) / 8) * (mins * 60);

    return formatBytes(calculatedBytes);
}

function buildTitle(
    meta,
    res,
    lang,
    format,
    size,
    season,
    episode
) {

    const qIcon =
        res.includes("4K") || res.includes("2160")
            ? "🌟"
            : "💎";

    let line1 = "🎬 ";

    if (season && episode) {

        line1 += `S${season} E${episode} | ${meta.name}`;

        if (meta.episodeTitle) {
            line1 += ` | ${meta.episodeTitle}`;
        }

    } else {

        line1 += `${meta.name}${meta.year ? ` (${meta.year})` : ""}`;
    }

    const line2 =
        `${qIcon} ${res} | 🌍 ${lang} | 💾 ${size}`;

    const line3 =
        `🎞️ ${format.toUpperCase()} | ⏱️ ${meta.duration} | 📼 AVC • 🔊 AAC`;

    return `${line1}\n${line2}\n${line3}`;
}

function makeRequest(url, options = {}) {

    return fetch(url, {
        method: options.method || "GET",
        headers: {
            ...VIDLINK_HEADERS,
            ...(options.headers || {})
        }
    }).then(response => {

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response;
    });
}

// ======================
// IMDB -> TMDB
// ======================

function getTmdbId(imdbId, type) {

    const normalizedType =
        String(type).toLowerCase();

    const findUrl =
        `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;

    return fetch(findUrl)
        .then(r => r.json())
        .then(data => {

            if (
                normalizedType === "movie" &&
                data.movie_results &&
                data.movie_results.length > 0
            ) {
                return data.movie_results[0].id.toString();
            }

            if (
                normalizedType === "tv" &&
                data.tv_results &&
                data.tv_results.length > 0
            ) {
                return data.tv_results[0].id.toString();
            }

            return imdbId;
        })
        .catch(() => imdbId);
}

// ======================
// TMDB INFO
// ======================

function getTmdbInfo(
    tmdbId,
    mediaType,
    seasonNum = null,
    episodeNum = null
) {

    const endpoint =
        mediaType === "tv"
            ? "tv"
            : "movie";

    const url =
        `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    return makeRequest(url)
        .then(r => r.json())
        .then(data => {

            const title =
                mediaType === "tv"
                    ? data.name
                    : data.title;

            const year =
                mediaType === "tv"
                    ? data.first_air_date?.substring(0, 4)
                    : data.release_date?.substring(0, 4);

            let duration =
                mediaType === "tv"
                    ? `${data.episode_run_time?.[0] || 45} min`
                    : `${data.runtime || 90} min`;

            if (
                mediaType === "tv" &&
                seasonNum &&
                episodeNum
            ) {

                const epUrl =
                    `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNum}/episode/${episodeNum}?api_key=${TMDB_API_KEY}`;

                return makeRequest(epUrl)
                    .then(r => r.json())
                    .then(epData => {

                        if (epData.runtime) {
                            duration = `${epData.runtime} min`;
                        }

                        return {
                            title,
                            year,
                            duration,
                            episodeTitle: epData.name || ""
                        };
                    })
                    .catch(() => ({
                        title,
                        year,
                        duration,
                        episodeTitle: ""
                    }));
            }

            return {
                title,
                year,
                duration,
                episodeTitle: ""
            };
        });
}

// ======================
// ENCRYPT
// ======================

function encryptTmdbId(tmdbId) {

    return makeRequest(
        `${ENC_DEC_API}/enc-vidlink?text=${tmdbId}`
    )
        .then(r => r.json())
        .then(data => {

            if (data && data.result) {
                return data.result;
            }

            throw new Error("Encryption failed");
        });
}

// ======================
// QUALITY
// ======================

function extractQuality(label) {

    const q = String(label || "").toLowerCase();

    if (q.includes("2160") || q.includes("4k")) {
        return "4K";
    }

    if (q.includes("1440")) {
        return "1440p";
    }

    if (q.includes("1080")) {
        return "1080p";
    }

    if (q.includes("720")) {
        return "720p";
    }

    if (q.includes("480")) {
        return "480p";
    }

    return "Auto";
}

// ======================
// MAIN
// ======================

function getStreams(
    tmdbId,
    mediaType = "movie",
    seasonNum = null,
    episodeNum = null
) {

    // Convert IMDb IDs
    if (String(tmdbId).startsWith("tt")) {

        return getTmdbId(tmdbId, mediaType)
            .then(convertedId => {

                return getStreams(
                    convertedId,
                    mediaType,
                    seasonNum,
                    episodeNum
                );
            });
    }

    return getTmdbInfo(
        tmdbId,
        mediaType,
        seasonNum,
        episodeNum
    )
    .then(tmdbInfo => {

        return encryptTmdbId(tmdbId)
            .then(encryptedId => {

                let vidlinkUrl;

                if (
                    mediaType === "tv" &&
                    seasonNum &&
                    episodeNum
                ) {

                    vidlinkUrl =
                        `${VIDLINK_API}/tv/${encryptedId}/${seasonNum}/${episodeNum}`;

                } else {

                    vidlinkUrl =
                        `${VIDLINK_API}/movie/${encryptedId}`;
                }

                return makeRequest(vidlinkUrl)
                    .then(r => r.json())
                    .then(data => {

                        const streams = [];

                        if (
                            data.stream &&
                            data.stream.qualities
                        ) {

                            Object.entries(
                                data.stream.qualities
                            ).forEach(([qualityKey, qualityData]) => {

                                if (!qualityData.url) return;

                                const quality =
                                    extractQuality(qualityKey);

                                const size =
                                    calculateCalculatedFallbackSize(
                                        quality,
                                        tmdbInfo.duration
                                    );

                                const formattedTitle =
                                    buildTitle(
                                        {
                                            name: tmdbInfo.title,
                                            year: tmdbInfo.year,
                                            duration: tmdbInfo.duration,
                                            episodeTitle: tmdbInfo.episodeTitle
                                        },
                                        quality,
                                        "Multi-Audio",
                                        qualityData.url.includes(".m3u8")
                                            ? "M3U8"
                                            : "MP4",
                                        size,
                                        seasonNum,
                                        episodeNum
                                    );

                                streams.push({
                                    name:
                                        `🎦 Vidlink | ${quality} | Multi-Audio`,

                                    title: formattedTitle,

                                    url: qualityData.url,

                                    quality: quality,

                                    size: size,

                                    headers: VIDLINK_HEADERS,

                                    provider: "vidlink"
                                });
                            });
                        }

                        return streams;
                    });
            });
    })
    .catch(error => {

        console.error(
            `[Vidlink] ${error.message}`
        );

        return [];
    });
}

// ======================
// EXPORT
// ======================

if (
    typeof module !== "undefined" &&
    module.exports
) {

    module.exports = {
        getStreams
    };

} else {

    global.VidlinkScraperModule = {
        getStreams
    };
}
