// Dahmer Movies Scraper - Simplified 4K/Playback Fix
console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';

async function makeRequest(url) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    return res;
}

// Resolves the link to ensure it plays, handles 429 with a simple wait
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
        
        if (response.status === 429) {
            console.log('[DahmerMovies] Server busy (429), trying anyway...');
            // If blocked, we return the original but add the range header later to help
        }
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
            // Only accept video files, skip parent directories
            if (text && href !== '../' && /\.(mkv|mp4|avi)$/i.test(text)) {
                links.push({ text, href });
            }
        }
    }
    return links;
}

async function invokeDahmerMovies(title, year, season = null, episode = null) {
    // Keep folder names exactly as they appear on the server
    const cleanTitle = title.replace(/:/g, '');
    const folderPath = season === null 
        ? `/movies/${encodeURIComponent(cleanTitle + ' (' + year + ')')}/`
        : `/tvs/${encodeURIComponent(cleanTitle)}/Season ${season}/`;

    const fullDirUrl = DAHMER_MOVIES_API + folderPath;

    try {
        const response = await makeRequest(fullDirUrl);
        if (!response.ok) return [];
        
        const html = await response.text();
        const paths = parseLinks(html);

        // Sort: Move 2160p/4k to the front
        const sortedPaths = paths.sort((a, b) => {
            const a4k = /2160p|4k/i.test(a.text);
            const b4k = /2160p|4k/i.test(b.text);
            return b4k - a4k;
        });

        const results = [];
        // Only process the first 3 links to prevent 429 triggers
        for (const path of sortedPaths.slice(0, 3)) {
            let initialUrl = path.href.startsWith('http') ? path.href : (fullDirUrl + path.href);
            
            // Fix double slashes
            initialUrl = initialUrl.replace(/([^:]\/)\/+/g, "$1");

            const streamUrl = await resolveFinalUrl(initialUrl);

            results.push({
                name: "DahmerMovies",
                title: path.text,
                url: streamUrl,
                quality: /2160p|4k/i.test(path.text) ? '2160p' : '1080p',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Android) ExoPlayer',
                    'Referer': DAHMER_MOVIES_API + '/',
                    'Range': 'bytes=0-' // This is the fix for playback 429
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
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const res = await makeRequest(tmdbUrl);
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
