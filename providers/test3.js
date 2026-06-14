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
    const sNum = Number.isInteger(season) ? season : parseInt(season, 10) || 1;
    const eNum = Number.isInteger(episode) ? episode : parseInt(episode, 10) || 1;

    // 1. Fetch title and correct runtime info from TMDB
    let tmdbApiUrl = `https://api.themoviedb.org/3/${isTv ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    let tmdbData = await fetchJson(tmdbApiUrl, {});
    if (!tmdbData) return streams;

    let title = tmdbData.title || tmdbData.name || tmdbData.original_title || tmdbData.original_name;
    if (!title) return streams;
    
    // Resolve runtime data safely
    let resolvedRuntime = 0;
    if (isTv) {
        // Query specific episode endpoint to grab actual runtime payload cleanly
        let tmdbEpUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${sNum}/episode/${eNum}?api_key=${TMDB_API_KEY}`;
        let epData = await fetchJson(tmdbEpUrl, {});
        if (epData && epData.runtime) {
            resolvedRuntime = epData.runtime;
        } else if (tmdbData.episode_run_time && tmdbData.episode_run_time.length > 0) {
            resolvedRuntime = tmdbData.episode_run_time[0];
        }
    } else {
        resolvedRuntime = tmdbData.runtime || 0;
    }

    // Capture explicit launch year
    let dateStr = tmdbData.release_date || tmdbData.first_air_date || "";
    let displayYear = dateStr ? ` (${dateStr.slice(0, 4)})` : "";
    
    // Clean up title (take before colon or hyphen) for search optimization
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
        // Fallback to title match in case Cinestream has the wrong TMDB ID mapping
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
    
    // Extract Spoken Languages for output tags
    let audioTag = "Multi-Audio";
    let langsLabel = "Multi";
    if (decryptedData.spokenLanguages && Array.isArray(decryptedData.spokenLanguages)) {
        let langNames = decryptedData.spokenLanguages.map(l => l.name).filter(Boolean);
        if (langNames.length > 0) {
            langsLabel = langNames.join(", ");
            audioTag = langNames.includes("English") && langNames.length === 1 ? "Single-Audio" : "Multi-Audio";
        }
    }

    // 5. Extract links
    let targetLinks = [];

    if (isTv) {
        if (!decryptedData.seasons || !Array.isArray(decryptedData.seasons)) return streams;
        const targetSeasonObj = decryptedData.seasons.find(s => s.seasonNumber === sNum);
        if (!targetSeasonObj || !targetSeasonObj.episodes) return streams;

        const targetEpisodeObj = targetSeasonObj.episodes.find(e => e.episodeNumber === eNum);
        if (!targetEpisodeObj || !targetEpisodeObj.streamingLinks) return streams;

        targetLinks = targetEpisodeObj.streamingLinks;
    } else {
        if (!decryptedData.streamingLinks) return streams;
        targetLinks = decryptedData.streamingLinks;
    }

    let order = { "2160p": 5, "1080p": 4, "720p": 3, "480p": 2, "HD": 1 };

    targetLinks.forEach(link => {
        if (link && link.url) {
            let quality = link.quality || "1080p";
            if (quality === "HD") quality = "1080p"; // Normalize label styling
            
            let qNum = order[quality] || 0;
            let qIcon = quality.includes("4K") || quality.includes("2160") ? "🌟" : "💎";
            
            // Format Stream Type Evaluation
            let isM3u8 = link.type === "hls" || link.url.includes(".m3u8");
            let formatLabel = isM3u8 ? "M3U8 / HLS" : "MP4";

            // Title Heading Text
            let rawTitle = isTv ? `${title} - S${String(sNum).padStart(2, '0')}E${String(eNum).padStart(2, '0')}${displayYear}` : `${title}${displayYear}`;
            
            // Format precise execution duration data strings
            let durationStr = "N/A";
            if (resolvedRuntime && Number.isInteger(resolvedRuntime) && resolvedRuntime > 0) {
                durationStr = `${resolvedRuntime} min`;
            }

            // Construct Unified Three-Tier Subheading Blocks
            let row1 = `🎬 ${rawTitle}`;
            let row2 = `${qIcon} ${quality} | 🌍 ${audioTag} | 🔊 ${audioTag} | 🗃️ Server 1`;
            let row3 = `🎞️ ${formatLabel} | ⏱️ ${durationStr} | 📌 ${langsLabel} • WEB-DL`;
            let finalSubtitlesBlock = `${row1}\n${row2}\n${row3}`;

            streams.push({
                name: `${PROVIDER_NAME} | ${quality} | ${audioTag}`,
                title: finalSubtitlesBlock,
                description: finalSubtitlesBlock,
                size: row2,
                url: link.url,
                quality: quality,
                qNum: qNum,
                format: isM3u8 ? "m3u8" : "mp4",
                headers: {
                    "Origin": "https://cinestream.kje.us",
                    "Referer": "https://cinestream.kje.us/"
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
