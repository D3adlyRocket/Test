// Fixed MovieBox Scraper for Nuvio
// Replaced broken HMAC/Mobile API with working H5 Gateway logic

const TMDB_API_KEY = 'd131017ccc6e5462a81c9304d21476de';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MOVIEBOX_API = "https://h5.aoneroom.com";

const HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'X-Client-Info': '{"timezone":"Africa/Nairobi"}',
    'Referer': 'https://h5.aoneroom.com/',
    'Origin': 'https://fmoviesunblocked.net'
};

// --- Helpers ---

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

function unwrap(json) {
    if (!json) return {};
    // MovieBox H5 API often nests data twice
    const data = json.data || json;
    return data.data || data;
}

// --- API Methods ---

async function searchMovieBox(query, mediaType) {
    // Handshake: Required to "warm up" the session as seen in script 2
    await fetch(`${MOVIEBOX_API}/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox`, { headers: HEADERS }).catch(() => {});

    const url = `${MOVIEBOX_API}/wefeed-h5-bff/web/subject/search`;
    const body = JSON.stringify({
        keyword: query,
        page: 1,
        perPage: 24,
        subjectType: mediaType === 'tv' ? 2 : 1
    });

    try {
        const res = await fetch(url, { 
            method: 'POST', 
            headers: HEADERS, 
            body 
        });
        const json = await res.json();
        const data = unwrap(json);
        return data.items || [];
    } catch (e) {
        return [];
    }
}

async function getStreamLinks(subjectId, season = 0, episode = 0, lang = 'Original') {
    let params = `subjectId=${subjectId}`;
    if (season > 0) {
        params += `&se=${season}&ep=${episode}`;
    }

    const url = `${MOVIEBOX_API}/wefeed-h5-bff/web/subject/download?${params}`;
    
    try {
        const res = await fetch(url, { 
            headers: {
                ...HEADERS,
                'Referer': 'https://fmoviesunblocked.net/' 
            } 
        });
        const json = await res.json();
        const data = unwrap(json);
        const downloads = data.downloads || [];

        return downloads.map(d => ({
            name: `MovieBox • ${lang}`,
            title: `${d.resolution || 720}p`,
            url: d.url,
            quality: `${d.resolution || 720}p`,
            headers: {
                "Referer": "https://fmoviesunblocked.net/",
                "Origin": "https://fmoviesunblocked.net",
                "User-Agent": HEADERS['User-Agent']
            }
        }));
    } catch (e) {
        return [];
    }
}

// --- Main Export ---

async function getStreams(tmdbId, mediaType, seasonNum = 1, episodeNum = 1) {
    const details = await fetchTmdbDetails(tmdbId, mediaType);
    if (!details) return [];

    const items = await searchMovieBox(details.title, mediaType);
    if (!items || items.length === 0) return [];

    // Filter for a match: Script 2 uses a Regex approach, we'll use a simplified version
    const cleanSearchTitle = details.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Find the first item where the title matches our search
    const match = items.find(item => {
        const itemTitle = (item.title || "").toLowerCase().replace(/\sS\d+.*/, ""); // Remove Season suffixes
        const cleanItemTitle = itemTitle.replace(/[^a-z0-9]/g, '');
        return cleanItemTitle.includes(cleanSearchTitle) || cleanSearchTitle.includes(cleanItemTitle);
    });

    if (match) {
        // Extract language if present in brackets: "The Flash [Hindi]"
        const langPart = match.title.match(/\[([^\]]+)\]/);
        const language = langPart ? langPart[1] : 'Original';

        return await getStreamLinks(
            match.subjectId, 
            mediaType === 'tv' ? seasonNum : 0, 
            mediaType === 'tv' ? episodeNum : 0,
            language
        );
    }

    return [];
}

module.exports = { getStreams };
