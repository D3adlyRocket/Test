// Dahmer Movies Scraper - Universal Smart Search Fix
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
    const cleanTitle = title.replace(/:/g, '').toLowerCase();
    let activeDirUrl = '';
    let html = '';

    if (season === null) {
        // --- MOVIE LOGIC ---
        const folderPath = `/movies/${encodeURIComponent(title.replace(/:/g, '') + ' (' + year + ')')}/`;
        activeDirUrl = DAHMER_MOVIES_API + folderPath;
        const response = await makeRequest(activeDirUrl);
        if (response.ok) html = await response.text();
    } else {
        // --- SMART TV LOGIC (Fixes Daredevil & Paradise) ---
        const tvRootRes = await makeRequest(DAHMER_MOVIES_API + '/tvs/');
        if (!tvRootRes.ok) return [];
        const rootHtml = await tvRootRes.text();
        
        // Find folder that CONTAINS the title (handles "Daredevil - Born Again" & "Paradise (2025)")
        const folderRegex = /<a href="([^"]*)\/"[^>]*>([^<]*)<\/a>/gi;
        let showFolder = '';
        let folderMatch;
        
        while ((folderMatch = folderRegex.exec(rootHtml)) !== null) {
            const folderHref = folderMatch[1];
            const folderName = folderMatch[2].toLowerCase();
            if (folderName.includes(cleanTitle)) {
                showFolder = folderHref;
                break;
            }
        }

        if (!showFolder) showFolder = encodeURIComponent(title.replace(/:/g, ''));

        // Try Season variations
        const sPad = season < 10 ? '0' + season : season;
        const seasonVariants = [`Season%20${season}`, `Season%20${sPad}`];

        for (const sVar of seasonVariants) {
            const tryUrl = `${DAHMER_MOVIES_API}/tvs/${showFolder}/${sVar}/`.replace(/([^:]\/)\/+/g, "$1");
            const response = await makeRequest(tryUrl);
            if (response.ok) {
                html = await response.text();
                activeDirUrl = tryUrl;
                break;
            }
        }
    }

    if (!html) return [];
    
    const paths = parseLinks(html);
    let filteredPaths = paths;

    if (season !== null && episode !== null) {
        const e = episode < 10 ? `0${episode}` : episode;
        // Robust pattern: Matches S01E01, E01, Episode 01, or just " 01 "
        const pattern = new RegExp(`E${e}|E${episode}|Episode\\s${episode}|[\\s-]${e}[\\s\\.]`, 'i');
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
