// Dahmer Movies Scraper - Worker Extraction Version
console.log('[DahmerMovies] Initializing Worker-Link Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// THIS IS THE KEY LOGIC FROM YOUR PROVIDED CODE
// It manually hunts for the 'location' header to find the worker.dev link
async function resolveFinalUrl(startUrl, retryCount = 0) {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
    const referer = 'https://a.111477.xyz/';

    try {
        const response = await fetch(startUrl, {
            method: 'HEAD',
            redirect: 'manual', // STOPS the browser from hiding the redirect
            headers: { 'User-Agent': userAgent, 'Referer': referer }
        });

        // Handle Rate Limiting (429) exactly like your reference code
        if (response.status === 429) {
            if (retryCount < 2) {
                console.log(`[DahmerMovies] 429 received, waiting before retry...`);
                await sleep(7500); 
                return resolveFinalUrl(startUrl, retryCount + 1);
            }
            return null;
        }

        // Catch the Redirect - This is where the workers.dev link lives
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location) {
                const nextUrl = location.startsWith('http') ? location : new URL(location, startUrl).href;
                
                // If we found the worker link, return it immediately
                if (nextUrl.includes('workers.dev')) {
                    return nextUrl;
                }
                // Otherwise, follow the next hop (limit to 5 hops)
                if (retryCount < 5) {
                    return resolveFinalUrl(nextUrl, retryCount + 1);
                }
            }
        }

        // If it didn't redirect but it is a worker link, keep it
        if (startUrl.includes('workers.dev')) return startUrl;

        return null; 
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
    const folderName = season === null ? `${cleanTitle} (${year})` : cleanTitle;
    
    // Exact encoding logic from your provided code
    const safeVariant = folderName.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
    const folderUrl = season === null 
        ? `${DAHMER_MOVIES_API}/movies/${safeVariant}/`
        : `${DAHMER_MOVIES_API}/tvs/${safeVariant}/${season < 10 ? 'Season%200' + season : 'Season%20' + season}/`;

    try {
        const response = await fetch(folderUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!response.ok) return [];
        
        const html = await response.text();
        const paths = parseLinks(html);

        // Sort: 2160p (4K) links first
        const sortedPaths = paths.sort((a, b) => {
            const a4k = /2160p|4k/i.test(a.text);
            const b4k = /2160p|4k/i.test(b.text);
            return b4k - a4k;
        });

        const results = [];
        // Process links until we find 3 working Worker links
        for (const path of sortedPaths) {
            if (results.length >= 3) break;

            let fullPath;
            if (path.href.startsWith('http')) {
                fullPath = path.href;
            } else if (path.href.startsWith('/')) {
                fullPath = `${new URL(DAHMER_MOVIES_API).origin}${path.href}`;
            } else {
                fullPath = folderUrl + path.href;
            }

            // Cleanup and Resolve the Worker link
            const cleanUrl = fullPath.replace(/([^:]\/)\/+/g, "$1");
            const workerUrl = await resolveFinalUrl(cleanUrl);

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

        if (!title) return [];
        return await invokeDahmerMovies(title, year, seasonNum, episodeNum);
    } catch (e) { return []; }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
else global.getStreams = getStreams;
