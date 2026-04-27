// DahmerMovies Scraper - Movie & TV Integrated
console.log('[DahmerMovies] Initializing scraper');

const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Your working playback logic
function resolveFinalUrl(startUrl) {
    const maxRedirects = 5;
    const referer = 'https://a.111477.xyz/';
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

    function attemptResolve(url, count, retryCount = 0) {
        if (count >= maxRedirects) return Promise.resolve({ url: url.includes('111477.xyz') ? null : url });

        return fetch(url, {
            method: 'HEAD',
            redirect: 'manual',
            headers: { 'User-Agent': userAgent, 'Referer': referer }
        }).then(function (response) {
            if (response.status === 429 && retryCount < 2) {
                return sleep(2000).then(() => attemptResolve(url, count, retryCount + 1));
            }
            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (location) {
                    const nextUrl = location.startsWith('http') ? location : new URL(location, url).href;
                    return attemptResolve(nextUrl, count + 1);
                }
            }
            return url.includes('111477.xyz') ? { url: null } : { url };
        }).catch(() => ({ url: null }));
    }
    return attemptResolve(startUrl, 0);
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
    
    // BUILD THE FOLDER URL
    let folderUrl = "";
    if (season === null) {
        // Movies
        const safeName = `${cleanTitle} (${year})`.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
        folderUrl = `${DAHMER_MOVIES_API}/movies/${safeName}/`;
    } else {
        // TV Shows - Fixed folder structure
        const sPad = season < 10 ? `0${season}` : season;
        const safeTitle = cleanTitle.replace(/ /g, '%20');
        folderUrl = `${DAHMER_MOVIES_API}/tvs/${safeTitle}/Season%20${sPad}/`;
    }

    try {
        const res = await fetch(folderUrl);
        if (!res.ok) return [];
        
        const html = await res.text();
        const paths = parseLinks(html);

        // Sort: 4K Priority
        paths.sort((a, b) => /2160p|4k/i.test(b.text) - /2160p|4k/i.test(a.text));

        const results = [];
        for (const path of paths) {
            // If it's a TV show, only pick the requested episode
            if (season !== null && episode !== null) {
                const ePad = episode < 10 ? `0${episode}` : episode;
                const pattern = new RegExp(`E${ePad}|E${episode}`, 'i');
                if (!pattern.test(path.text)) continue;
            }

            if (results.length >= 3) break;

            const fullUrl = (folderUrl + path.href).replace(/([^:]\/)\/+/g, "$1");
            const resolved = await resolveFinalUrl(fullUrl);

            if (resolved.url) {
                results.push({
                    name: "DahmerMovies",
                    title: path.text,
                    url: resolved.url,
                    quality: /2160p|4k/i.test(path.text) ? '2160p' : '1080p',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Android) ExoPlayer',
                        'Referer': DAHMER_MOVIES_API + '/'
                    }
                });
            }
        }
        return results;
    } catch (e) { return []; }
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);

        return await invokeDahmerMovies(title, year, seasonNum, episodeNum);
    } catch (e) { return []; }
}

if (typeof module !== 'undefined') module.exports = { getStreams };
else global.getStreams = getStreams;
