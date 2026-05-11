// MovieBox Scraper for Nuvio (Optimized H5 Version)
const TMDB_API_KEY = 'd131017ccc6e5462a81c9304d21476de';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MOVIEBOX_API = "https://h5.aoneroom.com";

const BASE_HEADERS = {
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.5",
    "Host": "h5.aoneroom.com",
    "Origin": "https://fmoviesunblocked.net",
    "Referer": "https://h5.aoneroom.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-Client-Info": '{"timezone":"Asia/Calcutta"}'
};

async function fetchWithHeaders(url, options = {}) {
    const headers = { ...BASE_HEADERS, ...(options.headers || {}) };
    return fetch(url, { ...options, headers });
}

// 1. Get TMDB Details
async function fetchTmdbDetails(tmdbId, mediaType) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return {
            title: data.title || data.name,
            year: (data.release_date || data.first_air_date || '').substring(0, 4)
        };
    } catch (e) { return null; }
}

// 2. Search MovieBox (Session Initialized)
async function searchMovieBox(title, mediaType) {
    try {
        // Essential: Initialize session as per the working script
        await fetchWithHeaders(`${MOVIEBOX_API}/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox`).catch(() => {});

        const body = JSON.stringify({
            keyword: title,
            page: 1,
            perPage: 24,
            subjectType: mediaType === "tv" ? 2 : 1
        });

        const res = await fetchWithHeaders(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/search`, {
            method: "POST",
            body
        });
        const json = await res.json();
        const data = json.data?.data || json.data || {};
        return data.items || [];
    } catch (e) { return []; }
}

// 3. Extract Streams
async function getStreams(tmdbId, mediaType, seasonNum = 1, episodeNum = 1) {
    const details = await fetchTmdbDetails(tmdbId, mediaType);
    if (!details) return [];

    const items = await searchMovieBox(details.title, mediaType);
    if (!items || items.length === 0) return [];

    // Filter for best match
    const cleanSearchTitle = details.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = items.find(item => {
        const cleanItemTitle = (item.title || "").toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanItemTitle.includes(cleanSearchTitle);
    });

    if (!match) return [];

    try {
        let params = `subjectId=${match.subjectId}`;
        if (mediaType === "tv") {
            params += `&se=${seasonNum}&ep=${episodeNum}`;
        }

        const res = await fetchWithHeaders(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/download?${params}`, {
            headers: { "Referer": "https://fmoviesunblocked.net/" }
        });
        
        const json = await res.json();
        const data = json.data?.data || json.data || {};
        const downloads = data.downloads || [];

        return downloads.map(d => ({
            name: `MovieBox • ${match.title.includes('[') ? match.title.split('[')[1].split(']')[0] : 'Original'}`,
            title: `${d.resolution || 720}p`,
            url: d.url,
            quality: `${d.resolution || 720}p`,
            headers: {
                "Referer": "https://fmoviesunblocked.net/",
                "Origin": "https://fmoviesunblocked.net"
            }
        }));
    } catch (e) {
        return [];
    }
}

module.exports = { getStreams };
