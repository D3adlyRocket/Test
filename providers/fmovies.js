// Dahmer Movies Scraper - Updated with Custom Description Format
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
                'Referer': DAHMER_MOVIES_API + '/'
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
    
    const folderVariants = season !== null ? [
        `/tvs/${encodeURIComponent(cleanTitle)}/Season%20${season < 10 ? '0' + season : season}/`,
        `/tvs/${encodeURIComponent(cleanTitle)}/Season%20${season}/`
    ] : [`/movies/${encodeURIComponent(cleanTitle + ' (' + year + ')')}/`];

    let html = '';
    let activeDirUrl = '';

    for (const path of folderVariants) {
        const fullDirUrl = DAHMER_MOVIES_API + path;
        const response = await makeRequest(fullDirUrl);
        if (response.ok) {
            html = await response.text();
            activeDirUrl = fullDirUrl;
            break; 
        }
    }

    if (!html) return [];
    
    const paths = parseLinks(html);

    let filteredPaths = paths;
    if (season !== null && episode !== null) {
        const e = episode < 10 ? `0${episode}` : episode;
        const pattern = new RegExp(`E${e}|E${episode}`, 'i');
        filteredPaths = paths.filter(p => pattern.test(p.text));
    }

    const sortedPaths = filteredPaths.sort((a, b) => {
        const a4k = /2160p|4k/i.test(a.text);
        const b4k = /2160p|4k/i.test(b.text);
        return b4k - a4k;
    });

    const results = [];
    for (const path of sortedPaths.slice(0, 5)) {
        let finalUrl;

        if (path.href.startsWith('http')) {
            finalUrl = path.href;
        } else if (path.href.includes('/movies/') || path.href.includes('/tvs/')) {
            finalUrl = DAHMER_MOVIES_API + (path.href.startsWith('/') ? '' : '/') + path.href;
        } else {
            finalUrl = activeDirUrl + path.href;
        }

        finalUrl = finalUrl.replace(/([^:]\/)\/+/g, "$1");
        const streamUrl = await resolveFinalUrl(finalUrl);

        // --- CUSTOM DESCRIPTION LOGIC ---
        const fileName = path.text;
        
        // Regex to extract info from the filename
        const resolution = fileName.match(/\b(2160p|1080p|720p|480p|4k)\b/i)?.[0] || '1080p';
        const language = fileName.match(/\b(Hindi|English|Dual|Multi|Tamil|Telugu)\b/i)?.[0] || 'Multi';
        const size = fileName.match(/\b(\d+(?:\.\d+)?\s?[GM]B)\b/i)?.[0] || 'N/A';
        
        // Clean up remaining text for Extra Info
        let extraInfo = fileName
            .replace(/\.(mkv|mp4|avi|webm)$/i, '')
            .replace(new RegExp(resolution, 'gi'), '')
            .replace(new RegExp(language, 'gi'), '')
            .replace(new RegExp(size, 'gi'), '')
            .replace(/[\[\]()._-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        results.push({
            name: "DahmerMovies",
            title: `${resolution} | ${language} | ${size} | ${extraInfo}`,
            url: streamUrl,
            quality: resolution.toLowerCase(),
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
