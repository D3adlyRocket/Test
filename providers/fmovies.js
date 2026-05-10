const COMMON_HEADERS = {
    "X-Requested-With": "XMLHttpRequest",
    "Sec-Fetch-Site": "same-origin",
    "Accept-Language": "en-CA,en-US;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Fetch-Mode": "cors",
    "Accept": "*/*",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    "Connection": "keep-alive",
    "Referer": "https://www.lookmovie2.to/",
    "Sec-Fetch-Dest": "empty"
};

async function fetchText(url, options = {}) {
    console.log(`[LookMovie2] Fetching: ${url}`);
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.text();
}

async function fetchJson(url, options = {}) {
    const raw = await fetchText(url, options);
    return JSON.parse(raw);
}

// Scrape title from TMDB
async function getTitleFromTmdb(tmdbId, mediaType) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `https://www.themoviedb.org/${type}/${tmdbId}`;
    const html = await fetchText(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36" } });
    const titleMatch = html.match(/<title>([^<]+?)(?:\s+\(\d{4}\))?\s+-\s+The Movie Database/);
    if (!titleMatch) throw new Error("Could not extract title from TMDB");
    return titleMatch[1].trim();
}

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[LookMovie2] Request: ${mediaType} ${tmdbId}`);
        
        const title = await getTitleFromTmdb(tmdbId, mediaType);
        const query = encodeURIComponent(title);
        const isShow = mediaType === "tv";
        const searchBase = isShow ? "shows" : "movies";
        
        // Search
        const searchUrl = `https://www.lookmovie2.to/api/v1/${searchBase}/do-search/?q=${query}`;
        const searchJson = await fetchJson(searchUrl, { headers: COMMON_HEADERS });
        const resultsArray = searchJson.result || searchJson;

        if (!resultsArray || resultsArray.length === 0) return [];
        const selectedSlug = resultsArray[0].slug;

        // Fetch HTML Page
        const pageUrl = `https://www.lookmovie2.to/${searchBase}/play/${selectedSlug}`;
        const htmlInput = await fetchText(pageUrl, {
            headers: {
                ...COMMON_HEADERS,
                "Sec-Fetch-Mode": "navigate",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": `https://www.lookmovie2.to/${searchBase}/view/${selectedSlug}`,
                "Sec-Fetch-Dest": "document"
            }
        });

        // Extract Data
        const hashMatch = htmlInput.match(/hash:\s*["']([^"']+)["']/);
        const expiresMatch = htmlInput.match(/expires:\s*(\d+)/);
        if (!hashMatch || !expiresMatch) throw new Error("Hash/Expires not found in HTML.");
        
        const hash = hashMatch[1];
        const expires = expiresMatch[1];
        let targetId = null;
        let accessEndpoint = "";

        if (!isShow) {
            const idMatch = htmlInput.match(/id_movie:\s*(\d+)/);
            if (!idMatch) throw new Error("id_movie not found");
            targetId = idMatch[1];
            accessEndpoint = `movie-access?id_movie=${targetId}`;
        } else {
            const epBlocks = htmlInput.match(/{[^{}]*id_episode:\s*\d+[^{}]*}/g) || [];
            for (let block of epBlocks) {
                let sMatch = block.match(/season:\s*['"]?(\d+)['"]?/);
                let epMatch = block.match(/episode:\s*['"]?(\d+)['"]?/);
                let idEpMatch = block.match(/id_episode:\s*(\d+)/);
                if (sMatch && epMatch && sMatch[1] == season && epMatch[1] == episode) {
                    targetId = idEpMatch[1];
                    break;
                }
            }
            if (!targetId) throw new Error(`Episode S${season}E${episode} not found in HTML`);
            accessEndpoint = `episode-access?id_episode=${targetId}`;
        }

        // Final Stream Request
        const apiUrl = `https://www.lookmovie2.to/api/v1/security/${accessEndpoint}&hash=${hash}&expires=${expires}`;
        const streamJson = await fetchJson(apiUrl, { headers: { ...COMMON_HEADERS, "Referer": pageUrl } });

        if (!streamJson.success || !streamJson.streams) return [];

        let finalStreams = [];
        const availableResolutions = Object.keys(streamJson.streams).filter(k => streamJson.streams[k] !== null);
        
        const playerHeaders = {
            "Sec-Fetch-Site": "cross-site",
            "Accept-Language": "en-CA,en-US;q=0.9,en;q=0.8",
            "Accept-Encoding": "identity",
            "Sec-Fetch-Mode": "cors",
            "Accept": "*/*",
            "Origin": "https://www.lookmovie2.to",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Brave/1 Mobile/15E148 Safari/604.1",
            "Connection": "keep-alive",
            "Referer": "https://www.lookmovie2.to/",
            "Sec-Fetch-Dest": "empty"
        };

        for (let res of availableResolutions) {
            let qualityLabel = res.includes("p") ? res : `${res}p`; 
            finalStreams.push({
                name: "LookMovie2",
                title: `LookMovie • ${qualityLabel}`,
                url: streamJson.streams[res],
                quality: qualityLabel,
                headers: playerHeaders
            });
        }

        return finalStreams.reverse();
    } catch (err) {
        console.error(`[LookMovie2] Error: ${err.message}`);
        return [];
    }
}

module.exports = { getStreams };
