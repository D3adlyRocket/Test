// Dahmer Movies Scraper - CDN Worker & Redirect Fix
console.log('[DahmerMovies] Initializing Optimized Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';

// This is the magic part that finds the "round-bread-fe41" style links
async function resolveFinalUrl(startUrl) {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36';
    const referer = DAHMER_MOVIES_API + '/';

    try {
        const response = await fetch(startUrl, {
            method: 'HEAD',
            redirect: 'follow', // Crucial: follows the path to the worker
            headers: { 
                'User-Agent': userAgent,
                'Referer': referer
            }
        });

        // If it successfully redirected to a Worker or CDN, return that URL
        if (response.url && !response.url.includes('bulk?u=')) {
            return response.url;
        }
        return startUrl;
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
            if (text && href !== '../' && /\.(mkv|mp4|avi|webm)$/i.test(text)) {
                links.push({ text, href });
            }
        }
    }
    return links;
}

async function invokeDahmerMovies(title, year, season = null, episode = null) {
    const cleanTitle = title.replace(/:/g, '');
    const folderName = season === null ? `${cleanTitle} (${year})` : cleanTitle;
    const baseDir = season === null ? `/movies/` : `/tvs/`;
    
    // Proper encoding for the folder search
    const folderPath = `${baseDir}${encodeURIComponent(folderName)}/`
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29');
    
    const fullDirUrl = DAHMER_MOVIES_API + folderPath;

    try {
        const response = await fetch(fullDirUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!response.ok) return [];
        
        const html = await response.text();
        const paths = parseLinks(html);

        // Sort: 2160p (4K) at the very top
        const sortedPaths = paths.sort((a, b) => {
            const a4k = /2160p|4k/i.test(a.text);
            const b4k = /2160p|4k/i.test(b.text);
            return b4k - a4k;
        });

        const results = [];
        // Only process a few to stay under the 429 limit
        for (const path of sortedPaths.slice(0, 4)) {
            let initialUrl;

            // Prevent URL doubling
            if (path.href.startsWith('http')) {
                initialUrl = path.href;
            } else if (path.href.includes('/movies/') || path.href.includes('/tvs/')) {
                initialUrl = DAHMER_MOVIES_API + (path.href.startsWith('/') ? '' : '/') + path.href;
            } else {
                initialUrl = fullDirUrl + path.href;
            }

            // Step 1: Clean the URL
            let cleanInitialUrl = initialUrl.replace(/([^:]\/)\/+/g, "$1");
            
            // Step 2: Extract from "bulk?u=" if necessary
            if (cleanInitialUrl.includes('bulk?u=')) {
                cleanInitialUrl = decodeURIComponent(cleanInitialUrl.split('u=')[1]);
            }

            // Step 3: Follow redirects to get the Worker Link (round-bread-fe41...)
            const finalPlaybackUrl = await resolveFinalUrl(cleanInitialUrl);

            results.push({
                name: "DahmerMovies",
                title: path.text,
                url: finalPlaybackUrl,
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
    } catch (e) { return []; }
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const res = await fetch(tmdbUrl);
        const data = await res.json();
        
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);

        if (!title) return [];
        return await invokeDahmerMovies(title, year, seasonNum, episodeNum);
    } catch (e) { return []; }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
else global.getStreams = getStreams;
