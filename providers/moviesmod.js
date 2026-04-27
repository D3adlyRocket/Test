// Dahmer Movies Scraper - Worker Link Priority Version
console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Strictly follows redirects to find the Worker URL
async function resolveWorkerUrl(startUrl, retryCount = 0) {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36';
    const referer = DAHMER_MOVIES_API + '/';

    try {
        const response = await fetch(startUrl, {
            method: 'HEAD',
            redirect: 'manual', // We handle the jump manually to see the Worker URL
            headers: { 'User-Agent': userAgent, 'Referer': referer }
        });

        // 429 Error Handling
        if (response.status === 429 && retryCount < 2) {
            await sleep(5000);
            return resolveWorkerUrl(startUrl, retryCount + 1);
        }

        // Check for the Redirect (where the worker link lives)
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location && location.includes('workers.dev')) {
                return location; // This is the round-bread link
            } else if (location) {
                // If it's a relative redirect, follow it again
                const nextUrl = location.startsWith('http') ? location : new URL(location, startUrl).href;
                return resolveWorkerUrl(nextUrl);
            }
        }

        // If no redirect was found but we are on a worker domain, return it
        if (response.url.includes('workers.dev')) return response.url;

        return null; // Ignore links that don't lead to a worker
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
            if (text && href !== '../' && /\.(mkv|mp4|avi)$/i.test(text)) {
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
    
    // Encoding specifically for this server's index
    const folderPath = `${baseDir}${encodeURIComponent(folderName)}/`
        .replace(/\(/g, '%28').replace(/\)/g, '%29');
    
    const fullDirUrl = DAHMER_MOVIES_API + folderPath;

    try {
        const response = await fetch(fullDirUrl);
        const html = await response.text();
        const paths = parseLinks(html);

        // Filter and sort
        const sortedPaths = paths.sort((a, b) => {
            const a4k = /2160p|4k/i.test(a.text);
            const b4k = /2160p|4k/i.test(b.text);
            return b4k - a4k;
        });

        const results = [];
        // Process in a loop to find the first working worker links
        for (const path of sortedPaths.slice(0, 5)) {
            let initialUrl;
            if (path.href.startsWith('http')) {
                initialUrl = path.href;
            } else if (path.href.includes('/movies/') || path.href.includes('/tvs/')) {
                initialUrl = DAHMER_MOVIES_API + (path.href.startsWith('/') ? '' : '/') + path.href;
            } else {
                initialUrl = fullDirUrl + path.href;
            }

            initialUrl = initialUrl.replace(/([^:]\/)\/+/g, "$1");
            
            // Resolve the Worker link specifically
            const workerUrl = await resolveWorkerUrl(initialUrl);

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
            
            // Short delay to avoid 429 while resolving multiple links
            if (results.length < 3) await sleep(500); 
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

        return await invokeDahmerMovies(title, year, seasonNum, episodeNum);
    } catch (e) { return []; }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
else global.getStreams = getStreams;
