// Dahmer Movies Scraper - Multi-Platform Worker Fix
console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// THIS IS THE EXACT LOGIC FROM YOUR PROVIDED WORKING CODE
// It uses a recursive attemptResolve to hunt down the worker URL
async function resolveFinalUrl(url, count = 0) {
    if (count >= 5) return null;
    const referer = 'https://a.111477.xyz/';
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

    try {
        const response = await fetch(url, {
            method: 'HEAD',
            redirect: 'manual',
            headers: { 'User-Agent': userAgent, 'Referer': referer }
        });

        if (response.status === 429) {
            await sleep(2000);
            return resolveFinalUrl(url, count + 1);
        }

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location) {
                const nextUrl = location.startsWith('http') ? location : new URL(location, url).href;
                // If it's the worker link, we found gold
                if (nextUrl.includes('workers.dev')) return nextUrl;
                return resolveFinalUrl(nextUrl, count + 1);
            }
        }

        // If the URL already looks like a worker link, return it
        if (url.includes('workers.dev')) return url;
        
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
    const movieFolder = `${cleanTitle} (${year})`;
    
    // Support both padded (Season 01) and unpadded folders
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

    // TV Episode matching (S01E01 style)
    if (season !== null && episode !== null) {
        const s = season < 10 ? `0${season}` : season;
        const e = episode < 10 ? `0${episode}` : episode;
        const pattern = new RegExp(`S${s}E${e}|E${e}|[ .-]${e}[ .-]`, 'i');
        filtered = paths.filter(p => pattern.test(p.text));
    }

    // Sort: 2160p (4K) links first
    filtered.sort((a, b) => /2160p|4k/i.test(b.text) - /2160p|4k/i.test(a.text));

    const results = [];
    for (const file of filtered.slice(0, 8)) { // Search deeper to find a working link
        if (results.length >= 3) break;

        let link = file.href.startsWith('http') ? file.href : activeDir + file.href;
        link = link.replace(/([^:]\/)\/+/g, "$1");

        // Force resolution to a Worker URL using the recursive logic
        const workerUrl = await resolveFinalUrl(link);

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
