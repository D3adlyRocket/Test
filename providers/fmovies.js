// MovieBox Scraper for Nuvio - Updated May 2026
// Targets the REST v2 API for maximum stability

const TMDB_API_KEY = 'd131017ccc6e5462a81c9304d21476de';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
// Updated to the newer REST API host identified in current mirrors
const MOVIEBOX_API = "https://h5-api.aoneroom.com"; 

const BASE_HEADERS = {
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.5",
    "X-Client-Info": '{"timezone":"Africa/Nairobi","platform":"web"}',
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Origin": "https://fmoviesunblocked.net",
    "Referer": "https://h5.aoneroom.com/"
};

// Precise data unwrapper to handle MovieBox's deep nesting
function unwrap(json) {
    if (!json) return {};
    let d = json.data || json;
    if (d.data) d = d.data;
    return d;
}

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

async function getStreams(tmdbId, mediaType, seasonNum = 1, episodeNum = 1) {
    try {
        const details = await fetchTmdbDetails(tmdbId, mediaType);
        if (!details) return [];

        // 1. Session Warm-up (Ensures the API treats the request as valid)
        await fetch(`${MOVIEBOX_API}/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox`, { headers: BASE_HEADERS }).catch(() => {});

        // 2. Search using the REST v2 endpoint
        const searchResp = await fetch(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/search`, {
            method: "POST",
            headers: { ...BASE_HEADERS, "Content-Type": "application/json" },
            body: JSON.stringify({
                keyword: details.title,
                page: 1,
                perPage: 20,
                subjectType: mediaType === "tv" ? 2 : 1
            })
        });

        const searchJson = await searchResp.json();
        const searchData = unwrap(searchJson);
        const items = searchData.items || searchData.list || [];

        // 3. Title Matching Logic
        const cleanTarget = details.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const match = items.find(item => {
            const cleanItem = (item.title || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanItem.includes(cleanTarget) || cleanTarget.includes(cleanItem);
        });

        if (!match) return [];

        // 4. Source Extraction (Download Endpoint)
        let params = `subjectId=${match.subjectId}`;
        if (mediaType === "tv") {
            params += `&se=${seasonNum}&ep=${episodeNum}`;
        }

        const sourceResp = await fetch(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/download?${params}`, {
            headers: {
                ...BASE_HEADERS,
                "Referer": "https://fmoviesunblocked.net/", // Critical for file access
            }
        });

        const sourceJson = await sourceResp.json();
        const sourceData = unwrap(sourceJson);
        const downloads = sourceData.downloads || [];

        return downloads.map(d => ({
            name: `MovieBox • ${match.title.includes('[') ? match.title.split('[')[1].split(']')[0] : 'Original'}`,
            title: `${d.resolution || 720}p`,
            url: d.url,
            quality: `${d.resolution || 720}p`,
            headers: {
                "Referer": "https://fmoviesunblocked.net/",
                "Origin": "https://fmoviesunblocked.net",
                "User-Agent": BASE_HEADERS["User-Agent"]
            }
        }));

    } catch (err) {
        console.error("[MovieBox Error]", err);
        return [];
    }
}

module.exports = { getStreams };
