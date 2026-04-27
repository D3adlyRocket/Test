// DahmerMovies Scraper - Final Integrated Fix
console.log('[DahmerMovies] Initializing Dahmer Movies scraper');

const TMDB_API_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';
const RETRY_MS = 7500;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// THE WORKER RESOLVER (Your confirmed working playback logic)
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
                return sleep(RETRY_MS).then(() => attemptResolve(url, count, retryCount + 1));
            }
            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (location) {
                    const nextUrl = location.startsWith('http') ? location : new URL(location, url).href;
                    return attemptResolve(nextUrl, count + 1);
                }
            }
            // Only return if it's NOT the restricted domain
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
    
    // TV SHOW & MOVIE FOLDER LOGIC
    let folderUrl = "";
    if (season === null) {
        const safeName = `${cleanTitle} (${year})`.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
        folderUrl = `${DAHMER_MOVIES_API}/movies/${safeName}/`;
    } else {
        const sPad = season < 10 ? `0${season}` : season;
        const safeName = cleanTitle.replace(/ /g, '%20');
        folderUrl = `${DAHMER_MOVIES_API}/tvs/${safeName}/Season%20${sPad}/`;
    }

    try {
        const res = await fetch(folderUrl);
        if (!res.ok) return [];
        const html = await res.text();
        const paths = parseLinks(html);

        // Filter for specific TV episodes (S01E01)
        let filtered = paths;
        if (season !== null && episode !== null) {
            const s = season < 10 ? `0${season}` : season;
            const e = episode < 10 ? `0${episode}` : episode;
            const pattern = new RegExp(`S${s}E${e}|E${e}`, 'i');
            filtered = paths.filter(p => pattern.test(p.text));
        }

        // Sort 4K first
        filtered.sort((a, b) => /2160p|4k/i.test(b.text) - /2160p|4k/i.test(a.text));

        const results = [];
        for (const path of filtered.slice(0, 5)) {
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
                    },
                    provider: "dahmermovies"
                });
            }
        }
        return results;
    } catch (e) { return []; }
}

function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    
    return fetch(tmdbUrl).then(res => res.json()).then(data => {
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);
        return invokeDahmerMovies(title, year, seasonNum, episodeNum);
    }).catch(() => []);
}

if (typeof module !== 'undefined') module.exports = { getStreams };
else global.getStreams = getStreams;
