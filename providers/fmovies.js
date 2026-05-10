const COMMON_HEADERS = {
    "X-Requested-With": "XMLHttpRequest",
    "Sec-Fetch-Site": "same-origin",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Fetch-Mode": "cors",
    "Accept": "*/*",
    // Matched to your specific browser screenshot for consistency
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
    "Connection": "keep-alive",
    "Referer": "https://www.lookmovie2.to/",
    "Sec-Fetch-Dest": "empty"
};

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[LookMovie2] Request: ${mediaType} ${tmdbId}`);
        
        const title = await getTitleFromTmdb(tmdbId, mediaType);
        const query = encodeURIComponent(title);
        const isShow = mediaType === "tv";
        const searchBase = isShow ? "shows" : "movies";
        
        // 1. Search for the slug
        const searchUrl = `https://www.lookmovie2.to/api/v1/${searchBase}/do-search/?q=${query}`;
        const searchResponse = await fetch(searchUrl, { headers: COMMON_HEADERS });
        const searchJson = await searchResponse.json();
        const resultsArray = searchJson.result || searchJson;

        if (!resultsArray || resultsArray.length === 0) return [];
        const selectedSlug = resultsArray[0].slug;

        // 2. Fetch HTML Page and CAPTURE COOKIES (Critical Fix)
        const pageUrl = `https://www.lookmovie2.to/${searchBase}/play/${selectedSlug}`;
        const pageResponse = await fetch(pageUrl, {
            headers: {
                ...COMMON_HEADERS,
                "Sec-Fetch-Mode": "navigate",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": `https://www.lookmovie2.to/${searchBase}/view/${selectedSlug}`,
                "Sec-Fetch-Dest": "document"
            }
        });

        const htmlInput = await pageResponse.text();
        
        // Extract Set-Cookie from headers to maintain the session
        const rawCookies = pageResponse.headers.get('set-cookie');
        // Clean the cookies (remove 'path=/', 'HttpOnly', etc. for the request header)
        const cookieHeader = rawCookies ? rawCookies.split(',').map(c => c.split(';')[0]).join('; ') : '';

        // 3. Extract Hash and ID
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
            if (!targetId) throw new Error(`Episode S${season}E${episode} not found`);
            accessEndpoint = `episode-access?id_episode=${targetId}`;
        }

        // 4. Final Stream Request WITH COOKIES
        const apiUrl = `https://www.lookmovie2.to/api/v1/security/${accessEndpoint}&hash=${hash}&expires=${expires}`;
        const streamResponse = await fetch(apiUrl, { 
            headers: { 
                ...COMMON_HEADERS, 
                "Referer": pageUrl,
                "Cookie": cookieHeader // Injecting the session cookies here
            } 
        });
        const streamJson = await streamResponse.json();

        if (!streamJson.success || !streamJson.streams) return [];

        let finalStreams = [];
        const availableResolutions = Object.keys(streamJson.streams).filter(k => streamJson.streams[k] !== null);
        
        // Define headers the video player needs to bypass hotlinking protection
        const playerHeaders = {
            "Origin": "https://www.lookmovie2.to",
            "Referer": "https://www.lookmovie2.to/",
            "User-Agent": COMMON_HEADERS["User-Agent"]
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
