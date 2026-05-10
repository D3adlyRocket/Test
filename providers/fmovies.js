const COMMON_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
};

async function getTitleFromTmdb(tmdbId, mediaType) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `https://www.themoviedb.org/${type}/${tmdbId}`;
    const response = await fetch(url, { headers: { "User-Agent": COMMON_HEADERS["User-Agent"] } });
    const html = await response.text();
    const titleMatch = html.match(/<title>([^<]+?)(?:\s+\(\d{4}\))?\s+-\s+The Movie Database/);
    if (!titleMatch) throw new Error("TMDB Title extraction failed");
    return titleMatch[1].trim();
}

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const title = await getTitleFromTmdb(tmdbId, mediaType);
        const query = encodeURIComponent(title);
        const isShow = mediaType === "tv";
        const searchBase = isShow ? "shows" : "movies";

        // 1. Search for Slug
        const searchUrl = `https://www.lookmovie2.to/api/v1/${searchBase}/do-search/?q=${query}`;
        const searchRes = await fetch(searchUrl, { 
            headers: { ...COMMON_HEADERS, "X-Requested-With": "XMLHttpRequest" } 
        });
        const searchJson = await searchRes.json();
        const resultsArray = searchJson.result || searchJson;
        if (!resultsArray || resultsArray.length === 0) return [];
        const selectedSlug = resultsArray[0].slug;

        // 2. Load Play Page to Get Session & Tokens
        const pageUrl = `https://www.lookmovie2.to/${searchBase}/play/${selectedSlug}`;
        const pageRes = await fetch(pageUrl, {
            headers: {
                ...COMMON_HEADERS,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin"
            }
        });

        const html = await pageRes.text();
        
        // SESSION EXTRACTION: Capture Cookies from the Page Load
        const rawCookies = pageRes.headers.get('set-cookie');
        const cookieHeader = rawCookies ? rawCookies.split(',').map(c => c.split(';')[0]).join('; ') : '';

        // 3. Token Extraction
        const hashMatch = html.match(/hash:\s*["']([^"']+)["']/);
        const expiresMatch = html.match(/expires:\s*(\d+)/);
        if (!hashMatch || !expiresMatch) throw new Error("Security tokens missing from HTML");

        const hash = hashMatch[1];
        const expires = expiresMatch[1];
        let targetId = null;
        let accessEndpoint = "";

        if (!isShow) {
            const idMatch = html.match(/id_movie:\s*(\d+)/);
            if (!idMatch) throw new Error("ID not found");
            targetId = idMatch[1];
            accessEndpoint = `movie-access?id_movie=${targetId}`;
        } else {
            const epBlocks = html.match(/{[^{}]*id_episode:\s*\d+[^{}]*}/g) || [];
            for (let block of epBlocks) {
                if (block.includes(`season: ${season}`) && block.includes(`episode: ${episode}`)) {
                    const idEpMatch = block.match(/id_episode:\s*(\d+)/);
                    if (idEpMatch) targetId = idEpMatch[1];
                    break;
                }
            }
            if (!targetId) throw new Error(`S${season}E${episode} not found`);
            accessEndpoint = `episode-access?id_episode=${targetId}`;
        }

        // 4. Final API Request
        const apiUrl = `https://www.lookmovie2.to/api/v1/security/${accessEndpoint}&hash=${hash}&expires=${expires}`;
        const streamRes = await fetch(apiUrl, {
            headers: {
                ...COMMON_HEADERS,
                "X-Requested-With": "XMLHttpRequest",
                "Referer": pageUrl,
                "Cookie": cookieHeader, // Critical: Uses the cookie from Step 2
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin"
            }
        });

        const streamJson = await streamRes.json();
        if (!streamJson.success || !streamJson.streams) return [];

        // 5. Format Output for Nuvio
        return Object.keys(streamJson.streams)
            .filter(res => streamJson.streams[res] !== null)
            .map(res => ({
                name: "LookMovie2",
                title: `LookMovie • ${res.includes('p') ? res : res + 'p'}`,
                url: streamJson.streams[res],
                quality: res.includes('p') ? res : res + 'p',
                headers: {
                    "User-Agent": COMMON_HEADERS["User-Agent"],
                    "Referer": "https://www.lookmovie2.to/",
                    "Origin": "https://www.lookmovie2.to"
                }
            })).reverse();

    } catch (err) {
        console.error(`[LookMovie2] ${err.message}`);
        return [];
    }
}

module.exports = { getStreams };
