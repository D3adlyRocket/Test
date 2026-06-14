Can you also do this please 

const CryptoJS = require('crypto-js');

const PROVIDER_NAME = "Cinestream";
const SECRET_KEY = "Penguin";
const API_BASE = "https://cinestream.kje.us/api";
const TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";

async function fetchJson(url, options) {
    try {
        const res = await fetch(url, options);
        if (res && res.ok) return await res.json();
        return null;
    } catch (e) {
        return null;
    }
}

function decryptCinestreamPayload(encryptedString) {
    if (!encryptedString) return null;
    try {
        let base64String = encryptedString.replace(/-/g, "+").replace(/_/g, "/");
        let decryptedBytes = CryptoJS.AES.decrypt(base64String, SECRET_KEY);
        let decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
        if (!decryptedText) return null;
        return JSON.parse(decryptedText);
    } catch (e) {
        return null;
    }
}

async function getStreams(tmdbId, mediaType, season, episode) {
    let streams = [];
    const isTv = (mediaType === "tv" || mediaType === "series");

    // 1. Fetch title from TMDB
    let tmdbApiUrl = `https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    let tmdbData = await fetchJson(tmdbApiUrl, {});
    if (!tmdbData) return streams;

    let title = tmdbData.title || tmdbData.name || tmdbData.original_title || tmdbData.original_name;
    if (!title) return streams;
    
    // Clean up title (take before colon or hyphen)
    let baseTitle = title.split(':')[0].split('-')[0].trim();

    // 2. Search API
    const searchRes = await fetchJson(`${API_BASE}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
        body: JSON.stringify({ q: baseTitle, limit: 40 })
    });

    if (!searchRes) return streams;

    const listToSearch = isTv ? searchRes.series : searchRes.movies;
    if (!listToSearch || !Array.isArray(listToSearch)) return streams;

    let match = listToSearch.find(item => item.tmdbId === parseInt(tmdbId));
    if (!match) {
        // Fallback to title match in case Cinestream has the wrong TMDB ID
        match = listToSearch.find(item => item.title && item.title.toLowerCase() === title.toLowerCase());
    }
    if (!match || !match._id) return streams;

    const internalId = match._id;

    // 3. Details API
    const detailsRes = await fetchJson(`${API_BASE}/details`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
        body: JSON.stringify({
            type: isTv ? "series" : "movies",
            id: internalId
        })
    });

    if (!detailsRes || !detailsRes.data) return streams;

    // 4. Decrypt
    const decryptedData = decryptCinestreamPayload(detailsRes.data);
    if (!decryptedData) return streams;
    
    // Extract Spoken Languages
    let langs = "";
    if (decryptedData.spokenLanguages && Array.isArray(decryptedData.spokenLanguages)) {
        let langNames = decryptedData.spokenLanguages.map(l => l.name).filter(Boolean);
        if (langNames.length > 0) langs = ` [${langNames.join(", ")}]`;
    }

    // 5. Extract links
    let targetLinks = [];

    if (isTv) {
        if (!decryptedData.seasons || !Array.isArray(decryptedData.seasons)) return streams;
        const targetSeasonObj = decryptedData.seasons.find(s => s.seasonNumber === parseInt(season));
        if (!targetSeasonObj || !targetSeasonObj.episodes) return streams;

        const targetEpisodeObj = targetSeasonObj.episodes.find(e => e.episodeNumber === parseInt(episode));
        if (!targetEpisodeObj || !targetEpisodeObj.streamingLinks) return streams;

        targetLinks = targetEpisodeObj.streamingLinks;
    } else {
        if (!decryptedData.streamingLinks) return streams;
        targetLinks = decryptedData.streamingLinks;
    }

    let order = { "2160p": 5, "1080p": 4, "720p": 3, "480p": 2, "HD": 1 };

    targetLinks.forEach(link => {
        if (link && link.url) {
            let quality = link.quality || "HD";
            let qNum = order[quality] || 0;
            let titlePrefix = isTv ? `${title} S${season}E${episode}` : title;
            let subTitle = `${quality}${langs} \u00B7 Cinestream`;

            streams.push({
                name: `${titlePrefix} - ${PROVIDER_NAME} | ${quality}`,
                title: `${titlePrefix}\n${subTitle}`,
                size: subTitle,
                url: link.url,
                quality: quality,
                qNum: qNum,
                format: link.type === "hls" || link.url.includes(".m3u8") ? "m3u8" : "mp4",
                headers: {
                    "origin": "https://cinestream.kje.us",
                    "referer": "https://cinestream.kje.us/"
                }
            });
        }
    });

    streams.sort((a, b) => b.qNum - a.qNum);
    streams.forEach(s => delete s.qNum);

    return streams;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
