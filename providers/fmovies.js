const COMMON_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
    "Accept-Language": "en-GB,en-US;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    "Connection": "keep-alive",
};

function getStreams(tmdbId, mediaType, season, episode) {
    const isShow = mediaType === "tv";
    const searchBase = isShow ? "shows" : "movies";

    // 1. Get Title from TMDB
    const tmdbUrl = `https://www.themoviedb.org/${mediaType}/${tmdbId}`;
    
    return fetch(tmdbUrl, { headers: { "User-Agent": COMMON_HEADERS["User-Agent"] } })
        .then(res => res.text())
        .then(html => {
            const titleMatch = html.match(/<title>([^<]+?)(?:\s+\(\d{4}\))?\s+-\s+The Movie Database/);
            if (!titleMatch) throw new Error("TMDB_ERR");
            const query = encodeURIComponent(titleMatch[1].trim());

            // 2. Search LookMovie
            const searchUrl = `https://www.lookmovie2.to/api/v1/${searchBase}/do-search/?q=${query}`;
            return fetch(searchUrl, { headers: COMMON_HEADERS });
        })
        .then(res => res.json())
        .then(searchJson => {
            const results = searchJson.result || searchJson;
            if (!results || !results[0]) return [];
            const slug = results[0].slug;

            // 3. Visit Play Page to get Hash/Expires/Cookie
            const pageUrl = `https://www.lookmovie2.to/${searchBase}/play/${slug}`;
            return fetch(pageUrl, { headers: { ...COMMON_HEADERS, "Sec-Fetch-Dest": "document" } })
                .then(res => {
                    const cookies = res.headers.get('set-cookie') || "";
                    return res.text().then(text => ({ text, cookies, pageUrl }));
                });
        })
        .then(({ text, cookies, pageUrl }) => {
            const hash = (text.match(/hash:\s*["']([^"']+)["']/) || [])[1];
            const expires = (text.match(/expires:\s*(\d+)/) || [])[1];
            if (!hash || !expires) throw new Error("TOKEN_ERR");

            let targetId = "";
            if (!isShow) {
                targetId = (text.match(/id_movie:\s*(\d+)/) || [])[1];
            } else {
                const epBlock = text.match(new RegExp(`{[^{}]*season:\\s*${season}[^{}]*episode:\\s*${episode}[^{}]*id_episode:\\s*(\\d+)[^{}]*}`, 'g'));
                if (epBlock) targetId = epBlock[0].match(/id_episode:\s*(\d+)/)[1];
            }

            if (!targetId) throw new Error("ID_ERR");

            const endpoint = isShow ? `episode-access?id_episode=${targetId}` : `movie-access?id_movie=${targetId}`;
            const apiUrl = `https://www.lookmovie2.to/api/v1/security/${endpoint}&hash=${hash}&expires=${expires}`;

            // 4. Final API Call
            return fetch(apiUrl, {
                headers: {
                    ...COMMON_HEADERS,
                    "Referer": pageUrl,
                    "Cookie": cookies.split(',').map(c => c.split(';')[0]).join('; ')
                }
            });
        })
        .then(res => res.json())
        .then(json => {
            if (!json.success || !json.streams) return [];
            
            return Object.keys(json.streams)
                .filter(res => json.streams[res])
                .map(res => ({
                    name: "LookMovie2",
                    title: `LookMovie • ${res}p`,
                    url: json.streams[res],
                    quality: res + 'p',
                    headers: { "User-Agent": COMMON_HEADERS["User-Agent"], "Referer": "https://www.lookmovie2.to/" }
                })).reverse();
        })
        .catch(err => {
            console.error(`[LM2 Error]: ${err.message}`);
            return [];
        });
}

module.exports = { getStreams };
