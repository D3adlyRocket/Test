// MovieBox Scraper for Nuvio (H5 Compatibility)
const TMDB_API_KEY = 'd131017ccc6e5462a81c9304d21476de';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MOVIEBOX_HOST = "h5.aoneroom.com";
const MOVIEBOX_API = `https://${MOVIEBOX_HOST}`;

const BASE_HEADERS = {
    "X-Client-Info": '{"timezone":"Africa/Nairobi"}',
    "Accept": "application/json",
    "Referer": `${MOVIEBOX_API}/`,
    "Host": MOVIEBOX_HOST,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

// Helper to unwrap data exactly like the working script
function unwrapData(json) {
    if (!json) return {};
    const data = json.data || json;
    return data.data || data;
}

async function fetchTmdbDetails(tmdbId, mediaType) {
    const type = mediaType === "tv" ? "tv" : "movie";
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

        // 1. Session Handshake (Crucial step from working script)
        await fetch(`${MOVIEBOX_API}/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox`, { headers: BASE_HEADERS }).catch(() => {});

        // 2. Search
        const searchResp = await fetch(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/search`, {
            method: "POST",
            headers: { ...BASE_HEADERS, "Content-Type": "application/json" },
            body: JSON.stringify({
                keyword: details.title,
                page: 1,
                perPage: 24,
                subjectType: mediaType === "tv" ? 2 : 1
            })
        });

        const searchJson = await searchResp.json();
        const searchData = unwrapData(searchJson);
        const items = searchData.items || [];

        // 3. Match
        const match = items.find(i => {
            const cleanT = details.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            const itemT = (i.title || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            return itemT.includes(cleanT) || cleanT.includes(itemT);
        });

        if (!match) return [];

        // 4. Get Download Links (Source)
        let params = `subjectId=${match.subjectId}`;
        if (mediaType === "tv") {
            params += `&se=${seasonNum}&ep=${episodeNum}`;
        }

        const sourceResp = await fetch(`${MOVIEBOX_API}/wefeed-h5-bff/web/subject/download?${params}`, {
            headers: {
                ...BASE_HEADERS,
                "Referer": "https://fmoviesunblocked.net/",
                "Origin": "https://fmoviesunblocked.net"
            }
        });

        const sourceJson = await sourceResp.json();
        const sourceData = unwrapData(sourceJson);
        const downloads = sourceData.downloads || [];

        return downloads.map(d => {
            const qualityStr = `${d.resolution || 720}p`;
            const lang = match.title.includes('[') ? match.title.split('[')[1].split(']')[0] : 'Original';
            
            return {
                name: `MovieBox • ${lang}`,
                title: qualityStr,
                url: d.url,
                quality: qualityStr,
                headers: {
                    "Referer": "https://fmoviesunblocked.net/",
                    "Origin": "https://fmoviesunblocked.net",
                    "User-Agent": BASE_HEADERS["User-Agent"]
                }
            };
        });

    } catch (error) {
        console.error("Scraper Error:", error);
        return [];
    }
}

module.exports = { getStreams };
