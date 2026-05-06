// Dahmer Movies Scraper - Hybrid TV & Mobile Fix
console.log('[DahmerMovies] Initializing Hybrid Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';
const DAHMER_WORKER_API = 'https://p.111477.xyz/bulk?u=';

// Helper for delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function makeRequest(url) {
    try {
        return await fetch(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': DAHMER_MOVIES_API + '/'
            }
        });
    } catch (e) { return { ok: false }; }
}

async function resolveFinalUrl(startUrl) {
    // If it's already a worker link, extract the target first to "clean" it
    let target = startUrl;
    if (startUrl.includes('u=')) {
        target = decodeURIComponent(startUrl.split('u=')[1].split('&')[0]);
    }

    try {
        const response = await fetch(target, {
            method: 'HEAD',
            redirect: 'follow',
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': DAHMER_MOVIES_API + '/'
            }
        });

        if (response.status === 429) {
            console.log('[DahmerMovies] 429 detected during resolve, backing off...');
            return null; // Signals to skip this link
        }

        // Return the resolved URL wrapped in the worker for extra safety
        let resolved = response.url;
        if (!resolved.includes('p.111477.xyz')) {
            resolved = DAHMER_WORKER_API + encodeURIComponent(resolved);
        }
        return resolved;
    } catch (e) { 
        // Fallback: If HEAD fails, manually wrap the target in the worker
        return DAHMER_WORKER_API + encodeURIComponent(target);
    }
}

function parseLinks(html) {
    const links = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
        const rowContent = match[1];
        const linkMatch = rowContent.match(/<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/i);
        const sizeMatch = rowContent.match(/<td[^>]*>(\d+(?:\.\d+)?\s?[KMGT]B)<\/td>/i);

        if (linkMatch) {
            const href = linkMatch[1];
            const text = linkMatch[2].trim();
            const size = sizeMatch ? sizeMatch[1].trim() : 'N/A';
            if (text && href !== '../' && /\.(mkv|mp4|avi|webm|m3u8)$/i.test(text)) {
                links.push({ text, href, size });
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
    const sortedPaths = paths.sort((a, b) => {
        const a4k = /2160p|4k/i.test(a.text);
        const b4k = /2160p|4k/i.test(b.text);
        return b4k - a4k;
    });

    const results = [];
    // We process links one by one with a delay to prevent 429
    for (const path of sortedPaths.slice(0, 5)) {
        await sleep(500); // 0.5s gap between link resolutions

        let rawUrl = path.href.startsWith('http') ? path.href : activeDirUrl + path.href;
        rawUrl = rawUrl.replace(/([^:]\/)\/+/g, "$1");

        const streamUrl = await resolveFinalUrl(rawUrl);
        if (!streamUrl) continue; // Skip if 429 hit during resolution

        const fileName = path.text;
        
        // Language & Format Logic
        let language = "Original"; 
        if (/\b(HIN|TAM|TEL|Multi|Dual|DUB|Multi-Audio|MULTI)\b/i.test(fileName)) language = "Multi Audio";
        else if (/^[a-zA-Z0-9\s?!\-:]+$/.test(title) && /\b(Eng|English)\b/i.test(fileName)) language = "English";

        const formatMatch = fileName.match(/\.(mkv|mp4|m3u8|avi|webm)$/i);
        const fileFormat = formatMatch ? formatMatch[1].toUpperCase() : 'LINK';
        const resolution = fileName.match(/\b(2160p|1080p|720p|4k)\b/i)?.[0] || '1080p';
        const fileSize = path.size !== 'N/A' ? path.size : 'N/A';
        
        let info = fileName.replace(/\.(mkv|mp4|avi|webm|m3u8)$/i, '').replace(/[\[\]()._-]/g, ' ').replace(/\s+/g, ' ').trim();

        results.push({
            name: "DahmerMovies",
            title: `📺 ${resolution}  |  🌐 ${language}  |  💾 ${fileSize}  |  🎞️ ${fileFormat}  |  ℹ️ ${info}`,
            url: streamUrl,
            quality: resolution.toLowerCase(),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': DAHMER_MOVIES_API + '/',
                'Connection': 'keep-alive',
                'Accept': '*/*',
                'Range': 'bytes=0-'
            }
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
