// MovieBox Scraper for Nuvio
// Updated to use the H5 Web API for better stability
const TMDB_API_KEY = 'd131017ccc6e5462a81c9304d21476de';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MOVIEBOX_API = "https://h5.aoneroom.com";

const HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': `${MOVIEBOX_API}/`,
    'Origin': 'https://fmoviesunblocked.net'
};

// TMDB Helper
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
    } catch (e) {
        return null;
    }
}

// Search Logic
async function searchMovieBox(query, mediaType) {
    const url = `${MOVIEBOX_API}/wefeed-h5-bff/web/subject/search`;
    const body = JSON.stringify({
        keyword: query,
        page: 1,
        perPage: 10,
        subjectType: mediaType === 'tv' ? 2 : 1
    });

    try {
        const res = await fetch(url, { method: 'POST', headers: HEADERS, body });
        const json = await res.json();
        return json.data?.items || json.items || [];
    } catch (e) {
        return [];
    }
}

// Stream Extraction
async function getStreamLinks(subjectId, season = 0, episode = 0, lang = 'Original') {
    let params = `subjectId=${subjectId}`;
    if (season > 0) {
        params += `&se=${season}&ep=${episode}`;
    }

    const url = `${MOVIEBOX_API}/wefeed-h5-bff/web/subject/download?${params}`;
    
    try {
        const res = await fetch(url, { headers: HEADERS });
        const json = await res.json();
        const data = json.data || json;
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

// Main Function
async function getStreams(tmdbId, mediaType, seasonNum = 1, episodeNum = 1) {
    const details = await fetchTmdbDetails(tmdbId, mediaType);
    if (!details) return [];

    const items = await searchMovieBox(details.title, mediaType);
    if (!items || items.length === 0) return [];

    // Filter for best match (Basic Title Matching)
    const cleanSearchTitle = details.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = items.find(item => {
        const cleanItemTitle = (item.title || "").toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanItemTitle.includes(cleanSearchTitle);
    });

    if (match) {
        // Check for language in title like "Movie [Hindi]"
        const langMatch = match.title.match(/\[(.*?)\]/);
        const language = langMatch ? langMatch[1] : 'Original';
        
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
