// Dahmer Movies Scraper - Final Universal Fix
console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';

async function resolveFinalUrl(startUrl) {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36';
    
    let cleanUrl = startUrl.includes('/bulk?u=') 
        ? decodeURIComponent(startUrl.split('u=')[1]) 
        : startUrl;

    try {
        // We use a standard follow here but check the final URL
        const response = await fetch(cleanUrl, {
            method: 'GET', // Changed from HEAD to GET as some workers block HEAD
            redirect: 'follow',
            headers: { 'User-Agent': userAgent, 'Referer': DAHMER_MOVIES_API + '/' }
        });

        // If the resulting URL is a worker, great. If not, we still return it 
        // because some environments won't show the redirect jump.
        return response.url || cleanUrl;
    } catch (e) {
        return cleanUrl;
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
    
    // Check multiple TV folder possibilities
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

    if (season !== null && episode !== null) {
        const s = season < 10 ? `0${season}` : season;
        const e = episode < 10 ? `0${episode}` : episode;
        const pattern = new RegExp(`S${s}E${e}|${episode}`, 'i');
        filtered = paths.filter(p => pattern.test(p.text));
    }

    filtered.sort((a, b) => /2160p|4k/i.test(b.text) - /2160p|4k/i.test(a.text));

    const results = [];
    for (const file of filtered.slice(0, 3)) {
        let link = file.href.startsWith('http') ? file.href : activeDir + file.href;
        link = link.replace(/([^:]\/)\/+/g, "$1");

        const finalUrl = await resolveFinalUrl(link);

        results.push({
            name: "DahmerMovies",
            title: file.text,
            url: finalUrl,
            quality: /2160p|4k/i.test(file.text) ? '2160p' : '1080p',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Android) ExoPlayer',
                'Referer': DAHMER_MOVIES_API + '/',
                'Range': 'bytes=0-'
            }
        });
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
