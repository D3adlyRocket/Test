// Dahmer Movies Scraper - Optimized for Mobile/TV
// React Native compatible

console.log('[DahmerMovies] Initializing Scraper');

// Constants
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';
const TIMEOUT = 15000; // 15 seconds for fetching, redirects might take longer

// Quality mapping
const Qualities = {
    Unknown: 0,
    P144: 144, P240: 240, P360: 360, P480: 480,
    P720: 720, P1080: 1080, P1440: 1440, P2160: 2160
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
    const requestOptions = {
        timeout: TIMEOUT,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Connection': 'keep-alive',
            ...options.headers
        },
        ...options
    };

    return fetch(url, requestOptions).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
    });
}

/**
 * CRITICAL: This resolves the redirector links to actual playable MP4/MKV files.
 * Without this, the player gets a HTML page or a 302 instead of a stream.
 */
async function resolveFinalUrl(startUrl) {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
    try {
        const response = await fetch(startUrl, {
            method: 'HEAD',
            redirect: 'follow', // Automatically follow redirects
            headers: { 
                'User-Agent': userAgent, 
                'Referer': DAHMER_MOVIES_API + '/' 
            }
        });
        return response.url; // Returns the final destination URL
    } catch (e) {
        return startUrl; // Fallback to original if HEAD fails
    }
}

// Utility functions
function getEpisodeSlug(season, episode) {
    const s = season < 10 ? `0${season}` : `${season}`;
    const e = episode < 10 ? `0${episode}` : `${episode}`;
    return [s, e];
}

function getIndexQuality(str) {
    if (!str) return 0;
    const match = str.match(/(\d{3,4})[pP]/);
    return match ? parseInt(match[1]) : 0;
}

function getQualityWithCodecs(str) {
    if (!str) return 'Unknown';
    const match = str.match(/(\d{3,4})[pP]/);
    let base = match ? `${match[1]}p` : '1080p';
    const codecs = [];
    if (/dv|dolby vision/i.test(str)) codecs.push('DV');
    if (/hdr10\+/i.test(str)) codecs.push('HDR10+');
    else if (/hdr/i.test(str)) codecs.push('HDR');
    if (/remux/i.test(str)) codecs.push('REMUX');
    return codecs.length > 0 ? `${base} | ${codecs.join(' | ')}` : base;
}

function parseLinks(html) {
    const links = [];
    const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
        const content = rowMatch[1];
        const linkMatch = content.match(/<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/i);
        if (!linkMatch) continue;

        const href = linkMatch[1];
        const text = linkMatch[2].trim();
        if (!text || href === '../' || text === '../') continue;

        let size = null;
        const sizeMatch = content.match(/<td[^>]*data-sort=["']?(\d+)["']?/i) || 
                          content.match(/(\d+(?:\.\d+)?\s*(?:GB|MB|KB|B))/i);
        if (sizeMatch) size = sizeMatch[1];

        links.push({ text, href, size });
    }
    return links;
}

async function invokeDahmerMovies(title, year, season = null, episode = null) {
    console.log(`[DahmerMovies] Searching for: ${title}`);
    
    // Construct Path
    const cleanTitle = title.replace(/:/g, '');
    const encodedUrl = season === null 
        ? `${DAHMER_MOVIES_API}/movies/${encodeURIComponent(cleanTitle + ' (' + year + ')')}/`
        : `${DAHMER_MOVIES_API}/tvs/${encodeURIComponent(cleanTitle)}/Season ${season}/`;

    try {
        const response = await makeRequest(encodedUrl);
        const html = await response.text();
        const paths = parseLinks(html);

        let filtered = [];
        if (season === null) {
            filtered = paths.filter(p => /(1080p|2160p)/i.test(p.text));
        } else {
            const [s, e] = getEpisodeSlug(season, episode);
            const pattern = new RegExp(`S${s}E${e}`, 'i');
            filtered = paths.filter(p => pattern.test(p.text));
        }

        // Limit to top 3 results to keep TV loading times fast
        const results = [];
        const topPaths = filtered.slice(0, 3);

        for (const path of topPaths) {
            let initialUrl = path.href.startsWith('http') ? path.href : (encodedUrl + path.href);
            
            // Resolve the real link (the bit that makes it play)
            const finalStreamUrl = await resolveFinalUrl(initialUrl);

            results.push({
                name: "DahmerMovies",
                title: path.text,
                url: finalStreamUrl,
                quality: getQualityWithCodecs(path.text),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Android) ExoPlayer', // Better for TV/Mobile players
                    'Referer': DAHMER_MOVIES_API + '/'
                },
                provider: "dahmermovies",
                filename: path.text
            });
        }

        return results.sort((a, b) => getIndexQuality(b.filename) - getIndexQuality(a.filename));
    } catch (error) {
        console.log(`[DahmerMovies] Error: ${error.message}`);
        return [];
    }
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const res = await makeRequest(tmdbUrl);
        const data = await res.json();
        
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);

        return await invokeDahmerMovies(title, year, seasonNum, episodeNum);
    } catch (e) {
        return [];
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
