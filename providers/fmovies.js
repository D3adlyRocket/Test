const COMMON_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    "X-Requested-With": "XMLHttpRequest",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Connection": "keep-alive"
};

async function getTitleFromTmdb(tmdbId, mediaType) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `https://www.themoviedb.org/${type}/${tmdbId}`;
    const res = await fetch(url, { headers: { "User-Agent": COMMON_HEADERS["User-Agent"] } });
    const html = await res.text();
    const match = html.match(/<title>([^<]+?)(?:\s+\(\d{4}\))?\s+-\s+The Movie Database/);
    return match ? match[1].trim() : "";
}

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const title = await getTitleFromTmdb(tmdbId, mediaType);
        if (!title) return [];

        const searchBase = mediaType === "tv" ? "shows" : "movies";
        const query = encodeURIComponent(title);

        // 1. Search for the ID/Slug
        const searchRes = await fetch(`https://www.lookmovie2.to/api/v1/${searchBase}/do-search/?q=${query}`, { 
            headers: COMMON_HEADERS 
        });
        const searchData = await searchRes.json();
        const item = (searchData.result || searchData)[0];
        if (!item) return [];

        // 2. Get the Play Page HTML to extract the Hash and Session
        const playUrl = `https://www.lookmovie2.to/${searchBase}/play/${item.slug}`;
        const pageRes = await fetch(playUrl, { headers: COMMON_HEADERS });
        const html = await pageRes.text();
        const cookies = pageRes.headers.get('set-cookie') || "";

        // 3. Precise Extraction based on your screenshots
        const hash = (html.match(/hash:\s*["']([^"']+)["']/) || [])[1];
        const expires = (html.match(/expires:\s*(\d+)/) || [])[1];
        
        let targetId = "";
        if (mediaType === "tv") {
            // Regex to find the specific episode ID in the JS config block
            const epRegex = new RegExp(`id_episode:\\s*(\\d+)[^}]*season:\\s*${season}[^}]*episode:\\s*${episode}`, 's');
            targetId = (html.match(epRegex) || [])[1];
        } else {
            targetId = (html.match(/id_movie:\s*(\d+)/) || [])[1];
        }

        if (!hash || !targetId) return [];

        // 4. Request the actual stream links
        const endpoint = mediaType === "tv" ? `episode-access?id_episode=${targetId}` : `movie-access?id_movie=${targetId}`;
        const apiUrl = `https://www.lookmovie2.to/api/v1/security/${endpoint}&hash=${hash}&expires=${expires}`;

        const streamRes = await fetch(apiUrl, {
            headers: {
                ...COMMON_HEADERS,
                "Referer": playUrl,
                "Cookie": cookies.split(',').map(c => c.split(';')[0]).join('; ')
            }
        });

        const streamData = await streamRes.json();
        if (!streamData.success || !streamData.streams) return [];

        // 5. Map the streams (handling the nulls seen in your screenshot)
        return Object.keys(streamData.streams)
            .filter(res => streamData.streams[res] !== null) 
            .map(res => ({
                name: "LookMovie2",
                title: `LookMovie • ${res}${res.endsWith('p') ? '' : 'p'}`,
                url: streamData.streams[res],
                quality: res.endsWith('p') ? res : res + 'p',
                headers: {
                    "User-Agent": COMMON_HEADERS["User-Agent"],
                    "Referer": "https://www.lookmovie2.to/",
                    "Origin": "https://www.lookmovie2.to"
                }
            })).reverse();

    } catch (err) {
        console.error("LookMovie2 Error: ", err);
        return [];
    }
}

module.exports = { getStreams };
