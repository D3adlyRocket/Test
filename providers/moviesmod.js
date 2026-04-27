// Dahmer Movies Scraper - Unified Mobile/TV Fix
console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// THIS IS THE FIX FOR MOBILE: Manually follows redirects to find workers.dev
async function resolveFinalUrl(startUrl, retryCount = 0) {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36';
    const referer = 'https://a.111477.xyz/';

    let cleanUrl = startUrl;
    if (startUrl.includes('/bulk?u=')) {
        cleanUrl = decodeURIComponent(startUrl.split('u=')[1]);
    }

    try {
        const response = await fetch(cleanUrl, {
            method: 'HEAD',
            redirect: 'manual', // Force manual tracking for mobile compatibility
            headers: { 'User-Agent': userAgent, 'Referer': referer }
        });

        // Handle 429 errors with a wait
        if (response.status === 429 && retryCount < 2) {
            await sleep(5000);
            return resolveFinalUrl(cleanUrl, retryCount + 1);
        }

        // Catch the Redirect header manually
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location) {
                const nextUrl = location.startsWith('http') ? location : new URL(location, cleanUrl).href;
                if (nextUrl.includes('workers.dev')) return nextUrl;
                if (retryCount < 5) return resolveFinalUrl(nextUrl, retryCount + 1);
            }
        }

        return cleanUrl.includes('workers.dev') ? cleanUrl : null;
    } catch (e) {
        return null;
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
            if (text && href !== '../' && /\.(mkv|mp4|avi|webm)$/i.test(text)) {
                links.push({ text, href });
            }
        }
    }
    return links;
}

async function invokeDahmerMovies(title, year, season = null, episode = null) {
    const cleanTitle = title.replace(/:/g, '');
    
    // TV SHOW FOLDER FIX: Pad season number (e.g., Season 01)
    let folderPath;
    if (season === null) {
        folderPath = `/movies/${encodeURIComponent(cleanTitle + ' (' + year + ')')}/`;
    } else {
        const s = season < 10 ? `0${season}` : season;
        folderPath = `/tvs/${encodeURIComponent(cleanTitle)}/Season%20${s}/`;
    }

    const fullDirUrl = DAHMER_MOVIES_API + folderPath.replace(/\(/g, '%28').replace(/\)/g, '%29');

    try {
        const response = await fetch(fullDirUrl);
        if (!response.ok) return [];
        
        const html = await response.text();
        const paths = parseLinks(html);

        // Filter for specific TV episodes if applicable
        let filtered = paths;
        if (season !== null && episode !== null) {
            const s = season < 10 ? `0${season}` : season;
            const e = episode < 10 ? `0${episode}` : episode;
            const pattern = new RegExp(`S${s}E${e}`, 'i');
            filtered = paths.filter(p => pattern.test(p.text));
        }

        // Sort: 4K Priority
        filtered.sort((a, b) => /2160p|4k/i.test(b.text) - /2160p|4k/i.test(a.text));

        const results = [];
        for (const path of filtered.slice(0, 5)) {
            let initialUrl = (path.href.startsWith('http')) ? path.href :
                             (path.href.includes('/movies/') || path.href.includes('/tvs/')) ? 
                             DAHMER_MOVIES_API + (path.href.startsWith('/') ? '' : '/') + path.href :
                             fullDirUrl + path.href;

            initialUrl = initialUrl.replace(/([^:]\/)\/+/g, "$1");
            
            const workerUrl = await resolveFinalUrl(initialUrl);

            if (workerUrl) {
                results.push({
                    name: "DahmerMovies",
                    title: path.text,
                    url: workerUrl,
                    quality: /2160p|4k/i.test(path.text) ? '2160p' : '1080p',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Android) ExoPlayer',
                        'Referer': DAHMER_MOVIES_API + '/',
                        'Range': 'bytes=0-'
                    },
                    provider: "dahmermovies"
                });
            }
        }
        return results;
    } catch (e) { return []; }
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const res = await fetch(tmdbUrl);
        const data = await res.json();
        
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);

        return await invokeDahmerMovies(title, year, seasonNum, episodeNum);
    } catch (e) { return []; }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
else global.getStreams = getStreams;
