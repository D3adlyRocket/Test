// Dahmer Movies Scraper - 4k Priority & 429 Error Handling
console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function makeRequest(url) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (res.status === 429) throw new Error('429');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
}

async function resolveFinalUrl(startUrl, retryCount = 0) {
    try {
        const response = await fetch(startUrl, {
            method: 'HEAD',
            redirect: 'follow',
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Android) ExoPlayer',
                'Referer': DAHMER_MOVIES_API + '/'
            }
        });
        
        if (response.status === 429 && retryCount < 2) {
            console.log(`[DahmerMovies] 429 detected, waiting 2s...`);
            await sleep(2000); // Wait for server cooldown
            return resolveFinalUrl(startUrl, retryCount + 1);
        }
        
        return response.url;
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
    const variants = [
        season === null ? `${cleanTitle} (${year})` : cleanTitle,
        cleanTitle // Fallback for folders without the year
    ];

    let html = '';
    let usedUrl = '';

    for (const folderName of variants) {
        const dirUrl = season === null 
            ? `${DAHMER_MOVIES_API}/movies/${encodeURIComponent(folderName)}/`
            : `${DAHMER_MOVIES_API}/tvs/${encodeURIComponent(folderName)}/Season ${season}/`;
        
        try {
            const res = await makeRequest(dirUrl);
            html = await res.text();
            usedUrl = dirUrl;
            if (html.includes('<tr')) break;
        } catch (e) { continue; }
    }

    if (!html) return [];

    const paths = parseLinks(html);
    
    // PRIORITY: Separate 4k and 1080p
    const p2160 = paths.filter(p => /2160p|4k/i.test(p.text));
    const p1080 = paths.filter(p => /1080p/i.test(p.text));
    
    // Process 4k first, then 1080p up to a total of 5 links
    const toProcess = [...p2160, ...p1080].slice(0, 5);
    const results = [];

    for (const path of toProcess) {
        let absoluteUrl = path.href.startsWith('http') ? path.href : 
                         (path.href.startsWith('/') ? new URL(DAHMER_MOVIES_API).origin + path.href : usedUrl + path.href);
        
        absoluteUrl = absoluteUrl.replace(/([^:]\/)\/+/g, "$1");

        const finalStreamUrl = await resolveFinalUrl(absoluteUrl);

        results.push({
            name: "DahmerMovies",
            title: path.text,
            url: finalStreamUrl,
            quality: /2160p|4k/i.test(path.text) ? '2160p' : '1080p',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Android) ExoPlayer',
                'Referer': DAHMER_MOVIES_API + '/'
            },
            provider: "dahmermovies"
        });
        
        // Brief pause between link resolutions to prevent 429
        await sleep(300); 
    }
    return results;
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        const res = await makeRequest(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);
        return await invokeDahmerMovies(title, year, seasonNum, episodeNum);
    } catch (e) { return []; }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
else global.getStreams = getStreams;
