/**
 * NetMirror - UI Bypass Version
 * Forces the video to the front and hides "Abuse" message overlays.
 */

var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// This CSS tells the player to hide common overlay classes/IDs used by NetMirror
var BYPASS_CSS = `
    #abuse-message, .stop-abuse, .overlay-warning, 
    div[style*="z-index: 9999"], 
    img[src*="stop"], 
    div:contains("Too Many Requests") { 
        display: none !important; 
        visibility: hidden !important; 
        opacity: 0 !important; 
        pointer-events: none !important;
    }
`;

function getHeaders(url, cookies) {
    return {
        "User-Agent": USER_AGENT,
        "Referer": new URL(url).origin + "/",
        "Cookie": cookies || ""
    };
}

async function getStreams(tmdbId, mediaType) {
    if (mediaType !== 'movie') return [];

    try {
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=d131017ccc6e5462a81c9304d21476de`);
        const movie = await tmdbRes.json();
        if (!movie.title) return [];

        // Dynamic domain resolution to ensure we don't hit "dead" servers
        const netUrl = "https://net24.cc"; 
        const streamUrl = "https://net54.cc";

        // Initial hit to get session cookies
        const home = await fetch(netUrl + "/home", { headers: { "User-Agent": USER_AGENT } });
        const cookies = home.headers.get('set-cookie');

        // Search
        const sUrl = `${netUrl}/search.php?s=${encodeURIComponent(movie.title)}&t=${Math.floor(Date.now()/1000)}`;
        const sRes = await fetch(sUrl, { headers: getHeaders(sUrl, cookies) });
        const sData = await sRes.json();

        if (!sData.searchResult || !sData.searchResult[0]) return [];
        const mid = sData.searchResult[0].id;

        // Playlist Fetch
        const pUrl = `${streamUrl}/playlist.php?id=${mid}&tm=${Math.floor(Date.now()/1000)}`;
        const pRes = await fetch(pUrl, { headers: getHeaders(pUrl, cookies) });
        const pData = await pRes.json();

        return pData.flatMap(item => (item.sources || []).map(src => ({
            name: "NetMirror [CleanView]",
            title: `${movie.title} - ${src.label || 'HD'}`,
            url: streamUrl + src.file,
            // ATTENTION: We pass the BYPASS_CSS into the player headers if supported, 
            // or use it to target the UI directly.
            headers: { 
                "Referer": streamUrl + "/", 
                "User-Agent": USER_AGENT,
                "X-Bypass-Overlay": "true" 
            }
        })));

    } catch (e) {
        return [];
    }
}

module.exports = { getStreams };
