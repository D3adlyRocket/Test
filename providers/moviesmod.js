// Dahmer Movies Scraper - Direct Path Implementation
console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';

async function makeRequest(url) {
    try {
        return await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
    } catch (e) { return { ok: false }; }
}

async function resolveFinalUrl(startUrl) {
    let cleanUrl = startUrl;
    if (startUrl.includes('/bulk?u=')) {
        cleanUrl = decodeURIComponent(startUrl.split('u=')[1]);
    }
    try {
        const response = await fetch(cleanUrl, {
            method: 'HEAD',
            redirect: 'follow',
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Android) ExoPlayer',
                'Referer': DAHMER_MOVIES_API + '/',
                'Range': 'bytes=0-'
            }
        });
        return response.url;
    } catch (e) { return cleanUrl; }
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
    let html = '';
    let activeDirUrl = '';

    if (season === null) {
        // --- MOVIE PATH ---
        const moviePath = `/movies/${encodeURIComponent(cleanTitle)}%20(${year})/`;
        activeDirUrl = DAHMER_MOVIES_API + moviePath;
        const res = await makeRequest(activeDirUrl);
        if (res.ok) html = await res.text();
    } else {
        // --- TV PATHS (Targeting your specific examples) ---
        const s = season; 
        const sPad = season < 10 ? '0' + season : season;

        // We try the most likely folder variations based on your examples
        const tvVariants = [
            `/tvs/${encodeURIComponent(cleanTitle)}%20-%20Born%20Again/Season%20${sPad}/`,
            `/tvs/${encodeURIComponent(cleanTitle)}%20-%20Born%20Again/Season%20${s}/`,
            `/tvs/${encodeURIComponent(cleanTitle)}%20(${year})/Season%20${s}/`,
            `/tvs/${encodeURIComponent(cleanTitle)}%20(${year})/Season%20${sPad}/`,
            `/tvs/${encodeURIComponent(cleanTitle)}/Season%20${sPad}/`,
            `/tvs/${encodeURIComponent(cleanTitle)}/Season%20${s}/`
        ];

        for (const path of tvVariants) {
            const tryUrl = (DAHMER_MOVIES_API + path).replace(/([^:]\/)\/+/g, "$1");
            const res = await makeRequest(tryUrl);
            if (res.ok) {
                const text = await res.text();
                // Ensure the folder actually has video files, not just empty
                if (text.includes('.mkv') || text.includes('.mp4')) {
                    html = text;
                    activeDirUrl = tryUrl;
                    break;
                }
            }
        }
    }

    if (!html) return [];
    
    const paths = parseLinks(html);
    let filteredPaths = paths;

    if (season !== null && episode !== null) {
        const e = episode < 10 ? `0${episode}` : episode;
        const pattern = new RegExp(`E${e}|E${episode}|[\\s-]${e}[\\s\\.]`, 'i');
        filteredPaths = paths.filter(p => pattern.test(p.text));
    }

    const sortedPaths = filteredPaths.sort((a, b) => {
        const a4k = /2160p|4k/i.test(a.text);
        const b4k = /2160p|4k/i.test(b.text);
        return b4k - a4k;
    });

    const results = [];
    for (const path of sortedPaths.slice(0, 5)) {
        let finalUrl = path.href.startsWith('http') ? path.href : activeDirUrl + path.href;
        finalUrl = finalUrl.replace(/([^:]\/)\/+/g, "$1");

        const streamUrl = await resolveFinalUrl(finalUrl);

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
        return await invokeDahmerMovies(title, year, seasonNum, episodeNum);
    } catch (e) { return []; }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
else global.getStreams = getStreams;
