// Dahmer Movies Scraper - Multi-Platform Worker Fix
console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// THE WORKER RESOLVER: This mimics the logic in your reference code
async function resolveWorkerUrl(startUrl, retryCount = 0) {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36';
    const referer = 'https://a.111477.xyz/';

    try {
        const response = await fetch(startUrl, {
            method: 'HEAD',
            redirect: 'manual', // CRITICAL: This allows us to see the Location header
            headers: { 'User-Agent': userAgent, 'Referer': referer }
        });

        // Handle 429 Rate Limiting
        if (response.status === 429 && retryCount < 2) {
            await sleep(2000);
            return resolveWorkerUrl(startUrl, retryCount + 1);
        }

        // Hunt for the 'Location' header which contains the worker link
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location) {
                const nextUrl = location.startsWith('http') ? location : new URL(location, startUrl).href;
                
                // If we found a worker link, return it immediately
                if (nextUrl.includes('workers.dev')) {
                    return nextUrl;
                }
                
                // Otherwise follow the chain (limit to 3 jumps)
                if (retryCount < 3) {
                    return resolveWorkerUrl(nextUrl, retryCount + 1);
                }
            }
        }

        // If the URL is already a worker, use it. Otherwise, return null to avoid playback error
        return startUrl.includes('workers.dev') ? startUrl : null;
    } catch (e) {
        // Fallback for environments where 'manual' redirect fails: try one 'follow' attempt
        try {
            const followRes = await fetch(startUrl, { redirect: 'follow', method: 'HEAD' });
            if (followRes.url && followRes.url.includes('workers.dev')) return followRes.url;
        } catch (err) { return null; }
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
    const movieFolder = `${cleanTitle} (${year})`;
    
    // Support both padded and unpadded Season folders
    const tvVariants = season !== null ? [
        `/tvs/${encodeURIComponent(cleanTitle)}/Season%20${season < 10 ? '0' + season : season}/`,
        `/tvs/${encodeURIComponent(cleanTitle)}/Season%20${season}/`
    ] : [`/movies/${encodeURIComponent(movieFolder)}/`];

    let html = '';
    let activeDir = '';

    for (const path of tvVariants) {
        try {
            const res = await fetch(DAHMER_MOVIES_API + path);
            if (res.ok) {
                html = await res.text();
                activeDir = DAHMER_MOVIES_API + path;
                break;
            }
        } catch (e) { continue; }
    }

    if (!html) return [];

    const paths = parseLinks(html);
    let filtered = paths;

    // Filter for specific TV episodes if applicable
    if (season !== null && episode !== null) {
        const s = season < 10 ? `0${season}` : season;
        const e = episode < 10 ? `0${episode}` : episode;
        const pattern = new RegExp(`S${s}E${e}|E${e}|-${e}`, 'i');
        filtered = paths.filter(p => pattern.test(p.text));
    }

    // Sort: 2160p (4K) links first
    filtered.sort((a, b) => /2160p|4k/i.test(b.text) - /2160p|4k/i.test(a.text));

    const results = [];
    for (const file of filtered.slice(0, 5)) {
        if (results.length >= 3) break;

        let link = file.href.startsWith('http') ? file.href : activeDir + file.href;
        link = link.replace(/([^:]\/)\/+/g, "$1");

        // Force resolution to a Worker URL
        const workerUrl = await resolveWorkerUrl(link);

        if (workerUrl) {
            results.push({
                name: "DahmerMovies",
                title: file.text,
                url: workerUrl,
                quality: /2160p|4k/i.test(file.text) ? '2160p' : '1080p',
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
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);

        return await invokeDahmerMovies(title, year, seasonNum, episodeNum);
    } catch (e) { return []; }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
else global.getStreams = getStreams;
