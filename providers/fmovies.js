/**
 * NetMirror - Resilient 2026 Version
 * Fixes "No Links Fetched" by resolving dynamic domains and bypassing the UI block.
 */

var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function getStreams(tmdbId, mediaType) {
    if (mediaType !== 'movie') return [];

    try {
        // 1. Get Title
        const tmdb = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=d131017ccc6e5462a81c9304d21476de`).then(res => res.json());
        if (!tmdb.title) return [];

        // 2. Resolve Active Domain (Attempts to find the current live 'netXX' server)
        const init = await fetch("https://netmirror.gg/2/en", { headers: { "User-Agent": USER_AGENT } }).then(res => res.text());
        const domainMatch = init.match(/https:\/\/net(\d+)\.cc/);
        const netNum = domainMatch ? domainMatch[1] : "24"; // Defaults to 24 if scrape fails
        
        const baseUrl = `https://net${netNum}.cc`;
        const streamUrl = `https://net${parseInt(netNum) + 30}.cc`;

        // 3. Get Fresh Session (Mandatory to avoid the 'Stop Abuse' block)
        const homeRes = await fetch(baseUrl + "/home", { headers: { "User-Agent": USER_AGENT } });
        const homeHtml = await homeRes.text();
        
        // Extracting tokens directly from page source
        const tokenMatch = homeHtml.match(/(t_hash|t_hash_t|user_token)\s*[:=]\s*['"]([^'"]+)['"]/g);
        const cookies = tokenMatch ? tokenMatch.map(t => t.replace(/[:=]\s*/, '=').replace(/['"]/g, '')).join('; ') : "";

        // 4. Search
        const sUrl = `${baseUrl}/search.php?s=${encodeURIComponent(tmdb.title)}&t=${Math.floor(Date.now()/1000)}`;
        const searchData = await fetch(sUrl, { 
            headers: { "User-Agent": USER_AGENT, "Cookie": cookies, "Referer": baseUrl + "/" } 
        }).then(res => res.json());

        if (!searchData.searchResult || !searchData.searchResult[0]) return [];
        const mid = searchData.searchResult[0].id;

        // 5. Fetch Playlist
        const pUrl = `${streamUrl}/playlist.php?id=${mid}&tm=${Math.floor(Date.now()/1000)}`;
        const pData = await fetch(pUrl, { 
            headers: { "User-Agent": USER_AGENT, "Cookie": cookies, "Referer": streamUrl + "/" } 
        }).then(res => res.json());

        return pData.flatMap(item => (item.sources || []).map(src => ({
            name: "NetMirror [Fixed]",
            title: `${tmdb.title} - ${src.label || 'HD'}`,
            url: streamUrl + src.file,
            headers: { "Referer": streamUrl + "/", "User-Agent": USER_AGENT }
        })));

    } catch (e) {
        console.error("NetMirror Error:", e.message);
        return [];
    }
}

module.exports = { getStreams };
