// Dahmer Movies Scraper - Final Logic Fix
console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';

async function makeRequest(url) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        return res;
    } catch (e) {
        return { ok: false };
    }
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
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
        const content = match[1];
        const linkMatch = content.match(/<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/i);
        if (linkMatch) {
            const href = linkMatch[1];
            const text = linkMatch[2].trim();
            if (text && href !== '../' && /\.(mkv|mp4|avi)$/i.test(text)) {
                links.push({ text, href });
            }
        }
    }
    return links;
}

async function invokeDahmerMovies(title, year, season = null, episode = null) {
    const cleanTitle = title.replace(/:/g, '');
    
    // We construct the path manually to avoid URLSearchParams over-encoding
    let folderPath = "";
    if (season === null) {
        const folderName = `${cleanTitle} (${year})`;
        folderPath = `/movies/${encodeURIComponent(folderName)}/`;
    } else {
        folderPath = `/tvs/${encodeURIComponent(cleanTitle)}/Season ${season}/`;
    }

    const fullDirUrl = DAHMER_MOVIES_API + folderPath;
    console.log(`[DahmerMovies] Fetching: ${fullDirUrl}`);

    const response = await makeRequest(fullDirUrl);
    if (!response.ok) {
        console.log(`[DahmerMovies] Folder not found: ${fullDirUrl}`);
        return [];
    }
    
    const html = await response.text();
    const paths = parseLinks(html);

    // Sort to put 4K / 2160p links first
    const sortedPaths = paths.sort((a, b) => {
        const a4k = /2160p|4k/i.test(a.text) ? 1 : 0;
        const b4k = /2160p|4k/i.test(b.text) ? 1 : 0;
        return b4k - a4k;
    });

    const results = [];
    // Process top 3 to avoid 429 server blocks
    for (const path of sortedPaths.slice(0, 3)) {
        let rawUrl = path.href.startsWith('http') ? path.href : (fullDirUrl + path.href);
        // Clean up double slashes
        const absoluteUrl = rawUrl.replace(/([^:]\/)\/+/g, "$1");
        
        const streamUrl = await resolveFinalUrl(absoluteUrl);

        results.push({
            name: "DahmerMovies",
            title: path.text,
            url: streamUrl,
            quality: /2160p|4k/i.test(path.text) ? '2160p' : '1080p',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Android) ExoPlayer',
                'Referer': DAHMER_MOVIES_API + '/',
                'Range': 'bytes=0-'
            },
            provider: "dahmermovies"
        });
    }
    return results;
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const res = await makeRequest(tmdbUrl);
        const data = await res.json();
        
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);

        if (!title) return [];

        // CRITICAL: Added 'return await' here to pass the results back
        return await invokeDahmerMovies(title, year, seasonNum, episodeNum);
    } catch (e) {
        console.log(`[DahmerMovies] getStreams Error: ${e.message}`);
        return [];
    }
}

// Exporting
if (typeof module !== 'undefined') {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
