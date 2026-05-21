const TMDB_API_KEY = "68e094699525b18a70bab2f86b1fa706";
const ENC_DEC_API = "https://enc-dec.app/api";
const VIDLINK_API = "https://vidlink.pro/api/b";

const HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://vidlink.pro/",
    "Origin": "https://vidlink.pro"
};

function request(url) {
    return fetch(url, {
        headers: HEADERS
    }).then(r => {
        if (!r.ok) {
            throw new Error(`HTTP ${r.status}`);
        }
        return r;
    });
}

function getQuality(q) {

    q = String(q || "").toLowerCase();

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

function getTmdbId(imdbId, type) {

    const url =
        `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;

    return request(url)
        .then(r => r.json())
        .then(data => {

            if (
                type === "movie" &&
                data.movie_results &&
                data.movie_results.length
            ) {
                return data.movie_results[0].id;
            }

            if (
                type === "tv" &&
                data.tv_results &&
                data.tv_results.length
            ) {
                return data.tv_results[0].id;
            }

            throw new Error("TMDB conversion failed");
        });
}

function getTmdbInfo(id, mediaType) {

    const endpoint =
        mediaType === "tv"
            ? "tv"
            : "movie";

    const url =
        `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${TMDB_API_KEY}`;

    return request(url)
        .then(r => r.json())
        .then(data => {

            return {
                title:
                    mediaType === "tv"
                        ? data.name
                        : data.title,

                year:
                    mediaType === "tv"
                        ? data.first_air_date?.slice(0, 4)
                        : data.release_date?.slice(0, 4),

                duration:
                    mediaType === "tv"
                        ? `${data.episode_run_time?.[0] || 45} min`
                        : `${data.runtime || 90} min`
            };
        });
}

function encryptTmdbId(id) {

    return request(
        `${ENC_DEC_API}/enc-vidlink?text=${id}`
    )
        .then(r => r.json())
        .then(data => {

            if (!data.result) {
                throw new Error("Encryption failed");
            }

            return data.result;
        });
}

function buildTitle(title, year, quality, duration) {

    return [
        `🎬 ${title}${year ? ` (${year})` : ""}`,
        `💎 ${quality} | 🌍 Multi-Audio`,
        `⏱️ ${duration} | 📼 AVC • 🔊 AAC`
    ].join("\n");
}

async function getStreams(
    id,
    mediaType = "movie",
    season = null,
    episode = null
) {

    try {

        // IMDb -> TMDB
        if (String(id).startsWith("tt")) {

            id = await getTmdbId(
                id,
                mediaType
            );
        }

        const info =
            await getTmdbInfo(
                id,
                mediaType
            );

        const encryptedId =
            await encryptTmdbId(id);

        let apiUrl;

        if (
            mediaType === "tv" &&
            season &&
            episode
        ) {

            apiUrl =
                `${VIDLINK_API}/tv/${encryptedId}/${season}/${episode}`;

        } else {

            apiUrl =
                `${VIDLINK_API}/movie/${encryptedId}`;
        }

        const data =
            await request(apiUrl)
                .then(r => r.json());

        console.log(
            "[Vidlink RAW]",
            JSON.stringify(data)
        );

        const streams = [];

        // qualities format
        if (
            data.stream &&
            data.stream.qualities
        ) {

            Object.entries(
                data.stream.qualities
            ).forEach(([key, value]) => {

                if (!value.url) return;

                const quality =
                    getQuality(key);

                streams.push({
                    name:
                        `🎦 Vidlink ${quality}`,

                    title:
                        buildTitle(
                            info.title,
                            info.year,
                            quality,
                            info.duration
                        ),

                    url: value.url,

                    quality,

                    headers: HEADERS,

                    provider: "vidlink"
                });
            });
        }

        // playlist format
        else if (
            data.stream &&
            data.stream.playlist
        ) {

            streams.push({
                name: "🎦 Vidlink Auto",

                title:
                    buildTitle(
                        info.title,
                        info.year,
                        "Auto",
                        info.duration
                    ),

                url:
                    data.stream.playlist,

                quality: "Auto",

                headers: HEADERS,

                provider: "vidlink"
            });
        }

        // direct url format
        else if (data.url) {

            streams.push({
                name: "🎦 Vidlink",

                title:
                    buildTitle(
                        info.title,
                        info.year,
                        "Auto",
                        info.duration
                    ),

                url: data.url,

                quality: "Auto",

                headers: HEADERS,

                provider: "vidlink"
            });
        }

        console.log(
            `[Vidlink] Found ${streams.length} streams`
        );

        return streams;

    } catch (e) {

        console.log(
            "[Vidlink ERROR]",
            e.message
        );

        return [];
    }
}

module.exports = {
    getStreams
};
