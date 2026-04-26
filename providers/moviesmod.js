// Dahmer Movies Scraper - Fix for 404 Doubled URLs
// Optimized for Mobile/TV

console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';
const TIMEOUT = 15000;

function makeRequest(url, options = {}) {
    return fetch(url, {
        timeout: TIMEOUT,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            ...options.headers
        },
        ...options
    }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
    });
}

async function resolveFinalUrl(startUrl) {
    try {
        const response = await fetch(startUrl, {
            method: 'HEAD',
            redirect: 'follow',
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Android) ExoPlayer', 
                'Referer': DAHMER_MOVIES_API + '/' 
            }
        });
        return response.url;
    } catch (e) {
        return startUrl;
    }
}

function parseLinks(html) {
    const links = [];
    const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
        const content = rowMatch[1];
        const linkMatch = content.match(/<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/i);
        if (!linkMatch) continue;
        const href = linkMatch[1];
        const text = linkMatch[2].trim();
        if (!text || href === '../' || text === '../') continue;
        links.push({ text, href });
    }
    return links;
}

async function invokeDahmerMovies(title, year, season = null, episode = null) {
    const cleanTitle = title.replace(/:/g, '');
    const folderName = season === null 
        ? `${cleanTitle} (${year})` 
        : cleanTitle;
    
    const baseUrl = season === null 
        ? `${DAHMER_MOVIES_API}/movies/${encodeURIComponent(folderName)}/`
        : `${DAHMER_MOVIES_API}/tvs/${encodeURIComponent(folderName)}/Season ${season}/`;

    try {
        const response = await makeRequest(baseUrl);
        const html = await response.text();
        const paths = parseLinks(html);

        let filtered = [];
        if (season === null) {
            filtered = paths.filter(p => /\.(mkv|mp4|avi)$/i.test(p.text));
        } else {
            const s = season < 10 ? `0${season}` : season;
            const e = episode < 10 ? `0${episode}` : episode;
            const pattern = new RegExp(`S${s}E${e}`, 'i');
            filtered = paths.filter(p => pattern.test(p.text));
        }

        const results = [];
        // Only process top 2 to keep it lightning fast on TV
        for (const path of filtered.slice(0, 2)) {
            let finalPath;
            
            // FIX: Check if the href is a full URL or a relative path
            if (path.href.startsWith('http')) {
                finalPath = path.href;
            } else if (path.href.startsWith('/')) {
                // If it's root-relative, join with the origin only
                finalPath = new URL(DAHMER_MOVIES_API).origin + path.href;
            } else {
                // If it's just a filename, join with the folder URL
                finalPath = baseUrl + path.href;
            }

            const streamUrl = await resolveFinalUrl(finalPath);

            results.push({
                name: "DahmerMovies",
                title: path.text,
                url: streamUrl,
                quality: path.text.includes('2160p') ? '2160p' : '1080p',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Android) ExoPlayer',
                    'Referer': DAHMER_MOVIES_API + '/'
                },
                provider: "dahmermovies"
            });
        }
        return results;
    } catch (e) {
        return [];
    }
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        const res = await makeRequest(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);
        return await invokeDahmerMovies(title, year, seasonNum, episodeNum);
    } catch (e) {
        return [];
    }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
else global.getStreams = getStreams;
